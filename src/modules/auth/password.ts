/**
 * Passwords, for staff accounts.
 *
 * No `server-only` — CONTRIBUTING §9.5. Every decision here is pure, and these
 * are the decisions worth testing exhaustively, because none of them fail
 * visibly. A hash comparison that leaks timing, a lockout that counts wrong, a
 * form that says "no such user" — all three look perfectly fine in a browser.
 *
 * ## Why passwords exist here at all, given magic links work
 *
 * Two reasons, and they are different for the two audiences.
 *
 * For **ops**, it is a second door. Magic links have a single point of failure
 * this project has already hit: `EMAIL_FROM` pointed at a sandbox sender and
 * every outbound message 403'd, so for that whole window the console was
 * unreachable — and the console is where you go to find out why things are
 * broken.
 *
 * For **studios**, it is about the daily cost. A studio owner signs in to work,
 * repeatedly, often from a site visit on a phone. An emailed link means leaving
 * the app, finding an inbox, waiting, coming back — every single time. That is
 * a toll on the people we are asking to run their practice here.
 *
 * ## Why customers are not included
 *
 * A customer signs in rarely, usually once per decision. A password they set
 * eight months ago and have since forgotten is strictly worse for them than a
 * link: it is one more thing to fail at before they can see their quotes. They
 * keep the WhatsApp OTP and the emailed link.
 *
 * `canUsePassword` is the one place that line is drawn.
 *
 * ## scrypt, from node:crypto
 *
 * Argon2id would be the better primitive, and it is a native dependency to
 * install, patch and keep building on Vercel's runtime. scrypt is memory-hard,
 * in the standard library, and its parameters are tunable — which is enough
 * behind a five-attempt lock that needs a mailbox to lift. The hash
 * format is versioned precisely so the cost can be raised later without
 * invalidating anyone.
 */

import {
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';
import { promisify } from 'node:util';

/**
 * `promisify` picks the 3-argument overload, which drops the options object —
 * and the options object is where N, r and p live, so without this cast the
 * cost parameters are silently ignored and every hash is made at Node's
 * defaults. Typed explicitly rather than left to inference.
 */
const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options?: ScryptOptions,
) => Promise<Buffer>;

/**
 * Cost parameters.
 *
 * N=2^15 with r=8 is roughly 32 MB and ~100ms on a modern server — slow enough
 * that guessing is painful, fast enough that a sign-in does not feel broken.
 * `maxmem` must be raised explicitly or Node refuses N this large with its
 * 32 MB default.
 */
const PARAMS = { N: 32768, r: 8, p: 1, keylen: 64, maxmem: 64 * 1024 * 1024 } as const;

/** Bumped when PARAMS change, so old hashes stay verifiable. */
const VERSION = 's1';

/**
 * Five, then the door closes.
 *
 * Low on purpose. A legitimate operator who has forgotten their password is
 * one click from a magic link, so the cost of locking early is a minor
 * inconvenience; the cost of locking late is that every studio's GSTIN and
 * every customer's phone number is behind a guessable string.
 */
export const MAX_FAILURES = 5;

export interface PasswordFields {
  passwordHash: string | null;
  failedSignIns: number;
  lockedOutAt: Date | null;
}

/**
 * Who may sign in with a password at all.
 *
 * Staff accounts — the people who sign in to work, repeatedly, often from a
 * site visit on a phone. For them the emailed link is friction on every single
 * sign-in: leave the app, find the inbox, wait, come back.
 *
 * **Customers are deliberately not here.** They sign in rarely, usually once
 * per decision, and a password they set eight months ago and have since
 * forgotten is worse for them than a link — it is a thing to fail at before
 * they can see their quotes. They keep the WhatsApp OTP and the link.
 */
const PASSWORD_ROLES = ['OPS', 'STUDIO', 'ADMIN'] as const;

export function canUsePassword(role: string): boolean {
  return (PASSWORD_ROLES as readonly string[]).includes(role);
}

/**
 * Should this account be asked to set a password before going anywhere else?
 *
 * True exactly once: the first time a staff account redeems a link and has no
 * password yet. That first link is the approval email, so the question arrives
 * at the one moment the studio is already paying attention to us.
 */
export function shouldSetPassword(user: { role: string; passwordHash: string | null }): boolean {
  return canUsePassword(user.role) && user.passwordHash === null;
}

