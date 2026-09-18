/**
 * The canonical quotation format.
 *
 * ## The decision this file encodes
 *
 * **We define the line items. Every studio is quoted on ours, at their rates.**
 *
 * A studio joining the roster files around a hundred of its own past
 * quotations. We read the line items and the prices out of them, map each onto
 * the catalogue below, and store a rate per canonical item per studio. From
 * then on, every first quote we produce for that studio is our lines at their
 * numbers.
 *
 * That is the whole reason the comparison on this site is worth anything. The
 * landing page's promise — "every quote is written to the same lines, so two
 * studios sit side by side row for row" — is only true if somebody owns the
 * lines, and the only party who can own them without a conflict is us. Ask
 * three studios for a quote in their own format and you get the Problem
 * section: four lines on a letterhead, a photograph of a printout, and eleven
 * pages with no total.
 *
 * ## Why this is room-wise and not category-wise
 *
 * The first version of this priced eleven categories — `modular_kitchen`,
 * `wardrobes`, `false_ceiling`. It totals correctly and it is useless to read.
 * "Wardrobes · 96 SQ FT · ₹2,47,776" cannot be checked by the person paying
 * for it, and cannot be compared line for line against another studio, because
 * it is an aggregate of decisions nobody stated.
 *
 * Real quotations in this market are room-wise product lines, and the archive
 * behind this catalogue — around 940 quotations, with four priced in detail
 * against their floor plans — shows the sizing rule is remarkably consistent:
 * **heights are fixed, only widths track a wall run.** A wardrobe is
 * 1800×2100. A kitchen base cabinet is 750 high and as wide as the platform
 * run. That is what makes a first quote possible from a floor plan and a BHK,
 * and what makes it honest to show the dimensions on the line.
 *
 * ## Why the first quote is "generalised", and says so
 *
 * Only ONE number here genuinely comes from the plan: the kitchen platform
 * run. It varied 3410–5240 mm across the four calibration flats and it moves
 * the total more than anything else. Everything else uses a standard size,
 * because across those quotes the plan barely changed it.
 *
 * Fed just the kitchen run and the BHK, the deterministic build landed within
 * ±5% of the real quote on three of four, and −14% on the fourth — where the
 * difference was entirely designer add-ons beyond the standard template (a
 * store-room unit, an oversized console, a bigger workstation). So the model
 * is honest about what it is: the standard scope, priced properly, before
 * anybody has designed anything. Every line carries `standard: true` when its
 * size is assumed rather than measured, and the quote document says so.
 *
 * Pure, and with NO `server-only` — the quote document renders in the browser.
 * CONTRIBUTING §9.5.
 */

import type { Paise } from '@/lib/money';

// ── Rooms ───────────────────────────────────────────────────────

export const ROOMS = [
  'KITCHEN',
  'MASTER_BEDROOM',
  'SECOND_BEDROOM',
  'THIRD_BEDROOM',
  'LIVING_DINING',
  'BATHROOMS',
  'WHOLE_HOME',
] as const;

export type Room = (typeof ROOMS)[number];

export const ROOM_LABELS: Record<Room, string> = {
  KITCHEN: 'Kitchen',
  MASTER_BEDROOM: 'Master bedroom',
  SECOND_BEDROOM: 'Second bedroom',
  THIRD_BEDROOM: 'Third bedroom',
  LIVING_DINING: 'Living & dining',
  BATHROOMS: 'Bathrooms',
  WHOLE_HOME: 'Whole home',
};

/**
 * Modular or not.
 *
 * `MO` is factory-made carpentry — the part that is priced per square foot of
 * shutter and where two studios' rate cards actually differ. `NM` is
 * everything done on site: painting, ceiling, electrical, loose furniture.
 *
 * The split is shown on the quote because it is the single most useful cut of
 * the number. Two quotes ₹1.25 L apart are usually not both more expensive —
 * one has more factory work in it, and saying so turns an unexplained gap into
 * a decision.
 */
export type WorkCode = 'MO' | 'NM';

// ── How an item is sized ────────────────────────────────────────

