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

import type { Lang } from '@/modules/i18n/site';
import { say } from '@/modules/i18n/site/matching';

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
export function sinceWords(at: Date, now: Date, lang: Lang = 'en'): string {
  const days = Math.floor((now.getTime() - at.getTime()) / 86_400_000);
  // Western digits in every language, as the rest of the site writes them.
  const locale = lang === 'en' ? 'en-IN' : `${lang}-IN-u-nu-latn`;
  if (days < 1) return say(lang, 'since.today');
  if (days === 1) return say(lang, 'since.yesterday');
  if (days < 7) return say(lang, 'since.day', { day: at.toLocaleDateString(locale, { weekday: 'long' }) });
  return say(lang, 'since.day', { day: at.toLocaleDateString(locale, { day: 'numeric', month: 'long' }) });
}

/** The line to show, or null when nothing is new (or this is the first visit). */
export function welcomeBack(seen: Seen | null, currentIds: string[], now = new Date(), lang: Lang = 'en'): string | null {
  if (!seen) return null;
  const before = new Set(seen.ids);
  const fresh = currentIds.filter((id) => !before.has(id)).length;
  if (fresh === 0) return null;
  const since = sinceWords(new Date(seen.at), now, lang);
  return fresh === 1 ? say(lang, 'welcome.one', { since }) : say(lang, 'welcome.many', { n: fresh, since });
}
