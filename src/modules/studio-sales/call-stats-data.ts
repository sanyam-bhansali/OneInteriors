import 'server-only';

/**
 * The reads behind the Calling tab of lead analytics (improvement 7, owner
 * 22 Oct 2026). The rules and the arithmetic are call-stats.ts (pure,
 * tested); this file only asks Postgres for small, already-grouped rows.
 *
 * ## Fast at Hauspire's size
 *
 * 26,000 leads and about 100,000 timeline lines. Nothing here loads lines:
 * five grouped reads, each starting from the `[studioId, kind, createdAt]`
 * index on studio_client_events (or `[clientId, createdAt]` for a lead's
 * first call), each returning at most a few hundred rows whatever the range
 * — outcomes per person per day, distinct leads per person, first connects
 * per person per number of tries, one median per person, and one count per
 * funnel step. The outcome lists come from call-stats.ts as parameters, so
 * what counts as a connect is decided in one place.
 *
 * ## Who sees what
 *
 * The page is the owner's and the PM's (surfaces.ts closes
 * /studio/clients/analytics to sales). Should a salesperson ever reach this
 * read, it narrows itself: calls they made, leads assigned to them. The
 * studio id always comes from the signed-in member, never from the URL.
 *
 * Sales roles and teams (owner, 22 Oct 2026): a salesperson whose role has
 * "See the numbers" opens the page; with team reach every number is their
 * subtree's only — calls their team made, leads their team has
 * (studio/lead-scope.ts `analyticsScope`, lead-sql.ts `rawLeadFence`).
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { analyticsScope, myLeadScope } from '@/modules/studio/lead-scope';
import { rawLeadFence } from './lead-sql';
import {
  CONNECT_OUTCOMES,
  NOT_DIAL_OUTCOMES,
  buildCallStats,
  stepPlan,
  type CallRange,
  type CallStats,
  type FirstCallCount,
  type OutcomeCount,
  type ReachCount,
  type StepCount,
  type TriesCount,
} from './call-stats';

/** A JS instant as the UTC wall-clock our TIMESTAMP(3) columns hold, whatever the session time zone. */
const ts = (d: Date) => Prisma.sql`(${d.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;

/** The outcome as call-stats.ts reads it: none at all is the old "Spoke to them"; a JSON null stays null. */
const outcomeOf = (e: string) => Prisma.raw(`(CASE WHEN ${e}.meta -> 'outcome' IS NULL THEN 'spoke' ELSE ${e}.meta ->> 'outcome' END)`);

/** Whether a line is a dial / a connect (call-stats.ts `callKind`). */
const dialSql = (e: string) => Prisma.sql`NOT (COALESCE(${outcomeOf(e)}, '') = ANY(${[...NOT_DIAL_OUTCOMES]}::text[]))`;
const connectSql = (e: string) => Prisma.sql`(COALESCE(${outcomeOf(e)}, '') = ANY(${[...CONNECT_OUTCOMES]}::text[]))`;

export interface CallStatsPage {
  stats: CallStats;
  /** Owner or PM: everyone's numbers. False: only the signed-in person's (or their team's: `team`). */
  seesAll: boolean;
  /** Sales roles: the numbers are their team's (more than one person, not the studio). */
  team?: boolean;
}

/** The Calling tab's numbers for this range, or null when the person may not see leads (or the read failed). */
export async function callStatsFor(range: CallRange): Promise<CallStatsPage | null> {
  const seen = await myLeadScope();
  if (!seen) return null;
  const scope = analyticsScope(seen);
  const studioId = scope.studioId;
  const me = scope.member.id;
  const seesAll = scope.seesAll;
  /* Whose calls: everyone, their team (sales roles), or only theirs. */
  const people = seesAll ? null : scope.team ? [...scope.team] : [me];
  /* A salesperson: the calls they (or their team) made, and only those leads in the funnel. */
  const byFence = people === null ? Prisma.empty : Prisma.sql`AND e."byId" = ANY(${people}::text[])`;
  const leadFence = rawLeadFence(scope);
  const from = ts(range.from);
  const to = ts(range.to);

  try {
    const [stages, members] = await Promise.all([
      prisma.studioStage.findMany({
        where: { studioId },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true, kind: true, sortOrder: true, isIntake: true, isCallStep: true },
      }),
      prisma.studioMember.findMany({
        where: { studioId, ...(people === null ? {} : { id: { in: people } }) },
        select: { id: true, role: true, status: true, user: { select: { name: true, email: true, phone: true } } },
      }),
    ]);
    const plan = stepPlan(stages);
    const ids = Object.keys(plan.rankOf);
    const ranks = ids.map((id) => plan.rankOf[id]!);
    /* No won step: a rank nothing reaches, so "reached won" is zero and the page leaves the line out. */
    const wonRank = plan.wonRank ?? 1_000_000;

    const [outcomes, reach, tries, firstCalls, steps] = await Promise.all([
      /* Lines per person, per India day, per outcome. The sample lead's calls are practice, not work. */
      prisma.$queryRaw<{ member_id: string | null; day: string; outcome: string | null; n: number }[]>(Prisma.sql`
        SELECT e."byId" AS member_id,
               to_char(e."createdAt" + interval '330 minutes', 'YYYY-MM-DD') AS day,
               ${outcomeOf('e')} AS outcome,
               COUNT(*)::int AS n
        FROM studio_client_events e
        JOIN studio_clients c ON c.id = e."clientId" AND c."isDemo" = false
        WHERE e."studioId" = ${studioId} AND e.kind = 'CONTACTED'
          AND e."createdAt" >= ${from} AND e."createdAt" <= ${to} ${byFence}
        GROUP BY 1, 2, 3`),
      /* Distinct leads dialled and reached: per person, and the studio's own total. */
      prisma.$queryRaw<{ member_id: string | null; is_total: number; dialled: number; reached: number }[]>(Prisma.sql`
        SELECT e."byId" AS member_id,
               GROUPING(e."byId")::int AS is_total,
               (COUNT(DISTINCT e."clientId") FILTER (WHERE ${dialSql('e')}))::int AS dialled,
               (COUNT(DISTINCT e."clientId") FILTER (WHERE ${connectSql('e')}))::int AS reached
        FROM studio_client_events e
        JOIN studio_clients c ON c.id = e."clientId" AND c."isDemo" = false
        WHERE e."studioId" = ${studioId} AND e.kind = 'CONTACTED'
          AND e."createdAt" >= ${from} AND e."createdAt" <= ${to} ${byFence}
        GROUP BY GROUPING SETS ((e."byId"), ())`),
      /* Leads whose first connect ever is in the range: the dials before it, by anybody, as a histogram per connecting person. */
      prisma.$queryRaw<{ member_id: string | null; tries: number; n: number }[]>(Prisma.sql`
        WITH cand AS (
          SELECT DISTINCT e."clientId" AS client_id
          FROM studio_client_events e
          JOIN studio_clients c ON c.id = e."clientId" AND c."isDemo" = false
          WHERE e."studioId" = ${studioId} AND e.kind = 'CONTACTED'
            AND e."createdAt" >= ${from} AND e."createdAt" <= ${to} AND ${connectSql('e')}
        ),
        ev AS (
          SELECT e.id, e."clientId" AS client_id, e."byId" AS member_id, e."createdAt" AS at,
                 ${dialSql('e')} AS dial, ${connectSql('e')} AS connect
          FROM studio_client_events e
          JOIN cand ON cand.client_id = e."clientId"
          WHERE e."studioId" = ${studioId} AND e.kind = 'CONTACTED' AND e."createdAt" <= ${to}
        ),
        firsts AS (
          SELECT DISTINCT ON (client_id) client_id, member_id, at, id
          FROM ev WHERE connect
          ORDER BY client_id, at, id
        ),
        per_lead AS (
          SELECT f.client_id, f.member_id, COUNT(x.id)::int AS tries
          FROM firsts f
          LEFT JOIN ev x ON x.client_id = f.client_id AND x.dial AND (x.at < f.at OR (x.at = f.at AND x.id < f.id))
          WHERE f.at >= ${from} ${people === null ? Prisma.empty : Prisma.sql`AND f.member_id = ANY(${people}::text[])`}
          GROUP BY f.client_id, f.member_id
        )
        SELECT member_id, tries, COUNT(*)::int AS n FROM per_lead GROUP BY 1, 2`),
      /* Leads that arrived in the range: wait to the first dial, median per first dialler and for everyone, and those not rung yet. */
      prisma.$queryRaw<{ member_id: string | null; is_total: number; called: number; not_called: number; median: number | null }[]>(Prisma.sql`
        WITH arrived AS (
          SELECT c.id, c."createdAt" AS arrived_at, f.member_id, f.at
          FROM studio_clients c
          LEFT JOIN LATERAL (
            SELECT e."byId" AS member_id, e."createdAt" AS at
            FROM studio_client_events e
            WHERE e."clientId" = c.id AND e.kind = 'CONTACTED' AND ${dialSql('e')}
            ORDER BY e."createdAt", e.id
            LIMIT 1
          ) f ON true
          WHERE c."studioId" = ${studioId} AND c."deletedAt" IS NULL AND c."isDemo" = false
            AND c."createdAt" >= ${from} AND c."createdAt" <= ${to} ${leadFence}
        )
        SELECT member_id,
               GROUPING(member_id)::int AS is_total,
               COUNT(at)::int AS called,
               (COUNT(*) FILTER (WHERE at IS NULL))::int AS not_called,
               (percentile_cont(0.5) WITHIN GROUP (ORDER BY (GREATEST(0, EXTRACT(EPOCH FROM (at - arrived_at)) / 60.0))::float8) FILTER (WHERE at IS NOT NULL))::float8 AS median
        FROM arrived
        GROUP BY GROUPING SETS ((member_id), ())`),
      /* Per funnel step: leads that entered it in the range, and how many later reached a step after it / the first won step. */
      ids.length === 0
        ? Promise.resolve([] as { rank: number; entered: number; moved_on: number; reached_won: number }[])
        : prisma.$queryRaw<{ rank: number; entered: number; moved_on: number; reached_won: number }[]>(Prisma.sql`
        WITH rk AS (
          SELECT * FROM unnest(${ids}::text[], ${ranks}::int[]) AS t(stage_id, rank)
        ),
        moves AS (
          SELECT e."clientId" AS client_id, e."createdAt" AS at, rt.rank, rf.rank AS from_rank
          FROM studio_client_events e
          JOIN rk rt ON rt.stage_id = e.meta ->> 'toStageId'
          LEFT JOIN rk rf ON rf.stage_id = e.meta ->> 'fromStageId'
          JOIN studio_clients c ON c.id = e."clientId" AND c."deletedAt" IS NULL AND c."isDemo" = false ${leadFence}
          WHERE e."studioId" = ${studioId} AND e.kind = 'STAGE_CHANGED' AND e."createdAt" >= ${from}
        ),
        entries AS (
          SELECT client_id, rank, MIN(at) AS at FROM (
            SELECT client_id, rank, at FROM moves WHERE at <= ${to} AND from_rank IS DISTINCT FROM rank
            UNION ALL
            SELECT c.id, ${plan.arrivalRank}::int, c."createdAt"
            FROM studio_clients c
            WHERE c."studioId" = ${studioId} AND c."deletedAt" IS NULL AND c."isDemo" = false
              AND c."createdAt" >= ${from} AND c."createdAt" <= ${to} ${leadFence}
          ) x
          GROUP BY client_id, rank
        ),
        outcome AS (
          SELECT en.client_id, en.rank,
                 COALESCE(bool_or(m.rank > en.rank), false) AS moved_on,
                 COALESCE(bool_or(m.rank >= ${wonRank}::int), false) AS reached_won
          FROM entries en
          LEFT JOIN moves m ON m.client_id = en.client_id AND m.at >= en.at
          GROUP BY en.client_id, en.rank
        )
        SELECT rank::int AS rank, COUNT(*)::int AS entered,
               (COUNT(*) FILTER (WHERE moved_on))::int AS moved_on,
               (COUNT(*) FILTER (WHERE reached_won))::int AS reached_won
        FROM outcome GROUP BY rank`),
    ]);

    const stats = buildCallStats({
      range,
      members: members.map((m) => ({
        id: m.id,
        name: m.user.name?.trim() || m.user.email?.split('@')[0] || m.user.phone || 'Someone',
        /* The people who dial: an active salesperson shows with zeroes on a quiet day. */
        showAlways: m.status === 'ACTIVE' && m.role === 'SALES',
      })),
      outcomes: outcomes.map((o): OutcomeCount => ({ memberId: o.member_id, day: o.day, outcome: o.outcome, n: Number(o.n) })),
      reach: reach.map((r): ReachCount => ({ memberId: Number(r.is_total) === 1 ? 'total' : r.member_id, dialled: Number(r.dialled), reached: Number(r.reached) })),
      tries: tries.map((t): TriesCount => ({ memberId: t.member_id, triesBefore: Number(t.tries), n: Number(t.n) })),
      firstCalls: firstCalls.map(
        (f): FirstCallCount => ({
          memberId: Number(f.is_total) === 1 ? 'total' : f.member_id,
          called: Number(f.called),
          medianMinutes: f.median === null ? null : Number(f.median),
          ...(Number(f.is_total) === 1 ? { notCalled: Number(f.not_called) } : {}),
        }),
      ),
      plan,
      steps: steps.map((s): StepCount => ({ rank: Number(s.rank), entered: Number(s.entered), movedOn: Number(s.moved_on), reachedWon: Number(s.reached_won) })),
    });
    return { stats, seesAll, team: scope.team !== null };
  } catch (error) {
    console.error('[call-stats] read failed', error instanceof Error ? error.message : 'unknown');
    return null;
  }
}
