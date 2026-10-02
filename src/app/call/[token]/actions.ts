'use server';

import { revalidatePath } from 'next/cache';
import { cleanToken } from '@/modules/consultation/manage';
import { cancelCall, moveCall } from '@/modules/consultation/manage-store';

export type CallActionResult = { ok: true } | { ok: false; error: string };

export async function moveCallAction(token: string, startsAt: string): Promise<CallActionResult> {
  const t = cleanToken(token);
  if (!t || typeof startsAt !== 'string') return { ok: false, error: 'We could not find that booking.' };
  const r = await moveCall(t, startsAt.slice(0, 40));
  revalidatePath(`/call/${t}`);
  return r;
}

export async function cancelCallAction(token: string): Promise<CallActionResult> {
  const t = cleanToken(token);
  if (!t) return { ok: false, error: 'We could not find that booking.' };
  const r = await cancelCall(t);
  revalidatePath(`/call/${t}`);
  return r;
}
