import 'server-only';

/**
 * Leads arriving by themselves (lead intake, 21 Oct 2026;
 * docs/studio-os/LEAD-INTAKE.md): Meta lead ads, Google Ads lead forms, the
 * studio's website, and portals or WhatsApp tools posting to a webhook.
 *
 * ## No session, like capture.ts
 *
 * Every caller here is a machine on the internet. The studio comes from the
 * door it hit (a connection id in the path, or a Facebook Page id Meta
 * names), and the door is opened by a key (generic, Google) or Meta's
 * signature. What a caller can do is exactly what `land.ts` does: create one
 * lead in that studio's intake column, or add a line to the lead already
 * there with that phone. Nothing is read back to the caller beyond "taken".
 *
 * ## Each lead once (ported from AxLeads, lib/db/routing.ts)
 *
 * Every incoming lead is first CLAIMED: a StudioLeadIntakeEvent row, unique
 * on the door and the sender's id for it. A retry of the same lead hits the
 * unique index and stops (`onSeenAgain`): landed means never again, failed
 * means try again, and a claim stranded by a function that died mid-work is
 * released after ten minutes. The claim is then settled LANDED (a new lead),
 * DUPLICATE (added to the lead with that phone), or FAILED with a reason the
 * owner reads on Settings → Lead sources.
 *
 * ## Ack fast, then work (Meta, Google)
 *
 * Meta and Google retry a slow answer, so their routes verify, claim and
 * answer 200 at once, and the Graph fetch and the insert run in `after()`.
 * The generic door works inline: a website form has a person waiting, and
 * telling them "received" before the row exists would be a lie (capture.ts
 * makes the same call).
 *
 * ## Nothing secret is logged
 *
 * Page tokens, the app secret and door keys never reach a log line or an
 * event's error text, and no lead's answers are logged either (a log is not
 * where a stranger's phone number belongs). Unmatched Meta pages are logged
 * by page id, which is public.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { consume, bucketFor, type Limit } from '@/modules/rate-limit/store';
import { landLead, leadSourceIdFor } from '@/modules/studio-practice/land';
import { fallbackExternalId, secretMatches, verifyMetaSignature } from './secrets';
import {
  adColumns,
  attributionFor,
  graphError,
  graphLeadUrl,
  onSeenAgain,
  parseGeneric,
  parseGoogle,
  parseMetaLead,
  parseMetaWebhook,
  parsePageTokens,
  shapeLead,
  type ConnectionKindName,
  type IncomingLead,
  type IntakeStatusName,
} from './payloads';

/** One sender, any door: generous, because a portal posts every lead from one server. */
export const PER_ADDRESS: Limit = { max: 300, windowMs: 60 * 60 * 1000 };
/** One door, from everybody. Far above what a studio receives; a script reaches it in seconds. */
export const PER_DOOR: Limit = { max: 600, windowMs: 60 * 60 * 1000 };

export interface Door {
  id: string;
  studioId: string;
  studioSlug: string;
  studioActive: boolean;
  kind: ConnectionKindName;
  label: string;
  enabled: boolean;
  secretHash: string;
  metaPageId: string | null;
}

/** What a route answers: the status and the JSON body. */
export interface Reply {
  status: number;
  body: Record<string, unknown>;
}

const DOOR_SELECT = {
  id: true,
  studioId: true,
  kind: true,
  label: true,
  enabled: true,
  secretHash: true,
  metaPageId: true,
  studio: { select: { slug: true, status: true } },
} satisfies Prisma.StudioLeadConnectionSelect;

type DoorRow = Prisma.StudioLeadConnectionGetPayload<{ select: typeof DOOR_SELECT }>;

function toDoor(row: DoorRow): Door {
  return {
    id: row.id,
    studioId: row.studioId,
    studioSlug: row.studio.slug,
    studioActive: row.studio.status === 'ACTIVE',
    kind: row.kind,
    label: row.label,
    enabled: row.enabled,
    secretHash: row.secretHash,
    metaPageId: row.metaPageId,
  };
}

/** A connection id is a cuid. Anything else is not looked up. */
const isDoorId = (v: string): boolean => /^[a-z0-9]{8,40}$/i.test(v);

async function doorById(id: string): Promise<Door | null> {
  if (!isDoorId(id)) return null;
  const row = await prisma.studioLeadConnection.findUnique({ where: { id }, select: DOOR_SELECT });
  return row ? toDoor(row) : null;
}

