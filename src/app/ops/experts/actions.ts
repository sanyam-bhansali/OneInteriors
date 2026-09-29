'use server';

import { revalidatePath } from 'next/cache';
import { addHours, blockDay, removeHours, unblockDay } from '@/modules/consultation/availability';

export interface HoursState {
  error?: string;
}

/** "11:30" → 690. Null for anything else. */
function minutes(v: FormDataEntryValue | null): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(v ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h <= 23 && min <= 59 ? h * 60 + min : null;
}

export async function addHoursAction(_prev: HoursState, formData: FormData): Promise<HoursState> {
  const start = minutes(formData.get('start'));
  const end = minutes(formData.get('end'));
  if (start === null || end === null) return { error: 'Times as 11:00 or 17:30.' };
  const result = await addHours(String(formData.get('expertUserId') ?? ''), {
    weekday: Number(formData.get('weekday')),
    startMin: start,
    endMin: end,
  });
  revalidatePath('/ops/experts');
  return result.ok ? {} : { error: result.error };
}

export async function removeHoursAction(formData: FormData): Promise<void> {
  await removeHours(String(formData.get('id') ?? ''));
  revalidatePath('/ops/experts');
}

export async function blockDayAction(_prev: HoursState, formData: FormData): Promise<HoursState> {
  const result = await blockDay(
    String(formData.get('expertUserId') ?? ''),
    String(formData.get('day') ?? ''),
    String(formData.get('reason') ?? ''),
  );
  revalidatePath('/ops/experts');
  return result.ok ? {} : { error: result.error };
}

export async function unblockDayAction(formData: FormData): Promise<void> {
  await unblockDay(String(formData.get('id') ?? ''));
  revalidatePath('/ops/experts');
}
