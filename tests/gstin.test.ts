import { describe, it, expect } from 'vitest';
import {
  validateGstin,
  gstinCheckDigit,
  panFromGstin,
  isValidPan,
  isMaharashtra,
} from '@/modules/verification/gstin';

/**
 * Authoritative vector.
 *
 * CA Dhananjay Gokhale's published worked example, stated to be an
 * interpretation of the GST Developer Network's own Java checksum validator:
 *
 *   27AAPFU0939F1Z  →  hash sum 221  →  221 mod 36 = 5  →  36 − 5 = 31  →  'V'
 *
 * https://medium.com/@dhananjaygokhale/decoding-gst-number-checksum-digit-1ef2c8c53ad6
 */
const REFERENCE_14 = '27AAPFU0939F1Z';
const REFERENCE_GSTIN = '27AAPFU0939F1ZV';

describe('gstinCheckDigit', () => {
  it('matches the published worked example', () => {
    expect(gstinCheckDigit(REFERENCE_14)).toBe('V');
  });

  it('is stable — recomputing a valid GSTIN returns its own check digit', () => {
    expect(gstinCheckDigit(REFERENCE_GSTIN.slice(0, 14))).toBe(REFERENCE_GSTIN[14]);
  });

  /**
   * The edge case the article's own description gets wrong: when the hash sum
   * is an exact multiple of 36 the remainder is 0, and a naive `36 - 0` yields
   * 36 — which has no character in a 36-symbol alphabet. The outer `% 36` maps
   * it back to '0'. Worth a test precisely because it is rare enough to survive
   * a lot of manual checking.
   */
  it('maps a zero remainder to "0" rather than overflowing the alphabet', () => {
    const found: string[] = [];
    for (const c of '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
      const candidate = `27AAPFU0939F${c}Z`;
      found.push(gstinCheckDigit(candidate));
    }
    // Every result must be a real alphabet character, never undefined.
    for (const d of found) {
      expect(d).toMatch(/^[0-9A-Z]$/);
    }
  });

  it('rejects characters outside the base-36 alphabet', () => {
    expect(() => gstinCheckDigit('27AAPFU0939F1-')).toThrow();
  });
});

describe('validateGstin', () => {
  it('accepts a valid GSTIN and decodes its parts', () => {
    const result = validateGstin(REFERENCE_GSTIN);
    expect(result.valid).toBe(true);
    if (!result.valid) return;

    expect(result.parts.stateCode).toBe('27');
    expect(result.parts.stateName).toBe('Maharashtra');
    expect(result.parts.pan).toBe('AAPFU0939F');
    expect(result.parts.holderType).toBe('Firm / LLP'); // 4th PAN letter is F
    expect(result.parts.checkDigit).toBe('V');
  });

  it('normalises whitespace and case', () => {
    expect(validateGstin('  27aapfu0939f1zv  ').valid).toBe(true);
    expect(validateGstin('27 AAPFU 0939 F1ZV').valid).toBe(true);
  });

  it('catches a single-character typo via the check digit', () => {
    // Same GSTIN with one digit changed — shape is still valid, checksum is not.
    const typo = '27AAPFU0939F1ZW';
    const result = validateGstin(typo);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.reason).toMatch(/check digit/i);
  });

  it('rejects the wrong length with a useful message', () => {
    const result = validateGstin('27AAPFU0939F1Z');
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.reason).toMatch(/15 characters/);
  });

  it('rejects a malformed shape', () => {
    expect(validateGstin('271APFU0939F1ZV').valid).toBe(false); // digit where a letter belongs
    expect(validateGstin('27AAPFU0939F1XV').valid).toBe(false); // 14th char must be Z
  });

  it('rejects an unknown state code', () => {
    const result = validateGstin('99AAPFU0939F1ZV');
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.reason).toMatch(/state code/i);
  });

  it('rejects empty input', () => {
    expect(validateGstin('').valid).toBe(false);
    expect(validateGstin('   ').valid).toBe(false);
  });
});

describe('helpers', () => {
  it('extracts the PAN embedded in a GSTIN', () => {
    expect(panFromGstin(REFERENCE_GSTIN)).toBe('AAPFU0939F');
    expect(panFromGstin('nonsense')).toBeNull();
  });

  it('validates PAN shape', () => {
    expect(isValidPan('AAPFU0939F')).toBe(true);
    expect(isValidPan('aapfu0939f')).toBe(true);
    expect(isValidPan('AAPFU0939')).toBe(false);
    expect(isValidPan('AAPF00939F')).toBe(false);
  });

  it('identifies Maharashtra registrations', () => {
    expect(isMaharashtra(REFERENCE_GSTIN)).toBe(true);
    expect(isMaharashtra('29AAPFU0939F1ZV')).toBe(false);
  });
});

/**
 * The fixture studios carry invented GSTINs, and they MUST fail validation.
 *
 * This is deliberate and worth locking down: a made-up GSTIN with a valid
 * checksum could collide with a real registered business, and we would then be
 * displaying a real company's tax number next to an invented studio profile.
 * An invalid check digit is provably fake.
 */
describe('fixture GSTINs are provably fake', () => {
  const fixtures = [
    '27AAKCA1234F1ZP',
    '27AAOFS5678K1Z2',
    '27AABCN9012M1ZQ',
    '27AAJFM3456P1ZR',
    '27AAECS7890R1ZS',
    '27AAGFK2345L1ZT',
    '27AABFO6789T1ZU',
    '27AAPFT1357N1ZV',
  ];

  it('every fixture GSTIN fails the checksum', () => {
    for (const g of fixtures) {
      const result = validateGstin(g);
      expect(result.valid, `${g} must not validate — it would risk colliding with a real business`).toBe(false);
    }
  });
});
