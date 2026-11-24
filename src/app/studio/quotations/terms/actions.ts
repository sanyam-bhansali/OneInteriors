'use server';

import { guarded, SAVE_FAILED } from '@/lib/action-guard';

import { revalidatePath } from 'next/cache';
import { saveTerms } from '@/modules/studio-quote/store';
import type { State } from '../../form-state';

/** Save the studio's default terms (Quotations → Terms). Owner or project manager; the store checks. */
export async function saveTermsAction(text: string): Promise<State> {
  return guarded('saveTermsAction', { ok: false, error: SAVE_FAILED }, async () => {
  const result = await saveTerms(String(text ?? ''));
  if (!result.ok) return result;
  revalidatePath('/studio/quotations/terms');
  revalidatePath('/studio/settings');
  return { ok: true };
});
}
