import 'server-only';

/**
 * The leads list and board, paged in SQL (leads at scale, 12 Oct 2026).
 *
 * Hauspire has 26,000 leads. Nothing here loads them: the list reads one
 * page of 50 after a keyset cursor, the board reads the first 50 cards of
 * each column, and every number is a `count` or `groupBy`. Every read
 * starts from the signed-in person's scope (studio/lead-scope.ts) and the
 * filters (`lead-filters.ts`), so a salesperson's list, counts and board
 * only ever hold their own leads.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { readValues } from '@/modules/studio-practice/field-values';
import { boardColumnPlan, claimableView, seesFullLead, type LeadView } from './lead-view';
import { LISTED, LIVE } from '@/modules/studio-practice/demo-lead';
import { clientRows, seedSampleIfEmpty, type ClientRow } from '@/modules/studio-practice/clients';
import { myLeadScope, type LeadScope } from '@/modules/studio/lead-scope';
import { BOARD_KINDS, CLOSED_KINDS } from '@/modules/studio-practice/vocabulary';
import { istDay } from '@/modules/project/working-days';
import { istDayEnd } from './ist-range';
import { PAGE_SIZE, cursorOf, NOT_SET, without, withCustom, type Cursor, type LeadFilters, type SortKey } from './lead-filters';
import { clockAt, keysetWhere, kpiRules, orderByFor, scopedLeadWhere } from './lead-where';
import { rawLeadFence, rawPoolFence } from './lead-sql';
import { subtreeOf } from '@/modules/studio/sales-access';

/** At or above this many leads, the list opens instead of the board. */
export const LIST_DEFAULT_ABOVE = 300;
/** Cards per column, and per "show more". */
export const BOARD_PAGE = 50;

/** How many leads this person can see at all (for "list or board by default"). */
export async function visibleLeadCount(scope: LeadScope): Promise<number> {
  try {
    return await prisma.studioClient.count({ where: { ...LIVE, studioId: scope.studioId, AND: [scope.leads, { studioId: scope.studioId }] } });
  } catch {
    return 0;
  }
}

export interface LeadPage {
  rows: ClientRow[];
  /** Every lead matching the filters (not just this page). */
  total: number;
  /** The `after` value for the next page; null on the last. */
  next: string | null;
}

/** One page of the list. */
export async function leadPage(scope: LeadScope, f: LeadFilters, sort: SortKey, after: Cursor | null, now = new Date()): Promise<LeadPage> {
  const where = scopedLeadWhere(scope, f, now, LIVE);
  try {
    const [rows, total] = await Promise.all([
      clientRows(scope.studioId, after ? { AND: [where, keysetWhere(sort, after)] } : where, orderByFor(sort), PAGE_SIZE + 1),
      prisma.studioClient.count({ where: { ...LIVE, studioId: scope.studioId, AND: [where] } }),
    ]);
    const more = rows.length > PAGE_SIZE;
    const page = rows.slice(0, PAGE_SIZE);
    const last = page[page.length - 1];
    return { rows: page, total, next: more && last ? cursorOf(sort, last) : null };
  } catch (error) {
    console.error('[leads-list] page failed', error instanceof Error ? error.message : 'unknown');
    return { rows: [], total: 0, next: null };
  }
}

/** How many leads match (for "select all N matching"). */
export async function countMatching(scope: LeadScope, f: LeadFilters, now = new Date()): Promise<number> {
  try {
    return await prisma.studioClient.count({ where: { ...LIVE, studioId: scope.studioId, AND: [scopedLeadWhere(scope, f, now, LIVE)] } });
  } catch (error) {
    console.error('[leads-list] countMatching failed', error);
    return 0;
  }
}

export interface BoardColumn {
  stageId: string;
  /** Leads in this column (with the filters), counted in SQL. */
  count: number;
  /** Of those, follow-ups due today or missed. */
  due: number;
}

export interface BoardData {
  rows: ClientRow[];
  columns: BoardColumn[];
  /** Finished and lost, counted; their first 50 are in `rows`. */
  closedCount: number;
}

const BOARD_ORDER = [{ nextActionOn: { sort: 'asc' as const, nulls: 'last' as const } }, { updatedAt: 'desc' as const }, { id: 'asc' as const }];

