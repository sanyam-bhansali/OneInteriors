import { describe, expect, it } from 'vitest';
import { nextQuoteNumber } from '@/modules/studio-quote/quotes';

describe('the next quotation number', () => {
  it('starts at 001', () => {
    expect(nextQuoteNumber(2026, [])).toBe('2026-001');
  });

  it('ignores Design Final copies and other suffixes', () => {
    expect(nextQuoteNumber(2026, ['2026-001', '2026-001-D', '2026-002', '2026-002-D'])).toBe('2026-003');
  });

  it('takes the highest count, not the last in text order', () => {
    expect(nextQuoteNumber(2026, ['2026-099', '2026-100', '2026-100-D'])).toBe('2026-101');
  });

  it('ignores another year', () => {
    expect(nextQuoteNumber(2027, ['2026-014'])).toBe('2027-001');
  });
});
