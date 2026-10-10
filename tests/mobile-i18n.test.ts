import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DICT } from '@/modules/app/i18n-dict';
import { NATIVE } from '../mobile/src/lib/strings';

/**
 * The phone app keeps a copy of the website's /app dictionary (React Native
 * cannot import from src/). The copy must stay identical, and the app's own
 * words must not shadow a shared key or miss a language.
 */
describe('mobile app words', () => {
  it('keeps an identical copy of the website dictionary', () => {
    const web = readFileSync(join(__dirname, '../src/modules/app/i18n-dict.ts'), 'utf8');
    const app = readFileSync(join(__dirname, '../mobile/src/lib/i18n-dict.ts'), 'utf8');
    expect(app.replace(/\r\n/g, '\n')).toBe(web.replace(/\r\n/g, '\n'));
  });

  it('never repeats a shared key', () => {
    expect(Object.keys(NATIVE).filter((k) => k in DICT)).toEqual([]);
  });

  it('has English for every phrase, and Hindi and Marathi wherever English is not empty', () => {
    const gaps = Object.entries(NATIVE as Record<string, { en: string; hi: string; mr: string }>)
      .filter(([, e]) => !e.en || !e.hi || !e.mr)
      .map(([k]) => k);
    expect(gaps).toEqual([]);
  });
});
