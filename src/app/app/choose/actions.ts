'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/modules/auth/session';
import { requestOtp, verifyOtp } from '@/modules/auth/otp';
import { requestOtpMessage, verifyOtpMessage } from '@/modules/auth/otp-messages';
import { answerVisit, finalQuoteView, signFinalQuote, type ChooseResult } from '@/modules/portal/choose';
import { firstBeforeGst } from './first';

/** Yes or no to a visit time the studio proposed. */
export async function answerVisitAction(appointmentId: string, yes: boolean): Promise<ChooseResult> {
  const r = await answerVisit(appointmentId, yes ? 'CONFIRMED' : 'CANCELLED');
  if (r.ok) revalidatePath('/app/choose');
  return r;
}

export type CodeResult = { ok: true; to: string; devCode?: string } | { ok: false; error: string };

/**
 * A 6-digit WhatsApp code to the number on their account, to sign with.
 * Always their own number: the screen never chooses where the code goes.
 */
export async function requestSignCodeAction(): Promise<CodeResult> {
  const user = await getCurrentUser();
  if (!user?.phone) return { ok: false, error: 'Sign in with your number first.' };
  const h = await headers();
  const r = await requestOtp(user.phone, user.name ?? '', { ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null });
  if (!r.ok) return { ok: false, error: requestOtpMessage(r.reason) };
  return { ok: true, to: user.phone, devCode: r.devCode };
}

/**
 * Sign the final quote: the agreement ticked, the code right, the quote
 * still open and theirs. The quote is re-read here rather than trusted from
 * the screen, so what is locked is what the studio issued.
 */
export async function signAction(input: { quoteId: string; code: string; agreed: boolean }): Promise<ChooseResult> {
  if (!input.agreed) return { ok: false, error: 'Tick the box to say you have read and agree.' };
  const user = await getCurrentUser();
  if (!user?.phone) return { ok: false, error: 'Sign in with your number first.' };

  const h = await headers();
  const v = await verifyOtp(user.phone, input.code, user.name, {
    userAgent: h.get('user-agent'),
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
  });
  if (!v.ok) return { ok: false, error: verifyOtpMessage(v.reason) };
  if (v.userId !== user.id) return { ok: false, error: 'That code is for a different account.' };

  const view = await finalQuoteView(input.quoteId, firstBeforeGst);
  if (!view) return { ok: false, error: 'We could not find that quote on your project.' };
  const r = await signFinalQuote(view);
  if (r.ok) {
    revalidatePath('/app/choose');
    revalidatePath('/app/home');
  }
  return r.ok ? { ok: true } : r;
}
