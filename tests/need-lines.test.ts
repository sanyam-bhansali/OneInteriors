import { describe, it, expect } from 'vitest';
import { buildFirstQuote, homeShapeFor, type QuoteInput } from '@/modules/quotation/first-quote';
import { CATALOGUE, type StudioRates } from '@/modules/quotation/catalogue';
import { needAddsOf, needLines, scopeCandidates, selectionOf, type ScopeSelection } from '@/modules/quotation/scope';
import { quoteKey } from '@/modules/quotation/price-all';

/** Every standard line at ₹1,000 — and nothing filed for the need lines themselves. */
const RATES: StudioRates = Object.fromEntries(
  CATALOGUE.map((i) => [i.code, { code: i.code, ratePaise: 100_000, fromQuotations: 60, filedOn: '2026-09-01' }]),
);

const input = (scope: ScopeSelection, bhk = 2): QuoteInput => ({
  bhk,
  carpetAreaSqft: 900,
  bathrooms: 2,
  kitchenRunMm: 3400,
  runSource: 'floor_plan',
  scope,
});

const all = { needs: ['POOJA_ROOM', 'EXTRA_STORAGE', 'VASTU'], household: { worksFromHome: true } };

describe('which answers add a line', () => {
  it('reads work from home, a pooja room and storage — not vastu or the rest', () => {
    expect(needAddsOf(all)).toEqual(['WORKS_FROM_HOME', 'POOJA_ROOM', 'EXTRA_STORAGE']);
    expect(needAddsOf({ needs: ['VASTU', 'SMART_HOME'], household: null })).toEqual([]);
  });
});

describe('the lines they add', () => {
  it('adds extra lofts to a full home, and nothing the scope already has', () => {
    const sel = selectionOf({ scope: 'FULL_HOME', scopeRooms: [], excludedItems: [], ...all });
    // A full 2 BHK already has the mandir and the workstation.
    expect(needLines(2, sel).map((n) => n.item.code)).toEqual(['extra_loft']);
  });

  it('adds the workstation and the mandir to a kitchen-and-wardrobes job', () => {
    const sel = selectionOf({ scope: 'KITCHEN_WARDROBE', scopeRooms: [], excludedItems: [], ...all });
    expect(needLines(2, sel).map((n) => n.item.code)).toEqual(['second_workstation', 'mandir', 'extra_loft']);
  });

  it('gives a 1 BHK a study unit, since it has no second bedroom', () => {
    const sel = selectionOf({ scope: 'KITCHEN_WARDROBE', scopeRooms: [], excludedItems: [], ...all });
    expect(needLines(1, sel).map((n) => n.item.code)).toContain('study_unit');
  });

  it('keeps to the rooms of a job the customer narrowed themselves', () => {
    const kitchenOnly = selectionOf({ scope: 'SINGLE_ROOM', scopeRooms: ['KITCHEN'], excludedItems: [], ...all });
    expect(needLines(2, kitchenOnly)).toEqual([]);
    // The living room already has a mandir; a 1 BHK's study unit goes in it.
    const withLiving = selectionOf({ scope: 'SINGLE_ROOM', scopeRooms: ['LIVING_DINING'], excludedItems: [], ...all });
    expect(needLines(2, withLiving)).toEqual([]);
    expect(needLines(1, withLiving).map((n) => n.item.code)).toEqual(['study_unit']);
  });

  it('can be unticked like any other line', () => {
    const sel = selectionOf({ scope: 'FULL_HOME', scopeRooms: [], excludedItems: [], ...all });
    expect(scopeCandidates(2, sel).some((i) => i.code === 'extra_loft')).toBe(true);
    const q = buildFirstQuote(input({ ...sel, excludedItems: ['extra_loft'] }), RATES);
    expect(q.lines.some((l) => l.code === 'extra_loft')).toBe(false);
  });
});

describe('on the quote', () => {
  it('prices an added line at the standard line’s rate, and says why it is there', () => {
    const sel = selectionOf({ scope: 'FULL_HOME', scopeRooms: [], excludedItems: [], ...all });
    const q = buildFirstQuote(input(sel), RATES);
    const loft = q.lines.find((l) => l.code === 'extra_loft')!;
    expect(loft.ratePaise).toBe(100_000);
    expect(loft.quantity).toBeCloseTo(19.4, 1); // 3000 × 600 mm
    expect(loft.addedFor).toBe('Added because you need a lot of storage');
    expect(q.notPriced).not.toContain('extra_loft');
  });

  it('costs more than the same home without the answers', () => {
    const plain = buildFirstQuote(input(selectionOf({ scope: 'KITCHEN_WARDROBE', scopeRooms: [], excludedItems: [] })), RATES);
    const lived = buildFirstQuote(
      input(selectionOf({ scope: 'KITCHEN_WARDROBE', scopeRooms: [], excludedItems: [], ...all })),
      RATES,
    );
    expect(lived.totalPaise).toBeGreaterThan(plain.totalPaise);
    expect(plain.lines.some((l) => l.addedFor)).toBe(false);
  });

  it('reprices every studio when the answers change', () => {
    const brief = { propertyType: 'BHK_2' as const, carpetAreaSqft: 900, scope: 'FULL_HOME' as const };
    const plan = { fileName: null, kitchenRunMm: 3400, source: 'standard' as const };
    const before = quoteKey(homeShapeFor(brief), plan);
    const after = quoteKey(homeShapeFor({ ...brief, needs: ['EXTRA_STORAGE'] }), plan);
    expect(after).not.toBe(before);
  });
});
