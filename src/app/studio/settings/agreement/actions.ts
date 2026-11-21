'use server';

import { revalidatePath } from 'next/cache';
import { saveAgreementTemplate } from '@/modules/agreement/store';

/** Settings → Client agreement. The owner check is in the module. */
export async function saveAgreementTemplateAction(text: string, signatory: string, signatoryRole: string): Promise<{ ok: boolean; message: string }> {
  const r = await saveAgreementTemplate({ text: String(text ?? ''), signatory: String(signatory ?? ''), signatoryRole: String(signatoryRole ?? '') });
  if (r.ok) revalidatePath('/studio/settings/agreement');
  return r.ok ? { ok: true, message: r.message } : { ok: false, message: r.error };
}
