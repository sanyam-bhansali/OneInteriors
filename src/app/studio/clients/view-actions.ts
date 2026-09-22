'use server';

import { revalidatePath } from 'next/cache';
import { saveView, setDefaultView, deleteView } from '@/modules/studio-practice/saved-views';
import type { State } from '../form-state';

/**
 * Saved views, as server actions.
 *
 * Separate from `actions.ts` because that file is about leads and this one is
 * about how somebody looks at them — and because a `'use server'` file may
 * only export async functions, so the two cannot share a type export anyway.
 */

export async function saveViewAction(name: string, filters: unknown): Promise<State> {
  const result = await saveView(name, filters);
  if (!result.ok) return result;
  revalidatePath('/studio/clients');
  return { ok: true };
}

export async function setDefaultViewAction(viewId: string | null): Promise<State> {
  const result = await setDefaultView(viewId);
  if (!result.ok) return result;
  revalidatePath('/studio/clients');
  return { ok: true };
}

export async function deleteViewAction(viewId: string): Promise<State> {
  const result = await deleteView(viewId);
  if (!result.ok) return result;
  revalidatePath('/studio/clients');
  return { ok: true };
}