/**
 * The board: per column, its count and due count from SQL and its first 50
 * cards; closed columns as one count and their first 50. The sample lead is
 * on the board (LISTED) and in no count (LIVE).
 */
export async function boardData(scope: LeadScope, f: LeadFilters, stages: { id: string; kind: string }[], now = new Date()): Promise<BoardData> {
  if (scope.seesAll) await seedSampleIfEmpty();
  const listed = scopedLeadWhere(scope, f, now, LISTED);
  const live = scopedLeadWhere(scope, f, now, LIVE);
  const open = stages.filter((s) => (BOARD_KINDS as string[]).includes(s.kind) && (!f.stage?.length || f.stage.includes(s.id)));
  const closedIds = stages.filter((s) => (CLOSED_KINDS as string[]).includes(s.kind)).map((s) => s.id);
  const end = istDayEnd(istDay(now));
  try {
    const [counts, dues, closedCount, perColumn, closed] = await Promise.all([
      prisma.studioClient.groupBy({ by: ['stageId'], where: { ...LIVE, studioId: scope.studioId, AND: [live] }, _count: { _all: true } }),
      prisma.studioClient.groupBy({ by: ['stageId'], where: { ...LIVE, studioId: scope.studioId, AND: [live, { nextActionOn: { lte: end } }] }, _count: { _all: true } }),
      prisma.studioClient.count({ where: { ...LIVE, studioId: scope.studioId, AND: [live, { stageId: { in: closedIds } }] } }),
      Promise.all(open.map((s) => clientRows(scope.studioId, { AND: [listed, { stageId: s.id }] }, BOARD_ORDER, BOARD_PAGE))),
      clientRows(scope.studioId, { AND: [listed, { stageId: { in: closedIds } }] }, [{ updatedAt: 'desc' }, { id: 'asc' }], BOARD_PAGE),
    ]);
    const countOf = new Map(counts.map((c) => [c.stageId, c._count._all]));
    const dueOf = new Map(dues.map((c) => [c.stageId, c._count._all]));
    const rows = [...perColumn.flat(), ...closed];
    return {
      rows,
      columns: stages.map((s) => ({
        stageId: s.id,
        // The sample is shown but not counted; never show fewer than are drawn.
        count: Math.max(countOf.get(s.id) ?? 0, rows.filter((r) => r.stageId === s.id).length),
        due: dueOf.get(s.id) ?? 0,
      })),
      closedCount: Math.max(closedCount, closed.length),
    };
  } catch (error) {
    console.error('[leads-list] board failed', error instanceof Error ? error.message : 'unknown');
    return { rows: [], columns: stages.map((s) => ({ stageId: s.id, count: 0, due: 0 })), closedCount: 0 };
  }
}

/** The next 50 cards of one column ("Show more"). */
export async function moreCards(f: LeadFilters, stageId: string, offset: number, now = new Date()): Promise<ClientRow[]> {
  const scope = await myLeadScope();
  if (!scope || typeof stageId !== 'string' || stageId.length > 64) return [];
  const skip = Number.isInteger(offset) && offset > 0 ? Math.min(offset, 50_000) : 0;
  try {
    return await clientRows(scope.studioId, { AND: [scopedLeadWhere(scope, f, now, LISTED), { stageId }] }, BOARD_ORDER, BOARD_PAGE, skip);
  } catch {
    return [];
  }
}

export interface DueSnapshot {
  due: number;
  quiet: number;
  pool: number;
  /** The first few due, soonest first. */
  first: ClientRow[];
}

/**
 * The old dashboard's "waiting on you" (owner, PM): counted in SQL, with
 * the first `take` rows only.
 */
