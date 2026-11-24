'use server';

import { guarded } from '@/lib/action-guard';

import { revalidatePath } from 'next/cache';
import { markInboxRead } from '@/modules/studio/inbox';

export async function markInboxReadAction(id: string): Promise<void> {
  return guarded('markInboxReadAction', undefined, async () => {
  await markInboxRead(String(id).slice(0, 64));
  revalidatePath('/studio');
  revalidatePath('/studio/today');
});
}
