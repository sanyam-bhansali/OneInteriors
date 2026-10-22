import 'server-only';

/**
 * Bulk actions on the leads list (leads at scale, 12 Oct 2026): give to one
 * person, split evenly among chosen salespeople, move to a column, set a
 * follow-up date, delete. Rules in `bulk-rules.ts`.
 *
 * The browser sends either the ids it ticked or "everything matching these
 * filters" (the filter query string). Either way the server reads the ids
 * again inside the person's scope (studio/lead-scope.ts) — an id or a
 * filter from a browser proves nothing — and writes in chunks of a
 * thousand, one timeline line per lead, as the one-at-a-time paths do.
 */

import { mainLostStage } from '@/modules/studio-practice/vocabulary';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { notify } from '@/modules/notify/service';
import { LIVE } from '@/modules/studio-practice/demo-lead';
import { recordMany } from '@/modules/studio-practice/events';
import { assignedSummary, lostSummary, stageSummary } from '@/modules/studio-practice/event-copy';
import { BIN_DAYS, LOST_LABELS, type LostReasonName } from '@/modules/studio-practice/vocabulary';
import { actingMember, fenceFor, myLeadScope, type LeadScope } from '@/modules/studio/lead-scope';
import { hasSalesRole } from '@/modules/studio/roles';
import { mayAssignTo } from '@/modules/studio/sales-access';
import { poolTarget } from '@/modules/studio-practice/clients';
import { addDays, dayToDb, isDay, istDay, istTime } from '@/modules/project/working-days';
import { meetingLabel, parseMeeting } from './lead-rules';
import { BULK_CHUNK, BULK_MAX, bulkFence, chunks, mayBulk, readLimit, splitEvenly, splitSentence, type BulkAction } from './bulk-rules';
import { parseLeadFilters, parseSort, type LeadFilters } from './lead-filters';
import { orderByFor, scopedLeadWhere } from './lead-where';
import { queueConversions } from './conversions';

/** Ticked ids, or everything the filters show (optionally only the first `limit`). */
export type BulkTarget = { ids: string[] } | { query: string; limit?: number | null };
export type BulkResult = { ok: true; message: string } | { ok: false; error: string };

const ID = /^[A-Za-z0-9_-]{1,64}$/;

/** The person, if they may take this bulk action. */
async function who(action: BulkAction): Promise<LeadScope | null> {
  const scope = await myLeadScope();
  return scope && mayBulk(scope.member, action) ? scope : null;
}

/**
 * The ids this bulk action reaches: the target, inside the person's scope
 * and the action's fence (`bulkFence`: claiming reaches only the pool; a
 * salesperson's other actions only their own leads). "First N" follows the
 * list's own order (`sort` in the query).
 */
async function targetIds(scope: LeadScope, target: BulkTarget, action: BulkAction, more: Prisma.StudioClientWhereInput = {}): Promise<string[] | { error: string }> {
  const now = new Date();
  const fence = bulkFence(action, scope.seesAll || scope.team !== null);
  const fenced = (f: LeadFilters): LeadFilters => (fence === 'pool' ? { ...f, owner: 'pool' } : fence === 'mine' ? { ...f, owner: 'me' } : f);
  /* Sales roles (owner, 22 Oct 2026): the bulk reach AND the action's own reach. Claiming is fenced by the pools (`owner: 'pool'`). */
  const extra: Prisma.StudioClientWhereInput = { AND: [more, ...actionFences(scope, action)] };
  const tooMany = { error: `That is more than ${BULK_MAX.toLocaleString('en-IN')} leads. Narrow the filters first.` };
  if ('ids' in target) {
    if (!Array.isArray(target.ids) || target.ids.length === 0) return { error: 'Tick at least one lead.' };
    const ids = [...new Set(target.ids.filter((i) => typeof i === 'string' && ID.test(i)))];
    if (ids.length > BULK_MAX) return tooMany;
    const out: string[] = [];
    for (const batch of chunks(ids)) {
      const rows = await prisma.studioClient.findMany({
        where: { studioId: scope.studioId, AND: [scopedLeadWhere(scope, fenced({}), now, LIVE), { id: { in: batch } }, extra] },
        select: { id: true },
      });
      out.push(...rows.map((r) => r.id));
    }
    return out;
  }
  if (typeof target.query !== 'string' || target.query.length > 2000) return { error: 'Those filters did not read. Start again.' };
  const params = new URLSearchParams(target.query);
  const filters = fenced(parseLeadFilters(params));
  const limit = readLimit(target.limit);
  const rows = await prisma.studioClient.findMany({
    where: { studioId: scope.studioId, AND: [scopedLeadWhere(scope, filters, now, LIVE), extra] },
    orderBy: orderByFor(parseSort(params.get('sort'))),
    select: { id: true },
    take: (limit ?? BULK_MAX) + (limit ? 0 : 1),
  });
  if (!limit && rows.length > BULK_MAX) return tooMany;
  return rows.map((r) => r.id);
}

