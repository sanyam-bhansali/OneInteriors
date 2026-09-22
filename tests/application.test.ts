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

  /**
   * Reported as "clients are not able to submit the apply form".
   *
   * Eleven digits with a leading zero is one of the two commonest ways an
   * Indian writes a mobile, and it was refused — a studio typing their own
   * number correctly was told it was not a number. The applications lost to
   * it never reached anybody to be counted, which is why it went unnoticed.
   */
  it('accepts a mobile written with the STD-style leading zero', () => {
    expect(normalisePhone('09876543210')).toBe('+919876543210');
    expect(normalisePhone('0 98765 43210')).toBe('+919876543210');
    expect(normalisePhone('0-98765-43210')).toBe('+919876543210');
  });

  it('still refuses a landline written the same way', () => {
    /* The reason the fix strips one zero and re-tests rather than accepting
       eleven digits: 020 is Pune, and this is the same shape as the mobile
       above. It strips to 2025678900, fails the 6-9 rule, and stays refused
       — nothing can send an SMS to it. */
    expect(normalisePhone('020 2567 8900')).toBeNull();
    expect(normalisePhone('04412345678')).toBeNull();
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
