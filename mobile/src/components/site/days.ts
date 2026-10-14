import type { SiteDay, Update } from '../../lib/types';

/**
 * Site's calendar arithmetic, in IST (UTC+5:30, no daylight saving), on
 * whole day numbers so comparisons are plain integers.
 *
 * Two kinds of record feed the screen: the daily site log the studio posts
 * from site mode (`siteLogs`, Phase 2: one entry per day, with corrections
 * beside it and nobody-on-site days with their reason) and the older free
 * notes (`updates`). Both are shown, newest first.
 *
 * Missed days: when the server sends `siteMissedDays` it has already worked
 * them out against the studio's own working days and the 21:00 IST cut-off,
 * so those are used as they are. An older server does not send them; then a
 * working day (Monday to Saturday) with nothing posted counts as missed,
 * from the first update ever posted, as before.
 */

const DAY = 86_400_000;
const IST = 330 * 60_000;

/** The IST day an instant falls on. */
export const dayNum = (ms: number) => Math.floor((ms + IST) / DAY);
/** A 'YYYY-MM-DD' day as a day number. */
export const dayOfIsoDay = (day: string) => Math.floor(Date.parse(`${day}T00:00:00Z`) / DAY);
/** Midday IST on a day, as ISO, for the date formatters. */
export const dayIso = (n: number) => new Date(n * DAY - IST + 12 * 3_600_000).toISOString();
/** 0 Sunday … 6 Saturday. */
const weekday = (n: number) => new Date(n * DAY).getUTCDay();

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
const KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export interface StripDay {
  key: DayKey;
  n: number;
  /** done: work posted; nobody: the studio said nobody was on site; missed: nothing posted. */
  state: 'done' | 'nobody' | 'missed' | 'today' | 'later' | 'none';
  isToday: boolean;
}

/** A day of older notes. */
export interface DayGroup {
  kind: 'day';
  n: number;
  updates: Update[];
}
/** A day from the site log. */
export interface SiteItem {
  kind: 'site';
  n: number;
  day: SiteDay;
}
export interface Gap {
  kind: 'gap';
  n: number;
}
export type FeedItem = DayGroup | SiteItem | Gap;

/** This week, Monday to Saturday (on a Sunday, the week just ended). */
export function week(updates: Update[], siteLogs: SiteDay[] = [], serverMissed?: string[], now = Date.now()) {
  const today = dayNum(now);
  const wd = weekday(today);
  const monday = today - (wd === 0 ? 6 : wd - 1);
  const worked = new Set([...updates.map((u) => dayNum(Date.parse(u.at))), ...siteLogs.filter((d) => d.kind !== 'nobody').map((d) => dayOfIsoDay(d.day))]);
  const nobody = new Set(siteLogs.filter((d) => d.kind === 'nobody').map((d) => dayOfIsoDay(d.day)));
  const any = [...worked, ...nobody];
  const first = any.length ? Math.min(...any) : Infinity;
  const missed = serverMissed ? new Set(serverMissed.map(dayOfIsoDay)) : null;
  const days: StripDay[] = KEYS.map((key, i) => {
    const n = monday + i;
    const state: StripDay['state'] = worked.has(n)
      ? 'done'
      : nobody.has(n)
        ? 'nobody'
        : missed?.has(n)
          ? 'missed'
          : n > today
            ? 'later'
            : n === today
              ? 'today'
              : !missed && n >= first
                ? 'missed'
                : 'none';
    return { key, n, state, isToday: n === today };
  });
  const posted = days.filter((d) => d.state === 'done').length;
  const counted = days.filter((d) => d.state === 'done' || d.state === 'nobody' || d.state === 'missed').length;
  return { days, worked: posted, counted, today };
}

/** Every site-log day and every day of older notes, newest first, with the missed days slotted in. */
export function timeline(updates: Update[], missed: number[], siteLogs: SiteDay[] = []): FeedItem[] {
  const byDay = new Map<number, Update[]>();
  for (const u of [...updates].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))) {
    const n = dayNum(Date.parse(u.at));
    byDay.set(n, [...(byDay.get(n) ?? []), u]);
  }
  const items: FeedItem[] = [
    ...siteLogs.map((day) => ({ kind: 'site' as const, n: dayOfIsoDay(day.day), day })),
    ...[...byDay].map(([n, list]) => ({ kind: 'day' as const, n, updates: list })),
  ];
  const has = new Set(items.map((i) => i.n));
  for (const n of missed) if (!has.has(n)) items.push({ kind: 'gap', n });
  // Newest day first; on one day, the site log before older notes.
  const rank = { site: 0, day: 1, gap: 2 } as const;
  return items.sort((a, b) => b.n - a.n || rank[a.kind] - rank[b.kind]);
}

/** The latest thing posted from site, for Home's "Today on site": a site-log day or an older note, whichever is newer. */
export function latestFromSite(updates: Update[], siteLogs: SiteDay[] = []): { kind: 'site'; day: SiteDay; at: string } | { kind: 'note'; update: Update; at: string } | null {
  const log = [...siteLogs].sort((a, b) => (a.day === b.day ? Date.parse(b.postedAt) - Date.parse(a.postedAt) : a.day < b.day ? 1 : -1))[0];
  const note = [...updates].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
  if (log && (!note || dayOfIsoDay(log.day) >= dayNum(Date.parse(note.at)))) {
    const last = [log, ...log.corrections].map((e) => e.postedAt).sort().pop()!;
    return { kind: 'site', day: log, at: last };
  }
  return note ? { kind: 'note', update: note, at: note.at } : null;
}

/** Every photo of a site-log day, its corrections' too, in order. */
export const dayPhotos = (d: SiteDay) => [...d.photos, ...d.corrections.flatMap((c) => c.photos)];
