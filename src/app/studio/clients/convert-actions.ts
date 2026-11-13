'use server';

import { revalidatePath } from 'next/cache';
import { convertLead, convertScreen, type ConvertResult, type ConvertScreen } from '@/modules/studio-sales/convert';

/** Convert (owner, 13 Nov 2026): the dialog's data, and the convert itself. The module checks who may. */

export async function convertScreenAction(clientId: string): Promise<ConvertScreen | null> {
  return convertScreen(clientId);
}

export async function convertLeadAction(clientId: string, quoteId: string, handover: string, stageId: string | null): Promise<ConvertResult> {
  const r = await convertLead({ clientId, quoteId, handover, stageId });
  if (r.ok) {
    revalidatePath('/studio/clients');
    revalidatePath(`/studio/clients/${clientId}`);
    revalidatePath('/studio/projects');
    revalidatePath('/studio/design');
  }
  return r;
}
