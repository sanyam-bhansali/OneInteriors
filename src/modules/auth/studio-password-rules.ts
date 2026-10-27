/**
 * Studio password sign-in — the rules (owner, 27 Oct 2026). Pure, tested in
 * tests/studio-password.test.ts; the reads and writes are studio-password.ts.
 *
 * Until the company is registered and WhatsApp codes are live, everyone at a
 * studio signs in with their mobile number and a password. Staff have no
 * email, so nobody can mail them a link: the owner makes a one-time password
 * in Settings, Team, hands it over, and the person chooses their own the
 * first time they sign in. `STUDIO_SIGN_IN=otp` brings the WhatsApp code back.
 */

import { randomInt } from 'node:crypto';

export type StudioSignInMode = 'password' | 'otp';

/** Password unless `STUDIO_SIGN_IN=otp` is set. */
export function studioSignInMode(env: Record<string, string | undefined> = process.env): StudioSignInMode {
  return env.STUDIO_SIGN_IN?.trim().toLowerCase() === 'otp' ? 'otp' : 'password';
}

/** No 0/o, 1/l/i: read aloud or typed off a phone screen without a mix-up. */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/**
 * A one-time password: three groups of four, "k7mp-x3dq-9fhw". About 59 bits:
 * far past guessing behind a five-try lock, short enough to read out.
 */
export function temporaryPassword(pick: (n: number) => number = randomInt): string {
  const group = () => Array.from({ length: 4 }, () => ALPHABET[pick(ALPHABET.length)]).join('');
  return [group(), group(), group()].join('-');
}

export type StudioPasswordRefusal = 'invalid_phone' | 'no_match' | 'no_password' | 'locked' | 'suspended' | 'rate_limited' | 'unavailable';

/**
 * What a refused sign-in says. A wrong number and a wrong password read the
 * same; "no password yet" and "locked" say what to do, because the person
 * cannot fix either alone: the owner makes a new one-time password.
 */
export const REFUSAL_WORDS: Record<StudioPasswordRefusal, string> = {
  invalid_phone: 'That is not a mobile number. Ten digits, starting 6 to 9.',
  no_match: 'That mobile number and password did not match.',
  no_password: 'You have no password yet. Ask your studio owner to make one for you in Settings, Team.',
  locked: 'Locked after five wrong tries. Ask your studio owner to make you a new password in Settings, Team.',
  suspended: 'Your studio owner has paused your access. Ask them to reinstate you.',
  rate_limited: 'Too many tries from here. Wait a few minutes and try again.',
  unavailable: 'Sign-in is not working right now. This is our problem, not yours. Try again shortly.',
};
