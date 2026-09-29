import { describe, it, expect } from 'vitest';
import { EMPTY_BRIEF, type Brief } from '@/modules/brief/types';
import {
  failedFilter,
  rankStudios,
  scoreMatch,
  whyNotTheOthers,
  wideningsFor,
  ENGINE_VERSION,
} from '@/modules/matching/score';
import {
  householdFit,
  priorities,
  similarWork,
  styleFit,
  timelineFit,
  wantedSpecialisms,
} from '@/modules/matching/signals';
import { affinity } from '@/modules/matching/style-affinity';
import { STUDIOS } from '@/data/studios';
import { filedRatesFor } from '@/data/filed-rates';
import { EMPTY_PROFILE } from '@/modules/studio/matching-profile';
import type { Studio } from '@/modules/studio/types';
import { lakhsToPaise } from '@/lib/money';
import { sanitiseBrief } from '@/modules/matching/sanitise';

const TODAY = new Date('2026-09-20T00:00:00Z');
const by = (slug: string) => STUDIOS.find((s) => s.slug === slug)!;
const opts = { today: TODAY, ratesFor: filedRatesFor };

/** A Premium family in Kharadi: vastu, a pooja room, an elderly parent. */
const family: Brief = {
  ...EMPTY_BRIEF,
  contactName: 'Sanyam',
  propertyType: 'BHK_3',
  carpetAreaSqft: 1250,
  locality: 'kharadi',
  possessionStatus: 'EXPECTED',
  possessionOn: '2026-12-01',
  scope: 'FULL_HOME',
  tier: 'PREMIUM',
  budgetMinPaise: 1800 * 1250 * 100,
  budgetMaxPaise: 2500 * 1250 * 100,
  styleLikes: ['warm-modern', 'indian-contemporary'],
  styleDislikes: ['industrial'],
  household: { adults: 2, children: 1, elderly: 1, pets: false, worksFromHome: false },
  needs: ['VASTU', 'POOJA_ROOM'],
  priorityRanking: ['MATERIAL_QUALITY', 'SPEED', 'DESIGN_AMBITION', 'BUDGET'],
  involvement: 'COLLABORATE',
  language: 'MR',
  completedAt: '2026-09-20T00:00:00Z',
};

describe('match@2.0.0 filters', () => {
  it('shows only the band the customer chose', () => {
    const ranked = rankStudios(family, STUDIOS, 99, opts);
    expect(ranked.length).toBeGreaterThan(0);
    for (const r of ranked) expect(STUDIOS.find((s) => s.id === r.studioId)!.band).toBe('PREMIUM');
    expect(failedFilter(family, by('akara-design-studio'), opts)).toBe('OTHER_BAND');
  });

  it('keeps a studio with no confirmed band out, unless the pre-launch gate is open', () => {
    const unplaced = { ...by('vaastu-atelier'), band: null };
    expect(failedFilter(family, unplaced, opts)).toBe('OTHER_BAND');
    expect(failedFilter(family, unplaced, { ...opts, allowUnverified: true })).toBeNull();
  });

  it('filters on the kind of work, and on civil work for a renovation', () => {
    const kitchen = { ...family, scope: 'KITCHEN_WARDROBE' as const };
    expect(failedFilter(kitchen, by('kosha-interiors'), opts)).toBe('SCOPE');
    const reno = { ...family, scope: 'RENOVATION' as const };
    const noCivil = { ...by('kosha-interiors'), matchingProfile: { ...by('kosha-interiors').matchingProfile!, civil: 'NONE' as const } };
    expect(failedFilter(reno, noCivil, opts)).toBe('NO_CIVIL');
  });

  it('lets a city-wide studio through the zone filter', () => {
    // Kosha works in central Pune but takes homes anywhere.
    expect(failedFilter(family, by('kosha-interiors'), opts)).not.toBe('ZONE');
    const notCityWide = { ...by('kosha-interiors'), matchingProfile: { ...by('kosha-interiors').matchingProfile!, cityWide: false } };
    expect(failedFilter(family, notCityWide, opts)).toBe('ZONE');
  });

  it('filters on the studio’s own minimum for this kind of work', () => {
    const small = { ...family, tier: 'LUXURY' as const, budgetMinPaise: lakhsToPaise(10), budgetMaxPaise: lakhsToPaise(20) };
    // Marigold's full-home minimum is ₹40 L.
    expect(failedFilter(small, by('marigold-house'), opts)).toBe('MINIMUM');
  });
});

