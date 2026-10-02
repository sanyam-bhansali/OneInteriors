'use server';

import { revalidatePath } from 'next/cache';
import { submitCheckIn } from '@/modules/portal/home';
import { recordConsent, withdrawConsent } from '@/modules/consent/record';
import { CONSENT_PURPOSES, type ConsentPurpose } from '@/modules/consent/policy';
import { NOTE_MAX } from '@/modules/studio/check-in';

export interface CheckInState {
  status: 'idle' | 'saved' | 'error';
  errors?: Record<string, string>;
}

export async function checkInAction(_prev: CheckInState, formData: FormData): Promise<CheckInState> {
  const result = await submitCheckIn(String(formData.get('introductionId') ?? ''), {
    matched: String(formData.get('matched') ?? ''),
    communication: Number(formData.get('communication')),
    note: String(formData.get('note') ?? '').slice(0, NOTE_MAX + 1),
  });
  if (!result.ok) return { status: 'error', errors: result.errors };
  revalidatePath('/account');
  return { status: 'saved' };
}

/** One click, as easy as agreeing was. */
export async function withdrawConsentAction(formData: FormData): Promise<void> {
  const purpose = String(formData.get('purpose') ?? '');
  if (!(CONSENT_PURPOSES as readonly string[]).includes(purpose)) return;
  await withdrawConsent(purpose as ConsentPurpose);
  revalidatePath('/account');
}

/** Agree, after booking, that the studios they picked may see their name and number. */
export async function shareWithStudiosAction(): Promise<void> {
  await recordConsent([{ purpose: 'SHARE_WITH_STUDIO', granted: true }], 'your_home');
  revalidatePath('/account');
}
