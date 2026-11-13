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
import { BACKFILL_DAYS, GRAPH, afterCursor, campaignAllowed, campaignKey, formLeadsUrl, readForms, readLeadPage, sealingKey, unseal } from './meta-connect';
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
  /** "Connect Facebook": the Page token, sealed. Null: env STUDIO_META_PAGE_TOKENS. */
  metaTokenSealed: string | null;
  /** Which campaigns (owner, 12 Nov 2026). */
  metaOnlyCampaigns: boolean;
  metaCampaignIds: string[];
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
  metaTokenSealed: true,
  metaOnlyCampaigns: true,
  metaCampaignIds: true,
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
    metaTokenSealed: row.metaTokenSealed,
    metaOnlyCampaigns: row.metaOnlyCampaigns,
    metaCampaignIds: row.metaCampaignIds ?? [],
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

interface SettleExtra {
  clientId?: string;
  error?: string;
  /** The Meta campaign (owner, 12 Nov 2026), kept whatever the outcome. */
  campaign?: { id: string; name: string | null };
}

async function settle(eventId: string, status: IntakeStatusName, extra: SettleExtra = {}): Promise<void> {
  try {
    await prisma.studioLeadIntakeEvent.update({
      where: { id: eventId },
      data: {
        status,
        clientId: extra.clientId ?? null,
        error: extra.error ? extra.error.slice(0, 300) : null,
        ...(extra.campaign ? { campaignId: extra.campaign.id, campaignName: extra.campaign.name?.slice(0, 160) ?? null } : {}),
      },
    });
  } catch (error) {
    /* Bookkeeping never throws over the failure it is recording. */
    console.error('[intake] settle failed', eventId, error instanceof Error ? error.message : error);
  }
}

export type Outcome = 'landed' | 'duplicate' | 'failed' | 'test' | 'skipped';

interface LandOptions {
  /** Past leads: nobody told, no "came in again" line (`landLead`). */
  quiet?: boolean;
  campaign?: SettleExtra['campaign'];
}

/**
 * Land one claimed lead and settle its claim. Never throws: every failure
 * becomes a FAILED event with a reason.
 */
async function landClaimed(door: Door, eventId: string, incoming: IncomingLead, opts: LandOptions = {}): Promise<{ outcome: Outcome; error?: string }> {
  const { campaign } = opts;
  const fail = async (error: string) => {
    await settle(eventId, 'FAILED', { error, campaign });
    return { outcome: 'failed' as const, error };
  };

  if (!door.studioActive) return fail('Your studio is paused on One Interiors, so leads are not being taken.');

  /* A test (Google's "Send test data", or `is_test` on a generic post) is
     recorded so the owner can see the door works, and never put on the
     board: a fake card in the pool would be rung by somebody. */
  if (incoming.isTest) {
    await settle(eventId, 'LANDED', { campaign });
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
      quiet: opts.quiet === true,
    });
    if (landed.kind === 'no-stage') return fail('Your board has no columns to put the lead in.');
    await settle(eventId, landed.kind === 'created' ? 'LANDED' : 'DUPLICATE', { clientId: landed.clientId, campaign });
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

/**
 * The Page's token: the one sealed on the connection by "Connect Facebook",
 * else env STUDIO_META_PAGE_TOKENS (set by One Interiors before 12 Nov 2026).
 */
function pageTokenFor(door: Door): { token: string } | { error: string } {
  const pageId = door.metaPageId;
  if (!pageId) return { error: 'This connection has no Facebook Page id.' };
  if (door.metaTokenSealed) {
    const token = unseal(door.metaTokenSealed, sealingKey());
    return token ? { token } : { error: 'The Facebook connection needs renewing: press Connect Facebook again.' };
  }
  const entry = parsePageTokens(process.env.STUDIO_META_PAGE_TOKENS).get(pageId);
  if (!entry) return { error: 'This Page is not connected to Facebook yet: press Connect Facebook.' };
  if (entry.studio && entry.studio !== door.studioSlug) return { error: `Page ${pageId} is set up for a different studio on One Interiors.` };
  return { token: entry.token };
}

