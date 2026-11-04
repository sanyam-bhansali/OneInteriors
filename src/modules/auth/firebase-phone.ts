import 'server-only';

/**
 * Customer sign-in with a Firebase SMS code (owner, 4 Nov 2026).
 *
 * Firebase sends the code to the phone and checks it in the browser or the
 * app; we receive its ID token, check that ourselves (firebase-token.ts) and
 * then do exactly what our own code path does once a number is proved: find
 * or create the CUSTOMER behind it (`customerForVerifiedPhone`) and open one
 * of our sessions. Nothing about Firebase outlives this call: the person is
 * signed in with our session, on the website and in the app alike, so their
 * Home Profile comes back whenever they sign in with that number again.
 */

import { prisma } from '@/lib/prisma';
import { firebaseProjectId } from '@/lib/env';
import { normalisePhone } from '@/modules/studio/phone';
import { createSession, type SessionMeta } from './session';
import { customerForVerifiedPhone } from './otp';
import { cleanName, isValidName } from './otp-code';
import { verifyFirebaseToken, type KeySource } from './firebase-token';

export type FirebaseSignInResult =
  | { ok: true; userId: string; token?: string }
  | { ok: false; reason: 'not_configured' | 'invalid_token' | 'invalid_phone' | 'deleted' };

export async function signInWithFirebasePhone(
  idToken: string,
  rawName: string | null,
  meta: SessionMeta = {},
  keys?: KeySource,
): Promise<FirebaseSignInResult> {
  const projectId = firebaseProjectId();
  if (!projectId) return { ok: false, reason: 'not_configured' };

  const checked = await verifyFirebaseToken(idToken.trim(), projectId, keys);
  if (!checked.ok) return { ok: false, reason: 'invalid_token' };

  // Indian numbers only, the same rule as every other door.
  const phone = normalisePhone(checked.phone);
  if (!phone) return { ok: false, reason: 'invalid_phone' };

  const name = rawName && isValidName(rawName) ? cleanName(rawName) : null;
  const userId = await prisma.$transaction((tx) => customerForVerifiedPhone(tx, phone, name));
  if (!userId) return { ok: false, reason: 'deleted' };

  const token = await createSession(userId, meta);
  return meta.bearer ? { ok: true, userId, token } : { ok: true, userId };
}

export function firebaseSignInMessage(reason: Exclude<FirebaseSignInResult, { ok: true }>['reason']): string {
  return reason === 'invalid_phone'
    ? 'That does not look like an Indian mobile number.'
    : reason === 'not_configured'
      ? 'Sign-in is temporarily unavailable. This is our problem, not yours — try again shortly.'
      : 'That sign-in did not go through. Ask for a new code and try again.';
}
