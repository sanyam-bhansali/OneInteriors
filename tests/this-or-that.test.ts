import { describe, it, expect } from 'vitest';
import { PAIRS, applyChoices, pairsFor } from '@/modules/brief/this-or-that';
import { weightedAffinity } from '@/modules/matching/style-affinity';

describe('this or that', () => {
  it('pairs their likes, then each like with its closest neighbour, four in all', () => {
    const pairs = pairsFor(['japandi', 'warm-modern']);
    expect(pairs).toHaveLength(PAIRS);
    expect(pairs[0]).toEqual(['japandi', 'warm-modern']);
    expect(pairs.slice(1).every(([a, b]) => ['japandi', 'warm-modern'].includes(a) && !['japandi', 'warm-modern'].includes(b))).toBe(true);
  });

  it('never offers a style they ruled out', () => {
    const pairs = pairsFor(['japandi', 'warm-modern'], ['scandinavian']);
    expect(pairs.flat()).not.toContain('scandinavian');
  });

  it('puts the style they chose most first', () => {
    expect(applyChoices(['japandi', 'warm-modern', 'indian-contemporary'], ['warm-modern', 'warm-modern', 'indian-contemporary'])).toEqual([
      'warm-modern',
      'indian-contemporary',
      'japandi',
    ]);
  });

  it('lets a neighbour that won take the weakest place, keeping three', () => {
    const out = applyChoices(['japandi', 'warm-modern', 'art-deco'], ['japandi', 'scandinavian', 'scandinavian', 'warm-modern']);
    expect(out[0]).toBe('scandinavian');
    expect(out).toHaveLength(3);
    expect(out).not.toContain('art-deco');
  });

  it('counts the first like in full and the later ones a little less', () => {
    expect(weightedAffinity('japandi', ['japandi', 'warm-modern'])).toBe(1);
    expect(weightedAffinity('warm-modern', ['japandi', 'warm-modern'])).toBe(0.85);
  });
});