/** One Graph GET with the token in a header (never in the URL). */
async function graphGet(url: string, token: string, timeoutMs = 8000): Promise<{ ok: true; body: unknown } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' });
    const body = await res.json().catch(() => null);
    return res.ok ? { ok: true, body } : { ok: false, error: graphError(body, res.status) };
  } catch (error) {
    console.error('[intake/meta] graph unreachable', error instanceof Error ? error.name : 'error');
    return { ok: false, error: 'Meta could not be reached to fetch the lead. Use "Try again" below.' };
  }
}

/**
 * Land one Meta lead Graph has given us, or skip it when its campaign is not
 * one the studio picked (owner, 12 Nov 2026).
 */
async function landMetaLead(door: Door, eventId: string, graph: unknown, quiet: boolean): Promise<{ outcome: Outcome; error?: string }> {
  const incoming = parseMetaLead(graph);
  const campaign = { id: campaignKey(incoming.ads.campaignId), name: incoming.ads.campaignName };
  if (!campaignAllowed({ only: door.metaOnlyCampaigns, ids: door.metaCampaignIds }, incoming.ads.campaignId)) {
    await settle(eventId, 'SKIPPED', { campaign });
    return { outcome: 'skipped' };
  }
  return landClaimed(door, eventId, incoming, { quiet, campaign });
}

