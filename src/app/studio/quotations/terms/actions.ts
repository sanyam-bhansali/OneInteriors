'use server';

import { revalidatePath } from 'next/cache';
import { saveTerms } from '@/modules/studio-quote/store';
import type { State } from '../../form-state';

/** Save the studio's default terms (Quotations → Terms). Owner or project manager; the store checks. */
export async function saveTermsAction(text: string): Promise<State> {
  const result = await saveTerms(String(text ?? ''));
  if (!result.ok) return result;
  revalidatePath('/studio/quotations/terms');
  revalidatePath('/studio/settings');
  return { ok: true };
}
