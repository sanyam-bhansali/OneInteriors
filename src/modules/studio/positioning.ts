/**
 * What a studio sells, and where it places itself.
 *
 * Pure — no database, no `server-only` — so the cards can import the copy and
 * the tests can assert the vocabulary without a connection. CONTRIBUTING §9.5.
 *
 * ## These are not the rate card, and must not be confused with it
 *
 * The rate card is a set of per-square-foot numbers that `generate.ts` prices
 * real work with; it is what makes a first quote arrive in three seconds
 * without anybody being phoned. What is in this file is positioning — how the
 * studio wants to be read. Neither substitutes for the other, and the step
 * that collects them asks for both for exactly that reason.
 */

export const OFFERINGS = ['TURNKEY', 'DESIGN_BUILD', 'DESIGN_ONLY'] as const;
export type Offering = (typeof OFFERINGS)[number];

export function isOffering(v: string): v is Offering {
  return (OFFERINGS as readonly string[]).includes(v);
}

export const OFFERING_COPY: Record<Offering, { label: string; detail: string }> = {
  TURNKEY: {
    label: 'Turnkey projects',
    detail: 'Design and execution, handed over finished.',
  },
  DESIGN_BUILD: {
    label: 'Design + execution',
    detail: 'You design it and you run the site.',
  },
  DESIGN_ONLY: {
    label: 'Design only',
    detail: 'Space planning, drawings, 3D. Somebody else builds it.',
  },
};

export const PRICE_LEVELS = ['BUDGET', 'MID', 'PREMIUM', 'LUXURY'] as const;
export type PriceLevel = (typeof PRICE_LEVELS)[number];

export function isPriceLevel(v: string): v is PriceLevel {
  return (PRICE_LEVELS as readonly string[]).includes(v);
}

/**
 * The bands, with the ranges they are usually read as.
 *
 * The figures are indicative and the copy says so. They are here to make the
 * four words mean the same thing to us and to the studio — "premium" is
 * otherwise a word every practice applies to itself — and not to constrain
 * what anybody may pick. A studio whose range sits in one band and who
 * chooses another has said something deliberate, and it is not this file's
 * business to overrule them.
 */
export const PRICE_LEVEL_COPY: Record<PriceLevel, { label: string; range: string }> = {
  BUDGET: { label: 'Budget friendly', range: '₹5L – ₹15L' },
  MID: { label: 'Mid-range', range: '₹15L – ₹35L' },
  PREMIUM: { label: 'Premium', range: '₹35L – ₹75L' },
  LUXURY: { label: 'Luxury', range: '₹75L+' },
};

/**
 * What a studio's own range suggests, for the nudge beside the choice.
 *
 * A suggestion and never a default: the field starts empty, this only ever
 * renders as "your range usually reads as X", and picking something else
 * costs nothing. Pre-selecting it would turn a number they gave for one
 * purpose into a claim they never made.
 *
 * Null when they have not given a range yet, which is a real state — the
 * budget lives on the profile step and this one can be reached with it blank.
 */
export function suggestedLevel(minLakhs: number | null, maxLakhs: number | null): PriceLevel | null {
  if (maxLakhs === null) return null;
  /* Read off the TOP of the range. A practice that occasionally takes a small
     job for a repeat client is not thereby budget-friendly, and the floor is
     the number most distorted by that. */
  if (maxLakhs <= 15) return 'BUDGET';
  if (maxLakhs <= 35) return 'MID';
  if (maxLakhs <= 75) return 'PREMIUM';
  return 'LUXURY';
}
