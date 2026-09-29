/**
 * The expert call's launch offer — "₹5,000, free for the first 1,000
 * customers" (the owner, 30 Sep 2026).
 *
 * ## Only while it is true
 *
 * A struck-through price and a limited offer are claims, and Indian consumer
 * law (the CCPA's 2023 dark-pattern guidelines — "false urgency") treats a
 * made-up reference price or a limit that never runs out as misleading. So:
 *
 *  - the ₹5,000 is what the call will cost once the offer ends, and the
 *    owner has committed to that;
 *  - the count is real — free calls booked so far, from the database — and
 *    how many are left is shown once it is few enough to matter;
 *  - when the free calls run out, the offer line stops saying "free".
 *
 * Pure, and tested; `offerState` takes the count from the caller.
 */

export const EXPERT_CALL_PRICE_PAISE = 500_000;
export const FREE_CALLS = 1_000;
/** Show "N left" at or below this — above it the number means little. */
export const SHOW_REMAINING_AT = 250;

export interface OfferState {
  /** "₹5,000", shown struck through while the offer runs. */
  price: string;
  free: boolean;
  /** "Free for the first 1,000 customers". */
  headline: string;
  /** "184 free calls left" — null until it is few enough to matter. */
  remaining: string | null;
}

export function offerState(freeCallsBooked: number): OfferState {
  const price = `₹${(EXPERT_CALL_PRICE_PAISE / 100).toLocaleString('en-IN')}`;
  const left = Math.max(0, FREE_CALLS - Math.max(0, freeCallsBooked));
  if (left === 0) {
    return { price, free: false, headline: `${price} for a 30-minute call`, remaining: null };
  }
  return {
    price,
    free: true,
    headline: `Free for the first ${FREE_CALLS.toLocaleString('en-IN')} customers`,
    remaining: left <= SHOW_REMAINING_AT ? `${left} free call${left === 1 ? '' : 's'} left` : null,
  };
}
