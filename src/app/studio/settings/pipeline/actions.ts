'use server';

import { revalidatePath } from 'next/cache';
import {
  addStage,
  renameStage,
  recolourStage,
  setStageKind,
  moveStage,
  setIntakeStage,
  removeStage,
  type ColourToken,
  type StageKindName,
} from '@/modules/studio-practice/stages';

export type State = { ok: true } | { ok: false; error: string } | { idle: true };
export const IDLE: State = { idle: true };

/**
 * Every pipeline edit changes what the board looks like and what the rail
 * counts, so both are revalidated. The dashboard too — "waiting on you" reads
 * the stage kinds.
 */
function refresh() {
  revalidatePath('/studio/settings/pipeline');
  revalidatePath('/studio/clients');
  revalidatePath('/studio/projects');
  revalidatePath('/studio');
}

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

export async function addStageAction(_prev: State, form: FormData): Promise<State> {
  const result = await addStage({
    name: str(form, 'name'),
    kind: (str(form, 'kind') || 'OPEN') as StageKindName,
    colour: (str(form, 'colour') || 'slate') as ColourToken,
  });
  if (!result.ok) return result;
  refresh();
  return { ok: true };
}

export async function renameStageAction(id: string, name: string): Promise<State> {
  const result = await renameStage(id, name);
  if (!result.ok) return result;
  refresh();
  return { ok: true };
}

export async function recolourStageAction(id: string, colour: ColourToken): Promise<State> {
  const result = await recolourStage(id, colour);
  if (!result.ok) return result;
  refresh();
  return { ok: true };
}

export async function setKindAction(id: string, kind: StageKindName): Promise<State> {
  const result = await setStageKind(id, kind);
  if (!result.ok) return result;
  refresh();
  return { ok: true };
}

export async function moveStageAction(id: string, direction: 'up' | 'down'): Promise<State> {
  const result = await moveStage(id, direction);
  if (!result.ok) return result;
  refresh();
  return { ok: true };
}

export async function setIntakeAction(id: string): Promise<State> {
  const result = await setIntakeStage(id);
  if (!result.ok) return result;
  refresh();
  return { ok: true };
}

export async function removeStageAction(id: string): Promise<State> {
  const result = await removeStage(id);
  if (!result.ok) return result;
  refresh();
  return { ok: true };
}
