import { describe, it, expect } from 'vitest';
import { buildFirstQuote, type QuoteInput } from '@/modules/quotation/first-quote';
import {
  FULL_HOME,
  checklistFor,
  roomsFor,
  scopeItems,
  scopePhrase,
  scopeReady,
  type ScopeSelection,
} from '@/modules/quotation/scope';
import { scopeBandRange, scopeShare } from '@/modules/quotation/scope-band';
import { referenceRates } from '@/data/filed-rates';
import { tierRangeFor } from '@/modules/quotation/tiers';

/**
 * The quote follows the scope (29 Sep 2026). Kitchen & wardrobes on a 3 BHK
 * was quoted ₹15.5 L with beds, ceiling, painting and a safety door in it.
 */

const HOME = { bhk: 3, carpetAreaSqft: 1150, bathrooms: 3 };
const INPUT: QuoteInput = { ...HOME, kitchenRunMm: null, runSource: 'standard' };
const sel = (patch: Partial<ScopeSelection>): ScopeSelection => ({ ...FULL_HOME, ...patch });
const codes = (s: ScopeSelection) => scopeItems(3, s).map((i) => i.code);

describe('what each scope quotes', () => {
  it('prices the full home exactly as before scope existed', () => {
    const before = buildFirstQuote(INPUT, referenceRates());
    const after = buildFirstQuote({ ...INPUT, scope: FULL_HOME }, referenceRates());
    expect(after.totalPaise).toBe(before.totalPaise);
    expect(codes(FULL_HOME).some((c) => c.startsWith('civil_'))).toBe(false);
  });

  it('prices only the kitchen and the bedrooms’ wardrobes and lofts for kitchen & wardrobes', () => {
    const kw = codes(sel({ scope: 'KITCHEN_WARDROBE' }));
    expect(kw).toContain('kitchen_base');
    expect(kw).toContain('master_wardrobe');
    expect(kw).toContain('third_loft');
    for (const out of ['master_bed', 'false_ceiling', 'painting', 'tv_unit', 'safety_door', 'master_dressing']) {
      expect(kw).not.toContain(out);
    }
  });

  it('prices only the chosen rooms for a single-room job', () => {
    const one = codes(sel({ scope: 'SINGLE_ROOM', scopeRooms: ['MASTER_BEDROOM'] }));
    expect(one.every((c) => c.startsWith('master_'))).toBe(true);
    expect(scopeReady(3, sel({ scope: 'SINGLE_ROOM', scopeRooms: [] }))).toBe(false);
  });

  it('quotes civil work for a renovation, plus any rooms chosen', () => {
    const civil = codes(sel({ scope: 'RENOVATION' }));
    expect(civil.every((c) => c.startsWith('civil_'))).toBe(true);
    const withKitchen = codes(sel({ scope: 'RENOVATION', scopeRooms: ['KITCHEN'] }));
    expect(withKitchen).toContain('kitchen_base');
    expect(withKitchen).toContain('civil_flooring');
  });

  it('leaves out what they unticked, for every studio alike', () => {
    const off = sel({ excludedItems: ['false_ceiling', 'painting'] });
    expect(codes(off)).not.toContain('false_ceiling');
    const q = buildFirstQuote({ ...INPUT, scope: off }, referenceRates());
    expect(q.assumptions.join(' ')).toContain('Left out at your request: False ceiling, Painting.');
  });

  it('names civil lines no studio has filed rather than guessing them', () => {
    const q = buildFirstQuote({ ...INPUT, scope: sel({ scope: 'RENOVATION' }) }, referenceRates());
    expect(q.notPriced).toEqual(
      expect.arrayContaining(['civil_flooring', 'civil_bathroom', 'civil_kitchen', 'civil_rewiring']),
    );
    expect(q.lines).toHaveLength(0);
  });

  it('says the scope on the quote', () => {
    const q = buildFirstQuote({ ...INPUT, scope: sel({ scope: 'KITCHEN_WARDROBE' }) }, referenceRates());
    expect(q.assumptions[0]).toMatch(/^Scope: Kitchen & wardrobes/);
  });
});

describe('the checklist', () => {
  it('groups the scope by room, and a 2 BHK has no third bedroom', () => {
    const groups = checklistFor(2, FULL_HOME).map((g) => g.room);
    expect(groups).toContain('KITCHEN');
    expect(groups).not.toContain('THIRD_BEDROOM');
    expect(roomsFor(2)).not.toContain('THIRD_BEDROOM');
    expect(roomsFor(3)).toContain('THIRD_BEDROOM');
  });

  it('describes the scope in words', () => {
    expect(scopePhrase(sel({ scope: 'SINGLE_ROOM', scopeRooms: ['MASTER_BEDROOM', 'KITCHEN'] }))).toBe(
      'Master bedroom and kitchen',
    );
    expect(scopePhrase(sel({ scope: 'RENOVATION', scopeRooms: ['BATHROOMS'] }))).toBe(
      'Renovation — civil work and bathrooms',
    );
  });
});

/**
 * The level screen showed a kitchen customer whole-home prices. The band is
 * now scaled by the share of a full home their scope is, measured on the
 * reference rates.
 */
describe('band prices for a scope', () => {
  it('is the whole band for a full home', () => {
    const range = scopeBandRange('PREMIUM', HOME, FULL_HOME)!;
    expect(range.share).toBe(1);
    expect(range.lowPaise).toBe(tierRangeFor('PREMIUM', 1150).lowPaise);
  });

  it('is a fraction of it for kitchen & wardrobes', () => {
    const share = scopeShare(HOME, sel({ scope: 'KITCHEN_WARDROBE' }))!;
    expect(share).toBeGreaterThan(0.2);
    expect(share).toBeLessThan(0.6);
    const range = scopeBandRange('PREMIUM', HOME, sel({ scope: 'KITCHEN_WARDROBE' }))!;
    expect(range.lowPaise).toBeLessThan(tierRangeFor('PREMIUM', 1150).lowPaise);
  });

  it('keeps the open top band open', () => {
    expect(scopeBandRange('LUXURY', HOME, sel({ scope: 'KITCHEN_WARDROBE' }))!.highPaise).toBeNull();
  });

  // Civil work is not in the reference rates, so a civil-only renovation has
  // nothing to measure. No range is better than an invented one.
  it('shows no range for work nothing prices yet', () => {
    expect(scopeBandRange('PREMIUM', HOME, sel({ scope: 'RENOVATION' }))).toBeNull();
  });
});
