/**
 * Composing a board: what goes in a room, what to start them with, and what the
 * board is quietly saying about their budget.
 *
 * The catalogue says what things ARE. This says where they GO and what a
 * particular collection of them means — which is the half that makes creating a
 * board safe rather than aspirational.
 *
 * Pure and tested. No `server-only` — see CONTRIBUTING §9.5.
 */

import type { BudgetTier, StyleTag } from '@/modules/brief/types';
import {
  ELEMENTS,
  elementBySlug,
  isAboveBand,
  bandRank,
  type Element,
  type ElementCategory,
} from './catalogue';
import type { RoomKey } from './rooms';

/** Which categories are worth offering in each room. */
const ROOM_CATEGORIES: Record<RoomKey, ElementCategory[]> = {
  LIVING: ['surfaces', 'furniture', 'lighting', 'textiles', 'walls'],
  KITCHEN: ['surfaces', 'joinery', 'lighting', 'walls'],
  BEDROOM_MAIN: ['joinery', 'furniture', 'textiles', 'lighting', 'walls'],
  BEDROOM_2: ['joinery', 'furniture', 'textiles', 'lighting', 'walls'],
  BEDROOM_3: ['joinery', 'furniture', 'textiles', 'lighting', 'walls'],
  BEDROOM_4: ['joinery', 'furniture', 'textiles', 'lighting', 'walls'],
  STUDY: ['joinery', 'furniture', 'lighting', 'walls'],
  BATHROOMS: ['surfaces', 'lighting', 'walls'],
  BALCONY: ['surfaces', 'furniture', 'textiles', 'lighting'],
};

/**
 * Elements that only make sense in particular rooms.
 *
 * Category alone is not enough: a granite counter and a floor tile are both
 * `surfaces`, and offering the counter for a bedroom would tell the customer,
 * accurately, that nobody thought about this. Anything absent from this map is
 * offered wherever its category is.
 */
const ROOM_ONLY: Record<string, RoomKey[]> = {
  'granite-counter': ['KITCHEN'],
  'quartz-counter': ['KITCHEN'],
  'platform-bed': ['BEDROOM_MAIN', 'BEDROOM_2', 'BEDROOM_3', 'BEDROOM_4'],
  'hydraulic-storage-bed': ['BEDROOM_MAIN', 'BEDROOM_2', 'BEDROOM_3', 'BEDROOM_4'],
  'fabric-sofa-low': ['LIVING'],
  'sectional-sofa': ['LIVING'],
  'leather-sofa': ['LIVING'],
  'solid-wood-dining': ['LIVING'],
  'glass-dining': ['LIVING'],
  'marble-coffee-table': ['LIVING'],
  'sliding-wardrobe': ['BEDROOM_MAIN', 'BEDROOM_2', 'BEDROOM_3', 'BEDROOM_4'],
  'floor-to-ceiling-wardrobe': ['BEDROOM_MAIN', 'BEDROOM_2', 'BEDROOM_3', 'BEDROOM_4'],
  'blackout-blinds': ['BEDROOM_MAIN', 'BEDROOM_2', 'BEDROOM_3', 'BEDROOM_4'],
  chandelier: ['LIVING'],
};

/** Everything offerable in a room, in catalogue order. */
export function elementsForRoom(room: RoomKey): Element[] {
  const categories = new Set(ROOM_CATEGORIES[room] ?? []);

  return ELEMENTS.filter((element) => {
    if (!categories.has(element.category)) return false;
    const only = ROOM_ONLY[element.slug];
    return only ? only.includes(room) : true;
  });
}

/**
 * How well an element suits this customer, for ordering the picker.
 *
 * Higher is better. Style match dominates, because that is what the customer
 * asked for; band proximity breaks ties, so an in-band item edges out an
 * identical-looking one they cannot afford.
 *
 * A disliked style is NOT scored low — it is removed entirely, by the caller.
 * Q5 is a hard filter everywhere else in this product and a picker that merely
 * deprioritised it would be the one place we quietly overrode the customer.
 */
function affinity(element: Element, likes: StyleTag[], tier: BudgetTier | null): number {
  const styleHits = element.styles.filter((style) => likes.includes(style)).length;

  // Style-neutral items (empty `styles`) are staples — paint, granite, a
  // storage bed. They should sit mid-table rather than last, so they get a
  // small constant instead of a zero.
  const styleScore = element.styles.length === 0 ? 1 : styleHits * 3;

  if (tier === null) return styleScore;

  // Distance from their band, so above and below both cost something — an
  // ESSENTIAL item is not the "best" suggestion for a LUXURY customer.
  const distance = Math.abs(bandRank(element.band) - bandRank(tier));
  return styleScore - distance;
}

