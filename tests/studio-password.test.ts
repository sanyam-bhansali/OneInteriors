import { describe, expect, it } from 'vitest';
import { REFUSAL_WORDS, studioSignInMode, temporaryPassword } from '@/modules/auth/studio-password-rules';
import { decideSignIn, MAX_FAILURES } from '@/modules/auth/password';
import { mayOpen, PASSWORD_PATH } from '@/modules/studio/surfaces';
import { SI_WORDS } from '@/app/studio-sign-in/words';
import type { StudioRoleName } from '@/modules/studio/roles';

/** Password sign-in for studio staff (owner, 27 Oct 2026), until WhatsApp codes are live. */

describe('which sign-in the studio uses', () => {
  it('password unless STUDIO_SIGN_IN=otp', () => {
    expect(studioSignInMode({})).toBe('password');
    expect(studioSignInMode({ STUDIO_SIGN_IN: 'password' })).toBe('password');
    expect(studioSignInMode({ STUDIO_SIGN_IN: ' OTP ' })).toBe('otp');
    expect(studioSignInMode({ STUDIO_SIGN_IN: 'whatever' })).toBe('password');
  });
});

describe('a one-time password', () => {
  it('is three groups of four, with no look-alike characters', () => {
    for (let i = 0; i < 200; i++) {
      const p = temporaryPassword();
      expect(p).toMatch(/^[a-km-np-z2-9]{4}-[a-km-np-z2-9]{4}-[a-km-np-z2-9]{4}$/);
      expect(p).not.toMatch(/[01ilo]/);
    }
  });

  it('comes from the picker it is given', () => {
    expect(temporaryPassword(() => 0)).toBe('aaaa-aaaa-aaaa');
  });

  it('is not the same twice', () => {
    expect(new Set(Array.from({ length: 50 }, () => temporaryPassword())).size).toBe(50);
  });
});

describe('the lock', () => {
  const user = (failed: number, locked = false) => ({ role: 'STUDIO', passwordHash: 'h', failedSignIns: failed, lockedOutAt: locked ? new Date() : null });

  it('locks on the fifth wrong try and refuses after', () => {
    expect(decideSignIn(user(MAX_FAILURES - 2), false)).toEqual({ kind: 'wrong', remaining: 1, nowLocked: false });
    expect(decideSignIn(user(MAX_FAILURES - 1), false)).toEqual({ kind: 'wrong', remaining: 0, nowLocked: true });
    expect(decideSignIn(user(MAX_FAILURES, true), true)).toEqual({ kind: 'refused' });
  });
});

describe('words', () => {
  it('every refusal is said in English, Hindi and Marathi on the sign-in page', () => {
    for (const k of Object.keys(REFUSAL_WORDS)) {
      const w = (SI_WORDS as Record<string, { en: string; hi: string; mr: string }>)[`pw.err.${k}`];
      expect(w, k).toBeTruthy();
      expect(w!.en && w!.hi && w!.mr, k).toBeTruthy();
    }
  });
});

describe('choosing your own password', () => {
  it('every active role opens it, even a supervisor and a studio without the full software', () => {
    for (const role of ['OWNER', 'PM', 'SALES', 'DESIGNER', 'ACCOUNTS', 'SUPERVISOR'] as StudioRoleName[]) {
      expect(mayOpen({ role, status: 'ACTIVE', fullSoftware: true }, PASSWORD_PATH), role).toBe(true);
      expect(mayOpen({ role, status: 'ACTIVE', fullSoftware: false }, PASSWORD_PATH), role).toBe(true);
    }
    expect(mayOpen({ role: 'DESIGNER', status: 'SUSPENDED' }, PASSWORD_PATH)).toBe(false);
  });
});
