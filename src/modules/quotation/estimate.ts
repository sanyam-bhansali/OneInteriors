/**
 * Turning a brief into quantities — the part of an indicative quote that is
 * ours rather than the studio's.
 *
 * ## What this is and is not
 *
 * A studio's rate card says what a square foot of wardrobe costs. It does not
 * say how many square feet of wardrobe a 3 BHK in Kharadi needs. This file is
 * that second half, and it is the honest weak point of the whole quote: the
 * rates are real, and the quantities are an educated guess from nine answers
 * and no site visit.
 *
 * So three rules hold:
 *
 * 1. **Every quantity carries the assumption that produced it**, in words the
 *    customer reads. Not a footnote — the assumptions are the product. A number
 *    without them is a promise we cannot keep.
 * 2. **The variance band widens as the brief gets thinner.** A quote from a
 *    brief with no carpet area is a worse guess than one with it, and the band
 *    has to say so rather than presenting equal confidence.
 * 3. **Nothing here is binding.** A firm quote comes from the studio after a
 *    site visit. This exists to tell a customer whether they are in the right
 *    ballpark and to make two studios comparable — not to be held to.
 *
 * Pure and exhaustively tested, because a quantity that is quietly wrong
 * produces a plausible number that is wrong by lakhs.
 */

import type { RateCategory } from './categories';

export type PropertyType = 'BHK_1' | 'BHK_2' | 'BHK_3' | 'BHK_4_PLUS' | 'VILLA';
export type ScopeType = 'FULL_HOME' | 'KITCHEN_WARDROBE' | 'SINGLE_ROOM' | 'RENOVATION';

export interface EstimateInput {
  propertyType: PropertyType | null;
  carpetAreaSqft: number | null;
  scope: ScopeType | null;
}

/**
 * Typical Pune carpet areas, used only when the customer did not tell us.
 *
 * These are the least defensible numbers in the file, which is exactly why
 * using one widens the variance band and adds a visible assumption saying we
 * guessed.
 */
export const TYPICAL_CARPET_SQFT: Record<PropertyType, number> = {
  BHK_1: 550,
  BHK_2: 850,
  BHK_3: 1150,
  BHK_4_PLUS: 1650,
  VILLA: 2200,
};

/** Bedrooms, which drive wardrobe area. */
export const BEDROOMS: Record<PropertyType, number> = {
  BHK_1: 1,
  BHK_2: 2,
  BHK_3: 3,
  BHK_4_PLUS: 4,
  VILLA: 4,
};

export const BATHROOMS: Record<PropertyType, number> = {
  BHK_1: 1,
  BHK_2: 2,
  BHK_3: 2,
  BHK_4_PLUS: 3,
  VILLA: 4,
};

/**
 * Kitchen shutter area in sqft. Not floor area — shutter area is what a
 * modular rate is quoted against, and conflating the two is the single most
 * common way a kitchen estimate comes out roughly double.
 */
export const KITCHEN_SHUTTER_SQFT: Record<PropertyType, number> = {
  BHK_1: 90,
  BHK_2: 120,
  BHK_3: 150,
  BHK_4_PLUS: 190,
  VILLA: 220,
};

/** Wardrobe shutter area per bedroom. */
const WARDROBE_SQFT_PER_BEDROOM = 55;

/** Other carpentry — TV unit, crockery, study — as sqft per bedroom. */
const CARPENTRY_SQFT_PER_BEDROOM = 28;

/** Share of carpet area that typically gets a false ceiling. */
const CEILING_SHARE = 0.55;

/**
 * Wall area as a multiple of carpet area.
 *
 * A rule of thumb that holds well enough for Indian apartments: roughly 3.2×
 * the carpet area once you account for internal partitions and a ceiling
 * height near 10 feet.
 */
const WALL_AREA_MULTIPLE = 3.2;

export interface EstimatedQuantity {
  category: RateCategory;
  quantity: number;
  unit: string;
  /** The sentence shown to the customer explaining where this number came from. */
  assumption: string;
}

export interface Estimate {
  carpetAreaSqft: number;
  /** True when we used a typical area because the customer did not give one. */
  areaAssumed: boolean;
  bedrooms: number;
  bathrooms: number;
  quantities: EstimatedQuantity[];
  /** ± this share. 0.15 = ±15%. */
  variancePct: number;
  /** Everything we had to assume, in reading order. */
  assumptions: string[];
}

/** Which categories a scope touches at all. */
export function categoriesForScope(scope: ScopeType | null): RateCategory[] {
  switch (scope) {
    case 'KITCHEN_WARDROBE':
      return ['modular_kitchen', 'wardrobes'];
    case 'SINGLE_ROOM':
      return ['wardrobes', 'carpentry', 'false_ceiling', 'painting', 'electrical'];
    case 'RENOVATION':
      return [
        'modular_kitchen',
        'wardrobes',
        'carpentry',
        'false_ceiling',
        'painting',
        'electrical',
        'plumbing',
        'flooring',
        'civil',
      ];
    case 'FULL_HOME':
    default:
      return [
        'modular_kitchen',
        'wardrobes',
        'carpentry',
        'false_ceiling',
        'painting',
        'electrical',
      ];
  }
}

