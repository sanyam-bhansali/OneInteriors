'use server';

import { revalidatePath } from 'next/cache';
import { markInboxRead } from '@/modules/studio/inbox';

export async function markInboxReadAction(id: string): Promise<void> {
  await markInboxRead(String(id).slice(0, 64));
  revalidatePath('/studio');
}
