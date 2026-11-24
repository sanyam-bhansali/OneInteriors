'use server';

import { guarded, SAVE_FAILED } from '@/lib/action-guard';

import { revalidatePath } from 'next/cache';
import { resetDesignTemplate, saveDesignTemplate, type DesignResult } from '@/modules/studio-design/design-flow';

/** Settings → Design steps. The checks are in the module (studio-design/template.ts, design-flow.ts). */

export async function saveDesignStepsAction(steps: unknown): Promise<DesignResult> {
  return guarded('saveDesignStepsAction', { ok: false, error: SAVE_FAILED }, async () => {
  const r = await saveDesignTemplate(Array.isArray(steps) ? steps.slice(0, 60) : steps);
  if (r.ok) revalidatePath('/studio/settings/design');
  return r;
});
}

export async function resetDesignStepsAction(): Promise<DesignResult> {
  return guarded('resetDesignStepsAction', { ok: false, error: SAVE_FAILED }, async () => {
  const r = await resetDesignTemplate();
  if (r.ok) revalidatePath('/studio/settings/design');
  return r;
});
}
