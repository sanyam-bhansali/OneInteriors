/**
 * Client password sign-in — the rules (owner, 1 Nov 2026). Pure, tested in
 * tests/customer-password.test.ts; the reads and writes are
 * customer-password.ts.
 *
 * A studio's client signs in to the project app with their mobile number and
 * a password until WhatsApp or SMS codes are live, as studio staff have since
 * 27 Oct (studio-password-rules.ts). The studio makes a one-time password from
 * the project page and hands it over itself; the client chooses their own on
 * first sign-in. Customers never get WhatsApp from us, so nothing is sent.
 *
 * Kept apart from password.ts on purpose: `canUsePassword` keeps customers
 * off the emailed-password sign-in, and that stays true. This door is for a
 * client with a studio-made password only, by mobile number.
 */

import { MAX_FAILURES } from './password';
import { cleanCode } from '@/modules/project/own-project-rules';

export type CustomerPasswordRefusal = 'invalid_phone' | 'no_match' | 'no_password' | 'locked' | 'rate_limited' | 'unavailable';

/**
 * What a refused sign-in says. A wrong number and a wrong password read the
 * same. "No password yet" and "locked" say what to do, because the client
 * cannot fix either alone: the studio makes a new one-time password.
 */
export const CUSTOMER_REFUSAL_WORDS: Record<CustomerPasswordRefusal, string> = {
  invalid_phone: 'That is not a mobile number. Ten digits, starting 6 to 9.',
  no_match: 'That mobile number and password did not match.',
  no_password: 'You have no password yet. Ask your designer for a one-time password.',
  locked: 'Locked after five wrong tries. Ask your designer for a new one-time password.',
  rate_limited: 'Too many tries from here. Wait a few minutes and try again.',
  unavailable: 'Sign-in is not working right now. This is our problem, not yours. Try again shortly.',
};

export type CustomerSignInOutcome = { kind: 'ok' } | { kind: 'refused'; reason: 'no_password' | 'locked' } | { kind: 'wrong'; nowLocked: boolean };

/** The same five-try lock as staff. Refused before the password is looked at when there is none or it is locked. */
export function decideCustomerSignIn(user: { passwordHash: string | null; failedSignIns: number; lockedOutAt: Date | null }, matched: boolean): CustomerSignInOutcome {
  if (!user.passwordHash) return { kind: 'refused', reason: 'no_password' };
  if (user.lockedOutAt) return { kind: 'refused', reason: 'locked' };
  if (matched) return { kind: 'ok' };
  return { kind: 'wrong', nowLocked: user.failedSignIns + 1 >= MAX_FAILURES };
}

/** A pasted invite link or a typed code, as the code ("…/app/join/ab12-cd34" → "AB12CD34"); null when neither. */
export function codeFromPaste(raw: string): string | null {
  const s = String(raw ?? '').trim().slice(0, 300);
  const fromLink = /\/app\/join\/([A-Za-z0-9-]+)/.exec(s);
  return cleanCode(fromLink ? fromLink[1]! : s);
}
