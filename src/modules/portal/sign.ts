import 'server-only';

/**
 * Signing the final quote with a WhatsApp code, for the website's Sign
 * screen and the phone app's `POST /api/app/v1/choose/sign/:id[/code]`.
 * Before this lived in the website's server action; both now come here, so
 * the checks, the code and the plan choice cannot drift apart.
 *
 * The design names Aadhaar OTP. That needs a licensed e-sign provider, which
 * is not chosen yet, so this signs with the account's own WhatsApp code.
 */

import { requestOtp, verifyOtp } from '@/modules/auth/otp';
import { requestOtpMessage, verifyOtpMessage } from '@/modules/auth/otp-messages';
import type { AuthUser, SessionMeta } from '@/modules/auth/session';
import { firstBeforeGst } from '@/modules/app/first-before-gst';
import { finalQuoteView, signFinalQuote } from './choose';
import type { PlanName } from './plans';

export type CodeResult = { ok: true; to: string; devCode?: string } | { ok: false; error: string };

/**
 * A 6-digit WhatsApp code to the number on their account, to sign with.
 * Always their own number: the screen never chooses where the code goes.
 */
export async function requestSignCode(user: AuthUser | null, ip: string | null): Promise<CodeResult> {
  if (!user?.phone) return { ok: false, error: 'Sign in with your number first.' };
  const r = await requestOtp(user.phone, user.name ?? '', { ip });
  if (!r.ok) return { ok: false, error: requestOtpMessage(r.reason) };
  return { ok: true, to: user.phone, devCode: r.devCode };
}

export type SignResult =
  | { ok: true; projectId: string; plan: 'basic'; assuredRequested: boolean }
  | { ok: false; error: string; notFound?: boolean };

/**
 * Sign the final quote: the agreement ticked, the code right, the quote still
 * open and theirs. The quote is re-read here rather than trusted from the
 * screen, so what is locked is what the studio issued. Choosing Assured
 * registers interest; every project starts on Basic.
 */
export async function signWithCode(
  user: AuthUser | null,
  input: { quoteId: string; code: string; agreed: boolean; plan: PlanName },
  meta: SessionMeta,
): Promise<SignResult> {
  if (!input.agreed) return { ok: false, error: 'Tick the box to say you have read and agree.' };
  if (!user?.phone) return { ok: false, error: 'Sign in with your number first.' };

  const v = await verifyOtp(user.phone, input.code, user.name, meta);
  if (!v.ok) return { ok: false, error: verifyOtpMessage(v.reason) };
  if (v.userId !== user.id) return { ok: false, error: 'That code is for a different account.' };

  const view = await finalQuoteView(input.quoteId, firstBeforeGst);
  if (!view) return { ok: false, notFound: true, error: 'We could not find that quote on your project.' };
  const r = await signFinalQuote(view, input.plan);
  if (!r.ok) return r;
  return { ok: true, projectId: r.projectId!, plan: 'basic', assuredRequested: input.plan === 'assured' };
}
