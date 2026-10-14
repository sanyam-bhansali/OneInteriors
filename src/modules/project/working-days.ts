/**
 * IST days and a studio's working days (studio workspace Phases 2–5). Pure,
 * and tested in tests/working-days.test.ts.
 *
 * Everything on site is counted in IST calendar days: one site log per
 * project per day (`HomeSiteLog.date`), the 18:00 and 21:00 reminders, "no
 * update today", a delay in working days. A day is a `'YYYY-MM-DD'` string
 * here, never a `Date`, because a `Date` is an instant and the same instant
 * is two different days in UTC and IST for five and a half hours of every
 * day. Convert at the edges only:
 *
 * - `istDay(instant)` — which IST day an instant falls on.
 * - `dayToDb(day)` / `dayFromDb(date)` — a `@db.Date` column
 *   (`HomeSiteLog.date`, `StudioHoliday.day`, `HomeProjectPayment.receivedOn`)
 *   travels through Prisma as midnight UTC of that calendar day.
 * - `istTime(day, 'HH:MM')` — the instant of a wall-clock time in IST (when
 *   the 18:00 reminder is due).
 *
 * ## Working days
 *
 * `Studio.workingDays` holds ISO weekdays (1 = Monday … 7 = Sunday), Monday
 * to Saturday until the owner decides (brief §8.4), plus the studio's
 * `StudioHoliday` rows. `calendarOf` turns those columns into a
 * `StudioCalendar`, repairing anything unreadable to the default rather than
 * trusting it: a studio with no working days at all would never be reminded
 * and never late, which is the wrong failure.
 */

export const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;

/** 1 = Monday … 7 = Sunday (ISO 8601). */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Monday to Saturday: the default until the owner decides (brief §8.4). */
export const DEFAULT_WORKING_DAYS: readonly IsoWeekday[] = [1, 2, 3, 4, 5, 6];

export interface StudioCalendar {
  /** Sorted, unique, never empty. */
  workingDays: readonly IsoWeekday[];
  /** IST days off, `'YYYY-MM-DD'`. */
  holidays: ReadonlySet<string>;
}

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real calendar day written `'YYYY-MM-DD'` (rejects 2026-02-30). */
export function isDay(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const m = DAY_RE.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === v;
}

function assertDay(day: string): void {
  if (!isDay(day)) throw new Error(`Not a day: ${String(day)}`);
}

