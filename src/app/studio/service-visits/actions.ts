'use server';

import { revalidatePath } from 'next/cache';
import { cancelServiceVisit, finishServiceVisit, moveServiceVisit } from '@/modules/aftercare/store';

/** Service visits: move, cancel (a paid one is refunded), done. The checks are in the module. */
type Out = { ok: boolean; message: string };
const out = (r: { ok: true; message: string } | { ok: false; error: string }): Out => (r.ok ? { ok: true, message: r.message } : { ok: false, message: r.error });

export async function moveVisitAction(id: string, day: string, start: string, note: string): Promise<Out> {
  const r = await moveServiceVisit(String(id).slice(0, 64), { day: String(day).slice(0, 10), start: String(start).slice(0, 5), note: String(note ?? '').slice(0, 300) });
  if (r.ok) revalidatePath('/studio/service-visits');
  return out(r);
}

export async function cancelVisitAction(id: string, reason: string): Promise<Out> {
  const r = await cancelServiceVisit(String(id).slice(0, 64), String(reason ?? '').slice(0, 300));
  if (r.ok) revalidatePath('/studio/service-visits');
  return out(r);
}

export async function finishVisitAction(id: string, note: string): Promise<Out> {
  const r = await finishServiceVisit(String(id).slice(0, 64), String(note ?? '').slice(0, 300));
  if (r.ok) revalidatePath('/studio/service-visits');
  return out(r);
}
