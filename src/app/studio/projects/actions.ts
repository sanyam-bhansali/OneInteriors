'use server';

import { revalidatePath } from 'next/cache';
import { addProject, setProjectStage, type ProjectStageName } from '@/modules/studio-practice/projects';
import { deleteProject, restoreProject, type DeleteResult } from '@/modules/studio/project-delete';

// `State` and `IDLE` live in studio/form-state.ts. A 'use server'
// file may only export async functions — and Turbopack rejects even a
// type-only re-export here, so this import is for local use and
// callers take the type from form-state directly.
import type { State } from '../form-state';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

function refresh() {
  revalidatePath('/studio/projects');
  revalidatePath('/studio/clients');
  revalidatePath('/studio');
}

export async function addProjectAction(_prev: State, form: FormData): Promise<State> {
  const contract = Number(str(form, 'contract'));

  const result = await addProject({
    clientId: str(form, 'clientId'),
    name: str(form, 'name'),
    contractRupees: Number.isFinite(contract) && contract > 0 ? contract : undefined,
    targetDate: str(form, 'targetDate') || undefined,
  });

  if (!result.ok) return result;
  refresh();
  return { ok: true };
}

export async function setStageAction(id: string, stage: ProjectStageName): Promise<State> {
  const result = await setProjectStage(id, stage);
  if (!result.ok) return result;
  refresh();
  return { ok: true };
}

/* Delete and restore a project (owner, 27 Oct 2026; studio/project-delete.ts). */
export async function deleteProjectAction(projectId: string, typedName: string, reason: string): Promise<DeleteResult> {
  const r = await deleteProject(projectId, typedName, reason);
  if (r.ok) {
    refresh();
    revalidatePath('/studio/home');
    revalidatePath('/studio/design');
  }
  return r;
}

export async function restoreProjectAction(projectId: string): Promise<DeleteResult> {
  const r = await restoreProject(projectId);
  if (r.ok) {
    refresh();
    revalidatePath('/studio/projects/deleted');
    revalidatePath('/studio/home');
  }
  return r;
}
