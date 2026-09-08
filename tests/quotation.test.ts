import { describe, it, expect } from 'vitest';
import {
  estimate,
  categoriesForScope,
  tooThinToQuote,
  TYPICAL_CARPET_SQFT,
  KITCHEN_SHUTTER_SQFT,
} from '@/modules/quotation/estimate';
import {
  priceEstimate,
  compareQuotes,
  bandsOverlap,
  GST_BPS,
  type RateCard,
} from '@/modules/quotation/price';
import { missingCoreRates, rateCardIsUsable, CORE_CATEGORIES } from '@/modules/quotation/categories';
import { rupeesToPaise } from '@/lib/money';

/** A complete, realistic Pune rate card. Every number is the studio's own. */
const RATES: RateCard = {
  modular_kitchen: rupeesToPaise(1800),
  wardrobes: rupeesToPaise(1600),
  carpentry: rupeesToPaise(1400),
  false_ceiling: rupeesToPaise(95),
  painting: rupeesToPaise(28),
  electrical: rupeesToPaise(120),
  plumbing: rupeesToPaise(35000),
  flooring: rupeesToPaise(180),
  design_fee: 500, // 5.00% in basis points
};

describe('estimate — quantities', () => {
  it('uses the carpet area given rather than a typical one', () => {
    const e = estimate({ propertyType: 'BHK_3', carpetAreaSqft: 1400, scope: 'FULL_HOME' });
    expect(e.carpetAreaSqft).toBe(1400);
    expect(e.areaAssumed).toBe(false);
  });

  it('falls back to a typical area and says so', () => {
    const e = estimate({ propertyType: 'BHK_3', carpetAreaSqft: null, scope: 'FULL_HOME' });
    expect(e.carpetAreaSqft).toBe(TYPICAL_CARPET_SQFT.BHK_3);
    expect(e.areaAssumed).toBe(true);
    expect(e.assumptions.join(' ')).toContain('assumed a carpet area');
  });

  /**
   * Every quantity must arrive with the sentence that explains it. An
   * unexplained number in a quote is a promise we cannot keep.
   */
  it('attaches an assumption to every single quantity', () => {
    const e = estimate({ propertyType: 'BHK_3', carpetAreaSqft: 1150, scope: 'FULL_HOME' });
    expect(e.quantities.length).toBeGreaterThan(0);
    for (const q of e.quantities) {
      expect(q.assumption.length).toBeGreaterThan(20);
    }
  });

  it('prices kitchen as shutter area, not floor area', () => {
    const e = estimate({ propertyType: 'BHK_2', carpetAreaSqft: 850, scope: 'FULL_HOME' });
    const kitchen = e.quantities.find((q) => q.category === 'modular_kitchen');
    expect(kitchen?.quantity).toBe(KITCHEN_SHUTTER_SQFT.BHK_2);
    // The mistake this guards against: using the 850 sqft carpet area.
    expect(kitchen?.quantity).toBeLessThan(300);
    expect(kitchen?.assumption).toContain('shutter area');
  });

  it('scales wardrobes with bedrooms', () => {
    const two = estimate({ propertyType: 'BHK_2', carpetAreaSqft: 850, scope: 'FULL_HOME' });
    const four = estimate({ propertyType: 'BHK_4_PLUS', carpetAreaSqft: 850, scope: 'FULL_HOME' });
    const w = (e: typeof two) => e.quantities.find((q) => q.category === 'wardrobes')!.quantity;
    expect(w(four)).toBeGreaterThan(w(two));
  });

  it('prices a single room as one bedroom, not the whole home', () => {
    const room = estimate({ propertyType: 'BHK_3', carpetAreaSqft: 1150, scope: 'SINGLE_ROOM' });
    const home = estimate({ propertyType: 'BHK_3', carpetAreaSqft: 1150, scope: 'FULL_HOME' });
    const w = (e: typeof room) => e.quantities.find((q) => q.category === 'wardrobes')!.quantity;
    expect(w(room)).toBeLessThan(w(home));
  });

  it('rounds quantities to something a person can read', () => {
    const e = estimate({ propertyType: 'BHK_3', carpetAreaSqft: 1137, scope: 'FULL_HOME' });
    for (const q of e.quantities) expect(Number.isInteger(q.quantity)).toBe(true);
  });

  it('only includes categories the scope actually touches', () => {
    const e = estimate({ propertyType: 'BHK_2', carpetAreaSqft: 850, scope: 'KITCHEN_WARDROBE' });
    const cats = e.quantities.map((q) => q.category);
    expect(cats).toContain('modular_kitchen');
    expect(cats).toContain('wardrobes');
    expect(cats).not.toContain('painting');
    expect(cats).not.toContain('false_ceiling');
  });

  it('adds civil and flooring for a renovation', () => {
    const cats = categoriesForScope('RENOVATION');
    expect(cats).toContain('civil');
    expect(cats).toContain('flooring');
    expect(categoriesForScope('FULL_HOME')).not.toContain('civil');
  });
});

