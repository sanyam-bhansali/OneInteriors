import { describe, it, expect } from 'vitest';
import { bandFromPortfolio, bandFromRates, proposeBand } from '@/modules/studio/band';
import { filedRatesFor, referenceRates } from '@/data/filed-rates';

const home = (lakhs: number, sqft: number, scope = 'FULL_HOME') => ({
  scope,
  valuePaise: lakhs * 100_000 * 100,
  carpetAreaSqft: sqft,
});

describe('bandFromRates', () => {
  it('places a studio from its rates on the reference home, before GST', () => {
    const r = bandFromRates(referenceRates())!;
    expect(r.perSqft).toBeGreaterThan(900);
    expect(r.perSqft).toBeLessThan(1200);
    expect(r.tier).toBe('ESSENTIAL');
  });

  it('gives no reading when the rates cannot price a full home', () => {
    expect(bandFromRates({})).toBeNull();
    const partial = { ...filedRatesFor('akara-design-studio') };
    delete partial.master_wardrobe;
    expect(bandFromRates(partial)).toBeNull();
  });
});

describe('bandFromPortfolio', () => {
  it('uses only finished full homes with a value and an area, as a median', () => {
    const r = bandFromPortfolio([home(25, 1250), home(20, 1000), home(5, 1250, 'KITCHEN_WARDROBE'), { scope: 'FULL_HOME', valuePaise: null }])!;
    expect(r.homes).toBe(2);
    expect(r.perSqft).toBe(2000);
    expect(r.tier).toBe('PREMIUM');
  });
  it('needs two homes', () => {
    expect(bandFromPortfolio([home(25, 1250)])).toBeNull();
  });
});

describe('proposeBand', () => {
  it('prefers the rates and flags a disagreement for ops', () => {
    const p = proposeBand(referenceRates(), [home(25, 1250), home(24, 1200)]);
    expect(p.proposed).toBe('ESSENTIAL');
    expect(p.disagree).toBe(true);
    expect(p.note).toMatch(/Worth a call/);
  });
  it('falls back to the portfolio, and says when there is nothing', () => {
    expect(proposeBand({}, [home(35, 1250), home(34, 1200)]).proposed).toBe('LUXURY');
    expect(proposeBand({}, []).proposed).toBeNull();
  });
});
