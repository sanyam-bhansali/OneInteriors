/**
 * Passwords, for ops accounts only.
 *
 * No `server-only` — CONTRIBUTING §9.5. Every decision here is pure, and these
 * are the decisions worth testing exhaustively, because none of them fail
 * visibly. A hash comparison that leaks timing, a lockout that counts wrong, a
 * form that says "no such user" — all three look perfectly fine in a browser.
 *
 * ## Why passwords exist here at all, given magic links work
 *
 * They exist because magic links have a single point of failure that this
 * system has already hit: **if email breaks, nobody can reach ops.** That is
 * not hypothetical — `EMAIL_FROM` pointed at a sandbox sender for weeks and
 * every outbound message 403'd. During that window the console was
 * unreachable, and the console is where you go to find out why things are
 * broken.
 *
 * So a password is a second door. It is not a better door.
 *
 * ## Why only ops
 *
 * Adding a password to an account is adding a thing that can be guessed,
 * reused from a breached site, or phished. That trade is worth it for one or
 * two accounts the operator controls and needs under any conditions. It is not
 * worth it across every studio owner, where it would also make us the people
 * who run password resets for a hundred small businesses.
 *
 * Studios stay magic-link-only. `canUsePassword` is the one place that rule
 * lives.
 *
 * ## scrypt, from node:crypto
 *
 * Argon2id would be the better primitive, and it is a native dependency to
 * install, patch and keep building on Vercel's runtime. scrypt is memory-hard,
 * in the standard library, and its parameters are tunable — which is enough
 * for a handful of operator accounts behind a five-attempt lock. The hash
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

/** Who may sign in with a password at all. */
export function canUsePassword(role: string): boolean {
  return role === 'OPS';
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
