import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CATEGORY_ERRORS, CATEGORY_WORDS, QUOTE_CATEGORIES, asQuoteCategory, categoryRefusal } from '@/modules/studio-quote/category-rules';
import { bookingRefusal, BOOKING_ERRORS } from '@/modules/studio-sales/booking-rules';

/** Essential / Premium / Luxe on every quotation (owner, 13 Nov 2026). */

describe('the category', () => {
  it('reads only Essential, Premium or Luxe', () => {
    expect(QUOTE_CATEGORIES).toEqual(['ESSENTIAL', 'PREMIUM', 'LUXURY']);
    expect(asQuoteCategory('PREMIUM')).toBe('PREMIUM');
    expect(asQuoteCategory('LUXURY')).toBe('LUXURY');
    for (const bad of ['', 'premium', 'LUXE', null, undefined, 3]) expect(asQuoteCategory(bad)).toBeNull();
    expect(CATEGORY_WORDS.LUXURY).toBe('Luxe');
  });

  it('is needed before a quotation goes further', () => {
    expect(categoryRefusal({ category: null })).toBe(CATEGORY_ERRORS.missing);
    expect(categoryRefusal({ category: undefined })).toBe(CATEGORY_ERRORS.missing);
    expect(categoryRefusal({ category: 'ESSENTIAL' })).toBeNull();
  });

  it('is not asked of an additional-scope quotation (the project has one)', () => {
    expect(categoryRefusal({ category: null, scopeForProjectId: 'p1' })).toBeNull();
  });
});

describe('booking and Convert', () => {
  const ok = { hasSalesFinal: true, alreadyBooked: false, changedSinceFinal: false, fromOneInteriors: false, leadDeleted: false, bookingStagePaise: 2_500_000, amountPaise: 0 };
  it('refuse a sales final with no category', () => {
    expect(bookingRefusal({ ...ok, noCategory: true })).toBe(CATEGORY_ERRORS.missing);
    expect(bookingRefusal({ ...ok, noCategory: false })).toBeNull();
    expect(bookingRefusal(ok)).toBeNull();
  });
  it('say the earlier reasons first', () => {
    expect(bookingRefusal({ ...ok, hasSalesFinal: false, noCategory: true })).toBe(BOOKING_ERRORS.noFinal);
  });
});

describe('every way a quotation goes further checks it', () => {
  const read = (p: string) => readFileSync(p, 'utf8');
  it('New quotation asks for it and refuses without it', () => {
    const actions = read('src/app/studio/quotations/actions.ts');
    expect(actions).toMatch(/asQuoteCategory\(str\(form, 'category'\)\)/);
    expect(actions).toMatch(/categoryRequired: true/);
    expect(read('src/app/studio/quotations/NewQuote.tsx')).toMatch(/name="category"[^>]*required/);
  });
  it('send, won, copy, send again, sales final and starting a project refuse without it', () => {
    const quotes = read('src/modules/studio-quote/quotes.ts');
    expect(quotes).toMatch(/status === 'ISSUED' \|\| status === 'ACCEPTED'\) \{\s*const row = [^\n]*category: true/);
    expect(quotes).toMatch(/const noCategory = categoryRefusal\(source\)/);
    expect(quotes).toMatch(/if \(!category\) return \{ ok: false, error: CATEGORY_ERRORS\.clear \}/);
    const revisions = read('src/modules/studio-sales/revisions.ts');
    expect(revisions.match(/categoryRefusal\(q\)/g)?.length).toBe(2);
    expect(read('src/modules/studio-sales/booking.ts')).toMatch(/noCategory: categoryRefusal\(q\) !== null/);
    expect(read('src/modules/project/own-project.ts')).toMatch(/const noCategory = categoryRefusal\(q\)/);
  });
});
