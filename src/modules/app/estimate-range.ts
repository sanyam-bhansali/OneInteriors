/**
 * The running estimate in the brief (trust fix 3): what most studios would
 * quote for the home as answered so far, priced by the same engine and rate
 * cards as the quotes that follow, so the brief and the quotes cannot
 * disagree.
 *
 * "Most studios" is the middle half (25th to 75th percentile) of every
 * listed studio's total, GST included. The full spread is noisier than it is
 * useful; the middle half is what a person can plan around. Nothing is shown
 * until at least three studios price the home.
 */

import type { Brief } from '@/modules/brief/types';
import type { StudioRates } from '@/modules/quotation/catalogue';
import type { Studio } from '@/modules/studio/types';
import type { Tier } from '@/modules/quotation/tiers';
import type { Paise } from '@/lib/money';
import { quotesForStudios } from './journey';

export const MIN_STUDIOS_FOR_ESTIMATE = 3;

export interface EstimateRange {
  lowPaise: Paise;
  midPaise: Paise;
  highPaise: Paise;
  studios: number;
}

function quantile(sorted: number[], q: number): number {
  const at = (sorted.length - 1) * q;
  const lo = Math.floor(at);
  const hi = Math.ceil(at);
  return Math.round(sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (at - lo));
}

/** The middle half of a set of totals, or null when there are too few to say. */
export function middleHalf(totals: number[], min = MIN_STUDIOS_FOR_ESTIMATE): EstimateRange | null {
  const t = totals.filter((x) => x > 0).sort((a, b) => a - b);
  if (t.length < min) return null;
  return { lowPaise: quantile(t, 0.25), midPaise: quantile(t, 0.5), highPaise: quantile(t, 0.75), studios: t.length };
}

/**
 * The studios to estimate with: those in the chosen band when enough of them
 * have one, otherwise every listed studio.
 */
export function studiosForTier(studios: Studio[], tier: Tier | null): Studio[] {
  if (!tier) return studios;
  const inBand = studios.filter((s) => s.band === tier);
  return inBand.length >= MIN_STUDIOS_FOR_ESTIMATE ? inBand : studios;
}

export function estimateFor(
  brief: Brief,
  studios: Studio[],
  rates: Record<string, StudioRates>,
  fallback: (slug: string) => StudioRates,
): EstimateRange | null {
  if (!brief.propertyType) return null;
  const totals = quotesForStudios(brief, studios, rates, fallback).map((q) => q.quote.totalPaise);
  return middleHalf(totals);
}
