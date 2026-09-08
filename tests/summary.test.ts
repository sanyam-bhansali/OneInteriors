import { describe, it, expect } from 'vitest';
import { summarise, type QuoteForSummary } from '@/modules/quotation/summary';
import { estimate } from '@/modules/quotation/estimate';
import { priceEstimate, compareQuotes, type RateCard } from '@/modules/quotation/price';
import { rupeesToPaise } from '@/lib/money';

const BASE: RateCard = {
  modular_kitchen: rupeesToPaise(1800),
  wardrobes: rupeesToPaise(1600),
  carpentry: rupeesToPaise(1400),
  false_ceiling: rupeesToPaise(95),
  painting: rupeesToPaise(28),
  electrical: rupeesToPaise(120),
};

const WORKINGS = estimate({ propertyType: 'BHK_3', carpetAreaSqft: 1150, scope: 'FULL_HOME' });

function quoteWith(rates: RateCard, studioId: string, studioName: string): QuoteForSummary {
  const priced = priceEstimate(WORKINGS, rates);
  if (!priced.ok) throw new Error('setup failed');
  return { studioId, studioName, quote: priced.quote };
}

function summaryFor(entries: QuoteForSummary[]) {
  const comparison = compareQuotes(entries.map((e) => ({ studioId: e.studioId, quote: e.quote })));
  return summarise(entries, comparison);
}

describe('summarise — the overlap rule', () => {
  /**
   * The reason this module is arithmetic rather than a model. Two quotes 4%
   * apart, each carrying a ±15% band, are the same quote — and telling a
   * customer otherwise points them at a difference that will not survive the
   * first site visit.
   */
  it('refuses to name a cheaper studio when the bands overlap', () => {
    const a = quoteWith(BASE, 'a', 'Akara');
    const b = quoteWith({ ...BASE, painting: rupeesToPaise(31) }, 'b', 'Bellwether');

    const summary = summaryFor([a, b]);

    expect(summary.headline).toContain('same price');
    expect(summary.headline).not.toContain('cheaper');
    expect(summary.points.join(' ')).toContain('margin of error');
  });

  it('tells the customer what to decide on instead', () => {
    const summary = summaryFor([
      quoteWith(BASE, 'a', 'Akara'),
      quoteWith({ ...BASE, painting: rupeesToPaise(31) }, 'b', 'Bellwether'),
    ]);
    expect(summary.points.join(' ')).toMatch(/delivery record|the work/i);
  });

  it('does name the cheaper studio once the bands genuinely separate', () => {
    const a = quoteWith(BASE, 'a', 'Akara');
    const b = quoteWith(
      {
        ...BASE,
        modular_kitchen: rupeesToPaise(4400),
        wardrobes: rupeesToPaise(3800),
        carpentry: rupeesToPaise(3400),
        false_ceiling: rupeesToPaise(220),
      },
      'b',
      'Bellwether',
    );

    const summary = summaryFor([a, b]);
    expect(summary.headline).toContain('Akara');
    expect(summary.headline).toContain('cheaper');
    expect(summary.headline).toContain('do not overlap');
  });
});

describe('summarise — what it points at', () => {
  it('names the largest category gap, which is where the decision is', () => {
    const a = quoteWith(BASE, 'a', 'Akara');
    const b = quoteWith({ ...BASE, modular_kitchen: rupeesToPaise(2900) }, 'b', 'Bellwether');

    const summary = summaryFor([a, b]);
    expect(summary.points.join(' ').toLowerCase()).toContain('modular kitchen');
  });

  /** A total that covers less work is worse than a total that is higher. */
  it('warns when a studio has not priced everything', () => {
    const reno = estimate({ propertyType: 'BHK_2', carpetAreaSqft: 850, scope: 'RENOVATION' });
    const full = priceEstimate(reno, { ...BASE, civil: rupeesToPaise(90000), plumbing: rupeesToPaise(35000), flooring: rupeesToPaise(180) });
    const partial = priceEstimate(reno, { ...BASE, flooring: rupeesToPaise(180), plumbing: rupeesToPaise(35000) });
    if (!full.ok || !partial.ok) throw new Error('setup');

    const entries: QuoteForSummary[] = [
      { studioId: 'a', studioName: 'Akara', quote: full.quote },
      { studioId: 'b', studioName: 'Bellwether', quote: partial.quote },
    ];
    const summary = summaryFor(entries);
    expect(summary.points.join(' ')).toContain('not covering the same work');
    expect(summary.points.join(' ')).toContain('Bellwether');
  });

  it('always gives the customer questions to ask', () => {
    const summary = summaryFor([quoteWith(BASE, 'a', 'Akara')]);
    expect(summary.questions.length).toBeGreaterThanOrEqual(3);
    expect(summary.questions.join(' ')).toContain('handover date');
  });
});

describe('summarise — degenerate cases', () => {
  it('says plainly that one quote is not a comparison', () => {
    const summary = summaryFor([quoteWith(BASE, 'a', 'Akara')]);
    expect(summary.headline).toContain('One quote');
    expect(summary.points.join(' ')).toContain('not whether it is a fair price');
  });

  it('flags a wide band as the customer’s own missing information', () => {
    const thin = estimate({ propertyType: 'BHK_3', carpetAreaSqft: null, scope: null });
    const priced = priceEstimate(thin, BASE);
    if (!priced.ok) throw new Error('setup');

    const summary = summaryFor([{ studioId: 'a', studioName: 'Akara', quote: priced.quote }]);
    expect(summary.points.join(' ')).toContain('missing something');
  });

  it('handles no quotes without throwing', () => {
    const summary = summarise([], []);
    expect(summary.headline).toContain('No quotes');
    expect(summary.points).toEqual([]);
  });
});
