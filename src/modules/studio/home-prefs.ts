/**
 * A team member's own home, set from the profile menu (owner, 12 Oct 2026):
 * which of their app tiles show and in what order, whether the "Right now"
 * strip shows, and where they land after signing in. Pure; the prefs live in
 * `StudioMember.homePrefs` and tests/studio-home-prefs.test.ts pins this.
 *
 * ## Personal, never a permission
 *
 * Every function here starts from the apps the member already has
 * (`appsFor`, which asked the door). A saved key that is not one of them —
 * an app their role lost, a hand-edited value — is dropped, so prefs can
 * hide or reorder a tile but never add one, and never point the landing at
 * a screen the member may not open.
 */

import { STUDIO_HOME, type AppKey, type StudioApp } from './apps';

export interface HomePrefs {
  /** Their tile order. Apps not listed follow, in the role's own order. */
  order: AppKey[];
  /** Tiles they hid from the home (still in the apps menu and search). */
  hidden: AppKey[];
  /** Whether the "Right now" strip shows under the greeting. */
  strip: boolean;
  /** Where sign-in sends them: the home, or one of their apps. */
  landing: 'home' | AppKey;
}

export const DEFAULT_HOME_PREFS: HomePrefs = { order: [], hidden: [], strip: true, landing: 'home' };

const KEYS = new Set<string>(['today', 'clients', 'quotes', 'projects', 'site', 'money', 'vendors', 'calendar', 'intros', 'rates', 'team']);

function keyList(v: unknown): AppKey[] {
  if (!Array.isArray(v)) return [];
  const out: AppKey[] = [];
  for (const k of v) if (typeof k === 'string' && KEYS.has(k) && !out.includes(k as AppKey)) out.push(k as AppKey);
  return out;
}

/** Read stored JSON (or anything) into prefs; whatever is unreadable falls back to the default. */
export function parseHomePrefs(raw: unknown): HomePrefs {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_HOME_PREFS };
  const r = raw as Record<string, unknown>;
  const landing = typeof r.landing === 'string' && (r.landing === 'home' || KEYS.has(r.landing)) ? (r.landing as HomePrefs['landing']) : 'home';
  return { order: keyList(r.order), hidden: keyList(r.hidden), strip: r.strip !== false, landing };
}

/**
 * Prefs fitted to the apps this member has: unknown keys dropped, and at
 * least one tile left showing (hiding everything would leave an empty home).
 */
export function fitHomePrefs(prefs: HomePrefs, apps: readonly Pick<StudioApp, 'key'>[]): HomePrefs {
  const mine = new Set<AppKey>(apps.map((a) => a.key));
  const order = prefs.order.filter((k) => mine.has(k));
  let hidden = prefs.hidden.filter((k) => mine.has(k));
  if (apps.length > 0 && hidden.length >= apps.length) hidden = [];
  const landing = prefs.landing === 'home' || mine.has(prefs.landing) ? prefs.landing : 'home';
  return { order, hidden, strip: prefs.strip, landing };
}

/** All of the member's apps in their chosen order (saved order first, then the rest as the role lists them). */
export function orderedApps<T extends Pick<StudioApp, 'key'>>(apps: readonly T[], prefs: HomePrefs): T[] {
  const byKey = new Map(apps.map((a) => [a.key, a]));
  const out: T[] = [];
  for (const k of prefs.order) {
    const a = byKey.get(k);
    if (a && !out.includes(a)) out.push(a);
  }
  for (const a of apps) if (!out.includes(a)) out.push(a);
  return out;
}

/** The tiles the home shows: their order, without the ones they hid. */
export function homeTiles<T extends Pick<StudioApp, 'key'>>(apps: readonly T[], prefs: HomePrefs): T[] {
  const fitted = fitHomePrefs(prefs, apps);
  return orderedApps(apps, fitted).filter((a) => !fitted.hidden.includes(a.key));
}

/** Where they land after signing in: their chosen app if they still have it, else the home. */
export function landingHref(apps: readonly Pick<StudioApp, 'key' | 'href'>[], prefs: HomePrefs): string {
  if (prefs.landing === 'home') return STUDIO_HOME;
  return apps.find((a) => a.key === prefs.landing)?.href ?? STUDIO_HOME;
}
