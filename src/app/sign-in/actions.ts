'use server';

import { headers } from 'next/headers';
import { requestMagicLink } from '@/modules/auth/magic-link';
import { signOut } from '@/modules/auth/session';
import { redirect } from 'next/navigation';
import { resolveSiteUrl } from '@/lib/site';
import { hasDatabase } from '@/lib/env';

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
      baseUrl: resolveSiteUrl(),
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
