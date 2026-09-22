import 'server-only';

/**
 * Is any of this working?
 *
 * ## Counted in SQL, never from the board
 *
 * `myClients()` takes 400 rows to draw a board. Deriving numbers from that
 * slice would produce a "total" that silently stops growing at 400 and a
 * conversion rate that is really a conversion rate *of the most recent 400* —
 * which is worse than no number, because it looks like one.
 *
 * So every figure here is its own `count` or `groupBy`. AxLeads learned the
 * same lesson and moved its KPI tiles into SQL for the same reason: the tiles
 * describe the workspace, the list describes a page.
 *
 * ## Every count carries LIVE
 *
 * The sample lead is a real row. `tests/demo-lead.test.ts` fails any
 * `studioClient.count` that omits the filter, and it is right to: a studio
 * whose board has one demo card should be told it has nothing, not that it
 * has one lead and a 0% win rate.
 *
 * ## What this deliberately does not compute
 *
 * A lead score. AxLeads has a thirteen-rule scoring table, and its HOT
 * pathway is hardcoded off — the score is computed, stored, displayed, and
 * gates nothing. A studio with forty leads does not need a score; one with
 * four thousand does, and none of ours has four thousand. See
 * `docs/LEADS-V2.md` §7.
 */

import { prisma } from '@/lib/prisma';
import { myStudioId } from '@/modules/studio-quote/store';
import { LIVE } from './demo-lead';
import { fromDb, type Paise } from '@/lib/money';

export interface SourceCount {
  source: string;
  total: number;
  won: number;
}

export interface StageCount {
  stageId: string;
  name: string;
  kind: string;
  colour: string;
  count: number;
}

export interface LeadAnalytics {
  /** Every live lead this studio has ever had, including closed ones. */
  total: number;
  /** In an OPEN or WON column — work in flight. */
  open: number;
  /** Nobody has taken it, and it is still open. */
  pooled: number;
  /** Open, with a follow-up date in the past. */
  overdue: number;
  /** Open, and nobody has logged contact in QUIET_AFTER_DAYS. */
  quiet: number;
  won: number;
  lost: number;
  /** Arrived in the last 30 days. */
  newThisMonth: number;
  /** Won ÷ (won + lost), as a percentage. Null until anything has closed. */
  winRate: number | null;
  /** Total quoted value against WON clients. */
  wonValuePaise: Paise;
  byStage: StageCount[];
  bySource: SourceCount[];
  /** Why the lost ones went, most common first. */
  lostReasons: { reason: string; count: number }[];
}

const DAY = 86_400_000;

