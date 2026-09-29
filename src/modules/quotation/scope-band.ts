/**
 * A band's price, for the scope they chose.
 *
 * The bands are defined per square foot of a whole home (Essential
 * ₹1,200–1,800 and so on). For a kitchen, or one bedroom, there is no per-sq-ft
 * figure — so the level screen showed whole-home prices to a kitchen customer
 * (₹8.75 L–₹40 L for a kitchen and wardrobes, reproduced 29 Sep).
 *
 * The range is now the band for their home, scaled by how large a part of a
 * full home their scope is. That share is measured, not guessed: both are
 * priced on the reference rate card (the archive medians, the same for every
 * studio) at this home's standard sizes. Only lines the reference card prices
 * count, so civil work — which it does not price yet — cannot distort the
 * share; a civil-only renovation gets no range rather than an invented one.
 *
 * The brief keeps the FULL-HOME band as its budget. The band describes the
 * studio's price level; a kitchen customer at Premium wants a Premium studio,
 * and comparing a ₹3 L kitchen budget with studios' ₹18 L homes would rule
 * every one of them out. Only the number shown is scaled.
 *
 * Pure and tested.
 */

import { referenceRates } from '@/data/filed-rates';
import { buildFirstQuote } from './first-quote';
import { FULL_HOME, type ScopeSelection } from './scope';
import { tierRangeFor, type Tier } from './tiers';

export interface HomeSize {
  bhk: number;
  carpetAreaSqft: number;
  bathrooms: number;
}

/** How large a part of a full home this scope is, 0–1, or null if unpriceable. */
export function scopeShare(home: HomeSize, selection: ScopeSelection): number | null {
  if (!selection.scope || selection.scope === 'FULL_HOME') {
    return selection.excludedItems.length === 0 ? 1 : shareOf(home, selection);
  }
  return shareOf(home, selection);
}

function shareOf(home: HomeSize, selection: ScopeSelection): number | null {
  const reference = referenceRates();
  const base = { ...home, kitchenRunMm: null, runSource: 'standard' as const };
  const work = (q: ReturnType<typeof buildFirstQuote>) => q.modularPaise + q.nonModularPaise;
  const full = work(buildFirstQuote({ ...base, scope: FULL_HOME }, reference));
  const part = work(buildFirstQuote({ ...base, scope: selection }, reference));
  if (full <= 0 || part <= 0) return null;
  return Math.min(1, part / full);
}

/** The band's range for this home and this scope, or null when it cannot be shown. */
export function scopeBandRange(
  tier: Tier,
  home: HomeSize,
  selection: ScopeSelection,
): { lowPaise: number; highPaise: number | null; share: number } | null {
  const share = scopeShare(home, selection);
  if (share === null) return null;
  const { lowPaise, highPaise } = tierRangeFor(tier, home.carpetAreaSqft);
  return {
    lowPaise: Math.round(lowPaise * share),
    highPaise: highPaise === null ? null : Math.round(highPaise * share),
    share,
  };
}
