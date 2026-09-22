import 'server-only';

/**
 * Writing and reading a lead's history.
 *
 * ## Writes never throw
 *
 * `record()` swallows everything. A timeline entry that failed to save is a
 * line missing from a history; a stage change that rolled back because the
 * history could not be written is work lost. The second is strictly worse,
 * and a studio moving a card has no idea a log exists to fail.
 *
 * That is also why `record` takes an optional transaction client rather than
 * insisting on one. Inside a transaction it is atomic with the change it
 * describes; outside, it is best-effort after the fact. Callers that can pass
 * a `tx` should.
 *
 * ## Append-only
 *
 * There is no update and no delete in this file. A history you can edit is a
 * history you cannot rely on, and the point of it is to be relied on in an
 * argument about what was promised to whom. Rows go only when their client
 * is erased, by cascade.
 *
 * ## Studio-scoped like the rest of the folder
 *
 * `record` is the exception that takes a `studioId`, because the bridge and
 * the import path both write events for a studio that is not the session.
 * The READS take nothing and scope themselves, which is the rule that
 * matters: nothing here can return another studio's history.
 */

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { myStudioId } from '@/modules/studio-quote/store';
import { myMembershipId, displayName } from './team';
import type { EventKindName } from './event-copy';

type Db = Prisma.TransactionClient | typeof prisma;

export interface EventRow {
  id: string;
  kind: EventKindName;
  actor: 'MEMBER' | 'SYSTEM';
  byName: string | null;
  summary: string;
  meta: Record<string, unknown> | null;
  createdAt: Date;
}

export interface RecordInput {
  studioId: string;
  clientId: string;
  kind: EventKindName;
  summary: string;
  meta?: Record<string, unknown>;
  /**
   * Who did it. Omit for a member action and it resolves the session's own
   * membership; pass `null` explicitly for something we did on their behalf.
   *
   * The three-state convention, the same one AxLeads uses for `assignedTo`
   * and for the same reason: `undefined` means "work it out", `null` is a
   * real value meaning SYSTEM, and a value is a value. Tested with
   * `!== undefined`, never truthiness.
   */
  by?: { id: string; name: string } | null;
  db?: Db;
}

/**
 * Write one line. Never throws, never blocks the thing it describes.
 */