export async function leadAnalytics(): Promise<LeadAnalytics | null> {
  const studioId = await myStudioId();
  if (!studioId) return null;

  try {
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * DAY);

    /* Stage kind is the unit of meaning everywhere in this folder — the
       studio owns the column NAMES, so a literal list would stop counting
       the day somebody renamed one. Fetched first because several counts
       below need the id sets. */
    const stages = await prisma.studioStage.findMany({
      where: { studioId },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, kind: true, colour: true },
    });

    const idsOfKind = (...kinds: string[]) =>
      stages.filter((s) => kinds.includes(s.kind)).map((s) => s.id);

    const openIds = idsOfKind('OPEN', 'WON');
    const wonIds = idsOfKind('WON', 'DONE');
    const lostIds = idsOfKind('LOST');

    const quietBefore = new Date(now.getTime() - 7 * DAY);

    const [
      total,
      open,
      pooled,
      overdue,
      quiet,
      won,
      lost,
      newThisMonth,
      byStageRaw,
      bySourceRaw,
      wonSourceRaw,
      lostReasonRaw,
      wonValue,
    ] = await Promise.all([
      prisma.studioClient.count({ where: { studioId, ...LIVE } }),
      prisma.studioClient.count({ where: { studioId, ...LIVE, stageId: { in: openIds } } }),
      prisma.studioClient.count({
        where: { studioId, ...LIVE, assignedToId: null, stageId: { in: openIds } },
      }),
      prisma.studioClient.count({
        where: { studioId, ...LIVE, stageId: { in: openIds }, nextActionOn: { lt: now } },
      }),
      /* "Quiet" is contact, not activity. `lastContactedAt` is written only
         by logContact — never by an edit — so this measures conversations,
         not keystrokes. A null has never been contacted at all, which is the
         loudest version of quiet and has to be included. */
      prisma.studioClient.count({
        where: {
          studioId,
          ...LIVE,
          stageId: { in: openIds },
          OR: [{ lastContactedAt: null }, { lastContactedAt: { lt: quietBefore } }],
        },
      }),
      prisma.studioClient.count({ where: { studioId, ...LIVE, stageId: { in: wonIds } } }),
      prisma.studioClient.count({ where: { studioId, ...LIVE, stageId: { in: lostIds } } }),
      prisma.studioClient.count({
        where: { studioId, ...LIVE, createdAt: { gte: monthAgo } },
      }),
      prisma.studioClient.groupBy({
        by: ['stageId'],
        where: { studioId, ...LIVE },
        _count: { _all: true },
      }),
      prisma.studioClient.groupBy({
        by: ['source'],
        where: { studioId, ...LIVE },
        _count: { _all: true },
      }),
      prisma.studioClient.groupBy({
        by: ['source'],
        where: { studioId, ...LIVE, stageId: { in: wonIds } },
        _count: { _all: true },
      }),
      prisma.studioClient.groupBy({
        by: ['lostReason'],
        where: { studioId, ...LIVE, stageId: { in: lostIds }, lostReason: { not: null } },
        _count: { _all: true },
      }),
      /* Summed from the LINES, not from a stored total — StudioQuote has no
         total column, on purpose, so a quotation edited today shows through
         immediately. `clients.ts` says the same thing where it computes the
         value on a card: "the same rule as everywhere else". Aggregating the
         line table directly keeps it one query instead of loading every
         quote and folding it in JavaScript. */
      prisma.studioQuoteLine.aggregate({
        where: {
          quote: { studioId, client: { ...LIVE, stageId: { in: wonIds } } },
        },
        _sum: { amountPaise: true },
      }),
    ]);

    const stageCount = new Map(byStageRaw.map((r) => [r.stageId, r._count._all]));
    const wonBySource = new Map(wonSourceRaw.map((r) => [r.source, r._count._all]));

    const closed = won + lost;

    return {
      total,
      open,
      pooled,
      overdue,
      quiet,
      won,
      lost,
      newThisMonth,
      /* Null, not zero, until something has closed. A studio three days in
         should read "nothing has closed yet", not "0%" — which is a verdict
         on work they have not finished. */
      winRate: closed === 0 ? null : Math.round((won / closed) * 100),
      wonValuePaise: fromDb(wonValue._sum.amountPaise ?? 0n),
      byStage: stages.map((s) => ({
        stageId: s.id,
        name: s.name,
        kind: s.kind,
        colour: s.colour,
        count: stageCount.get(s.id) ?? 0,
      })),
      bySource: bySourceRaw
        .map((r) => ({
          source: r.source,
          total: r._count._all,
          won: wonBySource.get(r.source) ?? 0,
        }))
        .sort((a, b) => b.total - a.total),
      lostReasons: lostReasonRaw
        .map((r) => ({ reason: r.lostReason ?? 'OTHER', count: r._count._all }))
        .sort((a, b) => b.count - a.count),
    };
  } catch (error) {
    console.error('[analytics] lead analytics failed', error);
    return null;
  }
}

/**
 * The three numbers the board leads with.
 *
 * ## Why not just call `leadAnalytics()`
 *
 * That runs thirteen counts and two groupBys, which is right for a page whose
 * whole job is numbers and wasteful on the one screen a studio opens twenty
 * times a day. This is three.
 *
 * ## Why these three
 *
 * They are the only figures on either screen that describe a PROBLEM. Total,
 * open and won all go up and can never be bad news, so they teach nobody
 * anything at a glance — they belong on the analytics page where somebody has
 * gone looking. These three go down when the studio does its job, which is
 * what makes them worth putting where the work happens.
 *
 * Counted in SQL rather than from the board's loaded rows for the same reason
 * as everywhere else: `myClients()` takes 400, so a derived "overdue" would
 * silently stop counting at 400 and read as an improvement.
 */
export interface BoardCounts {
  overdue: number;
  pooled: number;
  quiet: number;
}

export async function boardCounts(): Promise<BoardCounts> {
  const studioId = await myStudioId();
  if (!studioId) return { overdue: 0, pooled: 0, quiet: 0 };

  try {
    const now = new Date();
    const quietBefore = new Date(now.getTime() - 7 * DAY);

    const openIds = (
      await prisma.studioStage.findMany({
        where: { studioId, kind: { in: ['OPEN', 'WON'] } },
        select: { id: true },
      })
    ).map((s) => s.id);

    /* Bail before three counts that can only return zero. A studio whose
       pipeline has no open columns has bigger problems than this strip. */
    if (openIds.length === 0) return { overdue: 0, pooled: 0, quiet: 0 };

    const [overdue, pooled, quiet] = await Promise.all([
      prisma.studioClient.count({
        where: { studioId, ...LIVE, stageId: { in: openIds }, nextActionOn: { lt: now } },
      }),
      prisma.studioClient.count({
        where: { studioId, ...LIVE, stageId: { in: openIds }, assignedToId: null },
      }),
      prisma.studioClient.count({
        where: {
          studioId,
          ...LIVE,
          stageId: { in: openIds },
          /* Never contacted counts as quiet, and is the loudest version of
             it — `lastContactedAt` is written only by logContact, so this
             measures conversations rather than keystrokes. */
          OR: [{ lastContactedAt: null }, { lastContactedAt: { lt: quietBefore } }],
        },
      }),
    ]);

    return { overdue, pooled, quiet };
  } catch (error) {
    console.error('[analytics] board counts failed', error);
    return { overdue: 0, pooled: 0, quiet: 0 };
  }
}