/**
 * `AREA` items are priced per square foot of face: width × height.
 * `UNIT` items have one price regardless of the flat.
 * `PER_SQFT_CARPET` items scale with the carpet area (ceiling, painting).
 * `PER_BATHROOM` items repeat per bathroom.
 */
export type Sizing = 'AREA' | 'UNIT' | 'PER_SQFT_CARPET' | 'PER_BATHROOM';

export interface CatalogueItem {
  /** Stable key. This is what a studio's rate is filed against. */
  code: string;
  room: Room;
  label: string;
  work: WorkCode;
  sizing: Sizing;
  /** Standard height in mm, for AREA items. Fixed across the archive. */
  heightMm?: number;
  /** Standard width in mm, for AREA items whose width is NOT the kitchen run. */
  widthMm?: number;
  /** True when this item's width comes from the kitchen platform run. */
  fromKitchenRun?: boolean;
  /**
   * What it is made of, in checkable terms.
   *
   * This is the line that separates this quote from every other one. "Premium
   * ply" is the thing the Problem section holds up as unfalsifiable; "18mm BWP
   * carcass · matt laminate shutter · soft-close hinges" can be argued with,
   * and a customer who can argue with it can tell two studios apart.
   */
  spec: string;
  /** Which configurations include it. Empty means every one. */
  minBhk?: number;
}

/**
 * The catalogue.
 *
 * Membership comes from the archive: a product appearing in more than half of
 * that room's quotations is in the standard scope. Anything between 15% and
 * 50% is a designer add-on and is deliberately NOT here — a first quote that
 * includes the occasional dry-balcony unit is a first quote that is high for
 * most people, and being high is how a quote stops being believed.
 */