export async function dueSnapshot(take = 6, now = new Date()): Promise<DueSnapshot> {
  const scope = await myLeadScope();
  if (!scope) return { due: 0, quiet: 0, pool: 0, first: [] };
  const due = scopedLeadWhere(scope, { due: ['due'] }, now, LIVE);
  try {
    /* "No contact for over a week" on the old dashboard includes never
       contacted: gone quiet plus never called (the two never overlap). */
    const [dueN, quietN, neverN, poolN, first] = await Promise.all([
      prisma.studioClient.count({ where: { ...LIVE, studioId: scope.studioId, AND: [due] } }),
      prisma.studioClient.count({ where: { ...LIVE, studioId: scope.studioId, AND: [scopedLeadWhere(scope, { quiet: true }, now, LIVE)] } }),
      prisma.studioClient.count({ where: { ...LIVE, studioId: scope.studioId, AND: [scopedLeadWhere(scope, { never: true }, now, LIVE)] } }),
      prisma.studioClient.count({ where: { ...LIVE, studioId: scope.studioId, AND: [scopedLeadWhere(scope, { owner: 'pool', kind: 'open' }, now, LIVE)] } }),
      clientRows(scope.studioId, due, orderByFor('followup'), take),
    ]);
    return { due: dueN, quiet: quietN + neverN, pool: poolN, first };
  } catch {
    return { due: 0, quiet: 0, pool: 0, first: [] };
  }
}

export interface Facets {
  /** `INSTAGRAM` or `own:<id>` → leads. */
  source: Record<string, number>;
  /** Column id → leads. */
  stage: Record<string, number>;
  /** Member id, `pool` (not set) or `me` → leads. */
  owner: Record<string, number>;
  /** The studio's list fields: option → leads, and `NOT_SET`. */
  custom: { key: string; label: string; counts: Record<string, number> }[];
}

/**
 * The count beside each filter choice (AxLeads, 12 Oct 2026): for each
 * filter, counted with every OTHER current filter applied, so "Facebook
 * (412)" is what picking Facebook would show. Grouped in SQL; a list field
 * is one count per option plus "Not set" (at most 5 fields, 20 options).
 */
export async function filterFacets(
  scope: LeadScope,
  f: LeadFilters,
  fields: { key: string; label: string; type: string; options: string[] }[],
  now = new Date(),
): Promise<Facets> {
  const where = (g: LeadFilters) => ({ ...LIVE, studioId: scope.studioId, AND: [scopedLeadWhere(scope, g, now, LIVE)] });
  const lists = fields.filter((x) => x.type === 'SELECT' && x.options.length > 0).slice(0, 5);
  try {
    const [bySource, byStage, byOwner, salesMine, salesPool, custom] = await Promise.all([
      prisma.studioClient.groupBy({ by: ['source', 'leadSourceId'], where: where(without(f, 'source')), _count: { _all: true } }),
      prisma.studioClient.groupBy({ by: ['stageId'], where: where(without(without(f, 'stage'), 'kind')), _count: { _all: true } }),
      /* Sales roles: with team reach, per person in their team (the fence keeps it to the team). */
      scope.seesAll || scope.team ? prisma.studioClient.groupBy({ by: ['assignedToId'], where: where(without(f, 'owner')), _count: { _all: true } }) : Promise.resolve([]),
      scope.seesAll ? Promise.resolve(0) : prisma.studioClient.count({ where: { ...LIVE, studioId: scope.studioId, AND: [scopedLeadWhere(scope, { ...f, owner: 'me' }, now, LIVE)] } }),
      scope.seesAll ? Promise.resolve(0) : prisma.studioClient.count({ where: { ...LIVE, studioId: scope.studioId, AND: [scopedLeadWhere(scope, { ...f, owner: 'pool' }, now, LIVE)] } }),
      Promise.all(
        lists.map(async (field) => {
          const values = [...field.options.slice(0, 20), NOT_SET];
          const n = await Promise.all(values.map((v) => prisma.studioClient.count({ where: { ...LIVE, studioId: scope.studioId, AND: [scopedLeadWhere(scope, withCustom(f, field.key, v), now, LIVE)] } })));
          return { key: field.key, label: field.label, counts: Object.fromEntries(values.map((v, i) => [v, n[i] ?? 0])) };
        }),
      ),
    ]);
    const source: Record<string, number> = {};
    for (const r of bySource) {
      const k = r.leadSourceId ? `own:${r.leadSourceId}` : r.source;
      source[k] = (source[k] ?? 0) + r._count._all;
    }
    const owner: Record<string, number> = {};
    for (const r of byOwner) owner[r.assignedToId ?? 'pool'] = r._count._all;
    if (!scope.seesAll) {
      owner.me = salesMine;
      owner.pool = salesPool;
    }
    return { source, stage: Object.fromEntries(byStage.map((r) => [r.stageId, r._count._all])), owner, custom };
  } catch (error) {
    console.error('[leads-list] facets failed', error instanceof Error ? error.message : 'unknown');
    return { source: {}, stage: {}, owner: {}, custom: [] };
  }
}

