import 'server-only';

/**
 * Everything the studio dashboard reads.
 *
 * The interesting half — the funnel maths and its diagnosis — is pure and lives
 * in `dashboard-funnel.ts`. This is the querying.
 *
 * ## One rule runs through all of it
 *
 * Every number here is about THIS studio. There is no query in this file that
 * can see another studio's score, rank, rates or count, and there should never
 * be one. `rate-card.ts` already refuses aggregate benchmarking for a stated
 * reason — with two studios live, "the median of two" is telling each of them
 * the other's price — and that reasoning covers every metric here, not just
 * rates.
 */

import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { getCurrentUser } from '@/modules/auth/session';
import { splitReasoning, matchHistoryBegins } from '@/modules/matching/store';
import { FACTOR_LABELS, type FactorKey } from '@/modules/matching/score';
import { buildFunnel, diagnose, type FunnelCounts, type FunnelStep, type Diagnosis } from './dashboard-funnel';

export {
  buildFunnel,
  diagnose,
  STAGE_LABELS,
  STAGE_BLURBS,
  FUNNEL_STAGES,
  MIN_FOR_RATE,
} from './dashboard-funnel';
export type { FunnelStep, FunnelStage, Diagnosis, FunnelCounts } from './dashboard-funnel';

/**
 * The signed-in user's studio id, or null. Never takes one from the client.
 *
 * `getCurrentUser` rather than `requireRole`, for the reason written out in
 * `introduction.ts`: `requireRole` throws, this is a render-path read, and a
 * layout and its page render in parallel — so a throw here produces a 500 in
 * place of the layout's redirect. Returning null is both safe and correct.
 */
export async function myStudioId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user || !hasDatabase()) return null;

  const member = await prisma.studioMember.findUnique({
    where: { userId: user.id },
    select: { studioId: true },
  });
  return member?.studioId ?? null;
}

export function monthStart(offset = 0): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - offset, 1);
}

// ── Visibility ─────────────────────────────────────────────────

export interface Visibility {
  thisMonth: number;
  lastMonth: number;
  /** Null until there is a previous month worth comparing against. */
  change: number | null;
  /** When we started counting. There is no backfill; see matching/store.ts. */
  countingSince: Date | null;
}

export async function visibility(studioId: string): Promise<Visibility> {
  if (!hasDatabase()) {
    return { thisMonth: 0, lastMonth: 0, change: null, countingSince: null };
  }

  const thisStart = monthStart(0);
  const lastStart = monthStart(1);

  try {
    const [thisMonth, lastMonth, countingSince] = await Promise.all([
      prisma.match.count({ where: { studioId, createdAt: { gte: thisStart } } }),
      prisma.match.count({
        where: { studioId, createdAt: { gte: lastStart, lt: thisStart } },
      }),
      matchHistoryBegins(),
    ]);

    return {
      thisMonth,
      lastMonth,
      // A percentage change off a base of one or two is noise wearing a
      // decimal point. Below five last month, we say nothing.
      change: lastMonth >= 5 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null,
      countingSince,
    };
  } catch {
    return { thisMonth: 0, lastMonth: 0, change: null, countingSince: null };
  }
}

/** Briefs shown per month, oldest first, for the trend line. */
export async function visibilityByMonth(
  studioId: string,
  months = 6,
): Promise<{ label: string; count: number }[]> {
  if (!hasDatabase()) return [];

  try {
    const buckets: { label: string; count: number }[] = [];

    for (let i = months - 1; i >= 0; i--) {
      const start = monthStart(i);
      const end = monthStart(i - 1);
      const count = await prisma.match.count({
        where: { studioId, createdAt: { gte: start, lt: end } },
      });
      buckets.push({
        label: new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(start),
        count,
      });
    }

    return buckets;
  } catch {
    return [];
  }
}

// ── The funnel ─────────────────────────────────────────────────

export interface StudioFunnel {
  steps: FunnelStep[];
  diagnosis: Diagnosis;
  counts: FunnelCounts;
}

/**
 * Six stages, each from a real source.
 *
 * `opened` and `compared` come from analytics events carrying a `studioSlug`
 * prop — `AnalyticsEvent` has no `studioId` column and does not need one, since
 * the prop guard permits a slug while rejecting anything that looks like a
 * person.
 */
