import { describe, expect, it } from 'vitest';
import { DICT, translate, type Key } from '@/modules/app/i18n-dict';

const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('the app in Hindi and Marathi', () => {
  it('has every line in all three languages', () => {
    for (const [key, entry] of Object.entries(DICT)) {
      if (key === 'me.draft') continue; // only shown in Hindi and Marathi
      expect(entry.en, key).toBeTruthy();
      expect(entry.hi, key).toBeTruthy();
      expect(entry.mr, key).toBeTruthy();
    }
  });

  it('keeps the same placeholders in every language', () => {
    for (const [key, entry] of Object.entries(DICT)) {
      expect(holes(entry.hi), key).toEqual(holes(entry.en));
      expect(holes(entry.mr), key).toEqual(holes(entry.en));
    }
  });

  it('fills placeholders', () => {
    expect(translate('hi', 'q.meta' as Key, { n: 2, of: 7 })).toBe('सवाल 2 / 7');
    expect(translate('en', 'matches.cta' as Key, { n: 3 })).toBe('Get quotes from these 3');
  });
});
