import { describe, expect, it } from 'vitest';
import {
  aadhaarError,
  aadhaarLast4,
  accountNumberError,
  checkIdentity,
  ifscError,
  kycFileError,
  kycGaps,
  kycSummary,
  maskedAadhaar,
  panError,
  panHolderType,
  upiError,
  verhoeffValid,
  KYC_MAX_BYTES,
} from '@/modules/studio-crews/kyc';

/** A Verhoeff-valid 12-digit number from an 11-digit start: the check digit that makes it pass. */
function validAadhaar(start11: string): string {
  for (let d = 0; d <= 9; d++) if (verhoeffValid(`${start11}${d}`)) return `${start11}${d}`;
  throw new Error('no check digit');
}

describe('PAN', () => {
  it('accepts five letters, four digits, a letter, with a known holder type', () => {
    expect(panError('ABCPE1234F')).toBeNull();
    expect(panError(' abcpe 1234f ')).toBeNull();
    expect(panHolderType('ABCPE1234F')).toBe('Individual');
    expect(panHolderType('ABCFE1234F')).toBe('Firm');
  });
  it('refuses the wrong length, shape or holder type', () => {
    expect(panError('ABCPE1234')).toMatch(/10 characters/);
    expect(panError('ABC1E1234F')).toMatch(/five letters/);
    expect(panError('ABCXE1234F')).toMatch(/holder type/);
  });
  it('an empty PAN is not an error (temporary crews have none)', () => {
    expect(panError('')).toBeNull();
  });
});

describe('Aadhaar', () => {
  const good = validAadhaar('23456789012');
  it('passes the Verhoeff checksum', () => {
    expect(aadhaarError(good)).toBeNull();
    expect(aadhaarError(good.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3'))).toBeNull();
  });
  it('catches a single mistyped digit and a swap of neighbours', () => {
    const typo = `${good.slice(0, 5)}${(Number(good[5]) + 1) % 10}${good.slice(6)}`;
    expect(aadhaarError(typo)).toMatch(/checksum|check/);
    const swapped = `${good.slice(0, 3)}${good[4]}${good[3]}${good.slice(5)}`;
    if (swapped !== good) expect(aadhaarError(swapped)).not.toBeNull();
  });
  it('is 12 digits and never starts with 0 or 1', () => {
    expect(aadhaarError('12345')).toMatch(/12 digits/);
    expect(aadhaarError(validAadhaar('13456789012'))).toMatch(/0 or 1/);
  });
  it('keeps only the last four digits, and only of a sound number', () => {
    expect(aadhaarLast4(good)).toBe(good.slice(-4));
    expect(aadhaarLast4('234567890123')).toBe(verhoeffValid('234567890123') ? '0123' : null);
    expect(maskedAadhaar('1234')).toBe('XXXX XXXX 1234');
  });
});

describe('a crew’s identity on saving', () => {
  const good = validAadhaar('98765432101');
  it('a temporary crew needs nothing more', () => {
    expect(checkIdentity({ kind: 'TEMPORARY', phone: '', pan: '', aadhaar: '' })).toEqual({ ok: true, panNumber: null, aadhaarLast4: null });
  });
  it('a permanent crew needs a phone, a PAN and an Aadhaar', () => {
    const r = checkIdentity({ kind: 'PERMANENT', phone: '', pan: '', aadhaar: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/phone number.*Aadhaar.*PAN/);
  });
  it('stores the PAN upper-cased and only the Aadhaar’s last four', () => {
    const r = checkIdentity({ kind: 'PERMANENT', phone: '9876543210', pan: 'abcpe1234f', aadhaar: good });
    expect(r).toEqual({ ok: true, panNumber: 'ABCPE1234F', aadhaarLast4: good.slice(-4) });
    expect(JSON.stringify(r)).not.toContain(good);
  });
  it('keeps what is on file when the fields are left blank', () => {
    const r = checkIdentity({ kind: 'PERMANENT', phone: '9876543210', pan: '', aadhaar: '', existing: { panNumber: 'ABCPE1234F', aadhaarLast4: '4321' } });
    expect(r).toEqual({ ok: true, panNumber: 'ABCPE1234F', aadhaarLast4: '4321' });
  });
  it('refuses a bad PAN or Aadhaar before anything else', () => {
    expect(checkIdentity({ kind: 'TEMPORARY', phone: '', pan: 'XYZ', aadhaar: '' }).ok).toBe(false);
    expect(checkIdentity({ kind: 'TEMPORARY', phone: '', pan: '', aadhaar: '234567890120' }).ok).toBe(verhoeffValid('234567890120'));
  });
});

describe('KYC gaps', () => {
  const base = { phone: '9876543210', aadhaarLast4: '1234', panNumber: 'ABCPE1234F', aadhaarDocPath: 'a', panDocPath: 'p' };
  it('a temporary crew is never incomplete', () => {
    expect(kycGaps({ ...base, kind: 'TEMPORARY', phone: null, aadhaarLast4: null, panNumber: null })).toEqual({ blocking: [], soft: [] });
    expect(kycSummary({ ...base, kind: 'TEMPORARY' }).label).toBe('Temporary');
  });
  it('a permanent crew without numbers is blocked; without scans, softly noted', () => {
    expect(kycSummary({ ...base, kind: 'PERMANENT', panNumber: null }).label).toBe('Missing PAN');
    expect(kycSummary({ ...base, kind: 'PERMANENT', panDocPath: null }).label).toBe('No PAN card scan');
    expect(kycSummary({ ...base, kind: 'PERMANENT' })).toEqual({ label: 'KYC complete', tone: 'good' });
  });
});

describe('payee details and scans', () => {
  it('checks UPI, IFSC and account numbers', () => {
    expect(upiError('ramesh@okaxis')).toBeNull();
    expect(upiError('ramesh')).not.toBeNull();
    expect(ifscError('HDFC0001234')).toBeNull();
    expect(ifscError('HDFC1001234')).not.toBeNull();
    expect(accountNumberError('123456789012')).toBeNull();
    expect(accountNumberError('1234')).not.toBeNull();
  });
  it('takes JPG, PNG, WebP or PDF up to 3.8 MB', () => {
    expect(kycFileError({ type: 'image/jpeg', size: 1000 })).toBeNull();
    expect(kycFileError({ type: 'application/pdf', size: KYC_MAX_BYTES })).toBeNull();
    expect(kycFileError({ type: 'image/gif', size: 1000 })).not.toBeNull();
    expect(kycFileError({ type: 'image/png', size: KYC_MAX_BYTES + 1 })).not.toBeNull();
    expect(kycFileError({ type: 'image/png', size: 0 })).not.toBeNull();
  });
});