export async function studioFunnel(
  studioId: string,
  studioSlug: string,
  since: Date,
): Promise<StudioFunnel> {
  const empty: FunnelCounts = {
    shown: 0,
    opened: 0,
    compared: 0,
    namedInCall: 0,
    introduced: 0,
    signed: 0,
  };

  if (!hasDatabase()) {
    return { steps: buildFunnel(empty), diagnosis: diagnose(empty), counts: empty };
  }

  try {
    const [shown, opened, compared, namedInCall, introduced, signed] = await Promise.all([
      prisma.match.count({ where: { studioId, createdAt: { gte: since } } }),
      distinctViewers('studio.view', studioSlug, since),
      distinctViewers('studio.compared', studioSlug, since),
      prisma.consultation.count({
        where: { createdAt: { gte: since }, studioIds: { has: studioId } },
      }),
      prisma.introduction.count({ where: { studioId, introducedAt: { gte: since } } }),
      prisma.project.count({ where: { studioId, createdAt: { gte: since } } }),
    ]);

    const counts: FunnelCounts = { shown, opened, compared, namedInCall, introduced, signed };
    return { steps: buildFunnel(counts), diagnosis: diagnose(counts), counts };
  } catch (error) {
    console.error('[dashboard] funnel failed', error);
    return { steps: buildFunnel(empty), diagnosis: diagnose(empty), counts: empty };
  }
}

/**
 * How many distinct PEOPLE produced this event for this studio.
 *
 * Not how many events, which is what a plain `count` would give. Both
 * `/studios/[slug]` and `/compare` are `force-dynamic` and record on every
 * render, so a customer who refreshes the comparison three times would
 * otherwise contribute three — while every other stage of this funnel counts
 * rows. Mixing those two units is how a studio ends up reading "180% of the
 * step before" on a page they pay between ₹25,000 and ₹1,00,000 a month for.
 *
 * Identity is `briefId ?? userId ?? anonKey`, in that order, because `record()`
 * only attaches a `briefId` when a caller passes one and these call sites do
 * not — but it always writes the anonymous cookie key, and a signed-in visitor
 * whose cookie was consumed at claim-time still has a `userId`. A row with none
 * of the three cannot be attributed to anybody and is skipped rather than
 * counted as its own person.
 *
 * Deduplicating in JS rather than with `distinct` because Prisma's `distinct`
 * over several columns is a composite, not a coalesce — it would treat the same
 * person before and after sign-in as two.
 */
async function distinctViewers(
  name: 'studio.view' | 'studio.compared',
  studioSlug: string,
  since: Date,
): Promise<number> {
  const rows = await prisma.analyticsEvent.findMany({
    where: {
      name,
      createdAt: { gte: since },
      props: { path: ['studioSlug'], equals: studioSlug },
    },
    select: { briefId: true, userId: true, anonKey: true },
  });

  const people = new Set<string>();
  for (const row of rows) {
    const identity = row.briefId ?? row.userId ?? row.anonKey;
    if (identity) people.add(identity);
  }
  return people.size;
}

// ── Ranking history ────────────────────────────────────────────

export interface RankedBrief {
  matchId: string;
  when: Date;
  score: number;
  factorsScored: number;
  factorsTotal: number;
  /** Their own per-factor scores. Null means we could not measure it. */
  factors: { key: FactorKey; label: string; score: number | null }[];
  reasoning: string[];
  /** Anonymised brief facts. Never a name, never contact details. */
  locality: string | null;
  propertyType: string | null;
  scope: string | null;
  tier: string | null;
}

/**
 * Recent briefs this studio appeared in, with their own scores.
 *
 * Includes the ones they ranked poorly on. A page that hides those is a vanity
 * metric — the losses carry all of the actionable information, and a studio
 * that only ever sees wins has no reason to change anything.
 *
 * Note what is NOT selected: no other studio's score, no rank position relative
 * to named competitors, no customer identity.
 */
