'use server';

import { headers } from 'next/headers';
import { requestMagicLink } from '@/modules/auth/magic-link';
import { requestOtp, verifyOtp } from '@/modules/auth/otp';
import { signInWithPassword } from '@/modules/auth/password-signin';
import { signOut } from '@/modules/auth/session';
import { redirect } from 'next/navigation';
import { siteUrlForHost } from '@/lib/site';
import { hasDatabase } from '@/lib/env';
import { claimBrief } from '@/modules/brief/repository';
import { claimConsent } from '@/modules/consent/record';
import { record } from '@/modules/analytics/record';

export interface SignInState {
  status: 'idle' | 'sent' | 'error';
  message?: string;
  /** Development only — the link, when no email provider is configured. */
  devLink?: string;
}

export async function requestSignInLink(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get('email') ?? '');
  const h = await headers();

  // Sign-in is the one form where a 500 is unrecoverable for the person using
  // it: they have no way to tell a broken deployment from a mistyped address,
  // so they retype the address and it fails again. Any infrastructure problem
  // has to come back as a sentence.
  if (!hasDatabase()) {
    console.error('[sign-in] DATABASE_URL is not set on this deployment.');
    return {
      status: 'error',
      message: 'Sign-in is temporarily unavailable. This is our problem, not yours — try again shortly.',
    };
  }

  let result: Awaited<ReturnType<typeof requestMagicLink>>;
  try {
    result = await requestMagicLink(email, {
      ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      /* Back to the host they signed in FROM.
         Sessions are host-only, so a studio owner who signs in at
         studio.oneinteriors.in must be returned there — a link to the apex
         would write a cookie the studio host cannot read, and they would be
         asked to sign in again with nothing on screen explaining why.

         The header is already in scope for the IP above, and it is the
         request's own host rather than anything the form supplied. */
      baseUrl: siteUrlForHost(h.get('host')),
      // Carried into the emailed link so the customer lands back where they
      // were, not on the homepage. Validated inside requestMagicLink.
      next: String(formData.get('next') ?? '') || null,
    });
  } catch (error) {
    // The real reason goes to the server log, where it is diagnosable. The
    // customer gets something they can act on, and never a stack trace.
    console.error('[sign-in] requestMagicLink threw:', error);
    return {
      status: 'error',
      message: 'Sign-in is temporarily unavailable. This is our problem, not yours — try again shortly.',
    };
  }

  if (!result.ok) {
    return {
      status: 'error',
      message:
        result.reason === 'invalid_email'
          ? "That doesn't look like an email address."
          : 'Too many attempts. Try again in fifteen minutes.',
    };
  }

  // Deliberately identical whether or not an account exists — the response
  // must not be usable to enumerate who works here.
  return {
    status: 'sent',
    message: 'If that address has an account, a sign-in link is on its way. It expires in 15 minutes.',
    devLink: result.devLink,
  };
}

export async function signOutAction(): Promise<void> {
  await signOut();
  redirect('/');
}

// ── Staff sign-in: email + password ────────────────────────────
//
// Studios and ops. For ops it is a second door, because a magic link is only
// as available as outbound email — and when email broke, the console you would
// use to find out why was unreachable. For studios it is the daily path: they
// sign in to work, repeatedly, often from a site visit, and an emailed link
// means leaving the app every single time.
//
// Customers are excluded, enforced on the role in modules/auth/password.ts —
// not here and not by which form renders, because a server action is directly
// invocable.

export interface PasswordState {
  status: 'idle' | 'error';
  message?: string;
}

