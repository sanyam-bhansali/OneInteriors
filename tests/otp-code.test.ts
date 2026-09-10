import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import {
  OTP_LENGTH,
  cleanCode,
  cleanName,
  codeFromBytes,
  isOtpShape,
  isValidName,
} from '@/modules/auth/otp-code';

describe('codeFromBytes', () => {
  it('always produces exactly six digits', () => {
    for (let i = 0; i < 500; i += 1) {
      const code = codeFromBytes(randomBytes(4));
      expect(code).toMatch(/^\d{6}$/);
      expect(code.length).toBe(OTP_LENGTH);
    }
  });

  /**
   * The padding matters more than it looks. A small integer rendered without
   * it gives a four- or five-character code that the shape check then rejects,
   * so roughly one sign-in in a thousand would fail with "wrong code" for
   * someone who typed exactly what they were sent.
   */
  it('pads a small number rather than shortening the code', () => {
    expect(codeFromBytes(Uint8Array.from([0, 0, 0, 0]))).toBe('000000');
    expect(codeFromBytes(Uint8Array.from([0, 0, 0, 7]))).toBe('000007');
    expect(isOtpShape(codeFromBytes(Uint8Array.from([0, 0, 0, 0])))).toBe(true);
  });

  it('is deterministic for given bytes', () => {
    const bytes = Uint8Array.from([12, 34, 56, 78]);
    expect(codeFromBytes(bytes)).toBe(codeFromBytes(bytes));
  });

  it('refuses to make a code from too little entropy', () => {
    expect(() => codeFromBytes(Uint8Array.from([1, 2, 3]))).toThrow();
  });

  /**
   * Not a strict uniformity test — the modulo is knowingly very slightly
   * biased. This checks the generator actually spreads across the range, which
   * would catch a byte-assembly mistake that collapsed it into a narrow band.
   */
  it('spreads across the whole range', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i += 1) seen.add(codeFromBytes(randomBytes(4)));
    expect(seen.size).toBeGreaterThan(1900);
  });
});

describe('isOtpShape', () => {
  it('accepts six digits and nothing else', () => {
    expect(isOtpShape('481920')).toBe(true);
    expect(isOtpShape('48192')).toBe(false);
    expect(isOtpShape('4819201')).toBe(false);
    expect(isOtpShape('48192a')).toBe(false);
    expect(isOtpShape('481 920')).toBe(false);
    expect(isOtpShape('')).toBe(false);
    expect(isOtpShape(null)).toBe(false);
    expect(isOtpShape(undefined)).toBe(false);
  });

  it('rejects hostile input before it can reach a query', () => {
    expect(isOtpShape("' OR 1=1 --")).toBe(false);
    expect(isOtpShape('../../etc/passwd')).toBe(false);
    expect(isOtpShape('1'.repeat(5000))).toBe(false);
  });
});

describe('cleanCode', () => {
  /**
   * People do not type codes cleanly. Every one of these is a real thing a
   * customer does, and rejecting them as "wrong code" produces support calls
   * about a system that is working perfectly.
   */
  it('recovers the code from how people actually enter it', () => {
    expect(cleanCode('481 920')).toBe('481920');
    expect(cleanCode(' 481920 ')).toBe('481920');
    expect(cleanCode('481-920')).toBe('481920');
    expect(cleanCode('481 920')).toBe('481920'); // non-breaking space
  });

  it('takes the first six digits when the whole message is pasted', () => {
    expect(cleanCode('Your code is 481920, valid for 10 minutes')).toBe('481920');
  });

  it('returns something shape-invalid rather than guessing, when there is no code', () => {
    expect(isOtpShape(cleanCode('no digits here'))).toBe(false);
    expect(isOtpShape(cleanCode(''))).toBe(false);
  });
});

describe('names', () => {
  /**
   * Indian names carry initials, full stops, multiple given names and
   * inconsistent spacing. A validator that insists on two words or rejects
   * punctuation rejects real people — at the point in the funnel where they
   * have already answered nine questions.
   */
  it('accepts names real customers have', () => {
    for (const name of [
      'Sanyam Bhansali',
      'R. Krishnan',
      'K R Narayanan',
      'Priya',
      "D'Souza",
      'Mohammed Abdul Rahman',
      'अनुष्का शर्मा',
    ]) {
      expect(isValidName(name), name).toBe(true);
    }
  });

  it('rejects what is plainly not a name', () => {
    expect(isValidName('')).toBe(false);
    expect(isValidName('  ')).toBe(false);
    expect(isValidName('.')).toBe(false);
    expect(isValidName('12')).toBe(false);
    expect(isValidName('a')).toBe(false);
  });

  it('tidies spacing and caps the length', () => {
    expect(cleanName('  Sanyam   Bhansali ')).toBe('Sanyam Bhansali');
    expect(cleanName('x'.repeat(200)).length).toBe(80);
  });
});
