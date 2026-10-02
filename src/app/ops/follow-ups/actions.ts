'use server';

import { revalidatePath } from 'next/cache';
import { recordFollowUp } from '@/modules/consultation/follow-up-store';

export async function recordFollowUpAction(formData: FormData): Promise<void> {
  await recordFollowUp(
    String(formData.get('briefId') ?? ''),
    formData.get('outcome'),
    String(formData.get('note') ?? ''),
  );
  revalidatePath('/ops/follow-ups');
}
