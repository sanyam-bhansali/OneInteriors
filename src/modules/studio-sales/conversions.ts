import 'server-only';

/**
 * Meta conversion feedback (owner, 22 Oct 2026; docs/studio-os/LEAD-INTAKE.md):
 * when a lead that came from a Meta lead ad moves into a column the owner
 * chose, Meta is told, so it can find more people who become customers.
 *
 * Off for every studio until the owner switches it on in Settings → Lead
 * sources, and inert even then until the dataset and token are in
 * `STUDIO_META_CAPI` for the studio's slug (env, pasted by the owner; never
 * written by us). Only for a lead with a `leadgenId`. Never anything to the
 * customer.
 *
 * ## An outbox, so a move never waits on Meta
 *
 * A stage change (the card dragged, a call logged and moved, a bulk move, a
 * booking) calls `queueConversions` after its own write. That inserts one
 * StudioConversionEvent per lead and event (unique on both, so each event is
 * sent at most once per lead) and sends in `after()`, once the person has
 * their answer. Nothing here can fail the move: every error is logged and
 * swallowed.
 *
 * A send claims its row first (attempts bumped where attempts is what was
 * read), so `after()` and the daily retry never both send the same event.
 * A failure stays FAILED with Meta's words; the bin-purge cron
 * (/api/cron/bin-purge, daily 03:00 IST — reused, because Vercel Hobby
 * allows a handful of daily crons and this needs no schedule of its own)
 * retries what is due, five tries in all.
 *
 * ## Nothing secret is stored or logged
 *
 * The token goes in a header and nowhere else (`capi-payload.ts`). No payload
 * is kept: the event is rebuilt from the lead when sent, so the outbox holds
 * no phone or email, hashed or not.
 */

import { after } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { currentMember } from '@/modules/studio/access';
import { can } from '@/modules/studio/roles';
import { CAPI_EVENTS, MAX_ATTEMPTS, cleanCapiStages, eventForStage, eventsForMoves, parseCapiConfig, readCapiStages, type CapiEventName, type ConversionStatusName, type StageKindName } from '@/modules/studio-intake/capi-rules';
import { buildConversionEvent, postConversions, type FetchLike } from '@/modules/studio-intake/capi-payload';

export interface StageMove {
  clientId: string;
  toStageId: string;
}

/** Run after the response; outside a request (a script, a test) just run it. */
function later(work: () => Promise<unknown>): void {
  const quiet = () => work().catch((error) => console.error('[capi] send failed', error instanceof Error ? error.message : 'unknown'));
  try {
    after(quiet);
  } catch {
    void quiet();
  }
}

/**
 * Queue (and, after the response, send) the events these moves call for.
 * Never throws: a stage change must not fail because Meta feedback could not
 * be queued.
 */
export async function queueConversions(studioId: string, moves: readonly StageMove[]): Promise<void> {
  if (moves.length === 0) return;
  try {
    const ids = await enqueue(studioId, moves);
    if (ids.length > 0) later(() => sendForStudio(studioId, ids));
  } catch (error) {
    console.error('[capi] queue failed', error instanceof Error ? error.message : 'unknown');
  }
}

async function enqueue(studioId: string, moves: readonly StageMove[]): Promise<string[]> {
  const studio = await prisma.studio.findUnique({ where: { id: studioId }, select: { slug: true, metaCapiEnabled: true, metaCapiStages: true } });
  if (!studio?.metaCapiEnabled) return [];
  if (!parseCapiConfig(process.env.STUDIO_META_CAPI, studio.slug)) return [];

  const clientIds = [...new Set(moves.map((m) => m.clientId))];
  const leads = await prisma.studioClient.findMany({
    where: { studioId, id: { in: clientIds }, leadgenId: { not: null }, isDemo: false },
    select: { id: true, leadgenId: true },
  });
  if (leads.length === 0) return [];
  const stages = await prisma.studioStage.findMany({
    where: { studioId, id: { in: [...new Set(moves.map((m) => m.toStageId))] } },
    select: { id: true, kind: true },
  });
  const rows = eventsForMoves(
    moves,
    new Map(leads.map((l) => [l.id, { leadgenId: l.leadgenId }])),
    new Map(stages.map((s) => [s.id, s.kind as StageKindName])),
    readCapiStages(studio.metaCapiStages),
  );
  if (rows.length === 0) return [];
  const made = await prisma.studioConversionEvent.createManyAndReturn({
    data: rows.map((r) => ({ studioId, clientId: r.clientId, stageId: r.stageId, eventName: r.eventName })),
    skipDuplicates: true,
    select: { id: true },
  });
  return made.map((m) => m.id);
}

