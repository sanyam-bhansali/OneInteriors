'use server';

import { revalidatePath } from 'next/cache';
import { addProject, setProjectStage, type ProjectStageName } from '@/modules/studio-practice/projects';

export type State = { ok: true } | { ok: false; error: string } | { idle: true };
export const IDLE: State = { idle: true };

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
