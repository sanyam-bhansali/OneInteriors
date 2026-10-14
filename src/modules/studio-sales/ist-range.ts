/**
 * Date ranges in India days (leads at scale, 12 Oct 2026). Pure, tested in
 * tests/studio-leads-scale.test.ts.
 *
 * Every range the leads list, the dashboard and the calendar use is a token
 * that can sit in a URL and in a saved view: `today`, `7d`, `month`, or a
 * custom `2026-10-01..2026-10-12`. A saved view called "New today" has to
 * mean today every morning, so the relative ones are stored as words and
 * turned into instants only when the page is read. Days are India days
 * (midnight to midnight IST), whatever the server's clock says.
 */

import { IST_OFFSET_MS, addDays, isDay, istDay } from '@/modules/project/working-days';

const DAY = 86_400_000;

export type RangePreset = 'today' | 'yesterday' | '7d' | '30d' | 'week' | 'month' | 'any';

export const RANGE_PRESETS: readonly RangePreset[] = ['today', 'yesterday', '7d', '30d', 'week', 'month', 'any'];

export const RANGE_LABELS: Record<RangePreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  week: 'This week',
  month: 'This month',
  any: 'Any time',
};

/** A preset, or a custom span of India days (inclusive). */
export type RangeToken = RangePreset | { from: string; to: string };

/** The instant IST midnight of this day begins. */
export function istDayStart(day: string): Date {
  return new Date(Date.parse(`${day}T00:00:00Z`) - IST_OFFSET_MS);
}

/** The last millisecond of this IST day. */
export function istDayEnd(day: string): Date {
  return new Date(istDayStart(day).getTime() + DAY - 1);
}

/** Monday of the IST week `day` is in. */
export function istMonday(day: string): string {
  const js = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, js === 0 ? -6 : 1 - js);
}

/** The first day of the IST month `day` is in. */
export function monthStart(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

/** The last day of the IST month `day` is in. */
export function monthEnd(day: string): string {
  const [y, m] = day.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${day.slice(0, 7)}-${String(last).padStart(2, '0')}`;
}

/** Read a token from a URL value. Unknown or broken values are null (no filter). */
export function parseRange(raw: unknown): RangeToken | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim();
  if ((RANGE_PRESETS as readonly string[]).includes(v)) return v as RangePreset;
  const m = /^(\d{4}-\d{2}-\d{2})(?:\.\.(\d{4}-\d{2}-\d{2}))?$/.exec(v);
  if (!m) return null;
  const from = m[1]!;
  const to = m[2] ?? from;
  if (!isDay(from) || !isDay(to)) return null;
  return from <= to ? { from, to } : { from: to, to: from };
}

/** The token as a URL value. */
export function rangeToString(r: RangeToken): string {
  if (typeof r === 'string') return r;
  return r.from === r.to ? r.from : `${r.from}..${r.to}`;
}

/**
 * The instants a token covers, as a Prisma date filter: `{ gte, lte }`.
 * `any` is "has a value at all" (since 1970), for "booked at any time".
 */
export function rangeBounds(r: RangeToken, now: Date): { gte: Date; lte?: Date } {
  if (r === 'any') return { gte: new Date(0) };
  const today = istDay(now);
  let from: string;
  let to: string;
  if (typeof r !== 'string') {
    from = r.from;
    to = r.to;
  } else if (r === 'today') {
    from = to = today;
  } else if (r === 'yesterday') {
    from = to = addDays(today, -1);
  } else if (r === '7d') {
    from = addDays(today, -6);
    to = today;
  } else if (r === '30d') {
    from = addDays(today, -29);
    to = today;
  } else if (r === 'week') {
    from = istMonday(today);
    to = addDays(from, 6);
  } else {
    from = monthStart(today);
    to = monthEnd(today);
  }
  return { gte: istDayStart(from), lte: istDayEnd(to) };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "12 Oct" for an IST day. */
export function shortDay(day: string): string {
  const [, m, d] = day.split('-').map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1]}`;
}

/** "Today", "Last 7 days", "1 Oct – 12 Oct". */
export function rangeLabel(r: RangeToken): string {
  if (typeof r === 'string') return RANGE_LABELS[r];
  return r.from === r.to ? shortDay(r.from) : `${shortDay(r.from)} – ${shortDay(r.to)}`;
}
