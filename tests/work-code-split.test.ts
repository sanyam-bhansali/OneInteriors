import { describe, it, expect } from 'vitest';
import { splitByWorkCode, type PricedQuote, type QuoteLine } from '@/modules/quotation/price';
import {
  CATEGORY,
  MODULAR_CATEGORIES,
  RATE_CATEGORIES,
  isModular,
} from '@/modules/quotation/categories';

function line(category: QuoteLine['category'], amountPaise: number): QuoteLine {
  return {
    category,
    label: CATEGORY[category].label,
    quantity: 1,
    unit: CATEGORY[category].unit,
    ratePaise: amountPaise,
    amountPaise,
    assumption: 'test',
  };
}

function quote(lines: QuoteLine[]): PricedQuote {
  const subtotalPaise = lines.reduce((sum, l) => sum + l.amountPaise, 0);
  return {
    lines,
    subtotalPaise,
    designFeePaise: 0,
    gstPaise: 0,
    totalPaise: subtotalPaise,
    lowPaise: subtotalPaise,
    highPaise: subtotalPaise,
    variancePct: 0.15,
    assumptions: [],
    notPriced: [],
  };
}

describe('modular classification', () => {
  /**
   * Which side a category sits on decides what a "15% off modular" discount is
   * worth, so this is a pricing decision rather than a label. Pinned
   * deliberately: a category quietly moving sides changes real money.
   */
  it('treats factory-made carpentry as modular and site work as not', () => {
    expect([...MODULAR_CATEGORIES].sort()).toEqual(
      ['carpentry', 'modular_kitchen', 'wardrobes'].sort(),
    );

    for (const c of ['false_ceiling', 'painting', 'electrical', 'plumbing', 'civil'] as const) {
      expect(isModular(c), c).toBe(false);
    }
  });

  it('gives every category a side', () => {
    for (const c of RATE_CATEGORIES) {
      expect(typeof CATEGORY[c].modular, c).toBe('boolean');
    }
  });
});

describe('splitByWorkCode', () => {
  it('sums each side independently', () => {
    const split = splitByWorkCode(
      quote([
        line('modular_kitchen', 500_000),
        line('wardrobes', 300_000),
        line('painting', 90_000),
        line('electrical', 60_000),
      ]),
    );

    expect(split.modularPaise).toBe(800_000);
    expect(split.nonModularPaise).toBe(150_000);
  });

  /**
   * The design fee is a fee on the work, not work. Folding it into either
   * subtotal would make a modular discount computable against it, which is not
   * how any studio in this trade actually discounts.
   */
  it('leaves the design fee out of both subtotals', () => {
    const split = splitByWorkCode(
      quote([line('modular_kitchen', 500_000), line('design_fee', 70_000)]),
    );

    expect(split.modularPaise).toBe(500_000);
    expect(split.nonModularPaise).toBe(0);
  });

  it('accounts for every line except the fee', () => {
    const lines = [
      line('modular_kitchen', 111),
      line('wardrobes', 222),
      line('carpentry', 333),
      line('false_ceiling', 444),
      line('painting', 555),
      line('design_fee', 999),
    ];
    const split = splitByWorkCode(quote(lines));
    const withoutFee = lines
      .filter((l) => l.category !== 'design_fee')
      .reduce((sum, l) => sum + l.amountPaise, 0);

    expect(split.modularPaise + split.nonModularPaise).toBe(withoutFee);
  });

  it('handles an empty quote without producing NaN', () => {
    const split = splitByWorkCode(quote([]));
    expect(split.modularPaise).toBe(0);
    expect(split.nonModularPaise).toBe(0);
  });
});
