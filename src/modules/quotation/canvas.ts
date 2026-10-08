/**
 * The Home Canvas, v0 (docs/HOME-CANVAS.md): the quote made editable.
 *
 * A draft is what the customer has changed on the quote screen and not yet
 * saved to their brief — lines taken out or put back, and the kitchen
 * platform they measured. Every matched studio is re-priced on it, on every
 * change, because `buildFirstQuote` is pure arithmetic: ten studios cost a
 * few milliseconds. That is the whole idea. Every other quote in this
 * category is a document someone writes; ours is a calculation, so it can be
 * changed in front of the customer and stay true for every studio at once.
 *
 * Pure: no React, no storage. The screen is `components/oi/QuoteCanvas.tsx`.
 */

import { buildFirstQuote, runSourceOf, type FirstQuote } from './first-quote';
import type { StudioRates } from './catalogue';
import { hasRates } from './rate-policy';
import type { FloorPlan } from './project-store';
import type { HomeShape } from './price-all';
import { scopeCandidates } from './scope';

/** Shortest and longest kitchen platform the canvas accepts, in mm. */
export const RUN_MIN_MM = 1800;
export const RUN_MAX_MM = 7200;

export interface CanvasDraft {
  /** Catalogue codes taken out — the brief's `excludedItems`, edited. */
  excludedItems: string[];
  /**
   * A kitchen platform run the customer typed on this screen, or null to keep
   * whatever the brief already had (their plan, or the standard run).
   */
  kitchenRunMm: number | null;
}

export interface CanvasStudio {
  slug: string;
  name: string;
  curatedDiscountPct?: number | null;
}

export interface PricedStudio {
  slug: string;
  name: string;
  quote: FirstQuote;
}

/** The draft the canvas opens on: exactly the brief, nothing changed. */
export function draftFrom(shape: HomeShape): CanvasDraft {
  return { excludedItems: [...shape.scope.excludedItems], kitchenRunMm: null };
}

/** Has the customer changed anything on the canvas? */
export function draftChanged(shape: HomeShape, draft: CanvasDraft): boolean {
  const before = [...shape.scope.excludedItems].sort().join('|');
  const after = [...draft.excludedItems].sort().join('|');
  return before !== after || draft.kitchenRunMm !== null;
}

/**
 * Take a line out, or put it back. Never takes out the last line in scope:
 * a quote for nothing is not a quote, and every studio would read ₹0.
 */
export function toggleItem(shape: HomeShape, draft: CanvasDraft, code: string): CanvasDraft {
  const off = new Set(draft.excludedItems);
  if (off.has(code)) {
    off.delete(code);
  } else {
    const inScope = scopeCandidates(shape.bhk, shape.scope).filter((i) => !off.has(i.code));
    if (inScope.length <= 1) return draft;
    off.add(code);
  }
  return { ...draft, excludedItems: [...off] };
}

/** The kitchen run, clamped to a platform that exists, in whole 50 mm steps. */
export function withRun(draft: CanvasDraft, mm: number): CanvasDraft {
  const clamped = Math.min(RUN_MAX_MM, Math.max(RUN_MIN_MM, Math.round(mm / 50) * 50));
  return { ...draft, kitchenRunMm: clamped };
}

/**
 * Every studio with filed rates, priced on the draft, cheapest first.
 *
 * The kitchen: a run typed here counts as the customer's measurement, so the
 * band narrows the way the "measure your kitchen" step already narrows it
 * (±16% → ±12%). Otherwise the plan the page already priced on is kept.
 */
export function priceDraft({
  shape,
  plan,
  draft,
  studios,
  ratesFor,
}: {
  shape: HomeShape;
  plan: FloorPlan;
  draft: CanvasDraft;
  studios: CanvasStudio[];
  ratesFor: (slug: string) => StudioRates;
}): PricedStudio[] {
  const kitchenRunMm = draft.kitchenRunMm ?? plan.kitchenRunMm;
  const runSource = draft.kitchenRunMm !== null ? 'customer' : runSourceOf(plan);
  const out: PricedStudio[] = [];
  for (const s of studios) {
    const rates = ratesFor(s.slug);
    if (!hasRates(rates)) continue;
    const quote = buildFirstQuote(
      {
        bhk: shape.bhk,
        carpetAreaSqft: shape.carpetAreaSqft,
        carpetAreaAssumed: shape.carpetAreaAssumed,
        bathrooms: shape.bathrooms,
        kitchenRunMm,
        runSource,
        runShared: draft.kitchenRunMm === null && plan.shared === true,
        scope: { ...shape.scope, excludedItems: draft.excludedItems },
        curatedDiscountPct: s.curatedDiscountPct ?? null,
      },
      rates,
    );
    out.push({ slug: s.slug, name: s.name, quote });
  }
  return out.sort((a, b) => a.quote.totalPaise - b.quote.totalPaise);
}