async function doorByPage(pageId: string): Promise<Door | null> {
  const row = await prisma.studioLeadConnection.findUnique({ where: { metaPageId: pageId }, select: DOOR_SELECT });
  return row && row.kind === 'META_PAGE' ? toDoor(row) : null;
}

// ── Claiming and settling ──────────────────────────────────────

/**
 * Claim one lead for one door. The event id when this request should land
 * it; null when another request has it or already landed it.
 */
async function claim(doorId: string, externalId: string, isTest: boolean): Promise<string | null> {
  const ext = externalId.slice(0, 160);
  try {
    const made = await prisma.studioLeadIntakeEvent.create({
      data: { connectionId: doorId, externalId: ext, isTest },
      select: { id: true },
    });
    await prisma.studioLeadConnection.update({
      where: { id: doorId },
      data: { lastEventAt: new Date(), eventCount: { increment: 1 } },
    });
    return made.id;
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
  }

  const seen = await prisma.studioLeadIntakeEvent.findUnique({
    where: { connectionId_externalId: { connectionId: doorId, externalId: ext } },
    select: { id: true, status: true, updatedAt: true },
  });
  if (!seen || onSeenAgain(seen, new Date()) === 'skip') return null;

  /* Re-arming in the statement that tests it: two retries arriving together
     both read the old row, but only one update matches it. */
  const { count } = await prisma.studioLeadIntakeEvent.updateMany({
    where: { id: seen.id, status: seen.status, updatedAt: seen.updatedAt },
    data: { status: 'RECEIVED', error: null },
  });
  return count === 1 ? seen.id : null;
}

async function settle(eventId: string, status: IntakeStatusName, extra: { clientId?: string; error?: string } = {}): Promise<void> {
  try {
    await prisma.studioLeadIntakeEvent.update({
      where: { id: eventId },
      data: { status, clientId: extra.clientId ?? null, error: extra.error ? extra.error.slice(0, 300) : null },
    });
  } catch (error) {
    /* Bookkeeping never throws over the failure it is recording. */
    console.error('[intake] settle failed', eventId, error instanceof Error ? error.message : error);
  }
}

export type Outcome = 'landed' | 'duplicate' | 'failed' | 'test';

/**
 * Land one claimed lead and settle its claim. Never throws: every failure
 * becomes a FAILED event with a reason.
 */
async function landClaimed(door: Door, eventId: string, incoming: IncomingLead): Promise<{ outcome: Outcome; error?: string }> {
  const fail = async (error: string) => {
    await settle(eventId, 'FAILED', { error });
    return { outcome: 'failed' as const, error };
  };

  if (!door.studioActive) return fail('Your studio is paused on One Interiors, so leads are not being taken.');

  /* A test (Google's "Send test data", or `is_test` on a generic post) is
     recorded so the owner can see the door works, and never put on the
     board: a fake card in the pool would be rung by somebody. */
  if (incoming.isTest) {
    await settle(eventId, 'LANDED');
    return { outcome: 'test' };
  }

  const shaped = shapeLead(incoming);
  if (!shaped.ok) return fail(shaped.error);
  const { draft } = shaped;

  try {
    const where = attributionFor(door.kind, door.label, incoming);
    const leadSourceId = where.leadSourceName ? await leadSourceIdFor(door.studioId, where.leadSourceName) : null;
    const said = draft.notes ? `: “${draft.notes.slice(0, 300)}”` : '';
    const landed = await landLead({
      studioId: door.studioId,
      lead: {
        name: draft.name,
        phone: draft.phone,
        email: draft.email,
        locality: draft.locality,
        society: draft.society,
        city: draft.city,
        config: draft.config,
        budgetPaise: draft.budgetPaise,
        notes: draft.notes,
      },
      source: where.source,
      leadSourceId,
      sourceNote: leadSourceId || !where.leadSourceName ? where.sourceNote : `${where.leadSourceName} · ${where.sourceNote}`.slice(0, 200),
      how: where.how,
      createdSummary: `Came in through ${where.how}`,
      againSummary: `Came in again through ${where.how}${said}`,
      connectionId: door.id,
      ads: adColumns(incoming.ads),
    });
    if (landed.kind === 'no-stage') return fail('Your board has no columns to put the lead in.');
    await settle(eventId, landed.kind === 'created' ? 'LANDED' : 'DUPLICATE', { clientId: landed.clientId });
    await landed.alerted;
    return { outcome: landed.kind === 'created' ? 'landed' : 'duplicate' };
  } catch (error) {
    console.error('[intake] land failed', door.id, error instanceof Error ? error.message : error);
    return fail('The lead could not be saved. It will be tried again if the sender retries.');
  }
}

