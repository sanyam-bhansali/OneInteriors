'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/modules/auth/session';
import { answerVisit, type ChooseResult } from '@/modules/portal/choose';
import { requestSignCode, signWithCode, type CodeResult } from '@/modules/portal/sign';
import { parsePlan } from '@/modules/portal/plans';

/**
 * The Choose & sign screens' actions. Signing and its code are
 * `modules/portal/sign.ts`, shared with the phone app's API.
 */

/** Yes or no to a visit time the studio proposed. */
export async function answerVisitAction(appointmentId: string, yes: boolean): Promise<ChooseResult> {
  const r = await answerVisit(appointmentId, yes ? 'CONFIRMED' : 'CANCELLED');
  if (r.ok) revalidatePath('/app/choose');
  return r;
}

export type { CodeResult };

const ipOf = (h: Headers) => h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;

export async function requestSignCodeAction(): Promise<CodeResult> {
  return requestSignCode(await getCurrentUser(), ipOf(await headers()));
}

/** Sign with the code; Basic, or Assured as interest the team confirms (portal/plans.ts). */
export async function signAction(input: { quoteId: string; code: string; agreed: boolean; plan: string }): Promise<ChooseResult> {
  const plan = parsePlan(input.plan);
  if (!plan) return { ok: false, error: 'Choose Basic or Assured.' };
  const h = await headers();
  const r = await signWithCode(await getCurrentUser(), { quoteId: input.quoteId, code: input.code, agreed: input.agreed, plan }, {
    userAgent: h.get('user-agent'),
    ip: ipOf(h),
  });
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath('/app/choose');
  revalidatePath('/app/home');
  return { ok: true };
}
