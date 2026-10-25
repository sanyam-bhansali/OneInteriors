'use server';

import { revalidatePath } from 'next/cache';
import { checkDelay } from '@/modules/studio-design/delays';

/** Design → Delays: mark one late step's reason as checked. */
export async function checkDelayAction(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await checkDelay(String(id ?? '').slice(0, 64));
  if (r.ok) revalidatePath('/studio/design/delays');
  return r;
}