/** The IST calendar day an instant falls on. */
export function istDay(at: Date): string {
  return new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** The value to write to a `@db.Date` column for this day (midnight UTC, which Postgres stores as the date). */
export function dayToDb(day: string): Date {
  assertDay(day);
  return new Date(`${day}T00:00:00.000Z`);
}

/** A `@db.Date` value read back from Prisma, as a day. */
export function dayFromDb(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The day `n` calendar days after (or before, negative) this one. */
export function addDays(day: string, n: number): string {
  assertDay(day);
  return new Date(Date.parse(`${day}T00:00:00Z`) + Math.trunc(n) * DAY_MS).toISOString().slice(0, 10);
}

/** Whole calendar days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  assertDay(from);
  assertDay(to);
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** The ISO weekday of a day. */
export function isoWeekday(day: string): IsoWeekday {
  assertDay(day);
  const js = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return (js === 0 ? 7 : js) as IsoWeekday;
}

/** The instant of a wall-clock time on an IST day: `istTime('2026-10-12', '18:00')`. */
export function istTime(day: string, hhmm: string): Date {
  assertDay(day);
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!m) throw new Error(`Not a time: ${hhmm}`);
  return new Date(Date.parse(`${day}T${m[1]}:${m[2]}:00Z`) - IST_OFFSET_MS);
}

/** Minutes since IST midnight for an instant (18:00 IST = 1080). */
export function istMinutesOfDay(at: Date): number {
  const ms = (at.getTime() + IST_OFFSET_MS) % DAY_MS;
  return Math.floor((ms < 0 ? ms + DAY_MS : ms) / 60_000);
}

/** `Studio.workingDays` as stored → a clean, sorted list; the default when nothing usable is there. */
export function readWorkingDays(raw: unknown): IsoWeekday[] {
  if (!Array.isArray(raw)) return [...DEFAULT_WORKING_DAYS];
  const days = [...new Set(raw.filter((d): d is IsoWeekday => Number.isInteger(d) && d >= 1 && d <= 7))].sort((a, b) => a - b);
  return days.length ? days : [...DEFAULT_WORKING_DAYS];
}

/**
 * A studio's calendar from its columns: `Studio.workingDays` and its
 * `StudioHoliday.day` values (Dates from Prisma, or days already).
 */
export function calendarOf(studio: { workingDays?: unknown; holidays?: readonly (Date | string | { day: Date | string })[] | null }): StudioCalendar {
  const holidays = new Set<string>();
  for (const h of studio.holidays ?? []) {
    const v = typeof h === 'object' && !(h instanceof Date) ? h.day : h;
    const day = v instanceof Date ? (Number.isNaN(v.getTime()) ? null : dayFromDb(v)) : isDay(v) ? v : null;
    if (day) holidays.add(day);
  }
  return { workingDays: readWorkingDays(studio.workingDays), holidays };
}

/** The default calendar: Monday to Saturday, no holidays. */
export const DEFAULT_CALENDAR: StudioCalendar = { workingDays: DEFAULT_WORKING_DAYS, holidays: new Set() };

/** Whether the studio works on this day: one of its weekdays and not a holiday. */
export function isWorkingDay(day: string, cal: StudioCalendar = DEFAULT_CALENDAR): boolean {
  return cal.workingDays.includes(isoWeekday(day)) && !cal.holidays.has(day);
}

/** Far enough to get past any run of holidays a studio could enter, near enough to stop a loop. */
const SEARCH_LIMIT = 400;

/** The first working day after `day` (or `day` itself with `inclusive`). Null only if none within ~a year. */
export function nextWorkingDay(day: string, cal: StudioCalendar = DEFAULT_CALENDAR, opts: { inclusive?: boolean } = {}): string | null {
  let d = opts.inclusive ? day : addDays(day, 1);
  for (let i = 0; i < SEARCH_LIMIT; i++, d = addDays(d, 1)) if (isWorkingDay(d, cal)) return d;
  return null;
}

/** The last working day before `day` (or `day` itself with `inclusive`). Null only if none within ~a year. */
export function previousWorkingDay(day: string, cal: StudioCalendar = DEFAULT_CALENDAR, opts: { inclusive?: boolean } = {}): string | null {
  let d = opts.inclusive ? day : addDays(day, -1);
  for (let i = 0; i < SEARCH_LIMIT; i++, d = addDays(d, -1)) if (isWorkingDay(d, cal)) return d;
  return null;
}

/**
 * Working days after `from` up to and including `to` — "4 working days
 * late". Negative when `to` is before `from` (counting the working days in
 * `(to, from]`), 0 when they are the same day.
 */
export function workingDaysBetween(from: string, to: string, cal: StudioCalendar = DEFAULT_CALENDAR): number {
  const span = daysBetween(from, to);
  if (span === 0) return 0;
  const [lo, hi, sign] = span > 0 ? [from, to, 1] : [to, from, -1];
  let n = 0;
  for (let d = addDays(lo, 1); daysBetween(d, hi) >= 0; d = addDays(d, 1)) if (isWorkingDay(d, cal)) n++;
  return sign * n;
}

/** The day `n` working days after `day` (n ≥ 0; 0 returns `day`). */
export function addWorkingDays(day: string, n: number, cal: StudioCalendar = DEFAULT_CALENDAR): string {
  assertDay(day);
  let d = day;
  for (let left = Math.max(0, Math.trunc(n)); left > 0; left--) {
    const next = nextWorkingDay(d, cal);
    if (!next) throw new Error('No working day within a year');
    d = next;
  }
  return d;
}