// ── The AxLeads look (12 Oct 2026) ─────────────────────────────────────

/** Rows per list page and per board column load. */
export const VIEW_PAGE = 50;

const VIEW_INCLUDE = {
  stage: { select: { id: true, name: true, kind: true, colour: true } },
  assignedTo: { select: { user: { select: { name: true, email: true, phone: true } } } },
  leadSource: { select: { name: true } },
} as const;

type ViewRaw = Prisma.StudioClientGetPayload<{ include: typeof VIEW_INCLUDE }>;

/**
 * Lead rows as the list and the board draw them (`lead-view.ts LeadView`):
 * the row, plus — for these rows only, in grouped reads — its newest note and
 * note count, its newest timeline line, and whether the SQL calls it cold.
 * Four reads however many rows (the board passes every column's first page
 * at once). A lead the person may not open yet (a salesperson's view of the
 * pool) goes out as `claimableView`: no phone, notes or own fields, and its
 * notes are not even read.
 */
async function viewsOf(scope: LeadScope, rows: ViewRaw[], now: Date): Promise<LeadView[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const full = rows.filter((r) => seesFullLead(scope, r)).map((r) => r.id);
  const rules = kpiRules(clockAt(now));
  const [notes, noteCounts, lastEvents, stale] = await Promise.all([
    full.length
      ? prisma.studioClientEvent.findMany({
          where: { studioId: scope.studioId, clientId: { in: full }, kind: 'NOTE' },
          orderBy: { createdAt: 'desc' },
          distinct: ['clientId'],
          select: { clientId: true, summary: true },
        })
      : Promise.resolve([]),
    full.length
      ? prisma.studioClientEvent.groupBy({ by: ['clientId'], where: { studioId: scope.studioId, clientId: { in: full }, kind: 'NOTE' }, _count: { _all: true } })
      : Promise.resolve([]),
    prisma.studioClientEvent.groupBy({ by: ['clientId'], where: { studioId: scope.studioId, clientId: { in: ids } }, _max: { createdAt: true } }),
    prisma.studioClient.findMany({ where: { AND: [{ studioId: scope.studioId, id: { in: ids } }, rules.stale] }, select: { id: true } }),
  ]);
  const noteOf = new Map(notes.map((n) => [n.clientId, n.summary]));
  const countOf = new Map(noteCounts.map((n) => [n.clientId, n._count._all]));
  const lastOf = new Map(lastEvents.map((e) => [e.clientId, e._max.createdAt]));
  const staleIds = new Set(stale.map((s) => s.id));
  return rows.map((r) => {
    const view: LeadView = {
      id: r.id,
      name: r.name,
      phone: r.phone,
      society: r.society,
      locality: r.locality,
      city: r.city,
      config: r.config,
      budgetPaise: r.budgetPaise === null ? null : Number(r.budgetPaise),
      source: r.source as LeadView['source'],
      sourceName: r.leadSource?.name ?? null,
      stageId: r.stageId,
      stageName: r.stage.name,
      stageColour: r.stage.colour,
      stageKind: r.stage.kind as LeadView['stageKind'],
      assignedToId: r.assignedToId,
      poolTeamId: r.poolTeamId,
      assignedToName: r.assignedTo ? r.assignedTo.user.name?.trim() || r.assignedTo.user.email?.split('@')[0] || r.assignedTo.user.phone || 'Someone' : null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      lastActivityAt: lastOf.get(r.id) ?? null,
      lastContactedAt: r.lastContactedAt,
      nextAction: r.nextAction,
      nextActionOn: r.nextActionOn,
      tags: r.tags,
      latestNote: noteOf.get(r.id) ?? null,
      noteCount: countOf.get(r.id) ?? 0,
      fields: Object.fromEntries(Object.entries(readValues(r.fields)).map(([k, v]) => [k, String(v ?? '')])),
      isDemo: r.isDemo,
      flags: { stale: staleIds.has(r.id), closed: r.stage.kind === 'LOST' || r.stage.kind === 'DONE' },
    };
    return seesFullLead(scope, r) ? view : claimableView(view);
  });
}

