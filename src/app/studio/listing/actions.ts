'use server';

import { revalidatePath } from 'next/cache';
import { declareCapacity } from '@/modules/studio/allocation';

export type CapacityState = { status: 'idle' | 'saved' } | { status: 'error'; error: string };

export async function saveCapacityAction(
  _prev: CapacityState,
  formData: FormData,
): Promise<CapacityState> {
  const raw = String(formData.get('capacityPerMonth') ?? '').trim();

  // An empty field means "I would rather not say", which is a different answer
  // from zero and must not become one — zero would pause them immediately.
  const value = raw === '' ? null : Number(raw);
  if (value !== null && !Number.isFinite(value)) {
    return { status: 'error', error: 'That is not a number.' };
  }

  const result = await declareCapacity(value === null ? null : Math.round(value));
  if (!result.ok) return { status: 'error', error: result.error };

  revalidatePath('/studio/listing');
  revalidatePath('/studio');
  return { status: 'saved' };
}
