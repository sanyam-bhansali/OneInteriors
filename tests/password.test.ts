import { describe, expect, it } from 'vitest';
import {
  MAX_FAILURES,
  canUsePassword,
  decideSignIn,
  hashPassword,
  isLockedOut,
  passwordProblem,
  shouldSetPassword,
  verifyPassword,
} from '@/modules/auth/password';

/**
 * Passwords now guard both staff surfaces: ops, which sees every studio's
 * legal name and GSTIN and every customer's name, phone and email; and each
 * studio account, which sees that practice's entire client list.
 *
 * So the tests here are about the failure modes that do not show up in a
 * browser — a comparison that leaks timing, a lock that counts wrong, a form
 * that quietly tells you which addresses are real.
 */

const GOOD = 'harbour-lantern-quiet-42';

describe('hashing', () => {
  it('round-trips', async () => {
    const h = await hashPassword(GOOD);
    expect(await verifyPassword(GOOD, h)).toBe(true);
  });

  it('rejects the wrong password', async () => {
    const h = await hashPassword(GOOD);
    expect(await verifyPassword('harbour-lantern-quiet-43', h)).toBe(false);
    expect(await verifyPassword('', h)).toBe(false);
  });

  it('salts, so the same password twice gives different hashes', async () => {
    // Otherwise one leaked database is attacked once for every account that
    // happened to choose the same string.
    const [a, b] = await Promise.all([hashPassword(GOOD), hashPassword(GOOD)]);
    expect(a).not.toBe(b);
    expect(await verifyPassword(GOOD, b)).toBe(true);
  });

  it('carries its own cost parameters, so they can be raised later', async () => {
    // Verification reads N/r/p out of the stored hash rather than using the
    // current constants. Without that, raising the cost locks every existing
    // account out of its own password.
    const h = await hashPassword(GOOD);
    const [version, n, r, p] = h.split('$');
    expect(version).toBe('s1');
    expect(Number(n)).toBeGreaterThanOrEqual(16384);
    expect(Number(r)).toBeGreaterThan(0);
    expect(Number(p)).toBeGreaterThan(0);
  });

  it('fails closed on a malformed or tampered hash, never throws', async () => {
    // A corrupted column should drop the user onto the magic link, not 500
    // the sign-in page for everybody.
    for (const bad of ['', 'garbage', 's1$x$y$z$q$w', 's9$32768$8$1$AAAA$BBBB', '$$$$$']) {
      await expect(verifyPassword(GOOD, bad)).resolves.toBe(false);
    }
  });

  it('refuses absurd cost parameters from a tampered row', async () => {
    // scrypt with a huge N is a denial of service we would run against
    // ourselves, once per attempt.
    const h = await hashPassword(GOOD);
    const parts = h.split('$');
    parts[1] = '1073741824';
    await expect(verifyPassword(GOOD, parts.join('$'))).resolves.toBe(false);
  });

  it('normalises unicode, so the same typed password works on any keyboard', async () => {
    // é as one codepoint vs e + combining accent. Without NFKC the user is
    // locked out of their own account depending on the input method.
    const composed = 'café-harbour-lantern';
    const decomposed = 'café-harbour-lantern';
    expect(composed).not.toBe(decomposed);
    const h = await hashPassword(composed);
    expect(await verifyPassword(decomposed, h)).toBe(true);
  });
});

describe('who may use a password at all', () => {
  it('is staff: ops, studios, admins', () => {
    for (const role of ['OPS', 'STUDIO', 'ADMIN']) {
      expect(canUsePassword(role), role).toBe(true);
    }
  });

  it('is never a customer', () => {
    /**
     * A customer signs in rarely, usually once per decision. A password set
     * eight months ago and since forgotten is strictly worse for them than a
     * link — one more thing to fail at before they can see their quotes.
     *
     * The rule lives in the decision, not in the UI. A CUSTOMER row that
     * somehow acquired a passwordHash still cannot sign in with it, because
     * "customers are link-only" has to be a fact about the system rather than
     * a claim about which form renders.
     */
    const customer = {
      role: 'CUSTOMER',
      passwordHash: 'anything',
      failedSignIns: 0,
      lockedOutAt: null,
    };
    expect(canUsePassword('CUSTOMER')).toBe(false);
    expect(decideSignIn(customer, true)).toEqual({ kind: 'refused' });
  });

  it('matches the role exactly, never by case', () => {
    for (const role of ['ops', 'studio', 'Ops', '']) {
      expect(canUsePassword(role), role).toBe(false);
    }
  });
});

