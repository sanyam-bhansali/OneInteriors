/**
 * The scope categories every studio prices against.
 *
 * ## Why a fixed list at all
 *
 * Studios keep their own product names and their own numbers — we never touch
 * either. But two quotes are only comparable if they are broken down the same
 * way. "₹8.4L versus ₹9.1L" tells a customer nothing; "their kitchen is ₹40k
 * more and their false ceiling is ₹25k less" tells them everything. This list
 * is the shared axis that makes the compare view possible, and it is the only
 * thing about pricing that is ours rather than the studio's.
 *
 * It is deliberately coarse. A studio with forty products maps them onto
 * twelve categories; the detail stays in their own catalogue for the firm
 * quote. An indicative quote that pretended to line-item precision it does not
 * have would be a worse lie than a rough number honestly labelled.
 */

export const RATE_CATEGORIES = [
  'modular_kitchen',
  'wardrobes',
  'carpentry',
  'false_ceiling',
  'painting',
  'electrical',
  'plumbing',
  'flooring',
  'furnishing',
  'civil',
  'design_fee',
] as const;

export type RateCategory = (typeof RATE_CATEGORIES)[number];

export type RateUnit = 'sqft' | 'rft' | 'unit' | 'lumpsum' | 'percent';

export interface CategoryDefinition {
  label: string;
  unit: RateUnit;
  /** Shown next to the input so a studio knows what we will multiply. */
  hint: string;
  /**
   * Is this category part of a normal full-home job? Categories that are not
   * are quoted only when the brief asks for them, so a studio leaving one
   * blank is not treated as an incomplete rate card.
   */
  core: boolean;
  /**
   * Factory-made carpentry, or site work?
   *
   * The Indian trade calls these MO and NM on the quotation itself, and the
   * split is not cosmetic: modular carpentry is where studios' rate cards
   * actually diverge, and it is what discounts are applied to — a studio
   * offering "15% off" almost always means 15% off modular only, not off the
   * painting and not off the fee. Showing the two subtotals separately is
   * therefore the single most explanatory line on a quotation, and getting a
   * category on the wrong side of it changes what a discount is worth.
   */
  modular: boolean;
}

export const CATEGORY: Record<RateCategory, CategoryDefinition> = {
  modular_kitchen: {
    label: 'Modular kitchen',
    unit: 'sqft',
    hint: 'Your all-in rate per sqft of kitchen shutter area — carcass, shutters, hardware, fitting.',
    core: true,
    modular: true,
  },
  wardrobes: {
    label: 'Wardrobes',
    unit: 'sqft',
    hint: 'Per sqft of wardrobe shutter area, finished and fitted.',
    core: true,
    modular: true,
  },
  carpentry: {
    label: 'Other carpentry',
    unit: 'sqft',
    hint: 'TV units, crockery units, study tables, storage. Per sqft of finished surface.',
    core: true,
    modular: true,
  },
  false_ceiling: {
    label: 'False ceiling',
    unit: 'sqft',
    hint: 'Per sqft of ceiling area covered, including cove and finishing.',
    core: true,
    modular: false,
  },
  painting: {
    label: 'Painting',
    unit: 'sqft',
    hint: 'Per sqft of wall area, including putty and primer.',
    core: true,
    modular: false,
  },
  electrical: {
    label: 'Electrical',
    unit: 'sqft',
    hint: 'Per sqft of carpet area for rewiring, points and fittings.',
    core: true,
    modular: false,
  },
  plumbing: {
    label: 'Plumbing',
    unit: 'lumpsum',
    hint: 'Typical per-bathroom cost, where the job involves plumbing work.',
    core: false,
    modular: false,
  },
  flooring: {
    label: 'Flooring',
    unit: 'sqft',
    hint: 'Per sqft, where flooring is being replaced.',
    core: false,
    modular: false,
  },
  furnishing: {
    label: 'Furnishing',
    unit: 'lumpsum',
    hint: 'Curtains, blinds and soft furnishing for a typical home of this size.',
    core: false,
    modular: false,
  },
  civil: {
    label: 'Civil work',
    unit: 'lumpsum',
    hint: 'Demolition, masonry, waterproofing. Renovation jobs only.',
    core: false,
    modular: false,
  },
  design_fee: {
    label: 'Design fee',
    unit: 'percent',
    hint: 'As a percentage of the project value. Enter 0 if it is built into your rates.',
    core: false,
    // A fee on the work, not work. It is shown on its own line and is never
    // inside either subtotal — which also matters because a modular discount
    // must not be computed against it.
    modular: false,
  },
};

export const MODULAR_CATEGORIES = RATE_CATEGORIES.filter((c) => CATEGORY[c].modular);

export function isModular(category: RateCategory): boolean {
  return CATEGORY[category].modular;
}

export const CORE_CATEGORIES = RATE_CATEGORIES.filter((c) => CATEGORY[c].core);

/**
 * A rate card is usable for an indicative quote once every core category has a
 * rate. The optional ones are only ever priced when the brief calls for them,
 * so their absence is a legitimate answer rather than a gap.
 */
export function missingCoreRates(rates: Partial<Record<RateCategory, number>>): RateCategory[] {
  return CORE_CATEGORIES.filter((c) => {
    const value = rates[c];
    return value === undefined || value === null || value <= 0;
  });
}

export function rateCardIsUsable(rates: Partial<Record<RateCategory, number>>): boolean {
  return missingCoreRates(rates).length === 0;
}
