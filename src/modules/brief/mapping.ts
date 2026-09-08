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

import { EMPTY_BRIEF, type Brief } from './types';
import type { PropertyType, ScopeType, Involvement, PriorityFactor, StyleTag } from './types';

/** The subset of the Prisma row this module reads. */
export interface BriefRow {
  propertyType: string | null;
  carpetAreaSqft: number | null;
  locality: string | null;
  possessionOn: Date | null;
  scope: string | null;
  budgetMinPaise: bigint | null;
  budgetMaxPaise: bigint | null;
  styleLikes: string[];
  styleDislikes: string[];
  adults: number | null;
  children: number | null;
  elderly: number | null;
  pets: boolean;
  worksFromHome: boolean;
  priorityRanking: string[];
  involvement: string | null;
  moveInBy: Date | null;
  lastStep: number;
  completedAt: Date | null;
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
    propertyType: (row.propertyType as PropertyType) ?? null,
    carpetAreaSqft: row.carpetAreaSqft,
    locality: row.locality,
    possessionOn: isoDate(row.possessionOn),
    scope: (row.scope as ScopeType) ?? null,
    budgetMinPaise: row.budgetMinPaise === null ? null : Number(row.budgetMinPaise),
    budgetMaxPaise: row.budgetMaxPaise === null ? null : Number(row.budgetMaxPaise),
    styleLikes: row.styleLikes as StyleTag[],
    styleDislikes: row.styleDislikes as StyleTag[],
    household,
    priorityRanking: row.priorityRanking as PriorityFactor[],
    involvement: (row.involvement as Involvement) ?? null,
    moveInBy: isoDate(row.moveInBy),
    lastStep: row.lastStep,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  };
}

/** The writable shape. Enum-typed columns are left as strings for Prisma. */
export function briefToRow(brief: Brief) {
  return {
    propertyType: brief.propertyType,
    carpetAreaSqft: brief.carpetAreaSqft,
    locality: brief.locality,
    possessionOn: toDate(brief.possessionOn),
    scope: brief.scope,
    budgetMinPaise: brief.budgetMinPaise === null ? null : BigInt(brief.budgetMinPaise),
    budgetMaxPaise: brief.budgetMaxPaise === null ? null : BigInt(brief.budgetMaxPaise),
    styleLikes: brief.styleLikes,
    styleDislikes: brief.styleDislikes,
    adults: brief.household?.adults ?? null,
    children: brief.household?.children ?? null,
    elderly: brief.household?.elderly ?? null,
    pets: brief.household?.pets ?? false,
    worksFromHome: brief.household?.worksFromHome ?? false,
    priorityRanking: brief.priorityRanking,
    involvement: brief.involvement,
    moveInBy: toDate(brief.moveInBy),
    lastStep: brief.lastStep,
    completedAt: toDate(brief.completedAt),
  };
}