export async function signInWithPasswordAction(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  if (!hasDatabase()) {
    console.error('[sign-in] DATABASE_URL is not set on this deployment.');
    return { status: 'error', message: UNAVAILABLE };
  }

  const h = await headers();
  let result: Awaited<ReturnType<typeof signInWithPassword>>;

  try {
    result = await signInWithPassword(
      String(formData.get('email') ?? ''),
      String(formData.get('password') ?? ''),
      {
        userAgent: h.get('user-agent'),
        ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        // The lockout email has to point at the host they are signing in on.
        // Sessions are host-only, so a link to the apex writes a cookie
        // ops.oneinteriors.in cannot read.
        baseUrl: siteUrlForHost(h.get('host')),
      },
    );
  } catch (error) {
    console.error('[sign-in] signInWithPassword threw:', error);
    return { status: 'error', message: UNAVAILABLE };
  }

  if (!result.ok) {
    return { status: 'error', message: result.message };
  }

  await record('signin.completed');

  /* By role, not by assumption. This said `redirect('/ops')` when ops were the
     only accounts with passwords; leaving it that way once studios have them
     would drop every studio owner on a console they cannot open, which the
     /ops layout would then bounce to the homepage — a successful sign-in that
     looks like a failed one.

     `next` from the query string is still deliberately not honoured: an open
     redirect on a form that mints a staff session is not worth the
     convenience. */
  redirect(result.role === 'OPS' || result.role === 'ADMIN' ? '/ops' : '/studio');
}

// ── Customer sign-in: phone + WhatsApp OTP ─────────────────────
//
// Staff keep the emailed link above. Customers get this, because the email
// round trip asked someone to leave the site and find an inbox at the exact
// moment they were one click from their quotes.

const UNAVAILABLE =
  'Sign-in is temporarily unavailable. This is our problem, not yours — try again shortly.';

export type OtpRequestResult =
  | { ok: true; devCode?: string }
  | { ok: false; error: string };

export async function requestOtpAction(
  phone: string,
  name: string,
): Promise<OtpRequestResult> {
  if (!hasDatabase()) {
    console.error('[sign-in] DATABASE_URL is not set on this deployment.');
    return { ok: false, error: UNAVAILABLE };
  }

  const h = await headers();

  try {
    const result = await requestOtp(phone, name, {
      ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    });

    if (result.ok) return { ok: true, devCode: result.devCode };

    return {
      ok: false,
      error:
        result.reason === 'invalid_phone'
          ? 'That does not look like an Indian mobile number.'
          : result.reason === 'invalid_name'
            ? 'Please tell us your name.'
            : result.reason === 'cooldown'
              ? 'Give it a few seconds before asking for another code.'
              : 'Too many codes requested. Try again in fifteen minutes.',
    };
  } catch (error) {
    console.error('[sign-in] requestOtp threw:', error);
    return { ok: false, error: UNAVAILABLE };
  }
}

export type OtpVerifyResult = { ok: true } | { ok: false; error: string };

export async function verifyOtpAction(
  phone: string,
  code: string,
  name: string | null,
): Promise<OtpVerifyResult> {
  if (!hasDatabase()) return { ok: false, error: UNAVAILABLE };

  const h = await headers();

  try {
    const result = await verifyOtp(phone, code, name, {
      userAgent: h.get('user-agent'),
      ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    });

    if (result.ok) {
      // Attach anything this browser did before signing in. Best effort — a
      // failed claim costs a brief; a failed sign-in costs the customer.
      const { claimed, anonKey } = await claimBrief(result.userId);
      await claimConsent(result.userId, anonKey);
      if (claimed) await record('brief.claimed');
      await record('signin.completed');
      return { ok: true };
    }

    return {
      ok: false,
      error:
        result.reason === 'expired'
          ? 'That code has expired. Ask for a new one.'
          : result.reason === 'too_many'
            ? 'Too many wrong attempts. Ask for a new code.'
            : result.reason === 'invalid_phone'
              ? 'That does not look like an Indian mobile number.'
              : 'That code is not right. Check the message and try again.',
    };
  } catch (error) {
    console.error('[sign-in] verifyOtp threw:', error);
    return { ok: false, error: UNAVAILABLE };
  }
}
