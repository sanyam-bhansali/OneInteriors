import { describe, it, expect } from 'vitest';
import {
  buildFirstQuote,
  compareQuotes,
  itemsFor,
  STANDARD_KITCHEN_RUN_MM,
  type QuoteInput,
} from '@/modules/quotation/first-quote';
import {
  CATALOGUE,
  GST_BPS,
  MODULAR_DISCOUNT_BPS,
  PROFESSIONAL_FEE_BPS,
  type StudioRates,
} from '@/modules/quotation/catalogue';

/**
 * The first quote is the number a customer decides on before anybody has
 * spoken to them, so the arithmetic in it has to be right in a way that a
 * screen full of plausible-looking rupees cannot demonstrate on its own.
 *
 * The commercial formula below is not ours to invent — it was reverse-
 * engineered from four real quotations and reconciled to the rupee on all
 * four:
 *
 *     Total = (MO + NM) + 7% professional fee − 15% discount on MO
 *
 * The order matters and is the thing most likely to be "tidied" by somebody
 * later, so it is asserted explicitly.
 */

/** A studio that has filed a rate for everything, at round numbers. */
function ratesFor(paise: number): StudioRates {
  return Object.fromEntries(
    CATALOGUE.map((i) => [
      i.code,
      { code: i.code, ratePaise: paise, fromQuotations: 104, filedOn: '2026-09-01' },
    ]),
  );
}

const BASE: QuoteInput = {
  bhk: 2,
  carpetAreaSqft: 850,
  bathrooms: 2,
  kitchenRunMm: 3410,
  runSource: 'floor_plan',
};

describe('what is in scope', () => {
  it('adds bedrooms as the flat gets bigger', () => {
    const one = itemsFor(1).length;
    const two = itemsFor(2).length;
    const three = itemsFor(3).length;

    expect(two).toBeGreaterThan(one);
    expect(three).toBeGreaterThan(two);
  });

  it('never includes a third bedroom in a 2 BHK', () => {
    expect(itemsFor(2).some((i) => i.room === 'THIRD_BEDROOM')).toBe(false);
    expect(itemsFor(3).some((i) => i.room === 'THIRD_BEDROOM')).toBe(true);
  });
});

describe('the commercial formula', () => {
  it('charges the fee on the whole of the work, then takes the discount off', () => {
    const q = buildFirstQuote(BASE, ratesFor(100_00));

    const expectedFee = Math.round(
      ((q.modularPaise + q.nonModularPaise) * PROFESSIONAL_FEE_BPS) / 10_000,
    );
    const expectedDiscount = Math.round((q.modularPaise * MODULAR_DISCOUNT_BPS) / 10_000);

    expect(q.professionalFeePaise).toBe(expectedFee);
    expect(q.modularDiscountPaise).toBe(expectedDiscount);

    // The order is the point. Discounting first and charging 7% of the smaller
    // number is a different — and wrong — total.
    const wrongWayRound = Math.round(
      ((q.modularPaise - expectedDiscount + q.nonModularPaise) * PROFESSIONAL_FEE_BPS) / 10_000,
    );
    expect(q.professionalFeePaise).not.toBe(wrongWayRound);
  });

  it('totals to the formula, with GST on top', () => {
    const q = buildFirstQuote(BASE, ratesFor(100_00));

    const beforeTax =
      q.modularPaise + q.nonModularPaise + q.professionalFeePaise - q.modularDiscountPaise;

    expect(q.gstPaise).toBe(Math.round((beforeTax * GST_BPS) / 10_000));
    expect(q.totalPaise).toBe(beforeTax + q.gstPaise);
  });

  it('discounts only the modular half', () => {
    const q = buildFirstQuote(BASE, ratesFor(100_00));
    // If the discount ever silently applied to everything, this ratio breaks.
    expect(q.modularDiscountPaise).toBeLessThan(q.modularPaise);
    expect(q.modularDiscountPaise).toBeLessThan(
      Math.round(((q.modularPaise + q.nonModularPaise) * MODULAR_DISCOUNT_BPS) / 10_000),
    );
  });

  it('is deterministic — the same inputs give the same rupees', () => {
    const a = buildFirstQuote(BASE, ratesFor(100_00));
    const b = buildFirstQuote(BASE, ratesFor(100_00));
    expect(a.totalPaise).toBe(b.totalPaise);
  });
});

