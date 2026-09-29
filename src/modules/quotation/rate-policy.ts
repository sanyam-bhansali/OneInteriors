/**
 * Which rates a studio is quoted on (plan §7.3, build queue item 3).
 *
 * Before launch the roster is invented, and every studio is priced on the
 * archive's sample rates with its own filed rates laid over them — the quote
 * says so ("Pre-launch — priced on archive rates").
 *
 * Once the roster is real (`NEXT_PUBLIC_ROSTER_IS_REAL=1`), a real studio is
 * priced on its own approved rates and nothing else: an item it has not
 * priced is named as not priced, and a studio with no approved rates at all
 * shows "Rates not filed yet" instead of a borrowed figure under its name.
 *
 * Pure, and tested.
 */

import type { StudioRates } from './catalogue';

export function ratesForPricing(placeholder: StudioRates, live: StudioRates, rosterReal: boolean): StudioRates {
  return rosterReal ? live : { ...placeholder, ...live };
}

/** Can this studio be quoted at all? Not on an empty rate card. */
export function hasRates(rates: StudioRates | undefined): boolean {
  return Boolean(rates) && Object.keys(rates!).length > 0;
}

export const NO_RATES_LABEL = 'Rates not filed yet';
