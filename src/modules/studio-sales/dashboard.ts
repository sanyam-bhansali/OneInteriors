import 'server-only';

/**
 * The sales dashboard — the counts (leads at scale, 12 Oct 2026). What each
 * number means is `dashboard-rules.ts`; every one here is a SQL `count` or
 * `groupBy` over `scopedLeadWhere(filters)`, never leads loaded into
 * memory. Owner and PM see the whole studio; a salesperson the same page,
 * limited by their scope to their own leads (no pool, no team table).
 */

import { prisma } from '@/lib/prisma';
import { fromDb } from '@/lib/money';
import { LIVE } from '@/modules/studio-practice/demo-lead';
import { LOST_LABELS, SOURCE_LABELS, type ClientSourceName, type LostReasonName } from '@/modules/studio-practice/vocabulary';
import { analyticsScope, myLeadScope, type LeadScope } from '@/modules/studio/lead-scope';
import type { LeadFilters } from './lead-filters';
import { scopedLeadWhere } from './lead-where';
import type { RangeToken } from './ist-range';
import { LOST_FILTERS, conversion, convertedFilters, newLeadKpis, nowKpis, personColumns, rangeKpis, type KpiSpec } from './dashboard-rules';

export interface Kpi extends KpiSpec {
  value: number;
}

export interface SourceRow {
  /** The filter value: `INSTAGRAM` or `own:<id>`. */
  source: string;
  label: string;
  leads: number;
  booked: number;
  pct: number | null;
}

export interface PersonRow {
  id: string;
  name: string;
  cells: Record<string, number>;
}

export interface Dashboard {
  seesAll: boolean;
  now: Kpi[];
  fresh: Kpi[];
  range: Kpi[];
  bookedPaise: number;
  conversion: { pct: number | null; booked: number; added: number };
  lost: { total: number; reasons: { reason: LostReasonName; label: string; count: number }[] };
  sources: SourceRow[];
  columns: { key: string; label: string; filters: LeadFilters }[];
  people: PersonRow[];
}

async function count(scope: LeadScope, f: LeadFilters, now: Date): Promise<number> {
  return prisma.studioClient.count({ where: { ...LIVE, studioId: scope.studioId, AND: [scopedLeadWhere(scope, f, now, LIVE)] } });
}

async function counted(scope: LeadScope, specs: KpiSpec[], now: Date): Promise<Kpi[]> {
  const shown = specs.filter((s) => scope.seesAll || !s.seesAllOnly);
  const values = await Promise.all(shown.map((s) => count(scope, s.filters, now)));
  return shown.map((s, i) => ({ ...s, value: values[i] ?? 0 }));
}

export async function myDashboard(range: RangeToken, now = new Date()): Promise<Dashboard | null> {
  const seen = await myLeadScope();
  if (!seen) return null;
  /* Sales roles (owner, 22 Oct 2026): counted in their analytics reach (team: their subtree only). */
  const scope = analyticsScope(seen);
  const team = scope.team;
  const where = (f: LeadFilters) => ({ ...LIVE, studioId: scope.studioId, AND: [scopedLeadWhere(scope, f, now, LIVE)] });
  const columns = personColumns(range);

  try {
    const [nowK, freshK, rangeK, bookedSum, convBooked, lostTotal, lostBy, srcAll, srcBooked, ownNames, members, perColumn] = await Promise.all([
      counted(scope, nowKpis(), now),
      counted(scope, newLeadKpis(), now),
      counted(scope, rangeKpis(range), now),
      /* What the bookings are worth: the sales final total of each booked
         lead's quotation(s). */
      prisma.studioQuoteRevision.aggregate({
        where: { studioId: scope.studioId, salesFinalOf: { is: { studioId: scope.studioId, client: { is: where({ booked: range }) } } } },
        _sum: { totalPaise: true },
      }),
      count(scope, convertedFilters(range), now),
      count(scope, LOST_FILTERS, now),
      prisma.studioClient.groupBy({ by: ['lostReason'], where: where(LOST_FILTERS), _count: { _all: true } }),
      prisma.studioClient.groupBy({ by: ['source', 'leadSourceId'], where: where({ added: range }), _count: { _all: true } }),
      prisma.studioClient.groupBy({ by: ['source', 'leadSourceId'], where: where(convertedFilters(range)), _count: { _all: true } }),
      prisma.studioLeadSource.findMany({ where: { studioId: scope.studioId }, select: { id: true, name: true } }),
      scope.seesAll || team
        ? prisma.studioMember.findMany({
            where: { studioId: scope.studioId, status: 'ACTIVE', role: { in: ['OWNER', 'PM', 'SALES'] }, ...(team ? { id: { in: [...team] } } : {}) },
            orderBy: { createdAt: 'asc' },
            select: { id: true, role: true, user: { select: { name: true, email: true, phone: true } } },
          })
        : Promise.resolve([]),
      scope.seesAll || team
        ? Promise.all(columns.map((c) => prisma.studioClient.groupBy({ by: ['assignedToId'], where: where(c.filters), _count: { _all: true } })))
        : Promise.resolve([]),
    ]);

    const added = rangeK.find((k) => k.key === 'added')?.value ?? 0;
    const names = new Map(ownNames.map((s) => [s.id, s.name]));
    const keyOf = (r: { source: string; leadSourceId: string | null }) => (r.leadSourceId ? `own:${r.leadSourceId}` : r.source);
    const bookedBy = new Map<string, number>();
    for (const r of srcBooked) bookedBy.set(keyOf(r), (bookedBy.get(keyOf(r)) ?? 0) + r._count._all);
    const leadsBy = new Map<string, number>();
    for (const r of srcAll) leadsBy.set(keyOf(r), (leadsBy.get(keyOf(r)) ?? 0) + r._count._all);

    const people: PersonRow[] = members
      .map((m) => ({
        id: m.id,
        name: m.user.name?.trim() || m.user.email?.split('@')[0] || m.user.phone || 'Someone',
        cells: Object.fromEntries(columns.map((c, i) => [c.key, perColumn[i]?.find((g) => g.assignedToId === m.id)?._count._all ?? 0])),
      }))
      // Salespeople first, then anyone else carrying leads.
      .sort((a, b) => Number(members.find((m) => m.id === b.id)?.role === 'SALES') - Number(members.find((m) => m.id === a.id)?.role === 'SALES'));

    return {
      /* The people table shows for the studio and for a team (sales roles). */
      seesAll: scope.seesAll || team !== null,
      now: nowK,
      fresh: freshK,
      range: rangeK,
      bookedPaise: fromDb(bookedSum._sum.totalPaise ?? 0n),
      conversion: { pct: conversion(convBooked, added), booked: convBooked, added },
      lost: {
        total: lostTotal,
        reasons: lostBy
          .filter((r) => r.lostReason !== null)
          .map((r) => ({ reason: r.lostReason as LostReasonName, label: LOST_LABELS[r.lostReason as LostReasonName], count: r._count._all }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
      },
      sources: [...leadsBy.entries()]
        .map(([source, leads]) => ({
          source,
          label: source.startsWith('own:') ? (names.get(source.slice(4)) ?? 'Other') : (SOURCE_LABELS[source as ClientSourceName] ?? source),
          leads,
          booked: bookedBy.get(source) ?? 0,
          pct: conversion(bookedBy.get(source) ?? 0, leads),
        }))
        .sort((a, b) => b.leads - a.leads),
      columns,
      people,
    };
  } catch (error) {
    console.error('[dashboard] read failed', error instanceof Error ? error.message : 'unknown');
    return null;
  }
}
