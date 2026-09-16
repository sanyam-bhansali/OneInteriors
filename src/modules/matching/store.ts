import 'server-only';

/**
 * Persisting matches.
 *
 * ## Why this file had to exist before anything studio-facing could
 *
 * `score.ts` computed every match at render time and threw it away. Nothing in
 * the codebase ever wrote a `Match` row — while `/ops/allocation` carried a
 * column headed "Briefs shown for", reading that empty table inside a
 * `try/catch` and silently rendering `0` for every studio. The number a studio
 * pays us for was a zero on our own ops screen.
 *
 * The schema was always ready: `score`, `factorsScored`, `factorsTotal`,
 * `breakdown`, `reasoning`, `engineVersion`. Only the writer was missing.
 *
 * ## Why it is a sibling of score.ts rather than part of it
 *
 * `score.ts` is pure, has no `server-only`, and is imported by
 * `MatchClient.tsx` — which ranks studios **in the browser**, inside a
 * `useMemo`. Putting Prisma anywhere near it would break that import and every
 * test of it. See CONTRIBUTING §9.5.
 *
 * That client-side import is also why this is never called from the match page:
 * a write there would fire on every re-render, from the browser, for a brief
 * that may not be saved yet.
 *
 * ## There is no backfill
 *
 * Every match computed before this shipped is gone. A studio's history starts
 * the day this deployed, and the dashboard says so rather than implying a
 * studio joined recently.
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { hasDatabase } from '@/lib/env';
import type { MatchResult } from './score';

/**
 * Write one row per studio shown, for one brief.
 *
 * Never throws. A failed analytics-shaped write must not take down the page a
 * customer is mid-way through — losing a row here costs a studio one data point
 * on a dashboard; an exception costs the customer their quotes.
 */
export async function storeMatches(briefId: string, results: MatchResult[]): Promise<void> {
  if (!hasDatabase() || !briefId || results.length === 0) return;

  try {
    for (const result of results) {
      /**
       * Never rewrite a row produced by a different engine version.
       *
       * `engineVersion` exists so an old score is never silently reinterpreted
       * under new weights. If the weights change tomorrow, a customer's
       * existing match keeps the number they were actually shown — and a studio
       * looking at their own history sees what happened rather than what would
       * happen now. Re-running the engine over old briefs would quietly rewrite
       * the past, which is the one thing a record is for.
       */
      const existing = await prisma.match.findUnique({
        where: { briefId_studioId: { briefId, studioId: result.studioId } },
        select: { id: true, engineVersion: true },
      });

      if (existing && existing.engineVersion !== result.engineVersion) continue;

      const data = {
        score: result.score,
        factorsScored: result.factorsScored,
        factorsTotal: result.factorsTotal,
        /**
         * Nulls preserved, deliberately. `null` means "not measurable yet", and
         * on a new roster most factors are null — coercing them to 0 would tell
         * a studio it scored badly on something we never measured, which would
         * be the dashboard's dominant message for months.
         */
        breakdown: result.breakdown as Prisma.InputJsonValue,
        /** Newline-joined: the clauses are sentences and they split cleanly. */
        reasoning: result.reasoning.join('\n'),
        engineVersion: result.engineVersion,
      };

      await prisma.match.upsert({
        where: { briefId_studioId: { briefId, studioId: result.studioId } },
        create: { briefId, studioId: result.studioId, ...data },
        update: data,
      });
    }
  } catch (error) {
    console.error('[matching] could not store matches', error);
  }
}

/** The reasoning clauses, back out of the joined column. */
export function splitReasoning(reasoning: string): string[] {
  return reasoning
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * The date of the earliest match we hold, for any studio.
 *
 * The dashboard uses this to say "we have been counting since 12 September"
 * rather than letting a studio read a short history as a quiet month. There is
 * no backfill and there never can be, so the honest move is to date the record
 * rather than to present it as complete.
 */
export async function matchHistoryBegins(): Promise<Date | null> {
  if (!hasDatabase()) return null;

  try {
    const first = await prisma.match.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    return first?.createdAt ?? null;
  } catch {
    return null;
  }
}
