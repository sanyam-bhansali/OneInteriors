/**
 * Mapping between the `Brief` the UI uses and the row Postgres stores.
 *
 * Pure, so the round trip can be tested without a database — and it needs
 * testing, because two things are easy to get wrong here and both are silent:
 *
 *  - **Money.** Budgets are integer paise as `number` in the app and `BigInt`
 *    in Postgres. A missed conversion does not throw, it just produces a budget
 *    a hundred times too large, which then quietly fails every hard filter in
 *    the matching engine.
 *  - **Household.** Nested in the app, five flat columns in the database. A
 *    null household is not the same as a household of zero people; the first
 *    means "not answered yet", the second would tell the matching engine a home
 *    with nobody in it.
 */

import { canonicalSociety } from './society';
import {
  EMPTY_BRIEF,
  HOME_NEEDS,
  LANGUAGES,
  type Brief,
  type HomeNeed,
  type Language,
  type PlanUse,
} from './types';
import type {
  PropertyType,
  PossessionStatus,
  ScopeType,
  Involvement,
  PriorityFactor,
  StyleTag,
} from './types';

/** The subset of the Prisma row this module reads. */
export interface BriefRow {
  /**
   * READ ONLY through this mapper, for the same reason as `floorPlanName`:
   * the contact step writes it, after consent, and a quiz sync that
   * round-tripped it would either erase it or write a name the customer has
   * not yet agreed to give us.
   */
  contactName?: string | null;
  propertyType: string | null;
  carpetAreaSqft: number | null;
  locality: string | null;
  society?: string | null;
  possessionStatus: string | null;
  possessionOn: Date | null;
  scope: string | null;
  scopeRooms?: string[];
  excludedItems?: string[];
  tier: string | null;
  budgetMinPaise: bigint | null;
  budgetMaxPaise: bigint | null;
  styleLikes: string[];
  styleDislikes: string[];
  styleStudioPicks?: string[];
  adults: number | null;
  children: number | null;
  elderly: number | null;
  pets: boolean;
  worksFromHome: boolean;
  needs?: string[];
  priorityRanking: string[];
  involvement: string | null;
  language?: string | null;
  moveInBy: Date | null;
  lastStep: number;
  completedAt: Date | null;
  /**
   * Display name of the uploaded floor plan, or null.
   *
   * READ ONLY through this mapper. It is deliberately absent from
   * `briefToRow`: the plan is written by the upload action, not by the quiz,
   * and a quiz sync that round-tripped this field would set it back to null
   * every time the customer changed an answer — silently detaching a file that
   * still exists in the bucket. Never the path, which is a storage detail that
   * has no business crossing to a client component.
   */
  floorPlanName?: string | null;
  floorPlanReading?: unknown;
}

/** A reading as a plain JSON object, checked on the way in as on the way out. */
function planJson(value: PlanUse): Record<string, string | number | boolean | null> | undefined {
  const p = planUseFrom(value);
  return p
    ? { kitchenRunMm: p.kitchenRunMm, bathrooms: p.bathrooms, hasStudy: p.hasStudy, areaSource: p.areaSource }
    : undefined;
}

/** A stored reading, if it has the shape we wrote; anything else is none. */
export function planUseFrom(value: unknown): PlanUse | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const run = typeof v.kitchenRunMm === 'number' && v.kitchenRunMm >= 1500 && v.kitchenRunMm <= 9000
    ? Math.round(v.kitchenRunMm)
    : null;
  const baths = typeof v.bathrooms === 'number' && Number.isInteger(v.bathrooms) && v.bathrooms >= 0 && v.bathrooms <= 6
    ? v.bathrooms
    : null;
  if (baths === null) return null;
  const source = v.areaSource;
  return {
    kitchenRunMm: run,
    bathrooms: baths,
    hasStudy: v.hasStudy === true,
    areaSource:
      source === 'printed' || source === 'computed' || source === 'customer' || source === 'society' ? source : null,
  };
}

/**
 * A society name, as typed, made safe to keep.
 *
 * Free text from a public form: trimmed, internal whitespace collapsed,
 * control characters dropped, capped at 80. Empty becomes null — "no answer"
 * and "answered with spaces" are the same thing.
 */
export function cleanSociety(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
  // A known building is stored under its one spelling (brief/society.ts).
  return cleaned ? canonicalSociety(cleaned) : null;
}

function isoDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function toDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function rowToBrief(row: BriefRow): Brief {
  // A household exists only once someone has actually answered Q6. `adults`
  // is the field that is always set when they do, so it is the marker.
  const household =
    row.adults === null
      ? null
      : {
          adults: row.adults,
          children: row.children ?? 0,
          elderly: row.elderly ?? 0,
          pets: row.pets,
          worksFromHome: row.worksFromHome,
        };

  return {
    ...EMPTY_BRIEF,
    contactName: row.contactName ?? null,
    propertyType: (row.propertyType as PropertyType) ?? null,
    carpetAreaSqft: row.carpetAreaSqft,
    locality: row.locality,
    society: row.society ?? null,
    possessionStatus: (row.possessionStatus as PossessionStatus) ?? null,
    possessionOn: isoDate(row.possessionOn),
    scope: (row.scope as ScopeType) ?? null,
    scopeRooms: row.scopeRooms ?? [],
    excludedItems: row.excludedItems ?? [],
    tier: (row.tier as Brief['tier']) ?? null,
    budgetMinPaise: row.budgetMinPaise === null ? null : Number(row.budgetMinPaise),
    budgetMaxPaise: row.budgetMaxPaise === null ? null : Number(row.budgetMaxPaise),
    styleLikes: row.styleLikes as StyleTag[],
    styleDislikes: row.styleDislikes as StyleTag[],
    styleStudioPicks: row.styleStudioPicks ?? [],
    household,
    // Filtered, not cast: a need retired from the list must not render as
    // `undefined` on somebody's brief.
    needs: (row.needs ?? []).filter((n): n is HomeNeed => (HOME_NEEDS as readonly string[]).includes(n)),
    priorityRanking: row.priorityRanking as PriorityFactor[],
    involvement: (row.involvement as Involvement) ?? null,
    language: (LANGUAGES as readonly string[]).includes(row.language ?? '')
      ? (row.language as Language)
      : null,
    moveInBy: isoDate(row.moveInBy),
    lastStep: row.lastStep,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    floorPlanName: row.floorPlanName ?? null,
    planReading: planUseFrom(row.floorPlanReading),
  };
}

/**
 * The writable shape. Enum-typed columns are left as strings for Prisma.
 *
 * `floorPlanName` and `floorPlanPath` are absent on purpose — see the note on
 * `BriefRow`. Adding them here would have the quiz erase an uploaded plan.
 */
export function briefToRow(brief: Brief) {
  return {
    propertyType: brief.propertyType,
    carpetAreaSqft: brief.carpetAreaSqft,
    locality: brief.locality,
    society: cleanSociety(brief.society),
    possessionStatus: brief.possessionStatus,
    possessionOn: toDate(brief.possessionOn),
    scope: brief.scope,
    // Short codes only; anything longer is not one of ours.
    scopeRooms: brief.scopeRooms.filter((r) => typeof r === 'string' && r.length <= 32).slice(0, 8),
    excludedItems: brief.excludedItems
      .filter((c) => typeof c === 'string' && c.length <= 40)
      .slice(0, 60),
    tier: brief.tier,
    budgetMinPaise: brief.budgetMinPaise === null ? null : BigInt(brief.budgetMinPaise),
    budgetMaxPaise: brief.budgetMaxPaise === null ? null : BigInt(brief.budgetMaxPaise),
    styleLikes: brief.styleLikes,
    styleDislikes: brief.styleDislikes,
    styleStudioPicks: (brief.styleStudioPicks ?? []).filter((id) => typeof id === 'string' && id.length <= 40).slice(0, 3),
    adults: brief.household?.adults ?? null,
    children: brief.household?.children ?? null,
    elderly: brief.household?.elderly ?? null,
    pets: brief.household?.pets ?? false,
    worksFromHome: brief.household?.worksFromHome ?? false,
    needs: brief.needs.filter((n) => (HOME_NEEDS as readonly string[]).includes(n)),
    priorityRanking: brief.priorityRanking,
    involvement: brief.involvement,
    language: brief.language,
    moveInBy: toDate(brief.moveInBy),
    // Json column: Prisma wants DbNull, not null, to clear it — omitted when
    // there is none so a sync never wipes a reading another tab confirmed.
    ...(brief.planReading ? { floorPlanReading: planJson(brief.planReading) } : {}),
    lastStep: brief.lastStep,
    completedAt: toDate(brief.completedAt),
  };
}