/**
 * The band is the honesty mechanism. A thinner brief has to produce a visibly
 * wider range, or we are presenting a guess with the same confidence as a
 * measurement.
 */
describe('estimate — variance widens as the brief thins', () => {
  it('is tightest with a complete brief', () => {
    const e = estimate({ propertyType: 'BHK_3', carpetAreaSqft: 1150, scope: 'FULL_HOME' });
    expect(e.variancePct).toBeCloseTo(0.15);
  });

  it('widens when the carpet area was guessed', () => {
    const full = estimate({ propertyType: 'BHK_3', carpetAreaSqft: 1150, scope: 'FULL_HOME' });
    const noArea = estimate({ propertyType: 'BHK_3', carpetAreaSqft: null, scope: 'FULL_HOME' });
    expect(noArea.variancePct).toBeGreaterThan(full.variancePct);
  });

  it('widens most when the property type is unknown', () => {
    const noType = estimate({ propertyType: null, carpetAreaSqft: 1150, scope: 'FULL_HOME' });
    const noArea = estimate({ propertyType: 'BHK_3', carpetAreaSqft: null, scope: 'FULL_HOME' });
    expect(noType.variancePct).toBeGreaterThan(noArea.variancePct);
  });

  it('caps the band rather than showing a meaningless range', () => {
    const e = estimate({ propertyType: null, carpetAreaSqft: null, scope: null });
    expect(e.variancePct).toBeLessThanOrEqual(0.45);
  });

  it('declines to quote at all when the brief is too thin', () => {
    expect(tooThinToQuote({ propertyType: null, carpetAreaSqft: null, scope: 'FULL_HOME' })).toBe(true);
    expect(tooThinToQuote({ propertyType: 'BHK_2', carpetAreaSqft: null, scope: null })).toBe(false);
  });
});

describe('rate card completeness', () => {
  it('accepts a card with every core rate', () => {
    expect(rateCardIsUsable(RATES)).toBe(true);
    expect(missingCoreRates(RATES)).toEqual([]);
  });

  it('names what is missing', () => {
    const partial = { ...RATES, painting: undefined };
    expect(missingCoreRates(partial)).toContain('painting');
  });

  it('treats a zero rate as missing, not as free work', () => {
    expect(missingCoreRates({ ...RATES, wardrobes: 0 })).toContain('wardrobes');
  });

  it('does not require the optional categories', () => {
    const coreOnly: RateCard = {};
    for (const c of CORE_CATEGORIES) coreOnly[c] = rupeesToPaise(100);
    expect(rateCardIsUsable(coreOnly)).toBe(true);
  });
});

describe('priceEstimate', () => {
  const e = estimate({ propertyType: 'BHK_3', carpetAreaSqft: 1150, scope: 'FULL_HOME' });

  it('prices every line from the studio’s own rate', () => {
    const result = priceEstimate(e, RATES);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    for (const line of result.quote.lines) {
      expect(line.ratePaise).toBe(RATES[line.category]);
      expect(line.amountPaise).toBe(Math.round(line.ratePaise * line.quantity));
    }
  });

  /**
   * The governance rule, asserted. There is no platform rate and no fallback:
   * a studio without a rate is not quoted, full stop.
   */
  it('refuses to quote rather than inventing a missing rate', () => {
    const result = priceEstimate(e, { ...RATES, modular_kitchen: undefined });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('incomplete_rate_card');
    expect(result.missing).toContain('modular_kitchen');
  });

  it('adds GST on top of work plus design fee', () => {
    const result = priceEstimate(e, RATES);
    if (!result.ok) return;
    const { subtotalPaise, designFeePaise, gstPaise, totalPaise } = result.quote;
    expect(gstPaise).toBe(Math.round(((subtotalPaise + designFeePaise) * GST_BPS) / 10_000));
    expect(totalPaise).toBe(subtotalPaise + designFeePaise + gstPaise);
  });

  it('omits the design fee when the studio charges none', () => {
    const result = priceEstimate(e, { ...RATES, design_fee: 0 });
    if (!result.ok) return;
    expect(result.quote.designFeePaise).toBe(0);
  });

  it('produces a band around the total, never a bare midpoint', () => {
    const result = priceEstimate(e, RATES);
    if (!result.ok) return;
    const { lowPaise, highPaise, totalPaise, variancePct } = result.quote;
    expect(lowPaise).toBeLessThan(totalPaise);
    expect(highPaise).toBeGreaterThan(totalPaise);
    expect(lowPaise).toBe(Math.round(totalPaise * (1 - variancePct)));
  });

  /**
   * A total that quietly excludes plumbing is how a customer ends up feeling
   * misled by arithmetic that was perfectly correct.
   */
  it('names anything left out instead of silently dropping it', () => {
    const reno = estimate({ propertyType: 'BHK_2', carpetAreaSqft: 850, scope: 'RENOVATION' });
    const result = priceEstimate(reno, { ...RATES, civil: undefined });
    if (!result.ok) return;
    expect(result.quote.notPriced).toContain('civil');
    expect(result.quote.assumptions.join(' ')).toContain('Not included');
  });

  it('carries the estimate’s assumptions through to the quote', () => {
    const thin = estimate({ propertyType: 'BHK_3', carpetAreaSqft: null, scope: 'FULL_HOME' });
    const result = priceEstimate(thin, RATES);
    if (!result.ok) return;
    expect(result.quote.assumptions.join(' ')).toContain('assumed a carpet area');
  });

  it('always says the GST treatment is not yet confirmed', () => {
    const result = priceEstimate(e, RATES);
    if (!result.ok) return;
    expect(result.quote.assumptions.join(' ')).toContain('GST');
  });
});