export async function record(input: RecordInput): Promise<void> {
  const db = input.db ?? prisma;

  try {
    let byId: string | null = null;
    let byName: string | null = null;
    let actor: 'MEMBER' | 'SYSTEM' = 'SYSTEM';

    if (input.by !== undefined) {
      if (input.by !== null) {
        byId = input.by.id;
        byName = input.by.name;
        actor = 'MEMBER';
      }
      /* Explicit null stays SYSTEM. */
    } else {
      const me = await currentMember();
      if (me) {
        byId = me.id;
        byName = me.name;
        actor = 'MEMBER';
      }
    }

    await db.studioClientEvent.create({
      data: {
        studioId: input.studioId,
        clientId: input.clientId,
        kind: input.kind,
        actor,
        byId,
        byName,
        summary: input.summary,
        meta: (input.meta ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (error) {
    /* Logged, not raised. See the note at the top of the file. */
    console.error('[events] could not record', input.kind, input.clientId, error);
  }
}

/**
 * Several lines at once, for a bulk action.
 *
 * A bulk assignment of forty leads writes forty timeline rows, not one — each
 * lead's own history has to show what happened to IT. The audit trail for the
 * *action* is a different thing and lives in `AuditLog`.
 */
export async function recordMany(
  rows: Omit<RecordInput, 'db' | 'by'>[],
  opts: { db?: Db; by?: { id: string; name: string } | null } = {},
): Promise<void> {
  if (rows.length === 0) return;
  const db = opts.db ?? prisma;

  try {
    let byId: string | null = null;
    let byName: string | null = null;
    let actor: 'MEMBER' | 'SYSTEM' = 'SYSTEM';

    if (opts.by !== undefined) {
      if (opts.by !== null) {
        byId = opts.by.id;
        byName = opts.by.name;
        actor = 'MEMBER';
      }
    } else {
      const me = await currentMember();
      if (me) {
        byId = me.id;
        byName = me.name;
        actor = 'MEMBER';
      }
    }

    await db.studioClientEvent.createMany({
      data: rows.map((r) => ({
        studioId: r.studioId,
        clientId: r.clientId,
        kind: r.kind,
        actor,
        byId,
        byName,
        summary: r.summary,
        meta: (r.meta ?? undefined) as Prisma.InputJsonValue | undefined,
      })),
    });
  } catch (error) {
    console.error('[events] could not record batch', rows.length, error);
  }
}

/**
 * One lead's history, newest first.
 *
 * Capped. A lead worked for two years by a busy studio accumulates hundreds
 * of lines, and nobody scrolls past the first screen — the ones that matter
 * are the recent ones plus whatever the studio went looking for, and looking
 * is a different screen from this one.
 */
export const TIMELINE_LIMIT = 100;

export async function timelineFor(clientId: string): Promise<EventRow[]> {
  const studioId = await myStudioId();
  if (!studioId) return [];

  try {
    /* Scoped by studioId as well as clientId. A client id off a form is not
       proof of ownership — the same rule `clients.ts` states for its writes,
       and this simply returns nothing when the id is not theirs rather than
       leaking another studio's conversation history. */
    const rows = await prisma.studioClientEvent.findMany({
      where: { studioId, clientId },
      orderBy: { createdAt: 'desc' },
      take: TIMELINE_LIMIT,
      select: {
        id: true,
        kind: true,
        actor: true,
        byName: true,
        summary: true,
        meta: true,
        createdAt: true,
      },
    });

    return rows.map((r) => ({
      id: r.id,
      kind: r.kind as EventKindName,
      actor: r.actor as 'MEMBER' | 'SYSTEM',
      byName: r.byName,
      summary: r.summary,
      meta: (r.meta ?? null) as Record<string, unknown> | null,
      createdAt: r.createdAt,
    }));
  } catch (error) {
    console.error('[events] timeline read failed', error);
    return [];
  }
}

/**
 * The whole studio's recent activity — "what has been going on".
 *
 * Deliberately not filtered to the signed-in person. A studio owner's first
 * question on a Monday is what the team did, not what they personally did,
 * and an owner-only feed would answer a question nobody asked.
 */
export async function recentActivity(limit = 40): Promise<(EventRow & {
  clientId: string;
  clientName: string;
})[]> {
  const studioId = await myStudioId();
  if (!studioId) return [];

  try {
    const rows = await prisma.studioClientEvent.findMany({
      where: {
        studioId,
        /* The sample lead's own events do not count as activity. A studio
           that has done nothing should be told nothing has happened, not
           shown a feed of things we did on their behalf. Same rule as every
           counter — see demo-lead.ts. */
        client: { isDemo: false, deletedAt: null },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        kind: true,
        actor: true,
        byName: true,
        summary: true,
        meta: true,
        createdAt: true,
        clientId: true,
        client: { select: { name: true } },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      kind: r.kind as EventKindName,
      actor: r.actor as 'MEMBER' | 'SYSTEM',
      byName: r.byName,
      summary: r.summary,
      meta: (r.meta ?? null) as Record<string, unknown> | null,
      createdAt: r.createdAt,
      clientId: r.clientId,
      clientName: r.client.name,
    }));
  } catch (error) {
    console.error('[events] activity read failed', error);
    return [];
  }
}

/** The signed-in member, as an event author. Null for ops, or on failure. */
async function currentMember(): Promise<{ id: string; name: string } | null> {
  try {
    const id = await myMembershipId();
    if (!id) return null;

    const row = await prisma.studioMember.findUnique({
      where: { id },
      select: { id: true, user: { select: { name: true, email: true } } },
    });
    if (!row) return null;

    return { id: row.id, name: displayName(row.user?.name ?? null, row.user?.email ?? null) };
  } catch {
    return null;
  }
}
