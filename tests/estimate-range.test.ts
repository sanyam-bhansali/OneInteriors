import { describe, expect, it } from 'vitest';
import { middleHalf, studiosForTier } from '@/modules/app/estimate-range';
import type { Studio } from '@/modules/studio/types';

describe('the running estimate', () => {
  it('is the middle half of what studios quote', () => {
    const r = middleHalf([100, 200, 300, 400, 500]);
    expect(r).toEqual({ lowPaise: 200, midPaise: 300, highPaise: 400, studios: 5 });
  });

  it('says nothing until three studios price the home', () => {
    expect(middleHalf([100, 200])).toBeNull();
    expect(middleHalf([100, 200, 0])).toBeNull();
  });

  it('uses the chosen band only when enough studios are in it', () => {
    const s = (band: Studio['band']) => ({ band }) as Studio;
    const all = [s('PREMIUM'), s('PREMIUM'), s('PREMIUM'), s('LUXURY')];
    expect(studiosForTier(all, 'PREMIUM')).toHaveLength(3);
    expect(studiosForTier(all, 'LUXURY')).toHaveLength(4);
    expect(studiosForTier(all, null)).toHaveLength(4);
  });
});
