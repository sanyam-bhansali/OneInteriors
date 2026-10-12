import 'server-only';

/**
 * The leads list's filters as Prisma `where`s (split from lead-filters.ts,
 * 12 Oct 2026): the KPI rules, the filters, the person's scope, the sort and
 * the keyset. Server only: the browser half (parsing, the URL, labels) is
 * lead-filters.ts, which imports Prisma for types only.
 */

import { Prisma } from '@prisma/client';
import { istDayEnd, istDayStart, rangeBounds } from './ist-range';
import { istDay } from '@/modules/project/working-days';
import { QUIET_AFTER_DAYS, type ClientSourceName } from '@/modules/studio-practice/vocabulary';
import { NOT_SET, salesOwner, type Cursor, type LeadFilters, type SortKey } from './lead-filters';

const OPEN_STAGE: Prisma.StudioClientWhereInput = { stage: { kind: { in: ['OPEN', 'WON'] } } };

/** The clock every rule reads, resolved once (AxLeads `clockNow`), in India days. */
export interface Clock {
  now: Date;
  startOfToday: Date;
  endOfToday: Date;
  /** Untouched since this is cold. */
  staleBefore: Date;
}

export function clockAt(now: Date): Clock {
  const today = istDay(now);
  return { now, startOfToday: istDayStart(today), endOfToday: istDayEnd(today), staleBefore: new Date(now.getTime() - QUIET_AFTER_DAYS * 86_400_000) };
}

/**
 * The KPI rules, as `where` fragments (AxLeads lib/leads/list.ts `rules`,
 * for our tables). Exported so the cards count exactly what they filter.
 */
export function kpiRules(c: Clock) {
  const open = OPEN_STAGE;
  const pendingCall: Prisma.StudioClientWhereInput = { nextActionOn: { not: null } };
  const overdueCall: Prisma.StudioClientWhereInput = { nextActionOn: { lt: c.now } };
  const openTask: Prisma.StudioClientWhereInput = { tasks: { some: { doneAt: null } } };
  const overdueTask: Prisma.StudioClientWhereInput = { tasks: { some: { doneAt: null, dueAt: { lt: c.now } } } };
  /* Due TODAY (IST midnight to midnight), as AxLeads' Today: the overdue
     backlog is Needs action, not Today. */
  const todayBounds = { gte: c.startOfToday, lte: c.endOfToday };
  const callDueToday: Prisma.StudioClientWhereInput = { nextActionOn: todayBounds };
  const taskDueToday: Prisma.StudioClientWhereInput = { tasks: { some: { doneAt: null, dueAt: todayBounds } } };
  /* Still in the intake column with nothing done: no call scheduled, no task,
     never contacted, and no timeline line beyond being created or given to
     somebody (AxLeads: no activity after creation). */
  const untouched: Prisma.StudioClientWhereInput = {
    AND: [
      { stage: { isIntake: true } },
      { nextActionOn: null, lastContactedAt: null },
      { tasks: { none: {} } },
      { events: { none: { kind: { notIn: ['CREATED', 'ASSIGNED'] } } } },
    ],
  };
  const stale: Prisma.StudioClientWhereInput = {
    AND: [open, { OR: [{ nextActionOn: null }, { nextActionOn: { lte: c.now } }] }, { createdAt: { lt: c.staleBefore } }, { events: { none: { createdAt: { gte: c.staleBefore } } } }],
  };
  const callbacks: Prisma.StudioClientWhereInput = { AND: [open, pendingCall] };
  const overdue: Prisma.StudioClientWhereInput = { AND: [open, overdueCall] };
  const tasks: Prisma.StudioClientWhereInput = { AND: [open, openTask] };
  const overdueTasks: Prisma.StudioClientWhereInput = { AND: [open, overdueTask] };
  const needs: Prisma.StudioClientWhereInput = { AND: [open, { OR: [overdueCall, overdueTask] }] };
  /* Today: a call due today, a task due today, or a lead that arrived today
     and nobody has touched. Earlier days are not here (they are Needs action). */
  const today: Prisma.StudioClientWhereInput = {
    OR: [{ AND: [open, callDueToday] }, { AND: [open, taskDueToday] }, { AND: [{ createdAt: { gte: c.startOfToday } }, untouched] }],
  };
  const converted: Prisma.StudioClientWhereInput = { stage: { kind: { in: ['WON', 'DONE'] } } };
  const newToday: Prisma.StudioClientWhereInput = { createdAt: { gte: c.startOfToday } };
  return { callbacks, overdue, tasks, overdueTasks, needs, today, pending: untouched, stale, converted, newToday };
}