describe('being asked to set one, once', () => {
  it('asks a studio with no password yet', () => {
    // This fires on the approval link — the one email a new studio definitely
    // reads, and the only moment we can count on their attention.
    expect(shouldSetPassword({ role: 'STUDIO', passwordHash: null })).toBe(true);
    expect(shouldSetPassword({ role: 'OPS', passwordHash: null })).toBe(true);
  });

  it('stops asking once one is set', () => {
    expect(shouldSetPassword({ role: 'STUDIO', passwordHash: 's1$...' })).toBe(false);
  });

  it('never asks a customer, who would have nowhere to use it', () => {
    expect(shouldSetPassword({ role: 'CUSTOMER', passwordHash: null })).toBe(false);
  });
});

describe('the lockout', () => {
  const ops = { role: 'OPS', passwordHash: 'h', failedSignIns: 0, lockedOutAt: null };

  it('lets a correct password through', () => {
    expect(decideSignIn(ops, true)).toEqual({ kind: 'ok' });
  });

  it('counts down, and locks exactly on the fifth failure', () => {
    // Off by one here is either a lock that never fires, or one that fires on
    // a legitimate typo.
    const seen = [];
    for (let already = 0; already < MAX_FAILURES; already++) {
      const out = decideSignIn({ ...ops, failedSignIns: already }, false);
      expect(out.kind).toBe('wrong');
      if (out.kind !== 'wrong') return;
      seen.push([already + 1, out.remaining, out.nowLocked]);
    }
    expect(seen).toEqual([
      [1, 4, false],
      [2, 3, false],
      [3, 2, false],
      [4, 1, false],
      [5, 0, true],
    ]);
  });

  it('stays shut once locked, whatever the password', () => {
    const locked = { ...ops, lockedOutAt: new Date(), failedSignIns: MAX_FAILURES };
    expect(isLockedOut(locked)).toBe(true);
    // Including a CORRECT password. The lock is cleared by proving control of
    // the mailbox, not by eventually guessing right.
    expect(decideSignIn(locked, true)).toEqual({ kind: 'refused' });
  });

  it('is not time-based', () => {
    /**
     * A fifteen-minute lock is one an attacker waits out, four times an hour,
     * forever. This one holds until a magic link is redeemed — proof of the
     * mailbox, which a password guesser does not have. The operator is never
     * stuck, because the link always works.
     */
    const longAgo = { ...ops, lockedOutAt: new Date('2020-01-01'), failedSignIns: 99 };
    expect(decideSignIn(longAgo, true)).toEqual({ kind: 'refused' });
  });

  it('refuses an account with no password set, without saying so', () => {
    // Same shape as every other refusal — see the enumeration test below.
    expect(decideSignIn({ ...ops, passwordHash: null }, false)).toEqual({ kind: 'refused' });
  });
});

describe('the form cannot be used to enumerate accounts', () => {
  it('answers identically for wrong role, no password, and locked', () => {
    /**
     * If "no such account" and "wrong password" are distinguishable, the sign-in
     * form becomes a tool for discovering which email addresses are staff
     * accounts — and a staff address is worth phishing. All three refusals are
     * one indistinguishable outcome.
     */
    const base = { passwordHash: 'h', failedSignIns: 0, lockedOutAt: null };
    const outcomes = [
      decideSignIn({ ...base, role: 'CUSTOMER' }, false),
      decideSignIn({ ...base, role: 'OPS', passwordHash: null }, false),
      decideSignIn({ ...base, role: 'OPS', lockedOutAt: new Date() }, false),
    ];
    for (const o of outcomes) expect(o).toEqual({ kind: 'refused' });
  });
});

describe('what may be set as a password', () => {
  it('accepts a reasonable one', () => {
    expect(passwordProblem(GOOD)).toBeNull();
  });

  it('requires length over composition', () => {
    // Composition rules produce Password1! and a sticky note. Length is what
    // costs a guesser time.
    expect(passwordProblem('Ab3$xY')).toMatch(/12 characters/);
    expect(passwordProblem('correct horse battery staple')).toBeNull();
  });

  it('rejects the product name, which is what gets tried first', () => {
    expect(passwordProblem('OneInteriors24@')).toMatch(/guessable/i);
    expect(passwordProblem('oneinteriors2026!')).toMatch(/guessable/i);
  });

  it('rejects the usual suspects', () => {
    for (const bad of ['passwordpassword', 'qwertyqwerty123', 'letmein12345678']) {
      expect(passwordProblem(bad), bad).toMatch(/guessable/i);
    }
  });

  it('rejects a long string of almost nothing', () => {
    expect(passwordProblem('aaaaaaaaaaaaaaaa')).toMatch(/different characters/);
  });

  it('catches a leading or trailing space, which is invisible and permanent', () => {
    expect(passwordProblem(` ${GOOD}`)).toMatch(/space/);
    expect(passwordProblem(`${GOOD} `)).toMatch(/space/);
  });
});