// ── The generic door: website, portals, WhatsApp tools ─────────

/**
 * POST /api/studio/intake/[connectionId]. `key` is the door's key (header
 * `x-oi-key` or `?key=`), `address` only a rate-limit key (never stored).
 */
export async function takeGeneric(doorId: string, key: string | null, body: unknown, address: string): Promise<Reply> {
  if (!hasDatabase()) return { status: 503, body: { ok: false, error: 'unavailable' } };

  const byAddress = await consume(bucketFor('intake-ip', address), PER_ADDRESS);
  if (!byAddress.allowed) return { status: 429, body: { ok: false, error: 'rate_limited', retryInSeconds: byAddress.retryInSeconds } };

  const door = await doorById(doorId);
  if (!door || (door.kind !== 'WEBSITE' && door.kind !== 'PORTAL')) return { status: 404, body: { ok: false, error: 'not_found' } };
  if (!secretMatches(key, door.secretHash)) return { status: 401, body: { ok: false, error: 'bad_key' } };
  if (!door.enabled) return { status: 403, body: { ok: false, error: 'disabled' } };

  const byDoor = await consume(bucketFor('intake-door', door.id), PER_DOOR);
  if (!byDoor.allowed) return { status: 429, body: { ok: false, error: 'rate_limited', retryInSeconds: byDoor.retryInSeconds } };

  const incoming = parseGeneric(body);
  const o = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  incoming.isTest = o.is_test === true || o.is_test === 'true' || o.test === true || o.test === 'true';

  const identity = incoming.phone ?? incoming.email ?? incoming.name ?? '';
  if (!identity) return { status: 422, body: { ok: false, error: 'No phone number or email in the lead.' } };
  const externalId = incoming.isTest ? `test:${Date.now()}` : (incoming.externalId ?? fallbackExternalId(identity, new Date()));

  const eventId = await claim(door.id, externalId, incoming.isTest);
  if (!eventId) return { status: 200, body: { ok: true, status: 'already_received' } };

  const { outcome, error } = await landClaimed(door, eventId, incoming);
  if (outcome === 'failed') return { status: 422, body: { ok: false, error } };
  return { status: 200, body: { ok: true, status: outcome } };
}

// ── Google Ads lead forms ──────────────────────────────────────

/**
 * POST /api/studio/intake/google/[connectionId]. The door's key is
 * `google_key` in the body (what the owner pasted as the "Key" in Google
 * Ads). Answers at once; `work` (if any) is for `after()`.
 */
export async function takeGoogle(doorId: string, body: unknown): Promise<{ reply: Reply; work?: () => Promise<void> }> {
  if (!hasDatabase()) return { reply: { status: 503, body: { status: 'unavailable' } } };

  const door = await doorById(doorId);
  if (!door || door.kind !== 'GOOGLE_LEAD_FORM') return { reply: { status: 404, body: { error: 'not_found' } } };

  const parsed = parseGoogle(body);
  if (!secretMatches(parsed.googleKey, door.secretHash)) return { reply: { status: 403, body: { error: 'invalid key' } } };
  if (!door.enabled) return { reply: { status: 200, body: { status: 'disabled' } } };

  const byDoor = await consume(bucketFor('intake-door', door.id), PER_DOOR);
  if (!byDoor.allowed) return { reply: { status: 429, body: { error: 'rate_limited' } } };

  /* Google's "Send test data" reuses one id for every test, so a test gets
     its own: otherwise only the first test would ever show. */
  const identity = parsed.lead.phone ?? parsed.lead.email ?? parsed.lead.name ?? 'google';
  const externalId = parsed.isTest ? `test:${Date.now()}` : parsed.leadId ? `g:${parsed.leadId}` : fallbackExternalId(identity, new Date());

  const eventId = await claim(door.id, externalId, parsed.isTest);
  if (!eventId) return { reply: { status: 200, body: { status: 'ok', deduped: true } } };

  return {
    reply: { status: 200, body: { status: 'ok' } },
    work: async () => {
      await landClaimed(door, eventId, parsed.lead);
    },
  };
}

// ── Meta lead ads ──────────────────────────────────────────────