/**
 * The filters as a `where` for `prisma.studioClient` — WITHOUT the studio,
 * scope or LIVE (see `scopedLeadWhere`). `meId` resolves `owner=me`.
 */
export function leadWhere(f: LeadFilters, now: Date, meId: string | null = null): Prisma.StudioClientWhereInput {
  const and: Prisma.StudioClientWhereInput[] = [];
  const c = clockAt(now);
  const r = kpiRules(c);
  const start = c.startOfToday;
  const end = c.endOfToday;

  if (f.q) {
    const digits = f.q.replace(/\D/g, '');
    const or: Prisma.StudioClientWhereInput[] = [
      { name: { contains: f.q, mode: 'insensitive' } },
      { society: { contains: f.q, mode: 'insensitive' } },
      { locality: { contains: f.q, mode: 'insensitive' } },
    ];
    if (digits.length >= 3) or.push({ phone: { contains: digits.length > 10 ? digits.slice(-10) : digits } });
    and.push({ OR: or });
  }
  if (f.source?.length) {
    and.push({
      OR: f.source.map((s): Prisma.StudioClientWhereInput => (s.startsWith('own:') ? { leadSourceId: s.slice(4) } : { source: s as ClientSourceName, leadSourceId: null })),
    });
  }
  if (f.stage?.length) and.push({ stageId: { in: f.stage } });
  if (f.kind === 'open') and.push(OPEN_STAGE);
  if (f.kind === 'won') and.push({ stage: { kind: { in: ['WON', 'DONE'] } } });
  if (f.kind === 'lost') and.push({ stage: { kind: 'LOST' } });
  if (f.kind === 'closed') and.push({ stage: { kind: { in: ['DONE', 'LOST'] } } });
  if (f.owner === 'pool') and.push({ assignedToId: null });
  else if (f.owner === 'anyone') and.push({ assignedToId: { not: null } });
  else if (f.owner === 'me') and.push({ assignedToId: meId ?? '__nobody__' });
  else if (f.owner) and.push({ assignedToId: f.owner });

  /* A follow-up, "never called" and "gone quiet" are about work still open:
     a lost lead with an old date is not a missed call. */
  if (f.due?.length) {
    const weekEnd = new Date(start.getTime() + 8 * 86_400_000 - 1);
    const parts = f.due.map((d): Prisma.StudioClientWhereInput => {
      switch (d) {
        case 'overdue':
          return { nextActionOn: { lt: now } };
        case 'today':
          return { nextActionOn: { gte: start, lte: end } };
        case 'week':
          // "This week" includes overdue and today, as in AxLeads.
          return { nextActionOn: { lte: weekEnd } };
        case 'missed':
          return { nextActionOn: { lt: start } };
        case 'due':
          return { nextActionOn: { lte: end } };
        case 'upcoming':
          return { nextActionOn: { gt: end } };
        case 'none':
          return { nextActionOn: null };
      }
    });
    and.push(OPEN_STAGE, parts.length === 1 ? parts[0]! : { OR: parts });
  }
  if (f.never) and.push(OPEN_STAGE, { lastContactedAt: null });
  if (f.quiet) and.push(OPEN_STAGE, { lastContactedAt: { lt: c.staleBefore } });
  if (f.lost) and.push({ lostReason: f.lost });

  if (f.added) and.push({ createdAt: rangeBounds(f.added, now) });
  if (f.contacted) and.push({ lastContactedAt: rangeBounds(f.contacted, now) });
  if (f.meeting) and.push({ meetingAt: rangeBounds(f.meeting, now) });
  if (f.booked) and.push({ bookedAt: rangeBounds(f.booked, now) });
  if (f.quoted) and.push({ quotes: { some: { revisions: { some: { sentAt: rangeBounds(f.quoted, now) } } } } });
  if (f.final) and.push({ quotes: { some: { salesFinalAt: rangeBounds(f.final, now) } } });
  if (f.stale) and.push(r.stale);
  if (f.tags?.length) and.push({ tags: { hasSome: f.tags } });
  for (const [key, values] of Object.entries(f.custom ?? {})) {
    if (!values.length) continue;
    const parts = values.map(
      (value): Prisma.StudioClientWhereInput =>
        value === NOT_SET
          ? { OR: [{ fields: { path: [key], equals: Prisma.AnyNull } }, { fields: { path: [key], equals: '' } }] }
          : { fields: { path: [key], equals: value } },
    );
    and.push(parts.length === 1 ? parts[0]! : { OR: parts });
  }
  if (f.kpi) and.push(r[f.kpi]);

  return and.length === 0 ? {} : { AND: and };
}