export interface SendTally {
  sent: number;
  failed: number;
  skipped: number;
}

/**
 * Send these events of one studio. Each row is claimed before it is sent;
 * a row somebody else claimed is left alone. `fetchImpl` is for tests.
 */
export async function sendForStudio(studioId: string, ids: readonly string[], fetchImpl: FetchLike = fetch as unknown as FetchLike): Promise<SendTally> {
  const tally: SendTally = { sent: 0, failed: 0, skipped: 0 };
  if (ids.length === 0) return tally;
  const studio = await prisma.studio.findUnique({ where: { id: studioId }, select: { slug: true, metaCapiEnabled: true } });
  const cfg = studio ? parseCapiConfig(process.env.STUDIO_META_CAPI, studio.slug) : null;
  const rows = await prisma.studioConversionEvent.findMany({
    where: { studioId, id: { in: [...ids] }, status: { in: ['QUEUED', 'FAILED'] }, attempts: { lt: MAX_ATTEMPTS } },
    select: { id: true, eventName: true, attempts: true, createdAt: true, client: { select: { leadgenId: true, phone: true, email: true, deletedAt: true } } },
  });

  for (const row of rows) {
    const { count } = await prisma.studioConversionEvent.updateMany({
      where: { id: row.id, studioId, status: { in: ['QUEUED', 'FAILED'] }, attempts: row.attempts },
      data: { attempts: { increment: 1 } },
    });
    if (count !== 1) continue;

    const settle = (status: ConversionStatusName, lastError: string | null) =>
      prisma.studioConversionEvent.updateMany({ where: { id: row.id, studioId }, data: { status, lastError, ...(status === 'SENT' ? { sentAt: new Date() } : {}) } });

    if (!studio?.metaCapiEnabled) {
      await settle('SKIPPED', 'Switched off before it was sent.');
      tally.skipped += 1;
      continue;
    }
    if (!cfg) {
      await settle('FAILED', 'Meta is not set up for your studio on One Interiors yet (STUDIO_META_CAPI).');
      tally.failed += 1;
      continue;
    }
    if (row.client.deletedAt || !row.client.leadgenId) {
      await settle('SKIPPED', 'The lead was deleted or has no Meta lead id.');
      tally.skipped += 1;
      continue;
    }
    const event = buildConversionEvent({
      eventName: row.eventName as CapiEventName,
      /* When the move happened, not when the send finally got through. */
      eventTime: row.createdAt,
      leadgenId: row.client.leadgenId,
      phone: row.client.phone,
      email: row.client.email,
    });
    if (!event) {
      await settle('SKIPPED', 'The Meta lead id on this lead is not one Meta gave.');
      tally.skipped += 1;
      continue;
    }
    const r = await postConversions(fetchImpl, cfg, [event]);
    if (r.ok) {
      await settle('SENT', null);
      tally.sent += 1;
    } else {
      await settle('FAILED', r.error.slice(0, 300));
      tally.failed += 1;
    }
  }
  return tally;
}

/**
 * The daily retry (run by /api/cron/bin-purge): every event still to send
 * that has not been touched in the last hour (so one `after()` is mid-send
 * on is left to it), oldest first, two hundred a run, studio by studio.
 */
export async function retryConversions(now = new Date()): Promise<SendTally> {
  const tally: SendTally = { sent: 0, failed: 0, skipped: 0 };
  try {
    const due = await prisma.studioConversionEvent.findMany({
      where: { status: { in: ['QUEUED', 'FAILED'] }, attempts: { lt: MAX_ATTEMPTS }, updatedAt: { lt: new Date(now.getTime() - 60 * 60 * 1000) } },
      orderBy: { updatedAt: 'asc' },
      take: 200,
      select: { id: true, studioId: true },
    });
    const byStudio = new Map<string, string[]>();
    for (const d of due) byStudio.set(d.studioId, [...(byStudio.get(d.studioId) ?? []), d.id]);
    for (const [studioId, ids] of byStudio) {
      const t = await sendForStudio(studioId, ids);
      tally.sent += t.sent;
      tally.failed += t.failed;
      tally.skipped += t.skipped;
    }
  } catch (error) {
    console.error('[capi] retry failed', error instanceof Error ? error.message : 'unknown');
  }
  return tally;
}

