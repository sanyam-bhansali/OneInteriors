'use server';

import { revalidatePath } from 'next/cache';
import { switchProjectSteps, type SwitchResult } from '@/modules/studio-design/switch-steps';
import { resetDesignTemplate } from '@/modules/studio-design/design-flow';

/** Settings → Design steps → Move projects to the new steps (DESIGN-PROCESS-PLAN.md Decision 12). */
export async function switchProjectAction(projectId: string, at: number): Promise<SwitchResult> {
  const id = String(projectId ?? '').slice(0, 64);
  const r = await switchProjectSteps(id, at);
  if (r.ok) {
    revalidatePath('/studio/settings/design/switch');
    revalidatePath(`/studio/projects/${id}`);
  }
  return r;
}

/** The studio's saved steps back to the standard (Hauspire's new) ones (owner). */
export async function standardStepsAction(): Promise<SwitchResult> {
  const r = await resetDesignTemplate();
  if (r.ok) {
    revalidatePath('/studio/settings/design/switch');
    revalidatePath('/studio/settings/design');
  }
  return r;
}
