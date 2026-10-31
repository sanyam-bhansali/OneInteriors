import { describe, expect, it } from 'vitest';
import { codeFromPaste, CUSTOMER_REFUSAL_WORDS, decideCustomerSignIn } from '@/modules/auth/customer-password-rules';

/**
 * The clients' password sign-in (owner, 1 Nov 2026): the same five-try lock
 * as staff, and "Connect your project" reading a pasted link or a typed code.
 */
describe('client password sign-in', () => {
  const user = { passwordHash: 'h', failedSignIns: 0, lockedOutAt: null as Date | null };

  it('lets the right password in', () => {
    expect(decideCustomerSignIn(user, true)).toEqual({ kind: 'ok' });
  });

  it('says what to do when there is no password or it is locked, before looking at it', () => {
    expect(decideCustomerSignIn({ ...user, passwordHash: null }, true)).toEqual({ kind: 'refused', reason: 'no_password' });
    expect(decideCustomerSignIn({ ...user, lockedOutAt: new Date() }, true)).toEqual({ kind: 'refused', reason: 'locked' });
  });

  it('locks on the fifth wrong try, not before', () => {
    expect(decideCustomerSignIn({ ...user, failedSignIns: 3 }, false)).toEqual({ kind: 'wrong', nowLocked: false });
    expect(decideCustomerSignIn({ ...user, failedSignIns: 4 }, false)).toEqual({ kind: 'wrong', nowLocked: true });
  });

  it('points the client at their designer, never at us, for a new password', () => {
    expect(CUSTOMER_REFUSAL_WORDS.no_password).toMatch(/designer/);
    expect(CUSTOMER_REFUSAL_WORDS.locked).toMatch(/designer/);
    expect(Object.values(CUSTOMER_REFUSAL_WORDS).join(' ')).not.toMatch(/WhatsApp/i);
  });
});

describe('connect your project', () => {
  it('reads a pasted link or a typed code the same way', () => {
    const code = 'ABCD2345';
    const fromCode = codeFromPaste(code);
    expect(fromCode).not.toBeNull();
    expect(codeFromPaste(`Hi! Follow your home here: https://app.oneinteriors.in/app/join/${code} — Hauspire`)).toBe(fromCode);
    expect(codeFromPaste(` ${code.toLowerCase()} `)).toBe(fromCode);
  });

  it('refuses what is neither', () => {
    expect(codeFromPaste('')).toBeNull();
    expect(codeFromPaste('hello there')).toBeNull();
    expect(codeFromPaste('https://example.com/whatever')).toBeNull();
  });
});
