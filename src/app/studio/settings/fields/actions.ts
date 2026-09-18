'use server';

import { revalidatePath } from 'next/cache';
import {
  addField,
  renameField,
  setFieldGrouping,
  removeField,
  type FieldTypeName,
} from '@/modules/studio-practice/fields';

// `State` and `IDLE` live in studio/form-state.ts. A 'use server'
// file may only export async functions — and Turbopack rejects even a
// type-only re-export here, so this import is for local use and
// callers take the type from form-state directly.
import type { State } from '../../form-state';

function refresh() {
  revalidatePath('/studio/settings/fields');
  revalidatePath('/studio/clients');
}

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

export async function addFieldAction(_prev: State, form: FormData): Promise<State> {
  const result = await addField({
    label: str(form, 'label'),
    type: (str(form, 'type') || 'TEXT') as FieldTypeName,
    options: str(form, 'options'),
  });
  if (!result.ok) return result;
  refresh();
  return { ok: true };
}

export async function renameFieldAction(id: string, label: string): Promise<State> {
  const result = await renameField(id, label);
  if (!result.ok) return result;
  refresh();
  return { ok: true };
}

export async function setGroupingAction(id: string, groupBy: boolean): Promise<State> {
  const result = await setFieldGrouping(id, groupBy);
  if (!result.ok) return result;
  refresh();
  return { ok: true };
}

export async function removeFieldAction(id: string): Promise<State> {
  const result = await removeField(id);
  if (!result.ok) return result;
  refresh();
  return { ok: true };
}
