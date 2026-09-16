import { describe, it, expect } from 'vitest';
import {
  areaMilli,
  lineAmount,
  lineQtyMilli,
  computeTotals,
  formatQty,
  isUnpriced,
  MM_PER_SQFT,
  QTY_SCALE,
  type QuoteLineInput,
} from '@/modules/studio-quote/pricing';
import { rupeesToPaise } from '@/lib/money';

/**
 * The money on a studio's own quotation.
 *
 * This is the first thing in the product a studio sends to its own client under
 * its own name, so the arithmetic has to be right in the boring cases and
 * obviously right in the edge ones. The source app works in rupee floats; this
 * works in integer paise, and these tests exist mostly to prove the conversion
 * did not quietly change any answers.
 */

const R = rupeesToPaise;

function area(w: number, h: number, ratePerSqftRupees: number): QuoteLineInput {
  return { unit: 'AREA', code: 'MODULAR', ratePaise: R(ratePerSqftRupees), widthMm: w, heightMm: h };
}

describe('areaMilli', () => {
  it('converts a real base-cabinet run to square feet', () => {
    // 4260 × 750 mm is the worked example in the vendor app's README, which
    // quotes it as "34.39 sqft" — that is the DISPLAY figure. The real value is
    // 34.391, and storing the rounded one would lose ₹1.75 on this single line
    // at a normal carpentry rate. Thousandths exist for exactly this.
    expect(areaMilli(4260, 750)).toBe(34_391);
    expect(formatQty(areaMilli(4260, 750))).toBe('34.39');
  });

  it('is zero when a dimension is missing, rather than wrong', () => {
    // A line nobody has measured is unpriced. It must not become a confident
    // zero inside a total that a client then signs.
    expect(areaMilli(1500, null)).toBe(0);
    expect(areaMilli(null, 2100)).toBe(0);
    expect(areaMilli(0, 2100)).toBe(0);
  });

  it('matches the constant it is derived from', () => {
    const w = 1000;
    const h = 1000;
    expect(areaMilli(w, h)).toBe(Math.round(((w * h) / MM_PER_SQFT) * QTY_SCALE));
  });
});

describe('lineAmount', () => {
  it('prices an area line from its dimensions', () => {
    // 34.391 sqft at ₹1,750/sqft = ₹60,184.25
    expect(lineAmount(area(4260, 750, 1750))).toBe(R(60_184.25));
  });

  it('prices sqft and rft lines from the stored quantity', () => {
    const sqft: QuoteLineInput = {
      unit: 'SQFT',
      code: 'ONSITE',
      ratePaise: R(200),
      qtyMilli: 120_500, // 120.5 sqft
    };
    expect(lineAmount(sqft)).toBe(R(24_100));

    const rft: QuoteLineInput = {
      unit: 'RFT',
      code: 'ONSITE',
      ratePaise: R(450),
      qtyMilli: 12_000,
    };
    expect(lineAmount(rft)).toBe(R(5_400));
  });

  it('prices a unit line by count', () => {
    const bed: QuoteLineInput = {
      unit: 'UNIT',
      code: 'MODULAR',
      ratePaise: R(38_000),
      qtyMilli: 2 * QTY_SCALE,
    };
    expect(lineAmount(bed)).toBe(R(76_000));
  });

  it('lets an agreed amount override the arithmetic', () => {
    // The rate card proposes; the studio decides. A designer rounding
    // ₹60,182.50 to ₹60,000 in front of a client is the normal case.
    const line = { ...area(4260, 750, 1750), amountPaise: R(60_000) };
    expect(lineAmount(line)).toBe(R(60_000));
  });

  it('treats an agreed amount of zero as agreed, not as absent', () => {
    // Something thrown in free. `?? ` on a nullish check rather than a falsy
    // one is the difference between "no charge" and "please price this".
    const line = { ...area(1500, 2100, 1750), amountPaise: 0 };
    expect(lineAmount(line)).toBe(0);
  });

  it('is zero for an unmeasured line rather than throwing', () => {
    expect(lineAmount({ unit: 'AREA', code: 'MODULAR', ratePaise: R(1750) })).toBe(0);
  });

  it('never returns a fractional paise', () => {
    // 7 × 7 mm at ₹1,337 — deliberately awkward.
    const line = area(7, 7, 1337);
    expect(Number.isInteger(lineAmount(line))).toBe(true);
  });
});

describe('lineQtyMilli', () => {
  it('reads an area line from its dimensions and everything else from qty', () => {
    expect(lineQtyMilli(area(4260, 750, 1750))).toBe(34_391);
    expect(
      lineQtyMilli({ unit: 'SQFT', code: 'ONSITE', ratePaise: R(200), qtyMilli: 9_000 }),
    ).toBe(9_000);
  });
});

