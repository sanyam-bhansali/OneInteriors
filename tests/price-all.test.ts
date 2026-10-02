import { describe, it, expect } from 'vitest';
import { kitchenFor, priceMatches, quoteKey, type HomeShape } from '@/modules/quotation/price-all';
import { FULL_HOME } from '@/modules/quotation/scope';
import { filedRatesFor } from '@/data/filed-rates';

/**
 * Every matched studio is priced the moment the matches appear — no gate, no
 * ten seconds each (docs/CUSTOMER-JOURNEY-PLAN.md §7.3).
 */

const SHAPE: HomeShape = {
  bhk: 3,
  carpetAreaSqft: 1150,
  carpetAreaAssumed: false,
  bathrooms: 3,
  scope: FULL_HOME,
};
const STUDIOS = [
  { slug: 'akara', name: 'Akara' },
  { slug: 'sixth-wall', name: 'Sixth Wall' },
  { slug: 'mrida', name: 'Mrida' },
];
const standard = kitchenFor(SHAPE, null, null);

describe('priceMatches', () => {
  it('prices every studio on the same lines and the same kitchen', () => {
    const quotes = priceMatches({ shape: SHAPE, plan: standard, studios: STUDIOS, existing: {}, ratesFor: filedRatesFor });
    expect(quotes).toHaveLength(3);
    const codes = quotes.map((q) => q.quote.lines.map((l) => l.code).join(','));
    expect(new Set(codes).size).toBe(1);
  });

  it('leaves alone a quote priced for exactly this brief', () => {
    const first = priceMatches({ shape: SHAPE, plan: standard, studios: STUDIOS, existing: {}, ratesFor: filedRatesFor });
    const existing = Object.fromEntries(first.map((q) => [q.studioSlug, q]));
    expect(priceMatches({ shape: SHAPE, plan: standard, studios: STUDIOS, existing, ratesFor: filedRatesFor })).toHaveLength(0);
  });

  it('rebuilds every quote when the brief changes something a quote depends on', () => {
    const first = priceMatches({ shape: SHAPE, plan: standard, studios: STUDIOS, existing: {}, ratesFor: filedRatesFor });
    const existing = Object.fromEntries(first.map((q) => [q.studioSlug, q]));
    const kitchenOnly = { ...SHAPE, scope: { ...FULL_HOME, scope: 'KITCHEN_WARDROBE' as const } };
    expect(priceMatches({ shape: kitchenOnly, plan: standard, studios: STUDIOS, existing, ratesFor: filedRatesFor })).toHaveLength(3);
    const unticked = { ...SHAPE, scope: { ...FULL_HOME, excludedItems: ['painting'] } };
    expect(quoteKey(unticked, standard)).not.toBe(quoteKey(SHAPE, standard));
  });
});

describe('the curated discount', () => {
  it('is its own line before GST, and re-prices the studio when it changes', () => {
    const [plain] = priceMatches({ shape: SHAPE, plan: standard, studios: STUDIOS.slice(0, 1), existing: {}, ratesFor: filedRatesFor });
    const withDiscount = [{ ...STUDIOS[0]!, curatedDiscountPct: 5 }];
    const [discounted] = priceMatches({
      shape: SHAPE,
      plan: standard,
      studios: withDiscount,
      existing: { [plain!.studioSlug]: plain! },
      ratesFor: filedRatesFor,
    });
    expect(discounted).toBeDefined();
    const q = discounted!.quote;
    const beforeDiscount = q.modularPaise + q.nonModularPaise + q.professionalFeePaise - q.modularDiscountPaise;
    expect(q.curatedDiscountPaise).toBe(Math.round(beforeDiscount * 0.05));
    expect(q.totalPaise).toBeLessThan(plain!.quote.totalPaise);
    expect(q.gstPaise).toBe(Math.round(((beforeDiscount - q.curatedDiscountPaise!) * 1800) / 10_000));
    expect(plain!.quote.curatedDiscountPaise).toBe(0);
  });
});

describe('kitchenFor', () => {
  it('prefers the confirmed plan, then a measured run, then the standard one', () => {
    const plan = { fileName: 'b.pdf', kitchenRunMm: 4200, source: 'floor_plan' as const };
    const measured = { fileName: null, kitchenRunMm: 3800, source: 'customer' as const };
    expect(kitchenFor(SHAPE, plan, measured)).toBe(plan);
    expect(kitchenFor(SHAPE, null, measured)).toBe(measured);
    expect(kitchenFor(SHAPE, null, null)).toEqual({ fileName: null, kitchenRunMm: 4400, source: 'standard' });
  });

  it('never trusts an unread plan left in the tab from before', () => {
    const unread = { fileName: 'old.pdf', kitchenRunMm: null, source: 'floor_plan' as const };
    expect(kitchenFor(SHAPE, null, unread).source).toBe('standard');
  });
});
