import { describe, it, expect } from 'vitest';
import { normalisePhone } from '@/modules/studio/phone';

/**
 * Phone normalisation. People type their number six different ways; we store
 * one. Worth testing properly because a wrong number is how an approved studio
 * never hears from us.
 */
describe('normalisePhone', () => {
  it('accepts a bare 10-digit mobile', () => {
    expect(normalisePhone('9876543210')).toBe('+919876543210');
  });

  it('ignores spaces, dashes and brackets', () => {
    expect(normalisePhone('98765 43210')).toBe('+919876543210');
    expect(normalisePhone('98765-43210')).toBe('+919876543210');
    expect(normalisePhone('(98765) 43210')).toBe('+919876543210');
  });

  it('accepts the 91 country code, with or without +', () => {
    expect(normalisePhone('+91 98765 43210')).toBe('+919876543210');
    expect(normalisePhone('919876543210')).toBe('+919876543210');
  });

  it('accepts the 091 STD-style prefix people still type', () => {
    expect(normalisePhone('0919876543210')).toBe('+919876543210');
  });

  it('rejects numbers not starting 6-9 — no Indian mobile does', () => {
    expect(normalisePhone('5876543210')).toBeNull();
    expect(normalisePhone('1234567890')).toBeNull();
  });

  it('rejects wrong lengths rather than guessing', () => {
    expect(normalisePhone('987654321')).toBeNull();
    expect(normalisePhone('98765432101')).toBeNull();
    expect(normalisePhone('')).toBeNull();
  });

  it('rejects a landline with an STD code, which is not a mobile', () => {
    // 020 is Pune. Ten digits, but starts 0 — not reachable by SMS.
    expect(normalisePhone('020 2567 8900')).toBeNull();
  });
});
