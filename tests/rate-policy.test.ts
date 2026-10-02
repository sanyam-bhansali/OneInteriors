import { describe, it, expect } from 'vitest';
import { hasRates, ratesForPricing } from '@/modules/quotation/rate-policy';
import { priceMatches } from '@/modules/quotation/price-all';
import { filedRatesFor } from '@/data/filed-rates';
import { FULL_HOME } from '@/modules/quotation/scope';

const placeholder = filedRatesFor('akara-design-studio');
const live = { kitchen_base: { code: 'kitchen_base', ratePaise: 250_000, fromQuotations: 60, filedOn: '2026-09-30' } };

describe('which rates a studio is quoted on', () => {
  it('before launch: sample rates, with the studio’s own laid over them', () => {
    const r = ratesForPricing(placeholder, live, false);
    expect(r.kitchen_base!.ratePaise).toBe(250_000);
    expect(Object.keys(r).length).toBe(Object.keys(placeholder).length);
  });

  it('once the roster is real: its own rates only, never a borrowed one', () => {
    expect(ratesForPricing(placeholder, live, true)).toEqual(live);
    expect(hasRates(ratesForPricing(placeholder, {}, true))).toBe(false);
  });

  it('never prices a studio with no rates at all', () => {
    const shape = { bhk: 3, carpetAreaSqft: 1250, carpetAreaAssumed: false, bathrooms: 3, scope: FULL_HOME };
    const plan = { fileName: null, kitchenRunMm: 4400, source: 'standard' as const };
    const quotes = priceMatches({
      shape,
      plan,
      studios: [{ slug: 'a', name: 'A' }, { slug: 'b', name: 'B' }],
      existing: {},
      ratesFor: (slug) => (slug === 'a' ? placeholder : {}),
    });
    expect(quotes.map((q) => q.studioSlug)).toEqual(['a']);
  });
});
