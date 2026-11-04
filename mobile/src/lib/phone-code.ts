import { Platform } from 'react-native';
import { api, call, type Result } from './api';
import { SAMPLE } from './sample';

/**
 * Send a sign-in code and check it, for every customer sign-in in the app.
 *
 * Firebase sends the SMS (owner, 4 Nov 2026) when the build carries its
 * config (app.config.ts adds it when google-services.json is supplied). The
 * app proves the number with Firebase, then trades Firebase's token for one
 * of our sessions at POST /auth/firebase, so the person has the same account,
 * and the same Home Profile, as on the website.
 *
 * Without Firebase in the build (the web preview, sample mode, a build made
 * before the config existed) the older path runs: our own code, by
 * /auth/otp/request and /auth/otp/verify.
 */

type Confirmation = { confirm(code: string): Promise<{ user: { getIdToken(): Promise<string> } } | null> };
type FirebaseAuthModule = {
  getAuth(): unknown;
  signInWithPhoneNumber(auth: unknown, phone: string): Promise<Confirmation>;
  signOut(auth: unknown): Promise<void>;
};

let cached: FirebaseAuthModule | null | undefined;

function firebaseAuth(): FirebaseAuthModule | null {
  if (cached !== undefined) return cached;
  cached = null;
  if (SAMPLE || Platform.OS === 'web') return cached;
  try {
    // Lazy: a build without the native module must still open.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const app = require('@react-native-firebase/app') as { getApps(): unknown[] };
    if (app.getApps().length === 0) return cached;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('@react-native-firebase/auth') as FirebaseAuthModule;
  } catch {
    cached = null;
  }
  return cached;
}

let pending: { phone: string; confirmation: Confirmation } | null = null;

function firebaseError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  if (code.includes('invalid-phone-number')) return 'That does not look like an Indian mobile number.';
  if (code.includes('too-many-requests') || code.includes('quota-exceeded')) return 'Too many codes requested. Try again in a little while.';
  if (code.includes('invalid-verification-code')) return 'That code is not right. Check the message and try again.';
  if (code.includes('session-expired') || code.includes('code-expired')) return 'That code has expired. Ask for a new one.';
  if (code.includes('network-request-failed')) return 'No connection. Check your internet and try again.';
  return 'We could not send the code. Try again in a minute.';
}

/** `phone` is +91 and ten digits. */
export async function sendPhoneCode(phone: string, name: string): Promise<Result<{ devCode?: string }>> {
  const fb = firebaseAuth();
  if (!fb) return api.requestCode(phone, name);
  try {
    const confirmation = await fb.signInWithPhoneNumber(fb.getAuth(), phone);
    pending = { phone, confirmation };
    return { ok: true, data: {} };
  } catch (error) {
    return { ok: false, status: 400, error: firebaseError(error) };
  }
}

/**
 * Check the code and get our session token. `extra` is the first visit's
 * Home Profile and consent, saved onto the account in the same call.
 */
export async function confirmPhoneCode(
  phone: string,
  code: string,
  name: string,
  extra?: { brief: unknown; consent: { share: boolean; offers: boolean } },
): Promise<Result<{ token: string }>> {
  const fb = firebaseAuth();
  if (!fb) {
    return extra
      ? call<{ token: string }>('POST', '/auth/otp/verify', { phone, code, name, ...extra })
      : api.verifyCode(phone, code, name);
  }
  if (!pending || pending.phone !== phone) return { ok: false, status: 400, error: 'Ask for a new code and try again.' };
  try {
    const credential = await pending.confirmation.confirm(code);
    if (!credential) return { ok: false, status: 400, error: 'Ask for a new code and try again.' };
    const idToken = await credential.user.getIdToken();
    const res = await call<{ token: string }>('POST', '/auth/firebase', { idToken, phone, name, ...(extra ?? {}) });
    if (res.ok) {
      pending = null;
      // Our session is the sign-in from here on.
      await fb.signOut(fb.getAuth()).catch(() => {});
    }
    return res;
  } catch (error) {
    return { ok: false, status: 400, error: firebaseError(error) };
  }
}
