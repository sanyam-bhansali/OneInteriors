/**
 * A studio as the customer's browser may see it (build queue item 4, plan §5.8).
 *
 * The match, compare and quiz pages rank in the browser — that is what makes
 * the one-tap widenings instant — so they need what the engine reads and
 * what the cards show. They do not need what only ops uses: why a studio is
 * paused, its capacity, test-record flags, verification notes, the declared
 * reasons behind a missing GSTIN or a short portfolio. Those are dropped
 * here, on the server, before anything is serialised to the page.
 *
 * Pure, and tested — the test fails if an ops-only field reaches the browser.
 */

import type { Studio } from './types';

/** Fields that never leave the server on a customer page. */
export const OPS_ONLY = [
  'pausedReason',
  'pauseCause',
  'capacityPerMonth',
  'hiddenAsTestAt',
  'submittedForReview',
  'portfolioShortfallNote',
  'gstinNote',
  'gstinNotApplicable',
] as const;

export function publicStudio(studio: Studio): Studio {
  const out: Record<string, unknown> = { ...studio };
  for (const key of OPS_ONLY) delete out[key];
  return {
    ...(out as unknown as Studio),
    // Kept, because the engine's hard filter reads it — as a flag, not a reason.
    pausedAt: studio.pausedAt ? 'paused' : null,
    pausedReason: null,
    pauseCause: null,
    capacityPerMonth: null,
    // Verification detail stays on the studio's public profile, where it is
    // explained; the cards need only which checks passed.
    checks: studio.checks.map((c) => ({ ...c, detail: null })),
  };
}

export function publicStudios(studios: Studio[]): Studio[] {
  return studios.map(publicStudio);
}
