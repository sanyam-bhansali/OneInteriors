/**
 * Hauspire's running projects on their real start dates (owner, 1 Nov 2026:
 * "I have added the project start date in this so you can properly update
 * the project tracker as per this and mark delay as well as stage"). Pure;
 * tests/bring-in-start-dates.test.ts. The script is
 * scripts/set-hauspire-start-dates.ts.
 *
 * ## Why a shift
 *
 * Bringing a project in (bring-in.ts) lays the studio's plan out so the
 * step it is at falls on the day it came in: every project looked on time.
 * With the real start, the same plan moves back (or forward) by the days
 * between the two starts — every stage, every step's planned day, and the
 * days the steps done before joining are dated — so the step it is at now
 * shows as late by exactly the days it really is. Nothing else changes: the
 * same steps are done, the same step is current, the plan keeps its shape.
 *
 * ## The sheet's dates
 *
 * The sheet writes "28-Dec" with no year. A running project started in the
 * last twelve months, so a day after today is last year's.
 */

import { daysBetween } from '../project/working-days';

const MONTHS: Readonly<Record<string, number>> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

/** "28-Dec", "3 Sep", "03-Sep-2026", "2026-09-03" → the day, YYYY-MM-DD; null when it is not a day. */
export function startDayFrom(raw: string | null | undefined, today: string): string | null {
  const t = (raw ?? '').trim().toLowerCase();
  if (!t) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (iso) return valid(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const m = /^(\d{1,2})[\s\-/.]+([a-z]{3,4})[a-z]*(?:[\s\-/.]+(\d{2,4}))?$/.exec(t);
  if (!m) return null;
  const day = Number(m[1]);
  const month = MONTHS[m[2]!] ?? MONTHS[m[2]!.slice(0, 3)];
  if (!month) return null;
  if (m[3]) {
    const y = Number(m[3]);
    return valid(y < 100 ? 2000 + y : y, month, day);
  }
  const thisYear = Number(today.slice(0, 4));
  const d = valid(thisYear, month, day);
  if (!d) return null;
  return d > today ? valid(thisYear - 1, month, day) : d;
}

function valid(y: number, m: number, d: number): string | null {
  const day = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const at = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(at.getTime()) || at.toISOString().slice(0, 10) !== day ? null : day;
}

/** Days to move the plan: from the start it has to the real one (negative = earlier). */
export const shiftDays = (currentStart: string, realStart: string): number => daysBetween(currentStart, realStart);

const DAY_MS = 86_400_000;

/** An instant moved by whole days. */
export const shifted = (at: Date, days: number): Date => new Date(at.getTime() + days * DAY_MS);

/**
 * When a step done before joining is dated after the shift: its new planned
 * day, but never after the day the project came in (a project that started
 * later than the plan assumed is ahead, not done in the future).
 */
export function doneBeforeJoiningAt(newPlannedOn: Date | null, oldDoneAt: Date, broughtInAt: Date, days: number): Date {
  const at = newPlannedOn ?? shifted(oldDoneAt, days);
  return at > broughtInAt ? broughtInAt : at;
}

/** The late days the current step will show: from its planned day to today, 0 when not past. */
export function lateDays(plannedOn: string | null, today: string): number {
  return plannedOn && plannedOn < today ? daysBetween(plannedOn, today) : 0;
}


