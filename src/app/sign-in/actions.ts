'use server';

import { headers } from 'next/headers';
import { requestMagicLink } from '@/modules/auth/magic-link';
import { signOut } from '@/modules/auth/session';
import { redirect } from 'next/navigation';
import { resolveSiteUrl } from '@/lib/site';

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

  const result = await requestMagicLink(email, {
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    baseUrl: resolveSiteUrl(),
    // Carried into the emailed link so the customer lands back where they
    // were, not on the homepage. Validated inside requestMagicLink.
    next: String(formData.get('next') ?? '') || null,
  });

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