const BASE_VARIANCE = 0.15;

export function estimate(input: EstimateInput): Estimate {
  const propertyType = input.propertyType ?? 'BHK_2';
  const assumptions: string[] = [];
  let variancePct = BASE_VARIANCE;

  if (!input.propertyType) {
    assumptions.push('You have not told us the property type, so we have assumed a 2 BHK.');
    // The single largest driver of everything below. Guessing it deserves the
    // largest single widening.
    variancePct += 0.15;
  }

  const areaAssumed = !input.carpetAreaSqft || input.carpetAreaSqft <= 0;
  const carpetAreaSqft = areaAssumed
    ? TYPICAL_CARPET_SQFT[propertyType]
    : (input.carpetAreaSqft as number);

  if (areaAssumed) {
    assumptions.push(
      `We have assumed a carpet area of ${TYPICAL_CARPET_SQFT[propertyType]} sqft, which is typical for a ${LABEL[propertyType]} in Pune. Telling us the real figure will tighten this considerably.`,
    );
    variancePct += 0.1;
  }

  if (!input.scope) {
    assumptions.push('You have not told us the scope, so we have priced a full home.');
    variancePct += 0.05;
  }

  const scope = input.scope ?? 'FULL_HOME';
  const bedrooms = BEDROOMS[propertyType];
  const bathrooms = BATHROOMS[propertyType];
  const wanted = new Set(categoriesForScope(scope));

  // A single room is one bedroom's worth of everything, not the whole home.
  const roomFactor = scope === 'SINGLE_ROOM' ? 1 / bedrooms : 1;
  if (scope === 'SINGLE_ROOM') {
    assumptions.push('For a single room we have priced one bedroom of a home this size.');
  }

  const quantities: EstimatedQuantity[] = [];
  const add = (category: RateCategory, quantity: number, unit: string, assumption: string) => {
    if (!wanted.has(category)) return;
    // Round to something a person can read. A quote claiming 118.4732 sqft of
    // wardrobe implies a precision the whole estimate does not have.
    const rounded = Math.round(quantity);
    if (rounded <= 0) return;
    quantities.push({ category, quantity: rounded, unit, assumption });
  };

  add(
    'modular_kitchen',
    KITCHEN_SHUTTER_SQFT[propertyType],
    'sqft',
    `A ${LABEL[propertyType]} kitchen is typically around ${KITCHEN_SHUTTER_SQFT[propertyType]} sqft of shutter area. This is shutter area, not floor area.`,
  );

  add(
    'wardrobes',
    bedrooms * WARDROBE_SQFT_PER_BEDROOM * roomFactor,
    'sqft',
    `${WARDROBE_SQFT_PER_BEDROOM} sqft of wardrobe per bedroom${
      roomFactor === 1 ? `, across ${bedrooms} bedrooms` : ''
    }.`,
  );

  add(
    'carpentry',
    bedrooms * CARPENTRY_SQFT_PER_BEDROOM * roomFactor,
    'sqft',
    'TV unit, crockery unit and storage, scaled to the size of the home.',
  );

  add(
    'false_ceiling',
    carpetAreaSqft * CEILING_SHARE * roomFactor,
    'sqft',
    `False ceiling over about ${Math.round(CEILING_SHARE * 100)}% of the carpet area — most homes do the living room and bedrooms, not the whole flat.`,
  );

  add(
    'painting',
    carpetAreaSqft * WALL_AREA_MULTIPLE * roomFactor,
    'sqft',
    `Wall area taken as ${WALL_AREA_MULTIPLE}× carpet area, which is the usual rule for a flat with 10 ft ceilings.`,
  );

  add(
    'electrical',
    carpetAreaSqft * roomFactor,
    'sqft',
    'Electrical priced across the carpet area.',
  );

  add('plumbing', bathrooms, 'bathroom', `Priced for ${bathrooms} bathrooms.`);

  add(
    'flooring',
    carpetAreaSqft,
    'sqft',
    'Flooring across the full carpet area, since renovation usually replaces it.',
  );

  add('civil', 1, 'job', 'Demolition and masonry, as one figure for a job this size.');

  return {
    carpetAreaSqft,
    areaAssumed,
    bedrooms,
    bathrooms,
    quantities,
    // Cap it. Past about 45% the number stops being useful and we should be
    // saying "we need more from you" rather than showing a wider band.
    variancePct: Math.min(variancePct, 0.45),
    assumptions,
  };
}

const LABEL: Record<PropertyType, string> = {
  BHK_1: '1 BHK',
  BHK_2: '2 BHK',
  BHK_3: '3 BHK',
  BHK_4_PLUS: '4+ BHK',
  VILLA: 'villa',
};

/**
 * Is the brief thin enough that we should decline to quote?
 *
 * A number with a ±45% band is not information, it is decoration — and worse,
 * a customer will remember the midpoint and not the band. Better to ask two
 * more questions than to publish a figure we know is nearly meaningless.
 */
export function tooThinToQuote(input: EstimateInput): boolean {
  return !input.propertyType && !input.carpetAreaSqft;
}