describe('match@2.0.0 signals', () => {
  it('gives partial credit to neighbouring styles', () => {
    expect(affinity('japandi', 'scandinavian')).toBeGreaterThan(0);
    expect(affinity('japandi', 'luxe-glam')).toBe(0);
    const japandiOnly = { ...family, styleLikes: ['japandi' as const] };
    // Northlight's work is Scandinavian — a neighbour, so it earns something.
    expect(styleFit(japandiOnly, by('northlight-studio'), { today: TODAY })!.value).toBeGreaterThan(20);
  });

  it('turns the household into specialisms and credits two tagged projects fully', () => {
    expect(wantedSpecialisms(family).sort()).toEqual(['CHILDREN', 'ELDERLY', 'POOJA_ROOM', 'VASTU']);
    const vaastu = householdFit(family, by('vaastu-atelier'))!;
    expect(vaastu.value).toBeGreaterThan(60);
    expect(vaastu.evidence).toMatch(/vastu/i);
  });

  it('does not score a studio that has said nothing about specialisms', () => {
    const quiet: Studio = { ...by('vaastu-atelier'), matchingProfile: EMPTY_PROFILE, portfolio: by('vaastu-atelier').portfolio.map((p) => ({ ...p, tags: [] })) };
    expect(householdFit(family, quiet)).toBeNull();
  });

  it('says when a studio can start against possession, and flags a late one', () => {
    const ok = timelineFit(family, by('vaastu-atelier'), { today: TODAY })!;
    expect(ok.late).toBe(false);
    expect(ok.line).toMatch(/Can start in December, when you get the keys/);
    const late = timelineFit(family, by('kosha-interiors'), { today: TODAY })!;
    expect(late.late).toBe(true);
    expect(late.line).toMatch(/^Booked until February/);
  });

  it('treats a stale start date as unknown', () => {
    // Mrida's start date was last confirmed in June.
    expect(timelineFit({ ...family, tier: 'ESSENTIAL' }, by('mrida-interiors'), { today: TODAY })).toBeNull();
  });

  it('weights the priorities 12 / 9 / 6 / 3 in the customer’s order', () => {
    const first = priorities(family, by('grain-and-grey'), { today: TODAY, ratesFor: filedRatesFor })!;
    const reversed = priorities({ ...family, priorityRanking: [...family.priorityRanking].reverse() }, by('grain-and-grey'), { today: TODAY, ratesFor: filedRatesFor })!;
    expect(first.value).not.toBeCloseTo(reversed.value, 0);
  });

  it('finds work like theirs, and names their society', () => {
    const inSociety = { ...family, society: 'sapphire heights' };
    const s = similarWork(inSociety, by('vaastu-atelier'))!;
    expect(s.sameSociety).toBe(1);
    expect(s.evidence).toMatch(/in your society/);
  });
});

describe('match@2.0.0 ranking', () => {
  it('puts the studio that fits this family first', () => {
    const ranked = rankStudios(family, STUDIOS, 6, opts);
    expect(by('vaastu-atelier').id).toBe(ranked[0]!.studioId);
    expect(ranked[0]!.engineVersion).toBe(ENGINE_VERSION);
  });

  it('does not let thin evidence outrank a studio measured on everything', () => {
    const full = scoreMatch(family, by('vaastu-atelier'), opts)!;
    const thin: Studio = { ...by('vaastu-atelier'), id: 'thin', tradeName: 'Thin', matchingProfile: EMPTY_PROFILE, portfolio: by('vaastu-atelier').portfolio.slice(0, 1) };
    const t = scoreMatch(family, thin, { ...opts, allowUnverified: true })!;
    expect(t.measuredWeight!).toBeLessThan(full.measuredWeight!);
    // Even if the thin one's displayed score were higher, the order is not.
    const ordered = rankStudios(family, [thin, by('vaastu-atelier')], 2, { ...opts, allowUnverified: true });
    expect(ordered[0]!.studioId).toBe(by('vaastu-atelier').id);
  });

  it('sorts a late starter down but never hides it', () => {
    const ranked = rankStudios(family, STUDIOS, 99, opts);
    const kosha = ranked.find((r) => r.studioId === by('kosha-interiors').id);
    expect(kosha).toBeDefined();
    expect(kosha!.timeline!.late).toBe(true);
  });

  it('offers named widenings with a count, and marks what they let in', () => {
    const south = { ...family, locality: 'katraj', tier: 'LUXURY' as const, budgetMaxPaise: null, budgetMinPaise: 2500 * 1250 * 100 };
    const offers = wideningsFor(south, STUDIOS, opts, true);
    const any = offers.find((o) => o.kind === 'ANY_ZONE');
    expect(any?.adds).toBeGreaterThan(0);
    const widened = rankStudios(south, STUDIOS, 99, { ...opts, widen: ['ANY_ZONE'] });
    expect(widened.some((r) => r.widened === 'ANY_ZONE')).toBe(true);
    // "One band up" only when the owner has approved it.
    expect(wideningsFor({ ...family }, STUDIOS, opts, false).some((o) => o.kind === 'BAND_UP')).toBe(false);
  });

  it('says why the others are not shown, without naming unverified or paused ones', () => {
    const others = whyNotTheOthers(family, STUDIOS, opts);
    expect(others.find((o) => o.name === 'Akara Design Studio')?.reason).toBe('OTHER_BAND');
    expect(others.every((o) => o.reason !== 'NOT_VERIFIED' && o.reason !== 'PAUSED')).toBe(true);
  });

  it('never prints a number in the reasoning', () => {
    for (const r of rankStudios(family, STUDIOS, 99, opts)) {
      expect(r.reasoning.join(' ')).not.toMatch(/\d+%\s*match/i);
    }
  });
});

describe('the server scores exactly what the card scored', () => {
  it('ranks and scores the sanitised brief identically, across the roster', () => {
    const full: Brief = {
      ...family,
      society: 'Sapphire Heights',
      scope: 'KITCHEN_WARDROBE',
      scopeRooms: [],
      excludedItems: ['master_loft'],
      planReading: { kitchenRunMm: 4200, bathrooms: 3, hasStudy: false, areaSource: 'printed' },
    };
    const card = rankStudios(full, STUDIOS, 99, opts).map((r) => [r.studioId, r.score, r.orderScore]);
    const server = rankStudios(sanitiseBrief(full), STUDIOS, 99, opts).map((r) => [r.studioId, r.score, r.orderScore]);
    expect(server).toEqual(card);
  });

  it('never carries the name or the number', () => {
    const safe = sanitiseBrief({ ...family, contactName: 'Sanyam' });
    expect(safe.contactName).toBeNull();
  });
});