export async function rankingHistory(studioId: string, limit = 12): Promise<RankedBrief[]> {
  if (!hasDatabase()) return [];

  try {
    const rows = await prisma.match.findMany({
      where: { studioId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        createdAt: true,
        score: true,
        factorsScored: true,
        factorsTotal: true,
        breakdown: true,
        reasoning: true,
        brief: {
          select: { locality: true, propertyType: true, scope: true, tier: true },
        },
      },
    });

    return rows.map((row) => {
      const breakdown = (row.breakdown ?? {}) as Partial<Record<FactorKey, number | null>>;

      return {
        matchId: row.id,
        when: row.createdAt,
        score: Math.round(row.score),
        factorsScored: row.factorsScored,
        factorsTotal: row.factorsTotal,
        factors: (Object.keys(FACTOR_LABELS) as FactorKey[]).map((key) => ({
          key,
          label: FACTOR_LABELS[key],
          // `?? null` and not `?? 0`. A factor absent from an older breakdown
          // is unmeasured, not zero, and the distinction is the whole point.
          score: breakdown[key] ?? null,
        })),
        reasoning: splitReasoning(row.reasoning),
        locality: row.brief.locality,
        propertyType: row.brief.propertyType,
        scope: row.brief.scope,
        tier: row.brief.tier,
      };
    });
  } catch (error) {
    console.error('[dashboard] ranking history failed', error);
    return [];
  }
}

/**
 * Average score per factor, across everything we hold for this studio.
 *
 * This is the actionable version of the history above: one brief's low style
 * score is a customer with unusual taste; a low average across thirty briefs is
 * a profile that does not describe the work.
 *
 * Nulls are excluded from the average rather than counted as zero, so a factor
 * we have never been able to measure comes back null rather than 0.
 */
export async function factorAverages(
  studioId: string,
): Promise<{ key: FactorKey; label: string; average: number | null; measured: number }[]> {
  if (!hasDatabase()) {
    return (Object.keys(FACTOR_LABELS) as FactorKey[]).map((key) => ({
      key,
      label: FACTOR_LABELS[key],
      average: null,
      measured: 0,
    }));
  }

  try {
    const rows = await prisma.match.findMany({
      where: { studioId },
      select: { breakdown: true },
      take: 200,
    });

    return (Object.keys(FACTOR_LABELS) as FactorKey[]).map((key) => {
      const values: number[] = [];
      for (const row of rows) {
        const breakdown = (row.breakdown ?? {}) as Partial<Record<FactorKey, number | null>>;
        const value = breakdown[key];
        if (typeof value === 'number') values.push(value);
      }

      return {
        key,
        label: FACTOR_LABELS[key],
        average: values.length === 0 ? null : Math.round(values.reduce((a, b) => a + b, 0) / values.length),
        measured: values.length,
      };
    });
  } catch {
    return (Object.keys(FACTOR_LABELS) as FactorKey[]).map((key) => ({
      key,
      label: FACTOR_LABELS[key],
      average: null,
      measured: 0,
    }));
  }
}

/**
 * What a studio can actually do about a weak factor.
 *
 * Every one of these is a verifiable action they take, not an instruction to
 * try harder. Note what is absent: nothing here suggests tagging more styles.
 * Breadth is self-punishing — Q5 dislikes are a hard filter at 40% of a
 * portfolio, so a studio claiming everything gets removed from more briefs, not
 * fewer. Telling them to do it would be advice that costs them work.
 */
export const FACTOR_ADVICE: Record<FactorKey, string> = {
  styleOverlap:
    'Tag your projects with the styles they honestly are. Three accurate tags beat eight hopeful ones — a style you are tagged for and did not really do is a style that can rule you out.',
  budgetFit:
    'Enter the real value of completed projects. Once three exist we use those instead of the range you declared, and delivered numbers are far more convincing than claimed ones.',
  workingStyle:
    'This comes from past-client ratings on communication, so it fills in as projects complete. Nothing to do yet.',
  deliveryReliability:
    'This is days past your own committed date, across completed projects. The only way to move it is to finish on time — and the only way to have it at all is to finish something through us.',
  scopeExperience:
    'Add completed projects in the scopes you want more of. A studio with no kitchen-only projects will keep losing kitchen-only briefs.',
  priorityAlignment:
    'This follows from the factors above rather than standing alone — it reads whichever one the customer said mattered most.',
};
