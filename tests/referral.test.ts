import { describe, it, expect } from 'vitest';
import { cleanCode, counts, CODE_RE, makeCode } from '@/modules/portal/referral';
import { BENEFITS, referralsLive } from '@/modules/portal/benefits';

describe('referral codes', () => {
  it('are the first name and four unambiguous characters', () => {
    const code = makeCode('Sanyam Bhansali', new Uint8Array([0, 1, 2, 3]));
    expect(code).toBe('SANYAM-ABCD');
    expect(CODE_RE.test(makeCode('Priya', new Uint8Array([200, 90, 31, 7])))).toBe(true);
    expect(makeCode(null, new Uint8Array([0, 0, 0, 0]))).toBe('HOME-AAAA');
    expect(makeCode('अनु', new Uint8Array([1, 1, 1, 1]))).toBe('HOME-BBBB');
  });

  it('are read back case-insensitively, and only if they could be ours', () => {
    expect(cleanCode(' sanyam-abcd ')).toBe('SANYAM-ABCD');
    expect(cleanCode('SANYAM-AB0D')).toBeNull();
    expect(cleanCode('<script>')).toBeNull();
  });

  it('never count for their owner', () => {
    expect(counts('u1', 'u1')).toBe(false);
    expect(counts('u1', 'u2')).toBe(true);
    expect(counts('u1', null)).toBe(true);
  });

  it('stay off every screen until the benefit has terms', () => {
    const without = BENEFITS.map((b) => (b.id === 'referral' ? { ...b, terms: null } : b));
    const withTerms = BENEFITS.map((b) => (b.id === 'referral' ? { ...b, terms: 'Refer a friend…' } : b));
    expect(referralsLive(without)).toBe(false);
    expect(referralsLive(withTerms)).toBe(true);
  });
});