async function leadViews(scope: LeadScope, where: Prisma.StudioClientWhereInput, orderBy: Prisma.StudioClientOrderByWithRelationInput[], take: number, now: Date): Promise<LeadView[]> {
  const rows = await prisma.studioClient.findMany({
    where: { AND: [where, { studioId: scope.studioId, deletedAt: null }] },
    orderBy,
    take,
    include: VIEW_INCLUDE,
  });
  return viewsOf(scope, rows, now);
}

export interface ViewPage {
  rows: LeadView[];
  next: string | null;
  /**
   * A board column not loaded yet (won, finished, lost): its count is in
   * the header and its cards load when the person opens it.
   */
  lazy?: boolean;
}

/** One page of the list (infinite scroll): keyset after `after`. */
export async function viewPage(scope: LeadScope, f: LeadFilters, sort: SortKey, after: Cursor | null, now = new Date()): Promise<ViewPage> {
  const where = scopedLeadWhere(scope, f, now, LIVE);
  try {
    const rows = await leadViews(scope, after ? { AND: [where, keysetWhere(sort, after)] } : where, orderByFor(sort), VIEW_PAGE + 1, now);
    const page = rows.slice(0, VIEW_PAGE);
    const last = page[page.length - 1];
    return { rows: page, next: rows.length > VIEW_PAGE && last ? cursorOf(sort, last) : null };
  } catch (error) {
    console.error('[leads-list] view page failed', error instanceof Error ? error.message : 'unknown');
    return { rows: [], next: null };
  }
}

/** One column's cards, with the filters (the stage filter picks columns, not cards). The sample is shown here. */
function columnWhere(scope: LeadScope, f: LeadFilters, stageId: string, now: Date): Prisma.StudioClientWhereInput {
  return { AND: [scopedLeadWhere(scope, { ...f, stage: undefined }, now, LISTED), { stageId }] };
}

/** One board column's next cards (newest first), with the same filters. */
export async function columnPage(scope: LeadScope, f: LeadFilters, stageId: string, after: Cursor | null, now = new Date()): Promise<ViewPage> {
  const where = columnWhere(scope, f, stageId, now);
  try {
    const rows = await leadViews(scope, after ? { AND: [where, keysetWhere('newest', after)] } : where, orderByFor('newest'), VIEW_PAGE + 1, now);
    const page = rows.slice(0, VIEW_PAGE);
    const last = page[page.length - 1];
    return { rows: page, next: rows.length > VIEW_PAGE && last ? cursorOf('newest', last) : null };
  } catch (error) {
    console.error('[leads-list] viewPage failed', error);
    return { rows: [], next: null };
  }
}

/**
 * The board's first load (leads at scale): the first page of every open
 * column — one light read per column, then ONE batch of the four extra
 * reads for all their cards together — and won, finished and lost columns
 * left `lazy` (`boardColumnPlan`; their counts come from `stageCounts`, in
 * SQL). About columns + 4 queries, instead of 5 per column.
 */
export async function boardPages(scope: LeadScope, f: LeadFilters, stages: readonly { id: string; kind: string }[], now = new Date()): Promise<Record<string, ViewPage>> {
  const plan = boardColumnPlan(stages, f.stage);
  const out: Record<string, ViewPage> = {};
  for (const id of plan.lazy) out[id] = { rows: [], next: null, lazy: true };
  try {
    const perColumn = await Promise.all(
      plan.eager.map((stageId) =>
        prisma.studioClient.findMany({
          where: { AND: [columnWhere(scope, f, stageId, now), { studioId: scope.studioId, deletedAt: null }] },
          orderBy: orderByFor('newest'),
          take: VIEW_PAGE + 1,
          include: VIEW_INCLUDE,
        }),
      ),
    );
    const pages = perColumn.map((rows) => rows.slice(0, VIEW_PAGE));
    const views = new Map((await viewsOf(scope, pages.flat(), now)).map((v) => [v.id, v]));
    plan.eager.forEach((stageId, i) => {
      const page = (pages[i] ?? []).map((r) => views.get(r.id)).filter((v): v is LeadView => Boolean(v));
      const last = page[page.length - 1];
      out[stageId] = { rows: page, next: (perColumn[i]?.length ?? 0) > VIEW_PAGE && last ? cursorOf('newest', last) : null };
    });
  } catch (error) {
    console.error('[leads-list] board failed', error instanceof Error ? error.message : 'unknown');
    for (const id of plan.eager) out[id] = { rows: [], next: null };
  }
  return out;
}

