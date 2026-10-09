/**
 * The reveal, counted down (build queue item 15): "10 verified studios →
 * 6 at Premium → top 3 for you". It starts from the number the site states
 * (lib/claims.ts) and never climbs: each step is at most the one before.
 *
 * Pure, and tested.
 */

import type { Brief } from '@/modules/brief/types';
import type { Studio } from '@/modules/studio/types';
import { TIER } from '@/modules/quotation/tiers';
import { VERIFIED_STUDIOS } from '@/lib/claims';
import { tx, type Lang } from '@/modules/i18n/site';
import { MATCH_DICT } from '@/modules/i18n/site/match';
import { failedFilter, type RankOptions } from './score';

export interface RevealStep {
  count: number;
  label: string;
}

/** The labels are in `lang` (English unless told); the band name stays as it is. */
export function revealSteps(
  brief: Brief,
  studios: Studio[],
  fit: number,
  options: RankOptions = {},
  lang: Lang = options.lang ?? 'en',
): RevealStep[] {
  const reasons = studios.map((s) => failedFilter(brief, s, options));
  const atLevel = reasons.filter((r) => r === null || !['NOT_VERIFIED', 'PAUSED', 'OTHER_BAND'].includes(r)).length;
  const steps: RevealStep[] = [{ count: VERIFIED_STUDIOS, label: tx(lang, MATCH_DICT['reveal.verified']) }];
  const level = Math.min(atLevel, VERIFIED_STUDIOS);
  if (brief.tier && level < VERIFIED_STUDIOS) {
    steps.push({ count: level, label: tx(lang, MATCH_DICT['reveal.at'], { level: TIER[brief.tier].label }) });
  }
  const last = steps[steps.length - 1]!.count;
  steps.push({ count: Math.min(fit, last), label: tx(lang, MATCH_DICT['reveal.forYou']) });
  return steps;
}