export interface PickerEntry {
  element: Element;
  aboveBand: boolean;
}

/**
 * The picker for one room: what they can add, best first, with anything above
 * their band flagged rather than hidden.
 *
 * Hiding it would be a lie of omission and people notice a thin catalogue. They
 * can have the marble; they just cannot have it by accident.
 */
export function pickerFor(
  room: RoomKey,
  likes: StyleTag[],
  dislikes: StyleTag[],
  tier: BudgetTier | null,
): PickerEntry[] {
  const banned = new Set(dislikes);

  return elementsForRoom(room)
    .filter((element) => !element.styles.some((style) => banned.has(style)))
    .map((element) => ({ element, aboveBand: isAboveBand(element, tier) }))
    .sort((a, b) => affinity(b.element, likes, tier) - affinity(a.element, likes, tier));
}

/**
 * The board we hand them to begin with.
 *
 * ## Why it is not empty
 *
 * This is the one real lesson from Planner5D. A blank canvas is the highest
 * drop-off surface in any tool of this kind — people do not know where to
 * start, so they do not. A board that is already half-built asks a much easier
 * question: not "what do you want?" but "is this right?", which anybody can
 * answer. Everything seeded here is removable, so they are still the author.
 *
 * ## Why it is in-band only
 *
 * The seed is our suggestion, and our suggestion should be affordable. They can
 * reach for the marble themselves — but us putting it there and letting them
 * discover the cost later is exactly the bait the rest of the product exists to
 * avoid.
 */
export function seedBoard(
  room: RoomKey,
  likes: StyleTag[],
  dislikes: StyleTag[],
  tier: BudgetTier | null,
  size = 4,
): string[] {
  const inBand = pickerFor(room, likes, dislikes, tier).filter((entry) => !entry.aboveBand);

  // One per category before doubling up, so a starting board reads as a room
  // rather than four floor tiles.
  const seen = new Set<ElementCategory>();
  const picked: string[] = [];

  for (const entry of inBand) {
    if (picked.length >= size) break;
    if (seen.has(entry.element.category)) continue;
    seen.add(entry.element.category);
    picked.push(entry.element.slug);
  }

  for (const entry of inBand) {
    if (picked.length >= size) break;
    if (!picked.includes(entry.element.slug)) picked.push(entry.element.slug);
  }

  return picked;
}

export interface BoardReading {
  total: number;
  aboveBand: number;
  /**
   * One sentence about what this board is doing to their budget, or null when
   * there is nothing worth saying.
   *
   * Null is the common case and that is deliberate. A running commentary on
   * every board turns into noise and then into nagging, and this page must
   * never feel like it is marking their work.
   */
  message: string | null;
  /** True when the board leans far enough above band to matter on the call. */
  stretching: boolean;
}

/**
 * What the board is saying about the budget.
 *
 * This is the feature. Nobody's Pinterest board tells them it costs three times
 * what they have — it cannot, because Pinterest has no idea what they have. We
 * do, so we say it, early, while it is still a conversation rather than a
 * disappointment in month two.
 *
 * It says it ONCE and without scolding. The customer is allowed to want things
 * above their band; plenty of good projects start there and get negotiated down
 * deliberately. What they are not allowed to do is arrive at the call not
 * knowing.
 */
export function readBoard(items: string[], tier: BudgetTier | null): BoardReading {
  const elements = items
    .map((slug) => elementBySlug(slug))
    .filter((element): element is Element => element !== null);

  const total = elements.length;
  const aboveBand = elements.filter((element) => isAboveBand(element, tier)).length;

  if (tier === null || total === 0) {
    return { total, aboveBand, message: null, stretching: false };
  }

  // A third. Below that it is one indulgence in an otherwise sensible room,
  // which is normal and healthy and none of our business.
  const stretching = aboveBand * 3 >= total && aboveBand > 0;

  if (!stretching) {
    return { total, aboveBand, message: null, stretching: false };
  }

  return {
    total,
    aboveBand,
    stretching: true,
    message:
      aboveBand === total
        ? 'Every piece on this board sits above the band you picked. That is worth knowing now rather than in month two — bring it up on the call and we will show you where the money would have to come from.'
        : `${aboveBand} of these ${total} sit above the band you picked. Not a problem, and worth raising on the call — usually one of them carries the look and the others can come down.`,
  };
}