export interface Kpis {
  total: number;
  newToday: number;
  today: number;
  pending: number;
  callbacks: number;
  overdue: number;
  tasks: number;
  overdueTasks: number;
  needs: number;
  converted: number;
  stale: number;
}

const NO_KPIS: Kpis = { total: 0, newToday: 0, today: 0, pending: 0, callbacks: 0, overdue: 0, tasks: 0, overdueTasks: 0, needs: 0, converted: 0, stale: 0 };

/**
 * Every card on the page (AxLeads `leadKpis`), against the list's filters
 * WITHOUT the card filter itself — clicking Pending narrows the list, not the
 * cards. Counted in SQL, one count per card.
 */
export async function leadKpis(scope: LeadScope, f: LeadFilters, now = new Date()): Promise<Kpis> {
  const base = scopedLeadWhere(scope, { ...f, kpi: undefined }, now, LIVE);
  const r = kpiRules(clockAt(now));
  const n = (extra: Prisma.StudioClientWhereInput) => prisma.studioClient.count({ where: { ...LIVE, studioId: scope.studioId, AND: [base, extra] } });
  try {
    const [total, newToday, today, pending, callbacks, overdue, tasks, overdueTasks, needs, converted, stale] = await Promise.all([
      n({}),
      n(r.newToday),
      n(r.today),
      n(r.pending),
      n(r.callbacks),
      n(r.overdue),
      n(r.tasks),
      n(r.overdueTasks),
      n(r.needs),
      n(r.converted),
      n(r.stale),
    ]);
    return { total, newToday, today, pending, callbacks, overdue, tasks, overdueTasks, needs, converted, stale };
  } catch (error) {
    console.error('[leads-list] kpis failed', error instanceof Error ? error.message : 'unknown');
    return NO_KPIS;
  }
}

/** Leads per column with every filter on (the board's headers), in SQL. */
export async function stageCounts(scope: LeadScope, f: LeadFilters, now = new Date()): Promise<Record<string, number>> {
  try {
    const rows = await prisma.studioClient.groupBy({
      by: ['stageId'],
      where: { ...LIVE, studioId: scope.studioId, AND: [scopedLeadWhere(scope, { ...f, stage: undefined }, now, LIVE)] },
      _count: { _all: true },
    });
    return Object.fromEntries(rows.map((r) => [r.stageId, r._count._all]));
  } catch {
    return {};
  }
}


export interface PoolTab {
  /** `studio`, or a head's member id. */
  key: string;
  label: string;
  /** Open, unassigned leads in it (with the other filters). */
  n: number;
}

/**
 * The pools this person may see, as tabs (sales roles and teams, owner
 * 22 Oct 2026): the studio pool and each head's team pool that has leads,
 * counted in SQL inside their pool fence. Never a pool they may not see.
 */
export async function poolTabsFor(scope: LeadScope, f: LeadFilters, now = new Date()): Promise<PoolTab[]> {
  try {
    const rows = await prisma.studioClient.groupBy({
      by: ['poolTeamId'],
      where: { ...LIVE, studioId: scope.studioId, AND: [scopedLeadWhere(scope, { ...f, owner: 'pool', poolTeam: undefined }, now, LIVE)] },
      _count: { _all: true },
    });
    const heads = rows.map((r) => r.poolTeamId).filter((id): id is string => typeof id === 'string');
    const names = heads.length
      ? await prisma.studioMember.findMany({ where: { studioId: scope.studioId, id: { in: heads } }, select: { id: true, user: { select: { name: true, email: true, phone: true } } } })
      : [];
    const nameOf = new Map(names.map((m) => [m.id, m.user.name?.trim() || m.user.email?.split('@')[0] || m.user.phone || 'Someone']));
    const studio = rows.find((r) => r.poolTeamId === null)?._count._all ?? 0;
    const tabs: PoolTab[] = [];
    if (scope.pools.kind === 'all' || (scope.pools.kind === 'some' && scope.pools.studio)) tabs.push({ key: 'studio', label: 'Studio pool', n: studio });
    for (const r of rows) {
      if (!r.poolTeamId) continue;
      tabs.push({ key: r.poolTeamId, label: `${nameOf.get(r.poolTeamId) ?? 'A team'}’s team`, n: r._count._all });
    }
    return tabs;
  } catch (error) {
    console.error('[leads-list] poolTabsFor failed', error);
    return [];
  }
}