// ── Settings → Lead sources ────────────────────────────────────

export interface ConversionStageRow {
  id: string;
  name: string;
  kind: StageKindName;
  event: CapiEventName | null;
}

export interface ConversionEventRow {
  id: string;
  clientId: string;
  clientName: string;
  eventName: string;
  status: ConversionStatusName;
  attempts: number;
  lastError: string | null;
  atLabel: string;
}

export interface ConversionScreen {
  /** The owner only: it sends what the studio knows about its customers to Meta. */
  canManage: boolean;
  /** Whether STUDIO_META_CAPI has this studio's dataset and token (never the values). */
  ready: boolean;
  enabled: boolean;
  stages: ConversionStageRow[];
  recent: ConversionEventRow[];
  failed: number;
  sent: number;
}

function when(d: Date): string {
  return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
}

/** Null for anyone but the owner and project managers (who see that it exists, not the controls). */
export async function myConversionScreen(): Promise<ConversionScreen | null> {
  const member = await currentMember();
  if (!member || !can(member, 'lead.import')) return null;
  const canManage = member.role === 'OWNER';
  try {
    const studio = await prisma.studio.findUnique({ where: { id: member.studioId }, select: { slug: true, metaCapiEnabled: true, metaCapiStages: true } });
    if (!studio) return null;
    const map = readCapiStages(studio.metaCapiStages);
    const [stages, recent, failed, sent] = await Promise.all([
      prisma.studioStage.findMany({ where: { studioId: member.studioId }, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, kind: true } }),
      prisma.studioConversionEvent.findMany({
        where: { studioId: member.studioId },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { id: true, clientId: true, eventName: true, status: true, attempts: true, lastError: true, createdAt: true, client: { select: { name: true } } },
      }),
      prisma.studioConversionEvent.count({ where: { studioId: member.studioId, status: 'FAILED' } }),
      prisma.studioConversionEvent.count({ where: { studioId: member.studioId, status: 'SENT' } }),
    ]);
    return {
      canManage,
      ready: parseCapiConfig(process.env.STUDIO_META_CAPI, studio.slug) !== null,
      enabled: studio.metaCapiEnabled,
      stages: stages.map((s) => ({ id: s.id, name: s.name, kind: s.kind as StageKindName, event: eventForStage({ id: s.id, kind: s.kind as StageKindName }, map) })),
      recent: recent.map((r) => ({
        id: r.id,
        clientId: r.clientId,
        clientName: r.client.name,
        eventName: CAPI_EVENTS.find((e) => e.name === r.eventName)?.label ?? r.eventName,
        status: r.status,
        attempts: r.attempts,
        lastError: r.lastError,
        atLabel: when(r.createdAt),
      })),
      failed,
      sent,
    };
  } catch (error) {
    console.error('[capi] screen failed', error instanceof Error ? error.message : 'unknown');
    return null;
  }
}

export type ConversionResult = { ok: true; message: string } | { ok: false; error: string };

/** The switch and the column choices. The owner only. */
export async function saveConversionSettings(input: { enabled: unknown; stages: unknown }): Promise<ConversionResult> {
  const member = await currentMember();
  if (!member || member.role !== 'OWNER' || !can(member, 'lead.import')) return { ok: false, error: 'Only the studio owner decides what Meta is told.' };
  const studio = await prisma.studio.findUnique({ where: { id: member.studioId }, select: { slug: true } });
  if (!studio) return { ok: false, error: 'No studio on this account.' };
  const enabled = input.enabled === true;
  if (enabled && !parseCapiConfig(process.env.STUDIO_META_CAPI, studio.slug)) {
    return { ok: false, error: 'One Interiors has not been given your Meta dataset and token yet, so this cannot be switched on. Nothing is sent until it is.' };
  }
  const stages = await prisma.studioStage.findMany({ where: { studioId: member.studioId }, select: { id: true, kind: true } });
  const cleaned = cleanCapiStages(input.stages, stages.map((s) => ({ id: s.id, kind: s.kind as StageKindName })));
  await prisma.studio.update({
    where: { id: member.studioId },
    data: { metaCapiEnabled: enabled, metaCapiStages: cleaned as unknown as Prisma.InputJsonValue },
  });
  return { ok: true, message: enabled ? 'On. From now on, Meta lead-ad leads moving into the columns you chose are reported to Meta, once each.' : 'Off. Nothing is sent to Meta.' };
}