export const CATALOGUE: CatalogueItem[] = [
  // ── Kitchen — the only plan-driven room ──
  {
    code: 'kitchen_base',
    room: 'KITCHEN',
    label: 'Base cabinets',
    work: 'MO',
    sizing: 'AREA',
    heightMm: 750,
    fromKitchenRun: true,
    spec: '18mm BWP carcass · laminate shutter · soft-close hinges',
  },
  {
    code: 'kitchen_wall',
    room: 'KITCHEN',
    label: 'Wall cabinets',
    work: 'MO',
    sizing: 'AREA',
    heightMm: 600,
    fromKitchenRun: true,
    spec: '18mm BWP carcass · laminate shutter · lift-up fittings',
  },
  {
    code: 'kitchen_loft',
    room: 'KITCHEN',
    label: 'Loft',
    work: 'MO',
    sizing: 'AREA',
    heightMm: 600,
    fromKitchenRun: true,
    spec: '18mm BWP carcass · laminate shutter',
  },
  {
    code: 'kitchen_tandem',
    room: 'KITCHEN',
    label: 'Tandem drawers',
    work: 'MO',
    sizing: 'UNIT',
    spec: 'Branded tandem box set · soft-close · 10-year rating',
  },

  // ── Bedrooms — standard sizes throughout ──
  {
    code: 'master_wardrobe',
    room: 'MASTER_BEDROOM',
    label: 'Wardrobe',
    work: 'MO',
    sizing: 'AREA',
    widthMm: 1800,
    heightMm: 2100,
    spec: '18mm BWP carcass · laminate shutter · soft-close hinges',
  },
  {
    code: 'master_loft',
    room: 'MASTER_BEDROOM',
    label: 'Loft over wardrobe',
    work: 'MO',
    sizing: 'AREA',
    widthMm: 1800,
    heightMm: 600,
    spec: '18mm BWP carcass · laminate shutter',
  },
  {
    code: 'master_dressing',
    room: 'MASTER_BEDROOM',
    label: 'Dressing unit & mirror',
    work: 'MO',
    sizing: 'UNIT',
    spec: 'Base unit with drawers · 5mm bevelled mirror',
  },
  {
    code: 'master_bed',
    room: 'MASTER_BEDROOM',
    label: 'Bed & headboard',
    work: 'NM',
    sizing: 'UNIT',
    spec: 'Queen · upholstered headboard · hydraulic storage',
  },

  {
    code: 'second_wardrobe',
    room: 'SECOND_BEDROOM',
    label: 'Wardrobe',
    work: 'MO',
    sizing: 'AREA',
    widthMm: 1500,
    heightMm: 2100,
    minBhk: 2,
    spec: '18mm BWP carcass · laminate shutter · soft-close hinges',
  },
  {
    code: 'second_loft',
    room: 'SECOND_BEDROOM',
    label: 'Loft over wardrobe',
    work: 'MO',
    sizing: 'AREA',
    widthMm: 1500,
    heightMm: 600,
    minBhk: 2,
    spec: '18mm BWP carcass · laminate shutter',
  },
  {
    code: 'second_bed',
    room: 'SECOND_BEDROOM',
    label: 'Bed & headboard',
    work: 'NM',
    sizing: 'UNIT',
    minBhk: 2,
    spec: 'Queen · upholstered headboard · hydraulic storage',
  },
  {
    code: 'second_workstation',
    room: 'SECOND_BEDROOM',
    label: 'Study / workstation',
    work: 'MO',
    sizing: 'UNIT',
    minBhk: 2,
    spec: '18mm BWP · laminate top · cable cut-out',
  },

  {
    code: 'third_wardrobe',
    room: 'THIRD_BEDROOM',
    label: 'Wardrobe',
    work: 'MO',
    sizing: 'AREA',
    widthMm: 1500,
    heightMm: 2100,
    minBhk: 3,
    spec: '18mm BWP carcass · laminate shutter · soft-close hinges',
  },
  {
    code: 'third_loft',
    room: 'THIRD_BEDROOM',
    label: 'Loft over wardrobe',
    work: 'MO',
    sizing: 'AREA',
    widthMm: 1500,
    heightMm: 600,
    minBhk: 3,
    spec: '18mm BWP carcass · laminate shutter',
  },
  {
    code: 'third_bed',
    room: 'THIRD_BEDROOM',
    label: 'Bed & headboard',
    work: 'NM',
    sizing: 'UNIT',
    minBhk: 3,
    spec: 'Queen · upholstered headboard · hydraulic storage',
  },

  // ── Living, dining, foyer ──
  {
    code: 'tv_unit',
    room: 'LIVING_DINING',
    label: 'TV unit',
    work: 'MO',
    sizing: 'AREA',
    widthMm: 2100,
    heightMm: 2100,
    spec: '18mm BWP carcass · laminate · concealed wiring',
  },
  {
    code: 'console_shoe',
    room: 'LIVING_DINING',
    label: 'Console & shoe rack',
    work: 'MO',
    sizing: 'AREA',
    widthMm: 1200,
    heightMm: 900,
    spec: '18mm BWP carcass · laminate shutter',
  },
  {
    code: 'mandir',
    room: 'LIVING_DINING',
    label: 'Mandir',
    work: 'MO',
    sizing: 'AREA',
    widthMm: 600,
    heightMm: 1800,
    spec: '18mm BWP · laminate · integrated lighting',
  },
  {
    code: 'safety_door',
    room: 'LIVING_DINING',
    label: 'Safety door',
    work: 'NM',
    sizing: 'UNIT',
    spec: 'MS frame · mesh shutter · powder-coated',
  },

  // ── Everything that is not a piece of furniture ──
  {
    code: 'false_ceiling',
    room: 'WHOLE_HOME',
    label: 'False ceiling',
    work: 'NM',
    sizing: 'PER_SQFT_CARPET',
    spec: 'Gypsum · peripheral to living and bedrooms · with cove',
  },
  {
    code: 'painting',
    room: 'WHOLE_HOME',
    label: 'Painting',
    work: 'NM',
    sizing: 'PER_SQFT_CARPET',
    spec: 'Putty · primer · two coats emulsion',
  },
  {
    code: 'electrical',
    room: 'WHOLE_HOME',
    label: 'Electrical',
    work: 'NM',
    sizing: 'PER_SQFT_CARPET',
    spec: 'Additional points · concealed conduit · modular switches',
  },
  {
    code: 'vanity',
    room: 'BATHROOMS',
    label: 'Vanity',
    work: 'MO',
    sizing: 'PER_BATHROOM',
    spec: 'Marine-ply carcass · laminate · mirror unit',
  },
];

