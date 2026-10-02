/**
 * Price every matched studio at once.
 *
 * The first quote used to be built one studio at a time, behind a gate and a
 * ten-second animation each — three studios were three round trips and half
 * a minute, for a computation that is instant and deterministic. Now every
 * match is priced the moment the page opens, on the same lines and the same
 * kitchen, so the cards carry their totals and compare has something to
 * compare. (docs/CUSTOMER-JOURNEY-PLAN.md §7.3)
 *
 * Pure and tested.
 */

import { buildFirstQuote, runSourceOf, standardKitchenRunMm, type FirstQuote } from './first-quote';
import type { StudioRates } from './catalogue';
import { hasRates } from './rate-policy';
import type { FloorPlan, StoredQuote } from './project-store';
import type { ScopeSelection } from './scope';

export interface HomeShape {
  bhk: number;
  carpetAreaSqft: number;
  carpetAreaAssumed: boolean;
  bathrooms: number;
  scope: ScopeSelection;
}

/**
 * The kitchen to price on: a confirmed plan's, else the one they measured at
 * the quote, else the standard run for their configuration.
 */
export function kitchenFor(
  shape: HomeShape,
  briefPlan: FloorPlan | null,
  projectPlan: FloorPlan | null,
): FloorPlan {
  return (
    briefPlan ??
    (projectPlan && runSourceOf(projectPlan) !== 'standard' ? projectPlan : null) ?? {
      fileName: null,
      kitchenRunMm: standardKitchenRunMm(shape.bhk),
      source: 'standard',
    }
  );
}

/** Everything a quote depends on, as one string. Change any part, and it is rebuilt. */
export function quoteKey(shape: HomeShape, plan: FloorPlan): string {
  return JSON.stringify([
    shape.bhk,
    shape.carpetAreaSqft,
    shape.bathrooms,
    shape.scope.scope,
    [...shape.scope.scopeRooms].sort(),
    [...shape.scope.excludedItems].sort(),
    [...(shape.scope.adds ?? [])].sort(),
    plan.kitchenRunMm,
    runSourceOf(plan),
  ]);
}

/**
 * The quotes to add or replace: one per studio that has none, or whose
 * quote was priced for something the brief no longer says.
 */
export function priceMatches({
  shape,
  plan,
  studios,
  existing,
  ratesFor,
  now = new Date(),
}: {
  shape: HomeShape;
  plan: FloorPlan;
  /** `curatedDiscountPct` from the studio's profile; a change re-prices that studio. */
  studios: { slug: string; name: string; curatedDiscountPct?: number | null }[];
  existing: Record<string, StoredQuote>;
  ratesFor: (slug: string) => StudioRates;
  now?: Date;
}): StoredQuote[] {
  const key = quoteKey(shape, plan);
  const fresh: StoredQuote[] = [];
  for (const studio of studios) {
    const rates = ratesFor(studio.slug);
    // No rates of their own: "Rates not filed yet", never a figure (rate-policy.ts).
    if (!hasRates(rates)) continue;
    const had = existing[studio.slug];
    const discount = studio.curatedDiscountPct ?? null;
    if (had?.key === key && (had.quote.curatedDiscountPct ?? null) === discount) continue;
    const quote: FirstQuote = buildFirstQuote(
      {
        bhk: shape.bhk,
        carpetAreaSqft: shape.carpetAreaSqft,
        carpetAreaAssumed: shape.carpetAreaAssumed,
        bathrooms: shape.bathrooms,
        kitchenRunMm: plan.kitchenRunMm,
        runSource: runSourceOf(plan),
        runShared: plan.shared === true,
        scope: shape.scope,
        curatedDiscountPct: discount,
      },
      rates,
    );
    fresh.push({ studioSlug: studio.slug, studioName: studio.name, builtAt: now.toISOString(), quote, key });
  }
  return fresh;
}
