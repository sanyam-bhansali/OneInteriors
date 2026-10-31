'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { hasDatabase } from '@/lib/env';
import { safeNext } from '@/lib/site';
import { record } from '@/modules/analytics/record';
import { chooseCustomerPassword, customerPasswordSignIn } from '@/modules/auth/customer-password';
import { codeFromPaste, CUSTOMER_REFUSAL_WORDS } from '@/modules/auth/customer-password-rules';
import { getCurrentUser } from '@/modules/auth/session';

/**
 * The clients' sign-in, while codes are not live (owner, 1 Nov 2026): mobile
 * number and the password their studio gave them (auth/customer-password.ts).
 * A one-time password goes on to "choose your own" first.
 */

export interface FormState {
  error: string | null;
}

/** Only into the project app: anything else falls back to the client's home. */
function nextIn(raw: unknown): string {
  const n = safeNext(typeof raw === 'string' ? raw : null);
  return n && n.startsWith('/app/') ? n : '/app/home';
}

export async function signInAction(_prev: FormState, form: FormData): Promise<FormState> {
  if (!hasDatabase()) return { error: CUSTOMER_REFUSAL_WORDS.unavailable };
  const h = await headers();
  const next = nextIn(form.get('next'));
  let to: string;
  try {
    const r = await customerPasswordSignIn(String(form.get('phone') ?? ''), String(form.get('password') ?? ''), {
      userAgent: h.get('user-agent'),
      ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    });
    if (!r.ok) return { error: CUSTOMER_REFUSAL_WORDS[r.reason] };
    await record('signin.completed');
    to = r.mustChange ? `/app/password?next=${encodeURIComponent(next)}` : next;
  } catch (error) {
    console.error('[app-sign-in] password sign-in threw:', error instanceof Error ? error.name : 'unknown');
    return { error: CUSTOMER_REFUSAL_WORDS.unavailable };
  }
  redirect(to);
}

export async function choosePasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect('/app/sign-in');
  const next = String(form.get('password') ?? '');
  if (next !== String(form.get('again') ?? '')) return { error: 'The two passwords are not the same.' };
  const r = await chooseCustomerPassword(user.id, next, null);
  if (!r.ok) return { error: r.message };
  redirect(nextIn(form.get('next')));
}

/** "Connect your project": a pasted invite link or a typed code opens its join page. */
export async function connectAction(_prev: FormState, form: FormData): Promise<FormState> {
  const code = codeFromPaste(String(form.get('code') ?? ''));
  if (!code) return { error: 'That is not a project link or code. Paste the whole link your designer sent, or type its code.' };
  redirect(`/app/join/${code}`);
}