describe('the kitchen is the only thing the plan changes', () => {
  it('a longer platform run costs more', () => {
    const small = buildFirstQuote({ ...BASE, kitchenRunMm: 3410 }, ratesFor(100_00));
    const large = buildFirstQuote({ ...BASE, kitchenRunMm: 5240 }, ratesFor(100_00));
    expect(large.totalPaise).toBeGreaterThan(small.totalPaise);
  });

  it('falls back to the standard run when there is no plan', () => {
    const q = buildFirstQuote(
      { ...BASE, kitchenRunMm: null, runSource: 'standard' },
      ratesFor(100_00),
    );
    const explicit = buildFirstQuote(
      { ...BASE, kitchenRunMm: STANDARD_KITCHEN_RUN_MM, runSource: 'standard' },
      ratesFor(100_00),
    );
    expect(q.totalPaise).toBe(explicit.totalPaise);
  });

  it('marks kitchen lines as standard until a real run is supplied', () => {
    const guessed = buildFirstQuote({ ...BASE, kitchenRunMm: null, runSource: 'standard' }, ratesFor(100_00));
    const known = buildFirstQuote(BASE, ratesFor(100_00));

    const kitchenOf = (q: ReturnType<typeof buildFirstQuote>) =>
      q.lines.filter((l) => l.room === 'KITCHEN' && l.unit === 'sq ft');

    expect(kitchenOf(guessed).every((l) => l.standard)).toBe(true);
    expect(kitchenOf(known).every((l) => !l.standard)).toBe(true);
  });

  it('widens the band when nobody has seen a plan, and says which number is the guess', () => {
    const withPlan = buildFirstQuote(BASE, ratesFor(100_00));
    const without = buildFirstQuote(
      { ...BASE, kitchenRunMm: null, runSource: 'standard' },
      ratesFor(100_00),
    );

    expect(without.variancePct).toBeGreaterThan(withPlan.variancePct);
    expect(without.assumptions[0]).toMatch(/no floor plan/i);
    expect(without.assumptions[0]).toMatch(/most likely to move/i);
  });
});

describe('a studio that has not filed everything', () => {
  it('names what it could not price rather than dropping it', () => {
    const partial = ratesFor(100_00);
    delete partial.kitchen_base;

    const q = buildFirstQuote(BASE, partial);

    expect(q.notPriced).toContain('kitchen_base');
    expect(q.lines.some((l) => l.code === 'kitchen_base')).toBe(false);
    expect(q.assumptions.join(' ')).toMatch(/not filed a rate/i);
  });

  it('never substitutes another studio’s rate for a missing one', () => {
    const partial = ratesFor(100_00);
    delete partial.kitchen_base;

    const full = buildFirstQuote(BASE, ratesFor(100_00));
    const thin = buildFirstQuote(BASE, partial);

    // A silently-substituted rate would leave the totals equal.
    expect(thin.totalPaise).toBeLessThan(full.totalPaise);
  });
});

describe('the document', () => {
  it('groups into rooms and each room adds up', () => {
    const q = buildFirstQuote({ ...BASE, bhk: 3 }, ratesFor(100_00));

    for (const room of q.rooms) {
      const sum = room.lines.reduce((t, l) => t + l.amountPaise, 0);
      expect(room.subtotalPaise).toBe(sum);
    }

    const allLines = q.rooms.flatMap((r) => r.lines).length;
    expect(allLines).toBe(q.lines.length);
  });

  it('puts a size and a spec on every single line', () => {
    const q = buildFirstQuote({ ...BASE, bhk: 3 }, ratesFor(100_00));

    // This is the promise the landing page makes about every other quote in
    // the market being unreadable. A blank here breaks it.
    expect(q.lines.length).toBeGreaterThan(10);
    for (const line of q.lines) {
      expect(line.size.length).toBeGreaterThan(0);
      expect(line.spec.length).toBeGreaterThan(0);
      expect(line.quantity).toBeGreaterThan(0);
    }
  });
});

describe('comparing two studios', () => {
  it('keeps a row for a line only one of them priced', () => {
    const dear = ratesFor(120_00);
    const cheap = ratesFor(100_00);
    delete cheap.mandir;

    const rows = compareQuotes(
      buildFirstQuote(BASE, dear),
      buildFirstQuote(BASE, cheap),
    );

    const mandir = rows.find((r) => r.code === 'mandir');
    expect(mandir).toBeDefined();
    expect(mandir!.a).not.toBeNull();
    expect(mandir!.b).toBeNull();
    // Not comparable, so no delta is invented.
    expect(mandir!.deltaPaise).toBeNull();
  });

  it('signs the delta so dearer reads positive', () => {
    const rows = compareQuotes(
      buildFirstQuote(BASE, ratesFor(100_00)),
      buildFirstQuote(BASE, ratesFor(120_00)),
    );
    const priced = rows.filter((r) => r.deltaPaise !== null);
    expect(priced.length).toBeGreaterThan(0);
    expect(priced.every((r) => r.deltaPaise! > 0)).toBe(true);
  });
});
