import { EMPTY_BRIEF, type Brief } from './types';

/**
 * A brief as the phone app sends it, made safe to hand to `saveBrief`.
 *
 * The website's server action receives a `Brief` from our own React code; the
 * app's JSON API receives whatever arrives over the wire. `briefToRow` calls
 * `.filter` on the list fields and `BigInt` on the budget, so a missing array
 * or a string budget would be a 500 rather than a refusal. This fills absent
 * fields from `EMPTY_BRIEF` and resets any field of the wrong type to empty.
 * Enum values are left to the database, which refuses a value it does not
 * know — and `saveBrief` turns that into `persisted: false`, not a crash.
 */

const LISTS = [
  'scopeRooms',
  'excludedItems',
  'styleLikes',
  'styleDislikes',
  'styleStudioPicks',
  'needs',
  'priorityRanking',
] as const;

const NUMBERS = ['carpetAreaSqft', 'budgetMinPaise', 'budgetMaxPaise'] as const;

export function briefFromJson(value: unknown): Brief | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const brief: Record<string, unknown> = { ...EMPTY_BRIEF };

  for (const key of Object.keys(EMPTY_BRIEF) as (keyof Brief)[]) {
    if (key in input) brief[key] = input[key];
  }

  for (const key of LISTS) {
    const list = brief[key];
    brief[key] = Array.isArray(list) ? list.filter((v) => typeof v === 'string') : [];
  }

  for (const key of NUMBERS) {
    const n = brief[key];
    brief[key] = typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 ? n : null;
  }

  if (typeof brief.lastStep !== 'number' || !Number.isInteger(brief.lastStep)) brief.lastStep = 0;

  const household = brief.household;
  if (household !== null && (typeof household !== 'object' || Array.isArray(household))) {
    brief.household = null;
  }

  // Plan readings come only from our own reader on the server (the floor-plan
  // endpoint), never from a client claiming one.
  brief.planReading = null;
  brief.floorPlanName = null;

  return brief as unknown as Brief;
}
