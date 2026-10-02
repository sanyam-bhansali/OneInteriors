/**
 * The society floor-plan library — "3 homes in Sapphire Heights have shared
 * their 3 BHK plan: use these sizes?" (Phase 7).
 *
 * When a customer confirms the sizes read off their own floor plan, the sizes
 * (never the file, never the name) are kept against their society and home
 * type. The next family in the same building gets them without uploading
 * anything, and their quote is priced on a real kitchen instead of a
 * standard one.
 *
 * ## Two homes before anything is offered
 *
 * One home's sizes shown back to a neighbour would be that one flat. Two or
 * more is a building's layout, and the median of them is what is offered —
 * so an odd reading (a corner unit, a typo) does not become everyone's plan.
 *
 * Sizes that came FROM the library are never recorded back into it: that
 * would let one flat's numbers reinforce themselves.
 *
 * Pure, and tested.
 */

import { societyMatchKey } from '@/modules/brief/society';

export const MIN_HOMES = 2;

/**
 * "Sapphire Heights", "sapphire  heights " and "Sapphire-Heights" are one
 * building — and so are a known society's aliases ("Gera WOJ" is Gera World
 * of Joy; brief/society.ts).
 */
export function societyKey(name: string | null | undefined): string | null {
  return societyMatchKey(name);
}

export interface SharedPlan {
  carpetAreaSqft: number | null;
  bathrooms: number;
  kitchenRunMm: number | null;
}

export interface LibraryReading {
  carpetAreaSqft: number | null;
  bathrooms: number;
  kitchenRunMm: number | null;
  homes: number;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
}

/** The building's plan from the homes that shared it, or null below two. */
export function libraryReading(plans: SharedPlan[]): LibraryReading | null {
  if (plans.length < MIN_HOMES) return null;
  const area = median(plans.map((p) => p.carpetAreaSqft).filter((v): v is number => v !== null));
  const run = median(plans.map((p) => p.kitchenRunMm).filter((v): v is number => v !== null));
  return {
    carpetAreaSqft: area,
    bathrooms: median(plans.map((p) => p.bathrooms)) ?? 1,
    kitchenRunMm: run,
    homes: plans.length,
  };
}

/** Should this confirmed reading go into the library? Only one read off a real plan. */
export function shareable(reading: { areaSource: string | null } | null, society: string | null): boolean {
  return Boolean(reading && societyKey(society) && reading.areaSource !== 'society');
}