/** The reach fences a bulk action's rows must also sit inside. */
function actionFences(scope: LeadScope, action: BulkAction): Prisma.StudioClientWhereInput[] {
  if (action === 'claim') return [];
  const bulk = fenceFor(scope, 'lead.bulk');
  if (action === 'assign' || action === 'split') return [bulk, fenceFor(scope, 'lead.assign')];
  if (action === 'move' || action === 'followup') return [bulk, fenceFor(scope, 'lead.edit')];
  return [bulk, scope.leads];
}

/**
 * Claim pool leads for yourself (owner, 12 Oct 2026: salespeople may). Only
 * leads still unassigned at the moment of writing are taken, so two people
 * claiming at once never take the same lead twice.
 */
export async function bulkClaim(target: BulkTarget): Promise<BulkResult> {
  const scope = await who('claim');
  if (!scope) return { ok: false, error: 'Your role does not include taking leads from the pool.' };
  try {
    const ids = await targetIds(scope, target, 'claim', { assignedToId: null });
    if ('error' in ids) return { ok: false, error: ids.error };
    if (ids.length === 0) return { ok: false, error: 'Somebody has already taken those. Refresh the pool.' };
    const by = await actingMember();
    let done = 0;
    for (const batch of chunks(ids)) {
      /* Take what is still free and learn exactly which rows THIS statement
         took (UPDATE … RETURNING): a colleague claiming the same leads at the
         same moment wins the rows they reached first, and only the leads we
         actually took get a "Claimed by" timeline line. */
      const taken = await claimFree(scope.studioId, batch, scope.member.id);
      if (taken.length === 0) continue;
      done += taken.length;
      await recordMany(
        taken.map((clientId) => ({ studioId: scope.studioId, clientId, kind: 'ASSIGNED' as const, summary: `Claimed from the pool by ${by?.name ?? 'a salesperson'}`, meta: { toMemberId: scope.member.id, claimed: true } })),
        { by },
      );
    }
    const missed = ids.length - done;
    return {
      ok: true,
      message: `Done. ${plural(done, 'lead')} ${done === 1 ? 'is' : 'are'} yours now.${missed > 0 ? ` ${plural(missed, 'lead')} had just been taken by somebody else.` : ''}`,
    };
  } catch (error) {
    console.error('[bulk] claim failed', error instanceof Error ? error.message : 'unknown');
    return { ok: false, error: 'That did not save. Try again.' };
  }
}

/**
 * Give these leads to `memberId` where they are still unassigned, in one
 * statement, returning the ids it changed. Row locks make two concurrent
 * claims disjoint: the second one re-checks `"assignedToId" IS NULL` after
 * the first commits and skips those rows.
 */
