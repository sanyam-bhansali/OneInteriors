import { describe, expect, it } from 'vitest';
import { against, puneRanges } from '@/modules/app/pune-range';
import type { FirstQuote } from '@/modules/quotation/first-quote';

const q = (amounts: Record<string, number>) =>
  ({ lines: Object.entries(amounts).map(([code, amountPaise]) => ({ code, amountPaise })) }) as unknown as FirstQuote;

describe('usual in Pune', () => {
  it('spans the studios that price the line', () => {
    const r = puneRanges([q({ wardrobe: 100 }), q({ wardrobe: 300 }), q({ wardrobe: 200 })]);
    expect(r.get('wardrobe')).toEqual({ lowPaise: 100, highPaise: 300, studios: 3 });
  });

  it('shows nothing until three studios price a line', () => {
    const r = puneRanges([q({ wardrobe: 100, loft: 50 }), q({ wardrobe: 300 }), q({ wardrobe: 200, loft: 60 })]);
    expect(r.has('loft')).toBe(false);
    expect(r.has('wardrobe')).toBe(true);
  });

  it('ignores lines priced at nothing', () => {
    const r = puneRanges([q({ tv: 0 }), q({ tv: 0 }), q({ tv: 0 })]);
    expect(r.size).toBe(0);
  });

  it('places an amount against its range', () => {
    const range = { lowPaise: 100, highPaise: 200, studios: 3 };
    expect(against(50, range)).toBe('below');
    expect(against(150, range)).toBe('within');
    expect(against(250, range)).toBe('above');
  });
});