/** Fetch one lead from Graph with the page's token, and land it. */
async function fetchAndLandMeta(door: Door, eventId: string, leadgenId: string, quiet = false): Promise<{ outcome: Outcome; error?: string }> {
  const fail = async (error: string) => {
    await settle(eventId, 'FAILED', { error });
    return { outcome: 'failed' as const, error };
  };
  const t = pageTokenFor(door);
  if ('error' in t) return fail(t.error);
  const got = await graphGet(graphLeadUrl(leadgenId), t.token);
  if (!got.ok) return fail(got.error);
  return landMetaLead(door, eventId, got.body, quiet);
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

// ── Past leads and skipped campaigns (owner, 12 Nov 2026) ──────

/** Where "Bring in past leads" stopped: which form, and Graph's cursor in it. */
export interface BackfillCursor {
  form: number;
  after: string | null;
}

export interface BackfillTally {
  landed: number;
  duplicate: number;
  skipped: number;
  failed: number;
  /** Already brought in before (by the webhook or an earlier run). */
  seen: number;
}

export type BackfillStep =
  | { ok: true; done: boolean; next: BackfillCursor | null; tally: BackfillTally; forms: number }
  | { ok: false; error: string };

export const emptyTally = (): BackfillTally => ({ landed: 0, duplicate: 0, skipped: 0, failed: 0, seen: 0 });

function count(tally: BackfillTally, outcome: Outcome): void {
  if (outcome === 'landed') tally.landed += 1;
  else if (outcome === 'duplicate') tally.duplicate += 1;
  else if (outcome === 'skipped') tally.skipped += 1;
  else if (outcome === 'failed') tally.failed += 1;
}

/**
 * One stretch of "Bring in past leads": the Page's forms in order, each
 * read back `BACKFILL_DAYS`, every lead claimed on its leadgen id like a
 * webhook lead (so one already here is left alone) and landed quietly.
 * Stops after `budgetMs` and returns where to go on; the screen calls again
 * until `done`. Studio-scoped by the caller.
 */
export async function backfillMeta(studioId: string, connectionId: string, from: BackfillCursor | null, budgetMs: number): Promise<BackfillStep> {
  const door = await doorById(connectionId);
  if (!door || door.studioId !== studioId || door.kind !== 'META_PAGE' || !door.metaPageId) return { ok: false, error: 'That connection is not yours.' };
  if (!door.enabled) return { ok: false, error: 'Turn it on first.' };
  const t = pageTokenFor(door);
  if ('error' in t) return { ok: false, error: t.error };

  const formsGot = await graphGet(`${GRAPH}/${door.metaPageId}/leadgen_forms?fields=id,name&limit=200`, t.token);
  if (!formsGot.ok) return { ok: false, error: formsGot.error };
  const forms = readForms(formsGot.body);

  const started = Date.now();
  const since = Math.floor(started / 1000) - BACKFILL_DAYS * 86_400;
  const tally = emptyTally();
  let cur: BackfillCursor = from && from.form >= 0 ? from : { form: 0, after: null };

  while (cur.form < forms.length) {
    if (Date.now() - started > budgetMs) return { ok: true, done: false, next: cur, tally, forms: forms.length };
    const page = await graphGet(formLeadsUrl(forms[cur.form]!.id, since, cur.after), t.token, 15_000);
    if (!page.ok) return { ok: false, error: page.error };
    const ids = readLeadPage(page.body).map((l) => String(l.id));
    /* Looked up first, so a second run does not hit the unique index (and log an error) once per lead. */
    const known = new Set(
      (await prisma.studioLeadIntakeEvent.findMany({ where: { connectionId: door.id, externalId: { in: ids }, status: { not: 'FAILED' } }, select: { externalId: true } })).map((e) => e.externalId),
    );
    for (const lead of readLeadPage(page.body)) {
      if (known.has(String(lead.id))) {
        tally.seen += 1;
        continue;
      }
      const eventId = await claim(door.id, String(lead.id), false);
      if (!eventId) {
        tally.seen += 1;
        continue;
      }
      count(tally, (await landMetaLead(door, eventId, lead, true)).outcome);
    }
    const after = afterCursor(page.body);
    cur = after ? { form: cur.form, after } : { form: cur.form + 1, after: null };
  }

  await prisma.studioLeadConnection.update({ where: { id: door.id }, data: { metaBackfillAt: new Date() } });
  return { ok: true, done: true, next: null, tally, forms: forms.length };
}

/**
 * After the owner changes which campaigns: the SKIPPED leads of campaigns now
 * taken are fetched again and landed (quietly when older than a day: those
 * came from past leads). Stops after `budgetMs`; `left` says how many wait.
 */
export async function releaseSkipped(studioId: string, connectionId: string, budgetMs: number): Promise<{ ok: true; tally: BackfillTally; left: number } | { ok: false; error: string }> {
  const door = await doorById(connectionId);
  if (!door || door.studioId !== studioId || door.kind !== 'META_PAGE') return { ok: false, error: 'That connection is not yours.' };
  const tally = emptyTally();
  if (!door.enabled) return { ok: true, tally, left: 0 };
  const where: Prisma.StudioLeadIntakeEventWhereInput = door.metaOnlyCampaigns
    ? { connectionId: door.id, status: 'SKIPPED', campaignId: { in: door.metaCampaignIds } }
    : { connectionId: door.id, status: 'SKIPPED' };
  const started = Date.now();
  const dayAgo = new Date(started - 86_400_000);
  let stuck = 0;
  while (Date.now() - started <= budgetMs) {
    const batch = await prisma.studioLeadIntakeEvent.findMany({ where, orderBy: { createdAt: 'asc' }, take: 25, select: { id: true, externalId: true, updatedAt: true, createdAt: true } });
    if (batch.length === 0) break;
    let moved = 0;
    for (const e of batch) {
      if (Date.now() - started > budgetMs) break;
      const { count: took } = await prisma.studioLeadIntakeEvent.updateMany({ where: { id: e.id, status: 'SKIPPED', updatedAt: e.updatedAt }, data: { status: 'RECEIVED' } });
      if (took !== 1) continue;
      moved += 1;
      count(tally, (await fetchAndLandMeta(door, e.id, e.externalId, e.createdAt < dayAgo)).outcome);
    }
    /* Another request is taking the same batch: stop rather than spin. */
    if (moved === 0 && ++stuck >= 3) break;
  }
  const left = await prisma.studioLeadIntakeEvent.count({ where });
  return { ok: true, tally, left };
}