describe('compareQuotes', () => {
  const e = estimate({ propertyType: 'BHK_3', carpetAreaSqft: 1150, scope: 'FULL_HOME' });
  const cheap = priceEstimate(e, RATES);
  const dear = priceEstimate(e, { ...RATES, modular_kitchen: rupeesToPaise(2600) });

  it('ranks categories by how much they actually differ', () => {
    if (!cheap.ok || !dear.ok) throw new Error('setup');
    const rows = compareQuotes([
      { studioId: 'a', quote: cheap.quote },
      { studioId: 'b', quote: dear.quote },
    ]);
    // Only the kitchen rate differs, so it must be the top row.
    expect(rows[0].category).toBe('modular_kitchen');
    expect(rows[0].lowestStudioId).toBe('a');
    expect(rows[0].highestStudioId).toBe('b');
    expect(rows[0].spreadPaise).toBeGreaterThan(0);
  });

  /** Treating an unpriced category as zero would crown whoever left it blank. */
  it('does not treat a missing category as the cheapest', () => {
    const reno = estimate({ propertyType: 'BHK_2', carpetAreaSqft: 850, scope: 'RENOVATION' });
    const withCivil = priceEstimate(reno, { ...RATES, civil: rupeesToPaise(80000) });
    const without = priceEstimate(reno, { ...RATES, civil: undefined });
    if (!withCivil.ok || !without.ok) throw new Error('setup');

    const rows = compareQuotes([
      { studioId: 'has', quote: withCivil.quote },
      { studioId: 'lacks', quote: without.quote },
    ]);
    const civil = rows.find((r) => r.category === 'civil');
    expect(civil?.amounts.lacks).toBeNull();
    expect(civil?.lowestStudioId).not.toBe('lacks');
  });

  it('declares no winner when only one studio priced a category', () => {
    if (!cheap.ok) throw new Error('setup');
    const rows = compareQuotes([{ studioId: 'only', quote: cheap.quote }]);
    for (const row of rows) {
      expect(row.lowestStudioId).toBeNull();
      expect(row.spreadPaise).toBe(0);
    }
  });
});

/**
 * If two bands overlap, the difference is not yet real. Saying "this one is
 * cheaper" there would be reading noise as signal.
 */
describe('bandsOverlap', () => {
  const e = estimate({ propertyType: 'BHK_3', carpetAreaSqft: 1150, scope: 'FULL_HOME' });

  it('is true for quotes a few percent apart', () => {
    const a = priceEstimate(e, RATES);
    const b = priceEstimate(e, { ...RATES, painting: rupeesToPaise(30) });
    if (!a.ok || !b.ok) throw new Error('setup');
    expect(bandsOverlap(a.quote, b.quote)).toBe(true);
  });

  it('is false once one studio is genuinely dearer', () => {
    const a = priceEstimate(e, RATES);
    const b = priceEstimate(e, {
      ...RATES,
      modular_kitchen: rupeesToPaise(4200),
      wardrobes: rupeesToPaise(3600),
      carpentry: rupeesToPaise(3200),
    });
    if (!a.ok || !b.ok) throw new Error('setup');
    expect(bandsOverlap(a.quote, b.quote)).toBe(false);
  });
});