/** Who is asking: their studio, their membership, and the `where` their role allows (roles.ts). */
export interface ScopeLike {
  studioId: string;
  member: { id: string };
  leads: Prisma.StudioClientWhereInput;
  /** The pool they may list and claim from (roles.ts `poolVisibleTo`). */
  pool: Prisma.StudioClientWhereInput;
  seesAll: boolean;
}

/**
 * The filters inside the person's scope, for one studio, live rows only
 * (`live` is `LIVE` from demo-lead.ts, or `LISTED` for the board, which shows
 * the sample). For a salesperson the `owner` filter picks between their own
 * leads (the default) and the pool; any other value reads as their own.
 */
export function scopedLeadWhere(
  scope: ScopeLike,
  f: LeadFilters,
  now: Date,
  live: { deletedAt: null; isDemo?: false },
): Prisma.StudioClientWhereInput {
  if (scope.seesAll) return { AND: [scope.leads, { studioId: scope.studioId, ...live }, leadWhere(f, now, scope.member.id)] };
  const fence = salesOwner(f) === 'pool' ? scope.pool : scope.leads;
  return { AND: [fence, { studioId: scope.studioId, ...live }, leadWhere({ ...f, owner: undefined }, now, scope.member.id)] };
}

export function orderByFor(sort: SortKey): Prisma.StudioClientOrderByWithRelationInput[] {
  switch (sort) {
    case 'oldest':
      return [{ createdAt: 'asc' }, { id: 'asc' }];
    case 'lastactive':
      return [{ updatedAt: 'desc' }, { id: 'desc' }];
    case 'followup':
      return [{ nextActionOn: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }];
    case 'contacted':
      return [{ lastContactedAt: { sort: 'asc', nulls: 'first' } }, { id: 'asc' }];
    case 'name':
      return [{ name: 'asc' }, { id: 'asc' }];
    default:
      return [{ createdAt: 'desc' }, { id: 'desc' }];
  }
}

/**
 * Rows after the cursor, in the sort's order (keyset, not offset: page 500 is
 * as quick as page 1). Nulls sit last for the follow-up date and first for
 * "longest since a call", the same as `orderByFor`.
 */
export function keysetWhere(sort: SortKey, c: Cursor): Prisma.StudioClientWhereInput {
  if (sort === 'newest' || sort === 'lastactive') {
    const field = sort === 'newest' ? 'createdAt' : 'updatedAt';
    if (c.v === null) return { id: { lt: c.id } };
    const at = new Date(c.v);
    return { OR: [{ [field]: { lt: at } }, { [field]: at, id: { lt: c.id } }] } as Prisma.StudioClientWhereInput;
  }
  if (sort === 'followup') {
    if (c.v === null) return { nextActionOn: null, id: { gt: c.id } };
    const at = new Date(c.v);
    return { OR: [{ nextActionOn: { gt: at } }, { nextActionOn: at, id: { gt: c.id } }, { nextActionOn: null }] };
  }
  if (sort === 'contacted') {
    if (c.v === null) return { OR: [{ lastContactedAt: null, id: { gt: c.id } }, { lastContactedAt: { not: null } }] };
    const at = new Date(c.v);
    return { OR: [{ lastContactedAt: { gt: at } }, { lastContactedAt: at, id: { gt: c.id } }] };
  }
  if (c.v === null) return { id: { gt: c.id } };
  if (sort === 'name') return { OR: [{ name: { gt: c.v } }, { name: c.v, id: { gt: c.id } }] };
  const at = new Date(c.v);
  return { OR: [{ createdAt: { gt: at } }, { createdAt: at, id: { gt: c.id } }] };
}
