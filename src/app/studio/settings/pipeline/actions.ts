'use server';

import { guarded, SAVE_FAILED } from '@/lib/action-guard';

import { revalidatePath } from 'next/cache';
import {
  addStage,
  renameStage,
  recolourStage,
  setStageKind,
  moveStage,
  setIntakeStage,
  setCallStep,
  removeStage,
  applyHauspirePipeline,
  type ColourToken,
  type StageKindName,
} from '@/modules/studio-practice/stages';

// `State` and `IDLE` live in studio/form-state.ts. A 'use server'
// file may only export async functions — and Turbopack rejects even a
// type-only re-export here, so this import is for local use and
// callers take the type from form-state directly.
import type { State } from '../../form-state';

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
  return guarded('addStageAction', { ok: false, error: SAVE_FAILED }, async () => {
  const result = await addStage({
    name: str(form, 'name'),
    kind: (str(form, 'kind') || 'OPEN') as StageKindName,
    colour: (str(form, 'colour') || 'slate') as ColourToken,
  });
  if (!result.ok) return result;
  refresh();
  return { ok: true };
});
}

export async function renameStageAction(id: string, name: string): Promise<State> {
  return guarded('renameStageAction', { ok: false, error: SAVE_FAILED }, async () => {
  const result = await renameStage(id, name);
  if (!result.ok) return result;
  refresh();
  return { ok: true };
});
}

export async function recolourStageAction(id: string, colour: ColourToken): Promise<State> {
  return guarded('recolourStageAction', { ok: false, error: SAVE_FAILED }, async () => {
  const result = await recolourStage(id, colour);
  if (!result.ok) return result;
  refresh();
  return { ok: true };
});
}

export async function setKindAction(id: string, kind: StageKindName): Promise<State> {
  return guarded('setKindAction', { ok: false, error: SAVE_FAILED }, async () => {
  const result = await setStageKind(id, kind);
  if (!result.ok) return result;
  refresh();
  return { ok: true };
});
}

export async function moveStageAction(id: string, direction: 'up' | 'down'): Promise<State> {
  return guarded('moveStageAction', { ok: false, error: SAVE_FAILED }, async () => {
  const result = await moveStage(id, direction);
  if (!result.ok) return result;
  refresh();
  return { ok: true };
});
}

export async function setIntakeAction(id: string): Promise<State> {
  return guarded('setIntakeAction', { ok: false, error: SAVE_FAILED }, async () => {
  const result = await setIntakeStage(id);
  if (!result.ok) return result;
  refresh();
  return { ok: true };
});
}

/** "Calling step" on or off for one open column (owner, 21 Oct 2026). */
export async function setCallStepAction(id: string, on: boolean): Promise<State> {
  return guarded('setCallStepAction', { ok: false, error: SAVE_FAILED }, async () => {
  const result = await setCallStep(String(id ?? ''), on === true);
  if (!result.ok) return result;
  refresh();
  return { ok: true };
});
}

export async function removeStageAction(id: string): Promise<State> {
  return guarded('removeStageAction', { ok: false, error: SAVE_FAILED }, async () => {
  const result = await removeStage(id);
  if (!result.ok) return result;
  refresh();
  return { ok: true };
});
}

/** "Use the Hauspire pipeline": adds and renames only (owner, 12 Oct 2026). */
export async function applyHauspireAction(): Promise<State> {
  return guarded('applyHauspireAction', { ok: false, error: SAVE_FAILED }, async () => {
  const result = await applyHauspirePipeline();
  if (!result.ok) return result;
  refresh();
  return { ok: true };
});
}