/**
 * POST /api/studio/intake/meta. Always answered 200 by the route: Meta
 * retries anything else, and a retry storm helps nobody. Returns the work for
 * `after()`: one Graph fetch and landing per new lead.
 */
export async function takeMeta(rawBody: string, signature: string | null): Promise<(() => Promise<void>)[]> {
  if (!hasDatabase()) return [];

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return [];
  }

  const appSecret = process.env.META_APP_SECRET?.trim();
  const signed = appSecret ? verifyMetaSignature(rawBody, signature, appSecret) : false;
  if (appSecret && !signed) {
    console.warn('[intake/meta] signature did not match; ignored');
    return [];
  }

  const work: (() => Promise<void>)[] = [];
  for (const ref of parseMetaWebhook(body)) {
    const door = await doorByPage(ref.pageId);
    if (!door) {
      /* Visible rather than a silent drop: a page Meta sends us that no
         studio has added (the page id is public, nothing else is logged). */
      console.warn('[intake/meta] no studio has page', ref.pageId);
      continue;
    }
    if (!door.enabled) continue;

    const eventId = await claim(door.id, ref.leadgenId, false);
    if (!eventId) continue;

    if (!appSecret) {
      /* Unsigned and unverifiable: nothing is fetched or landed, but the
         owner sees on Settings why their ads are not arriving. */
      console.error('[intake/meta] META_APP_SECRET is not set');
      await settle(eventId, 'FAILED', { error: 'One Interiors has not been given the Meta app secret yet (META_APP_SECRET), so this lead could not be checked.' });
      continue;
    }

    work.push(() => fetchAndLandMeta(door, eventId, ref.leadgenId).then(() => undefined));
  }
  return work;
}

/** Fetch one lead from Graph with the page's token, and land it. */
async function fetchAndLandMeta(door: Door, eventId: string, leadgenId: string): Promise<{ outcome: Outcome; error?: string }> {
  const fail = async (error: string) => {
    await settle(eventId, 'FAILED', { error });
    return { outcome: 'failed' as const, error };
  };

  const pageId = door.metaPageId;
  if (!pageId) return fail('This connection has no Facebook Page id.');
  const tokens = parsePageTokens(process.env.STUDIO_META_PAGE_TOKENS);
  const entry = tokens.get(pageId);
  if (!entry) return fail(`One Interiors has no page token for page ${pageId} yet (STUDIO_META_PAGE_TOKENS).`);
  if (entry.studio && entry.studio !== door.studioSlug) return fail(`Page ${pageId} is set up for a different studio on One Interiors.`);

  let graph: unknown;
  try {
    const res = await fetch(graphLeadUrl(leadgenId), {
      headers: { authorization: `Bearer ${entry.token}` },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });
    graph = await res.json().catch(() => null);
    if (!res.ok) return fail(graphError(graph, res.status));
  } catch (error) {
    console.error('[intake/meta] graph fetch failed', leadgenId, error instanceof Error ? error.name : 'error');
    return fail('Meta could not be reached to fetch the lead. Use "Try again" below.');
  }

  return landClaimed(door, eventId, parseMetaLead(graph));
}

/**
 * Try a failed Meta lead again (the owner's button on Settings). Meta does
 * not resend a lead we answered 200 for, so without this a lead that failed
 * because a token was missing would be lost for good. Studio-scoped by the
 * caller (`connections.ts`).
 */
export async function retryMetaEvent(studioId: string, eventId: string): Promise<{ ok: true; outcome: Outcome } | { ok: false; error: string }> {
  const event = await prisma.studioLeadIntakeEvent.findFirst({
    where: { id: eventId, status: 'FAILED', connection: { studioId, kind: 'META_PAGE' } },
    select: { id: true, externalId: true, connectionId: true, status: true, updatedAt: true },
  });
  if (!event) return { ok: false, error: 'That lead is not one that can be tried again.' };
  const door = await doorById(event.connectionId);
  if (!door) return { ok: false, error: 'That connection has been removed.' };
  const { count } = await prisma.studioLeadIntakeEvent.updateMany({
    where: { id: event.id, status: 'FAILED', updatedAt: event.updatedAt },
    data: { status: 'RECEIVED', error: null },
  });
  if (count !== 1) return { ok: false, error: 'It is already being tried. Reload in a moment.' };
  const { outcome, error } = await fetchAndLandMeta(door, event.id, event.externalId);
  return outcome === 'failed' ? { ok: false, error: error ?? 'It failed again.' } : { ok: true, outcome };
}