describe('computeTotals', () => {
  const lines: QuoteLineInput[] = [
    { unit: 'UNIT', code: 'MODULAR', ratePaise: R(100_000), qtyMilli: QTY_SCALE },
    { unit: 'UNIT', code: 'ONSITE', ratePaise: R(50_000), qtyMilli: QTY_SCALE },
  ];

  it('separates modular from on-site work', () => {
    const t = computeTotals(lines, { feeBps: 700, discountBps: 0 });
    expect(t.modularPaise).toBe(R(100_000));
    expect(t.onsitePaise).toBe(R(50_000));
    expect(t.workPaise).toBe(R(150_000));
  });

  it('charges the professional fee on the whole work value', () => {
    const t = computeTotals(lines, { feeBps: 700, discountBps: 0 });
    expect(t.feePaise).toBe(R(10_500)); // 7% of 1,50,000
    expect(t.subTotalPaise).toBe(R(160_500));
    expect(t.totalPaise).toBe(R(160_500));
  });

  it('discounts modular work ONLY', () => {
    // The rule this file exists to enforce. 15% of the modular 1,00,000 is
    // 15,000 — not 15% of 1,50,000, and not 15% of the sub-total.
    const t = computeTotals(lines, { feeBps: 700, discountBps: 1500 });
    expect(t.discountPaise).toBe(R(15_000));
    expect(t.totalPaise).toBe(R(145_500));
  });

  it('takes an on-the-spot reduction off the total', () => {
    const t = computeTotals(lines, { feeBps: 700, discountBps: 0, onSpotPaise: R(500) });
    expect(t.totalPaise).toBe(R(160_000));
  });

  it('makes the stages sum to the total, exactly', () => {
    // The whole reason for splitAcross. A schedule that does not add up to the
    // contract is the first thing a client notices, and rounding each stage
    // independently guarantees it eventually will not.
    const t = computeTotals(lines, {
      feeBps: 700,
      discountBps: 1500,
      bookingAdvancePaise: R(25_000),
    });
    const summed = t.stages.reduce((a, s) => a + s.amountPaise, 0);
    expect(summed).toBe(t.totalPaise);
  });

  it('keeps the stages summing even on an awkward total', () => {
    const awkward: QuoteLineInput[] = [
      { unit: 'UNIT', code: 'MODULAR', ratePaise: 333_333, qtyMilli: 7 * QTY_SCALE },
      { unit: 'UNIT', code: 'ONSITE', ratePaise: 111_111, qtyMilli: 3 * QTY_SCALE },
    ];
    const t = computeTotals(awkward, {
      feeBps: 733,
      discountBps: 1237,
      onSpotPaise: 991,
      bookingAdvancePaise: 2_500_000,
    });
    const summed = t.stages.reduce((a, s) => a + s.amountPaise, 0);
    expect(summed).toBe(t.totalPaise);
    expect(t.stages.every((s) => Number.isInteger(s.amountPaise))).toBe(true);
  });

  it('puts the booking advance first and splits only the balance', () => {
    const t = computeTotals(lines, {
      feeBps: 700,
      discountBps: 0,
      bookingAdvancePaise: R(25_000),
    });
    expect(t.stages[0]!.label).toBe('Booking advance');
    expect(t.stages[0]!.amountPaise).toBe(R(25_000));
    expect(t.stages).toHaveLength(6);

    const balance = t.totalPaise - R(25_000);
    const rest = t.stages.slice(1).reduce((a, s) => a + s.amountPaise, 0);
    expect(rest).toBe(balance);
  });

  it('never proposes an advance larger than the quotation', () => {
    // A ₹25,000 advance against a ₹4,000 kitchen shutter is a schedule that
    // asks for more than the job costs.
    const small: QuoteLineInput[] = [
      { unit: 'UNIT', code: 'MODULAR', ratePaise: R(4_000), qtyMilli: QTY_SCALE },
    ];
    const t = computeTotals(small, {
      feeBps: 700,
      discountBps: 0,
      bookingAdvancePaise: R(25_000),
    });
    expect(t.stages[0]!.amountPaise).toBe(t.totalPaise);
    expect(t.stages).toHaveLength(1);
  });

  it('survives an empty quotation', () => {
    // The state every quotation starts in. `splitAcross` throws on a
    // non-positive total, so this would be a crash on the new-quote screen.
    const t = computeTotals([], { feeBps: 700, discountBps: 0, bookingAdvancePaise: R(25_000) });
    expect(t.totalPaise).toBe(0);
    expect(t.stages).toEqual([]);
  });
});

describe('isUnpriced', () => {
  it('flags a line with no measurement or no rate', () => {
    expect(isUnpriced({ unit: 'AREA', code: 'MODULAR', ratePaise: R(1750) })).toBe(true);
    expect(isUnpriced({ unit: 'SQFT', code: 'ONSITE', ratePaise: 0, qtyMilli: 5_000 })).toBe(true);
  });

  it('does not flag a line somebody has agreed a figure for', () => {
    expect(
      isUnpriced({ unit: 'AREA', code: 'MODULAR', ratePaise: 0, amountPaise: R(12_000) }),
    ).toBe(false);
    expect(isUnpriced(area(4260, 750, 1750))).toBe(false);
  });
});