/** A head's team (them and everyone below them), for "assigning from a team pool offers only that head's team". Studio-scoped. */
export async function headTeam(scope: LeadScope, headId: string): Promise<string[]> {
  try {
    const tree = await prisma.studioMember.findMany({ where: { studioId: scope.studioId }, select: { id: true, reportsToId: true } });
    return tree.some((m) => m.id === headId) ? subtreeOf(headId, tree) : [];
  } catch {
    return [];
  }
}

/** The person's fence for the raw counts below: the studio, and for a salesperson their own leads, their team's (sales roles), or the pools. */
function rawFence(scope: LeadScope, f: LeadFilters): Prisma.Sql {
  if (scope.seesAll) {
    if (f.owner === 'pool') return Prisma.sql`AND c."assignedToId" IS NULL`;
    if (f.owner === 'me') return Prisma.sql`AND c."assignedToId" = ${scope.member.id}`;
    if (f.owner && f.owner !== 'anyone') return Prisma.sql`AND c."assignedToId" = ${f.owner}`;
    return Prisma.empty;
  }
  if (f.owner === 'pool') return rawPoolFence(scope);
  if (scope.team) {
    const team = [...scope.team];
    if (f.owner === 'me') return Prisma.sql`AND c."assignedToId" = ${scope.member.id}`;
    if (f.owner === 'anyone') return Prisma.sql`AND c."assignedToId" = ANY(${team}::text[])`;
    if (f.owner) return team.includes(f.owner) ? Prisma.sql`AND c."assignedToId" = ${f.owner}` : Prisma.sql`AND false`;
    return rawLeadFence(scope);
  }
  return Prisma.sql`AND c."assignedToId" = ${scope.member.id}`;
}

/**
 * Tag counts and the studio's group-by field values with counts, for the
 * filter panel (AxLeads `facetCounts`). Counted in SQL over the person's
 * leads with their owner choice applied; the other panel filters are not
 * (a raw GROUP BY over JSON and arrays cannot take Prisma's filter).
 */
export async function tagAndGroupFacets(
  scope: LeadScope,
  f: LeadFilters,
  groupKeys: string[],
): Promise<{ tags: { value: string; n: number }[]; groups: Record<string, { value: string; n: number }[]> }> {
  const fence = rawFence(scope, f);
  const keys = groupKeys.slice(0, 6);
  try {
    const [tags, ...groups] = await Promise.all([
      prisma.$queryRaw<{ value: string; n: number }[]>(
        Prisma.sql`SELECT tg AS value, COUNT(*)::int AS n
          FROM studio_clients c CROSS JOIN LATERAL unnest(c.tags) AS tg
          WHERE c."studioId" = ${scope.studioId} AND c."deletedAt" IS NULL AND c."isDemo" = false ${fence}
          GROUP BY tg ORDER BY n DESC, tg ASC LIMIT 200`,
      ),
      ...keys.map((key) =>
        prisma.$queryRaw<{ value: string; n: number }[]>(
          Prisma.sql`SELECT COALESCE(NULLIF(c.fields->>${key}, ''), ${NOT_SET}) AS value, COUNT(*)::int AS n
            FROM studio_clients c
            WHERE c."studioId" = ${scope.studioId} AND c."deletedAt" IS NULL AND c."isDemo" = false ${fence}
            GROUP BY 1 ORDER BY n DESC LIMIT 60`,
        ),
      ),
    ]);
    return {
      tags: (tags ?? []).map((t) => ({ value: t.value, n: Number(t.n) })),
      groups: Object.fromEntries(keys.map((k, i) => [k, (groups[i] ?? []).map((g) => ({ value: g.value, n: Number(g.n) }))])),
    };
  } catch (error) {
    console.error('[leads-list] tag facets failed', error instanceof Error ? error.message : 'unknown');
    return { tags: [], groups: {} };
  }
}