async function claimFree(studioId: string, ids: string[], memberId: string): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`UPDATE studio_clients SET "assignedToId" = ${memberId}, "updatedAt" = NOW()
      WHERE "studioId" = ${studioId} AND id = ANY(${ids}::text[]) AND "assignedToId" IS NULL AND "deletedAt" IS NULL
      RETURNING id`,
  );
  return rows.map((r) => r.id);
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`;

/**
 * People a lead may be given to: active owner, PM or salesperson of this
 * studio; for a sales role with team reach, only people in their team.
 */
async function assignees(scope: LeadScope, ids: string[]) {
  const rows = await prisma.studioMember.findMany({
    where: { studioId: scope.studioId, id: { in: ids }, status: 'ACTIVE', role: { in: ['OWNER', 'PM', 'SALES'] } },
    select: { id: true, userId: true, user: { select: { name: true, email: true, phone: true } } },
  });
  const me = scope.member;
  return rows
    .filter((r) => !hasSalesRole(me) || mayAssignTo(me.sales, r.id))
    .map((r) => ({ id: r.id, userId: r.userId, name: r.user.name?.trim() || r.user.email?.split('@')[0] || r.user.phone || 'Someone' }));
}

/** Give these leads to one person (the timeline line, the person told once). */
async function giveTo(scope: LeadScope, ids: string[], to: { id: string; userId: string; name: string } | null, by: { id: string; name: string } | null): Promise<number> {
  /* Back to the pool: which pool (sales roles; clients.ts `poolTarget`). */
  const pool = await poolTarget(scope, to?.id ?? null, null);
  const poolData = pool.ok && pool.set ? { poolTeamId: pool.poolTeamId } : {};
  let done = 0;
  for (const batch of chunks(ids, BULK_CHUNK)) {
    const { count } = await prisma.studioClient.updateMany({
      where: { studioId: scope.studioId, id: { in: batch }, deletedAt: null },
      data: { assignedToId: to?.id ?? null, ...poolData },
    });
    done += count;
    await recordMany(
      batch.map((clientId) => ({ studioId: scope.studioId, clientId, kind: 'ASSIGNED' as const, summary: assignedSummary(to?.name ?? null), meta: { toMemberId: to?.id ?? null, bulk: true } })),
      { by },
    );
  }
  if (to && done > 0 && to.id !== scope.member.id) {
    const first = await prisma.studioClient.findFirst({ where: { studioId: scope.studioId, id: ids[0]! }, select: { id: true, name: true } });
    if (first) void notify(to.userId, { kind: 'lead-assigned', clientId: first.id, count: done, name: first.name, by: by?.name ?? null });
  }
  return done;
}

/** Give to one person, or (null) back to the pool. Owner and PM. */
export async function bulkAssign(target: BulkTarget, memberId: string | null): Promise<BulkResult> {
  const scope = await who('assign');
  if (!scope) return { ok: false, error: 'Your role does not include giving leads out.' };
  try {
    const to = memberId ? ((await assignees(scope, [memberId]))[0] ?? null) : null;
    if (memberId && !to) return { ok: false, error: 'That person cannot take leads from you (not active, not on the sales team, or not in your team).' };
    const ids = await targetIds(scope, target, 'assign');
    if ('error' in ids) return { ok: false, error: ids.error };
    if (ids.length === 0) return { ok: false, error: 'None of those are leads you can see.' };
    const done = await giveTo(scope, ids, to, await actingMember());
    return { ok: true, message: to ? `Done. ${plural(done, 'lead')} given to ${to.name}; they have been told.` : `Done. ${plural(done, 'lead')} back in the pool.` };
  } catch (error) {
    console.error('[bulk] assign failed', error instanceof Error ? error.message : 'unknown');
    return { ok: false, error: 'That did not save. Nothing was half-done that you need to undo; try again.' };
  }
}

/** Deal the leads out evenly among the chosen people. Owner and PM. */
export async function bulkSplit(target: BulkTarget, memberIds: string[]): Promise<BulkResult> {
  const scope = await who('split');
  if (!scope) return { ok: false, error: 'Your role does not include sharing leads out.' };
  if (!Array.isArray(memberIds) || memberIds.length < 2) return { ok: false, error: 'Pick at least two people to split between.' };
  try {
    const wanted = [...new Set(memberIds.filter((m) => typeof m === 'string' && ID.test(m)))].slice(0, 50);
    const people = await assignees(scope, wanted);
    if (people.length < 2) return { ok: false, error: 'Pick at least two people who can take leads.' };
    const ids = await targetIds(scope, target, 'split');
    if ('error' in ids) return { ok: false, error: ids.error };
    if (ids.length === 0) return { ok: false, error: 'None of those are leads you can see.' };
    // In the order people were picked, so the split reads as the person meant it.
    const ordered = wanted.map((id) => people.find((p) => p.id === id)).filter((p): p is (typeof people)[number] => Boolean(p));
    const dealt = splitEvenly(ids, ordered.map((p) => p.id));
    const by = await actingMember();
    const counts: { name: string; n: number }[] = [];
    for (const p of ordered) counts.push({ name: p.name, n: await giveTo(scope, dealt.get(p.id) ?? [], p, by) });
    return { ok: true, message: splitSentence(counts) };
  } catch (error) {
    console.error('[bulk] split failed', error instanceof Error ? error.message : 'unknown');
    return { ok: false, error: 'That stopped part-way. Check the list: some leads may already be given out.' };
  }
}

/** Move to one column. A lost column asks why; a closed one clears the follow-up. */
export async function bulkMove(target: BulkTarget, stageId: string, lostReason: string | null): Promise<BulkResult> {
  const scope = await who('move');
  if (!scope) return { ok: false, error: 'Your role does not include moving leads.' };
  try {
    const stage = typeof stageId === 'string' ? await prisma.studioStage.findFirst({ where: { id: stageId, studioId: scope.studioId }, select: { id: true, name: true, kind: true } }) : null;
    if (!stage) return { ok: false, error: 'Pick a column.' };
    const reason = lostReason && Object.prototype.hasOwnProperty.call(LOST_LABELS, lostReason) ? (lostReason as LostReasonName) : null;
    if (stage.kind === 'LOST' && !reason) return { ok: false, error: 'Why were they lost? Pick a reason; it is what the dashboard counts.' };
    const ids = await targetIds(scope, target, 'move', { stageId: { not: stage.id } });
    if ('error' in ids) return { ok: false, error: ids.error };
    if (ids.length === 0) return { ok: false, error: `They are all in ${stage.name} already.` };
    const closing = stage.kind === 'LOST' || stage.kind === 'DONE';
    const stages = new Map((await prisma.studioStage.findMany({ where: { studioId: scope.studioId }, select: { id: true, name: true } })).map((s) => [s.id, s.name]));
    const by = await actingMember();
    let done = 0;
    for (const batch of chunks(ids)) {
      const before = await prisma.studioClient.findMany({ where: { studioId: scope.studioId, id: { in: batch } }, select: { id: true, stageId: true } });
      const { count } = await prisma.studioClient.updateMany({
        where: { studioId: scope.studioId, id: { in: batch }, deletedAt: null },
        data: { stageId: stage.id, lostReason: stage.kind === 'LOST' ? reason : null, ...(closing ? { nextAction: null, nextActionOn: null } : {}) },
      });
      done += count;
      await recordMany(
        before.map((b) => ({
          studioId: scope.studioId,
          clientId: b.id,
          kind: stage.kind === 'LOST' ? ('LOST' as const) : ('STAGE_CHANGED' as const),
          summary: stage.kind === 'LOST' ? lostSummary(reason) : stageSummary(stages.get(b.stageId) ?? null, stage.name),
          meta: { fromStageId: b.stageId, toStageId: stage.id, kind: stage.kind, bulk: true },
        })),
        { by },
      );
      /* Meta conversion feedback (22 Oct 2026): one queue call per batch; inert unless switched on. */
      await queueConversions(scope.studioId, before.map((b) => ({ clientId: b.id, toStageId: stage.id })));
    }
    return { ok: true, message: `Done. ${plural(done, 'lead')} moved to ${stage.name}.` };
  } catch (error) {
    console.error('[bulk] move failed', error instanceof Error ? error.message : 'unknown');
    return { ok: false, error: 'That stopped part-way. Check the list before trying again.' };
  }
}

/**
 * Set the follow-up date (and, if given, what to do) on open leads. A lead
 * with no next action gets "Follow up", because a date with nothing to do is
 * a reminder to do nothing (clients.ts addClient).
 */
export async function bulkFollowUp(target: BulkTarget, day: string, time: string, action: string): Promise<BulkResult> {
  const scope = await who('followup');
  if (!scope) return { ok: false, error: 'Your role does not include changing follow-ups.' };
  if (!isDay(day)) return { ok: false, error: 'Pick the day.' };
  const at = time ? parseMeeting(day, time) : dayToDb(day);
  if (!at) return { ok: false, error: 'That time did not read. Use the picker.' };
  const what = typeof action === 'string' ? action.trim().slice(0, 140) : '';
  try {
    const ids = await targetIds(scope, target, 'followup', { stage: { kind: { in: ['OPEN', 'WON'] } } });
    if ('error' in ids) return { ok: false, error: ids.error };
    if (ids.length === 0) return { ok: false, error: 'None of those are open leads (finished and lost ones take no follow-up).' };
    const by = await actingMember();
    const summary = `Follow-up set${what ? ` — ${what}` : ''}: ${meetingLabel(at)}`;
    let done = 0;
    for (const batch of chunks(ids)) {
      const where = { studioId: scope.studioId, id: { in: batch }, deletedAt: null };
      if (what) {
        done += (await prisma.studioClient.updateMany({ where, data: { nextActionOn: at, nextAction: what } })).count;
      } else {
        done += (await prisma.studioClient.updateMany({ where: { ...where, nextAction: { not: null } }, data: { nextActionOn: at } })).count;
        done += (await prisma.studioClient.updateMany({ where: { ...where, nextAction: null }, data: { nextActionOn: at, nextAction: 'Follow up' } })).count;
      }
      // One timeline line per lead, batched, as snooze does: a bulk reschedule leaves a trace.
      await recordMany(
        batch.map((clientId) => ({ studioId: scope.studioId, clientId, kind: 'EDITED' as const, summary, meta: { followUpAt: at.toISOString(), bulk: true } })),
        { by },
      );
    }
    return { ok: true, message: `Done. ${plural(done, 'follow-up')} set.` };
  } catch (error) {
    console.error('[bulk] follow-up failed', error instanceof Error ? error.message : 'unknown');
    return { ok: false, error: 'That stopped part-way. Check the list before trying again.' };
  }
}

/**
 * Delete to the bin (30 days). Leads with quotations, projects or a booking
 * are left alone and counted, as one-at-a-time delete refuses them.
 */
export async function bulkBin(target: BulkTarget): Promise<BulkResult> {
  const scope = await who('bin');
  if (!scope) return { ok: false, error: 'Your role does not include deleting leads.' };
  try {
    const all = await targetIds(scope, target, 'bin');
    if ('error' in all) return { ok: false, error: all.error };
    if (all.length === 0) return { ok: false, error: 'None of those are leads you can see.' };
    const by = await actingMember();
    let done = 0;
    for (const batch of chunks(all)) {
      const free = await prisma.studioClient.findMany({
        where: { studioId: scope.studioId, id: { in: batch }, deletedAt: null, quotes: { none: {} }, projects: { none: {} }, bookedIntroductionId: null },
        select: { id: true },
      });
      const ids = free.map((f) => f.id);
      if (ids.length === 0) continue;
      const { count } = await prisma.studioClient.updateMany({ where: { studioId: scope.studioId, id: { in: ids }, deletedAt: null }, data: { deletedAt: new Date() } });
      done += count;
      await recordMany(ids.map((clientId) => ({ studioId: scope.studioId, clientId, kind: 'BINNED' as const, summary: `Deleted — erased automatically after ${BIN_DAYS} days` })), { by });
    }
    const kept = all.length - done;
    return {
      ok: true,
      message: `Done. ${plural(done, 'lead')} in the bin for ${BIN_DAYS} days.${kept > 0 ? ` ${plural(kept, 'lead')} with quotations, projects or a booking ${kept === 1 ? 'was' : 'were'} left alone.` : ''}`,
    };
  } catch (error) {
    console.error('[bulk] bin failed', error instanceof Error ? error.message : 'unknown');
    return { ok: false, error: 'That stopped part-way. Check the list and the bin before trying again.' };
  }
}

// ── The stale-lead review (AxLeads, 12 Oct 2026) ──────────────────────

/** How many days "Snooze" puts the follow-up out. */
export const SNOOZE_DAYS = 7;

/**
 * Snooze: the follow-up goes 7 days out (3:30 pm IST) and the lead leaves
 * "needs attention" until then; one timeline line each. A lead with no next
 * action gets "Follow up". Open leads only; a salesperson's own only.
 */
export async function bulkSnooze(target: BulkTarget): Promise<BulkResult> {
  const scope = await who('followup');
  if (!scope) return { ok: false, error: 'Your role does not include changing follow-ups.' };
  try {
    const ids = await targetIds(scope, target, 'followup', { stage: { kind: { in: ['OPEN', 'WON'] } } });
    if ('error' in ids) return { ok: false, error: ids.error };
    if (ids.length === 0) return { ok: false, error: 'None of those are open leads you can change.' };
    const day = addDays(istDay(new Date()), SNOOZE_DAYS);
    const at = istTime(day, '15:30');
    const by = await actingMember();
    let done = 0;
    for (const batch of chunks(ids)) {
      const where = { studioId: scope.studioId, id: { in: batch }, deletedAt: null };
      done += (await prisma.studioClient.updateMany({ where: { ...where, nextAction: { not: null } }, data: { nextActionOn: at } })).count;
      done += (await prisma.studioClient.updateMany({ where: { ...where, nextAction: null }, data: { nextActionOn: at, nextAction: 'Follow up' } })).count;
      await recordMany(
        batch.map((clientId) => ({ studioId: scope.studioId, clientId, kind: 'EDITED' as const, summary: `Snoozed ${SNOOZE_DAYS} days — follow up ${meetingLabel(at)}`, meta: { snoozedTo: at.toISOString() } })),
        { by },
      );
    }
    return { ok: true, message: `Done. ${plural(done, 'lead')} snoozed for ${SNOOZE_DAYS} days.` };
  } catch (error) {
    console.error('[bulk] snooze failed', error instanceof Error ? error.message : 'unknown');
    return { ok: false, error: 'That stopped part-way. Check the list before trying again.' };
  }
}

/** Mark lost, with one reason for the batch: the studio's Lost column (vocabulary.ts mainLostStage). */
export async function bulkMarkLost(target: BulkTarget, reason: string): Promise<BulkResult> {
  const scope = await who('move');
  if (!scope) return { ok: false, error: 'Your role does not include moving leads.' };
  const lost = mainLostStage(await prisma.studioStage.findMany({ where: { studioId: scope.studioId, kind: 'LOST' }, orderBy: { sortOrder: 'asc' }, select: { id: true, kind: true, name: true, sortOrder: true } }));
  if (!lost) return { ok: false, error: 'Your pipeline has no lost column. Settings → Pipeline.' };
  return bulkMove(target, lost.id, reason);
}