/**
 * Hash a password. Returns `s1$N$r$p$salt$hash`, all base64url.
 *
 * The salt is per-password and stored alongside, which is the point: two
 * accounts choosing the same password get different hashes, so a leaked
 * database cannot be attacked once for everybody.
 */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(plain.normalize('NFKC'), salt, PARAMS.keylen, {
    N: PARAMS.N,
    r: PARAMS.r,
    p: PARAMS.p,
    maxmem: PARAMS.maxmem,
  })) as Buffer;

  return [
    VERSION,
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString('base64url'),
    derived.toString('base64url'),
  ].join('$');
}

/**
 * Verify a password against a stored hash.
 *
 * Reads the cost parameters back out of the hash rather than using the current
 * constants, so raising PARAMS later does not lock everybody out of their own
 * accounts — the old hashes still verify with the parameters they were made
 * with.
 *
 * Returns false rather than throwing on a malformed hash. A corrupted column
 * should fail closed and let the magic link through, not 500 the sign-in page.
 */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== VERSION) return false;

  const [, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts as [
    string, string, string, string, string, string,
  ];
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  /* Refuse absurd parameters from a tampered row: scrypt with a huge N is a
     denial of service against ourselves, paid for on every attempt. */
  if (N > PARAMS.N || r > 16 || p > 4) return false;

  let expected: Buffer;
  let actual: Buffer;
  try {
    expected = Buffer.from(hashRaw, 'base64url');
    actual = (await scrypt(plain.normalize('NFKC'), Buffer.from(saltRaw, 'base64url'), expected.length, {
      N, r, p, maxmem: PARAMS.maxmem,
    })) as Buffer;
  } catch {
    return false;
  }

  if (expected.length !== actual.length || expected.length === 0) return false;
  return timingSafeEqual(expected, actual);
}

/**
 * Is this account currently barred from password sign-in?
 *
 * Deliberately NOT time-based. A fifteen-minute lock is a lock an attacker
 * waits out, four times an hour, forever. This one stays shut until the
 * account holder proves control of the mailbox by redeeming a magic link —
 * which is the same proof the account was created with, and which no attacker
 * who only has the password has.
 *
 * So the operator is never locked out (the link always works) and the guesser
 * is stopped permanently rather than briefly.
 */
export function isLockedOut(user: Pick<PasswordFields, 'lockedOutAt'>): boolean {
  return user.lockedOutAt !== null;
}

export type SignInOutcome =
  | { kind: 'ok' }
  /** Wrong password, and how many tries are left before the lock. */
  | { kind: 'wrong'; remaining: number; nowLocked: boolean }
  /** No password set, wrong role, or already locked — all answered identically. */
  | { kind: 'refused' };

/**
 * The decision, given what the database holds and whether the hash matched.
 *
 * Split out from the database work so the counting rules can be tested without
 * a Postgres instance, because the counting rules are where this goes wrong:
 * an off-by-one here is either a lock that never fires or one that fires on a
 * legitimate typo.
 */
export function decideSignIn(
  user: PasswordFields & { role: string },
  passwordMatched: boolean,
): SignInOutcome {
  if (!canUsePassword(user.role)) return { kind: 'refused' };
  if (!user.passwordHash) return { kind: 'refused' };
  if (isLockedOut(user)) return { kind: 'refused' };

  if (passwordMatched) return { kind: 'ok' };

  const failures = user.failedSignIns + 1;
  const nowLocked = failures >= MAX_FAILURES;
  return { kind: 'wrong', remaining: Math.max(0, MAX_FAILURES - failures), nowLocked };
}

/**
 * Is this password acceptable to set?
 *
 * Length first, and length mostly. Composition rules ("one capital, one
 * symbol") push people toward `Password1!` and a sticky note; length is what
 * actually costs a guesser time. Twelve characters with a five-attempt lock in
 * front of it is not the weak link in this system.
 *
 * The rejected-list is short and specific: the things someone would plausibly
 * type for THIS product, which are exactly the things an attacker guesses
 * first.
 */
export function passwordProblem(plain: string): string | null {
  const p = plain.normalize('NFKC');
  if (p.length < 12) return 'Use at least 12 characters.';
  if (p.length > 200) return 'That is longer than 200 characters.';
  if (p.trim().length !== p.length) return 'Remove the space at the start or end.';

  const flat = p.toLowerCase().replace(/[^a-z0-9]/g, '');
  const OBVIOUS = ['oneinteriors', 'password', 'qwerty', 'admin', 'letmein', '123456'];
  if (OBVIOUS.some((bad) => flat.includes(bad))) {
    return 'That contains something guessable. Avoid the product name and common words.';
  }
  if (new Set(p).size < 5) return 'Use a few more different characters.';
  return null;
}
