import { describe, expect, it } from 'vitest';
import { appsFor, STUDIO_HOME } from '@/modules/studio/apps';
import { DEFAULT_HOME_PREFS, fitHomePrefs, homeTiles, landingHref, orderedApps, parseHomePrefs } from '@/modules/studio/home-prefs';

const owner = appsFor({ role: 'OWNER', status: 'ACTIVE' });
const sales = appsFor({ role: 'SALES', status: 'ACTIVE' });
const keys = (xs: { key: string }[]) => xs.map((x) => x.key);

describe('a member’s own home (profile menu)', () => {
  it('reads nothing as the default, and junk as the default', () => {
    expect(parseHomePrefs(null)).toEqual(DEFAULT_HOME_PREFS);
    expect(parseHomePrefs('x')).toEqual(DEFAULT_HOME_PREFS);
    expect(parseHomePrefs({ order: [1, 'nope', 'quotes', 'quotes'], hidden: 'x', strip: 0, landing: 'evil' })).toEqual({
      order: ['quotes'],
      hidden: [],
      strip: true,
      landing: 'home',
    });
  });

  it('keeps the role’s order when nothing is chosen', () => {
    expect(keys(homeTiles(owner, DEFAULT_HOME_PREFS))).toEqual(keys(owner));
  });

  it('puts chosen apps first and the rest after, in the role’s order', () => {
    const prefs = { ...DEFAULT_HOME_PREFS, order: ['calendar', 'clients'] as const };
    expect(keys(orderedApps(sales, { ...prefs, order: [...prefs.order] }))).toEqual(['calendar', 'clients', 'quotes']);
  });

  it('hides tiles, but never all of them', () => {
    expect(keys(homeTiles(sales, { ...DEFAULT_HOME_PREFS, hidden: ['quotes'] }))).toEqual(['clients', 'calendar']);
    expect(keys(homeTiles(sales, { ...DEFAULT_HOME_PREFS, hidden: ['clients', 'quotes', 'calendar'] }))).toEqual(keys(sales));
  });

  it('can never add an app the role does not have', () => {
    const prefs = parseHomePrefs({ order: ['vendors', 'team', 'clients'], landing: 'vendors' });
    expect(keys(homeTiles(sales, prefs))).toEqual(['clients', 'quotes', 'calendar']);
    expect(fitHomePrefs(prefs, sales).landing).toBe('home');
    expect(landingHref(sales, prefs)).toBe(STUDIO_HOME);
  });

  it('lands on the chosen app when the member has it', () => {
    expect(landingHref(sales, { ...DEFAULT_HOME_PREFS, landing: 'clients' })).toBe('/studio/clients');
    expect(landingHref(sales, DEFAULT_HOME_PREFS)).toBe(STUDIO_HOME);
  });
});
