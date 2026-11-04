'use client';

/**
 * Send a sign-in code to a phone and check it, on the website.
 *
 * Firebase sends the SMS when the project's web config is set (owner,
 * 4 Nov 2026); otherwise the older path runs (our own code, shown on screen
 * in local development). Every form that signs a customer in calls these two
 * functions, so the sign-in page, the Home Profile and the expert booking
 * cannot drift apart.
 *
 * With Firebase: `send` asks Firebase for the SMS behind an invisible
 * reCAPTCHA, `check` confirms the code with Firebase and hands its ID token to
 * our server, which opens our own session. Firebase's own sign-in is then
 * dropped; the person is signed in with us.
 */

import { normalisePhone } from '@/modules/studio/phone';
import { firebaseSignInAction, requestOtpAction, verifyOtpAction } from '@/app/sign-in/actions';
import type { ConfirmationResult } from 'firebase/auth';

export type SendResult = { ok: true; devCode?: string } | { ok: false; error: string };
export type CheckResult = { ok: true } | { ok: false; error: string };

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function firebaseOn(): boolean {
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
}

/** The code Firebase sent, waiting for the person to type it. One at a time. */
let pending: { phone: string; result: ConfirmationResult } | null = null;
let verifier: { clear(): void } | null = null;

async function firebaseAuth() {
  const [{ initializeApp, getApps }, auth] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
  const app = getApps()[0] ?? initializeApp(config);
  const a = auth.getAuth(app);
  a.languageCode = 'en';
  return { a, auth };
}

function firebaseError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  if (code === 'auth/invalid-phone-number') return 'That does not look like an Indian mobile number.';
  if (code === 'auth/too-many-requests' || code === 'auth/quota-exceeded') return 'Too many codes requested. Try again in a little while.';
  if (code === 'auth/invalid-verification-code') return 'That code is not right. Check the message and try again.';
  if (code === 'auth/code-expired') return 'That code has expired. Ask for a new one.';
  if (code === 'auth/network-request-failed') return 'No connection. Check your internet and try again.';
  return 'We could not send the code. Try again in a minute.';
}

export async function sendPhoneCode(phone: string, name: string): Promise<SendResult> {
  if (!firebaseOn()) return requestOtpAction(phone, name);

  const e164 = normalisePhone(phone);
  if (!e164) return { ok: false, error: 'That does not look like an Indian mobile number.' };

  try {
    const { a, auth } = await firebaseAuth();
    // A fresh invisible check for every send: a used one cannot be reused.
    verifier?.clear();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const v = new auth.RecaptchaVerifier(a, host, { size: 'invisible' });
    verifier = { clear: () => { v.clear(); host.remove(); } };
    const result = await auth.signInWithPhoneNumber(a, e164, v);
    pending = { phone: e164, result };
    return { ok: true };
  } catch (error) {
    console.error('[sign-in] firebase send failed:', error);
    return { ok: false, error: firebaseError(error) };
  }
}

export async function checkPhoneCode(phone: string, code: string, name: string | null): Promise<CheckResult> {
  if (!firebaseOn()) return verifyOtpAction(phone, code, name);

  const e164 = normalisePhone(phone);
  if (!pending || pending.phone !== e164) return { ok: false, error: 'Ask for a new code and try again.' };

  try {
    const credential = await pending.result.confirm(code);
    const idToken = await credential.user.getIdToken();
    const signedIn = await firebaseSignInAction(idToken, name);
    if (signedIn.ok) {
      pending = null;
      verifier?.clear();
      verifier = null;
      // Our session is the sign-in from here on; Firebase's is not needed.
      const { a } = await firebaseAuth();
      await a.signOut().catch(() => {});
    }
    return signedIn;
  } catch (error) {
    return { ok: false, error: firebaseError(error) };
  }
}