/** Look an item up by the code its rate is filed against. */
export const ITEM: Record<string, CatalogueItem> = Object.fromEntries(
  CATALOGUE.map((i) => [i.code, i]),
);

// ── The terms every quote is built on ───────────────────────────

/**
 * The commercial terms, which are ours and identical for every studio.
 *
 * Confirmed exactly against four real quotations:
 *
 *     Total = (MO + NM) + 7% professional fee − 15% discount on MO
 *
 * The 15% is not a promotion and must not be presented as one. It is how this
 * market actually prices modular work — the list rate carries it — and a quote
 * that omitted it would be 15% high on the largest half of the bill, which is
 * the difference between a believable first quote and one that gets ignored.
 *
 * Holding these constant across studios is the point. If each studio set its
 * own fee and its own discount, two totals would differ for reasons that have
 * nothing to do with what is being built, and the comparison would be
 * measuring our contract terms rather than their prices.
 */
export const PROFESSIONAL_FEE_BPS = 700; // 7%
export const GST_BPS = 1800; // 18%

/**
 * The modular discount: 10%, and the number is not 15.
 *
 * This said 15% until the archive was actually read. That figure came from a
 * calibration note written against **four** quotations, all of which happened
 * to use it. Across the 934 that parse, the distribution is:
 *
 *     10%  279      0%   119      20%  21      25%  15
 *     15%  223      11%   25      12%  18      other 100
 *      5%  173
 *
 * The median is 10%. Fifteen was a real number from a real sample that was
 * too small, which is the most expensive kind of wrong — it looks sourced.
 * At 15% we would have under-quoted every studio by 5% of the modular half,
 * about ₹38,000 on a ₹7.7 L modular bill, and the error would have surfaced
 * as studios quietly revising their first quotes upward after a site visit:
 * exactly the behaviour this product exists to make impossible.
 *
 * It is held constant across studios on purpose. In the archive the rate is
 * per-quote and negotiated — six files carry a rupee amount in the cell
 * instead of a rate, and about twenty have a hand-rounded total — so letting
 * each studio set their own would mean two comparison totals differed on
 * bargaining rather than on what is being built.
 */
export const MODULAR_DISCOUNT_BPS = 1000; // 10% off MO — median of 934 quotations

/**
 * How many of a studio's own quotations we read before we will price for them.
 *
 * A rate taken from a handful of quotes is one designer's mood. A hundred is
 * enough for a median to mean something and for an outlier to stand out — and
 * it is also a real commitment from the studio, which is part of why the
 * roster is fourteen and not six thousand.
 */
export const MIN_QUOTATIONS_FOR_RATES = 100;

// ── A studio's rates ────────────────────────────────────────────

/**
 * One filed rate, and where it came from.
 *
 * `source` is not decoration. Every number this product shows a customer has
 * to be answerable, and for a rate the honest answer is "the median of the 104
 * quotations this studio filed" — not "our estimate". The customer never sees
 * this string, but the expert reading the quote back to them does, and so does
 * anyone investigating a complaint.
 */
export interface FiledRate {
  code: string;
  /** Per sqft of face for AREA, per unit for UNIT, per sqft carpet, or per bath. */
  ratePaise: Paise;
  /** How many of the studio's quotations this rate was derived from. */
  fromQuotations: number;
  /** ISO date the archive was last read. */
  filedOn: string;
}

export type StudioRates = Record<string, FiledRate>;

/**
 * Can this studio be quoted at all?
 *
 * A missing rate is never guessed and never substituted from another studio.
 * The quote names what could not be priced and says the studio has not filed
 * it — which is a fact about the studio worth knowing, and far better than a
 * total that quietly excludes the kitchen.
 */
export function missingRates(rates: StudioRates, items: CatalogueItem[]): string[] {
  return items.filter((i) => rates[i.code] === undefined).map((i) => i.code);
}
