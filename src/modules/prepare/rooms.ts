/**
 * The rooms in a customer's home, and what share of the budget each one eats.
 *
 * ## Why this exists
 *
 * Between booking an expert call and taking it, a customer has nothing to do.
 * That gap is where they go and fill in three lead forms on three other sites,
 * because the alternative is sitting still. The prep pack is what we give them
 * instead — and the reason it works is not that it entertains them, it is that
 * everything they do in it makes their own call better. Effort they can feel
 * the point of.
 *
 * ## Why rooms and not a canvas
 *
 * The obvious build here is a drag-and-drop 3D planner. We are deliberately not
 * building one, for a reason that is worth writing down so nobody re-opens it
 * in six months:
 *
 * Hand somebody an empty canvas and eight thousand furniture items and they
 * will design a home their budget cannot buy. Every hour they spend on it makes
 * the first ten minutes of the expert call worse, because that call now has to
 * open by taking it away from them. A planner manufactures a disappointment and
 * then charges us the engineering months to build it.
 *
 * So the unit of work here is a ROOM, and every room carries the money it costs
 * from the first screen. The customer still gets to express taste — that is the
 * part that feels good — but they express it inside a frame that is true. They
 * arrive at the call having already made the trade-offs, which is exactly the
 * edge they were promised.
 *
 * Pure and tested. No `server-only` — see CONTRIBUTING §9.5.
 */

import { splitAcross, type Paise } from '@/lib/money';
import type { PropertyType, ScopeType, Household } from '@/modules/brief/types';

export const ROOM_KEYS = [
  'LIVING',
  'KITCHEN',
  'BEDROOM_MAIN',
  'BEDROOM_2',
  'BEDROOM_3',
  'BEDROOM_4',
  'STUDY',
  'BATHROOMS',
  'BALCONY',
] as const;

export type RoomKey = (typeof ROOM_KEYS)[number];

export const ROOM_LABELS: Record<RoomKey, string> = {
  LIVING: 'Living & dining',
  KITCHEN: 'Kitchen',
  BEDROOM_MAIN: 'Main bedroom',
  BEDROOM_2: 'Second bedroom',
  BEDROOM_3: 'Third bedroom',
  BEDROOM_4: 'Fourth bedroom',
  STUDY: 'Study corner',
  BATHROOMS: 'Bathrooms',
  BALCONY: 'Balcony & utility',
};

/**
 * Share of a fit-out budget each room typically takes, in Pune apartments.
 *
 * These are PLANNING weights, not a quote, and the page says so in those words.
 * They exist to stop a customer spending their whole imagination on the room
 * that costs the least. The kitchen carries the largest single share because
 * modular work is priced on shutter area and a kitchen has more of it than
 * anything else in the flat — which is the fact most first-time clients are
 * most surprised by, and the one most worth them learning before the call
 * rather than during it.
 *
 * Weights, not percentages, on purpose: the set of rooms varies by property and
 * scope, and `splitAcross` normalises whatever subset survives. Nothing here
 * has to sum to 100 and nothing should be edited to make it.
 */
const ROOM_WEIGHTS: Record<RoomKey, number> = {
  KITCHEN: 25,
  LIVING: 24,
  BEDROOM_MAIN: 18,
  BEDROOM_2: 12,
  BEDROOM_3: 12,
  BEDROOM_4: 12,
  STUDY: 6,
  BATHROOMS: 7,
  BALCONY: 4,
};

/** Bedroom count per property type. Mirrors `estimate.ts` deliberately. */
const BEDROOMS: Record<PropertyType, number> = {
  BHK_1: 1,
  BHK_2: 2,
  BHK_3: 3,
  BHK_4_PLUS: 4,
  VILLA: 4,
};

const BEDROOM_ORDER: RoomKey[] = ['BEDROOM_MAIN', 'BEDROOM_2', 'BEDROOM_3', 'BEDROOM_4'];

export interface RoomPlanInput {
  propertyType: PropertyType | null;
  scope: ScopeType | null;
  household: Household | null;
  /** Top of the customer's band. Null when they have not set one yet. */
  budgetMaxPaise: Paise | null;
}

export interface PlannedRoom {
  key: RoomKey;
  label: string;
  /**
   * Indicative share of the budget, in paise. Null when we deliberately did not
   * split — see `budgetSplit` below. Never a range: this is a planning figure
   * and dressing it as a band would imply an estimate we have not made.
   */
  indicativePaise: Paise | null;
}

export interface RoomPlan {
  rooms: PlannedRoom[];
  /**
   * Did we split the budget across these rooms?
   *
   * False when the scope is a single room — we know the budget but not which
   * room it belongs to, and guessing would put a confident rupee figure against
   * the wrong wall. The page says "you told us one room" rather than showing
   * nine silent blanks.
   */
  budgetSplit: boolean;
}

/**
 * Which rooms are in play, and what each is worth.
 *
 * The room set comes from the property type; the budget split comes from the
 * scope. Those are two different questions and conflating them is how a
 * kitchen-and-wardrobes customer ends up being shown a balcony budget.
 */
export function roomPlan(input: RoomPlanInput): RoomPlan {
  const property = input.propertyType ?? 'BHK_2';
  const scope = input.scope ?? 'FULL_HOME';
  const bedrooms = BEDROOMS[property];

  const keys: RoomKey[] = [];

  if (scope === 'KITCHEN_WARDROBE') {
    // Wardrobes live in bedrooms, so the bedrooms are in scope even though the
    // customer did not name them. The kitchen dominates by a wider margin here
    // than in a full home, because none of the living-room spend is present to
    // balance it.
    keys.push('KITCHEN', ...BEDROOM_ORDER.slice(0, bedrooms));
  } else {
    keys.push('LIVING', 'KITCHEN', ...BEDROOM_ORDER.slice(0, bedrooms));

    // A work corner is only a room if somebody works from home. Offering it to
    // everyone turns a real signal into furniture.
    if (input.household?.worksFromHome) keys.push('STUDY');

    keys.push('BATHROOMS', 'BALCONY');
  }

  const budgetSplit = scope !== 'SINGLE_ROOM' && input.budgetMaxPaise !== null;

  if (!budgetSplit) {
    return {
      rooms: keys.map((key) => ({ key, label: ROOM_LABELS[key], indicativePaise: null })),
      budgetSplit: false,
    };
  }

  // `splitAcross` and not a map of `total * weight / sum`: the parts have to sum
  // to the whole exactly, and a customer who adds up nine room figures and finds
  // they are ₹340 short of their own budget has just been given a reason to
  // distrust every other number we show them.
  const parts = splitAcross(
    input.budgetMaxPaise as Paise,
    keys.map((key) => ROOM_WEIGHTS[key]),
  );

  return {
    rooms: keys.map((key, i) => ({ key, label: ROOM_LABELS[key], indicativePaise: parts[i] })),
    budgetSplit: true,
  };
}
