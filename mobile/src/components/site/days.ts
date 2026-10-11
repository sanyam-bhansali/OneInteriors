import type { Update } from '../../lib/types';

/**
 * Site's calendar arithmetic, in IST (UTC+5:30, no daylight saving), on
 * whole day numbers so comparisons are plain integers.
 *
 * A working day is Monday to Saturday. A working day "missed" means only
 * that no update was posted for it: the app has no record of who was on
 * site, so it never says nobody came. Days before the first update ever
 * posted are not counted, since site work had not started.
 */

const DAY = 86_400_000;
const IST = 330 * 60_000;

/** The IST day an instant falls on. */
export const dayNum = (ms: number) => Math.floor((ms + IST) / DAY);
/** Midday IST on a day, as ISO, for the date formatters. */
export const dayIso = (n: number) => new Date(n * DAY - IST + 12 * 3_600_000).toISOString();
/** 0 Sunday … 6 Saturday. */
const weekday = (n: number) => new Date(n * DAY).getUTCDay();

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
const KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export interface StripDay {
  key: DayKey;
  n: number;
  state: 'done' | 'missed' | 'today' | 'later' | 'none';
  isToday: boolean;
}

export interface DayGroup {
  kind: 'day';
  n: number;
  updates: Update[];
}
export interface Gap {
  kind: 'gap';
  n: number;
}

/** This week, Monday to Saturday (on a Sunday, the week just ended). */
export function week(updates: Update[], now = Date.now()) {
  const today = dayNum(now);
  const wd = weekday(today);
  const monday = today - (wd === 0 ? 6 : wd - 1);
  const posted = new Set(updates.map((u) => dayNum(Date.parse(u.at))));
  const first = updates.length ? Math.min(...posted) : Infinity;
  const days: StripDay[] = KEYS.map((key, i) => {
    const n = monday + i;
    const has = posted.has(n);
    const state: StripDay['state'] = has ? 'done' : n > today ? 'later' : n === today ? 'today' : n >= first ? 'missed' : 'none';
    return { key, n, state, isToday: n === today };
  });
  const worked = days.filter((d) => d.state === 'done').length;
  const counted = days.filter((d) => d.state === 'done' || d.state === 'missed').length;
  return { days, worked, counted, today };
}

/** Every update grouped by day, newest first, with this week's missed days slotted in. */
export function timeline(updates: Update[], missed: number[]): (DayGroup | Gap)[] {
  const byDay = new Map<number, Update[]>();
  for (const u of [...updates].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))) {
    const n = dayNum(Date.parse(u.at));
    byDay.set(n, [...(byDay.get(n) ?? []), u]);
  }
  const items: (DayGroup | Gap)[] = [...byDay].map(([n, list]) => ({ kind: 'day' as const, n, updates: list }));
  for (const n of missed) items.push({ kind: 'gap', n });
  return items.sort((a, b) => b.n - a.n);
}
