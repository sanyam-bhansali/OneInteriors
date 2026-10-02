/**
 * "Welcome back — one new studio fits your brief since Tuesday" (build queue
 * item 16).
 *
 * The browser keeps which studios it last showed and when (localStorage, per
 * device — nothing sent anywhere). On the next visit, any studio in the
 * matches that was not there then is news worth a line at the top.
 *
 * Pure, and tested; the page does the storage.
 */

export const SEEN_KEY = 'oi.seen.v1';

export interface Seen {
  ids: string[];
  /** ISO time of the visit that saw them. */
  at: string;
}

export function readSeen(raw: string | null): Seen | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<Seen>;
    return Array.isArray(v.ids) && typeof v.at === 'string' && !Number.isNaN(Date.parse(v.at))
      ? { ids: v.ids.filter((x): x is string => typeof x === 'string'), at: v.at }
      : null;
  } catch {
    return null;
  }
}

/** "since Tuesday", "since yesterday", "since 12 September". */
export function sinceWords(at: Date, now: Date): string {
  const days = Math.floor((now.getTime() - at.getTime()) / 86_400_000);
  if (days < 1) return 'since earlier today';
  if (days === 1) return 'since yesterday';
  if (days < 7) return `since ${at.toLocaleDateString('en-IN', { weekday: 'long' })}`;
  return `since ${at.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}`;
}

/** The line to show, or null when nothing is new (or this is the first visit). */
export function welcomeBack(seen: Seen | null, currentIds: string[], now = new Date()): string | null {
  if (!seen) return null;
  const before = new Set(seen.ids);
  const fresh = currentIds.filter((id) => !before.has(id)).length;
  if (fresh === 0) return null;
  const since = sinceWords(new Date(seen.at), now);
  return `Welcome back — ${fresh === 1 ? 'one new studio fits' : `${fresh} new studios fit`} your brief ${since}.`;
}
