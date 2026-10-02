/**
 * The number of verified studios the site states (the owner, 30 Sep 2026:
 * "take ten and use ten everywhere"). One constant, so the claim changes in
 * one place — and it must stay true: raise it as studios clear verification,
 * never above the number that actually have.
 *
 * Live counts shown to a customer ("N studios still match") never exceed it.
 */
export const VERIFIED_STUDIOS = 10;

/** A live count, capped at the stated number. */
export function shownStudioCount(actual: number): number {
  return Math.min(actual, VERIFIED_STUDIOS);
}
