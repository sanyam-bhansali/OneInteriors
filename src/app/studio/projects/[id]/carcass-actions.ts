'use server';

import { guarded, SAVE_FAILED } from '@/lib/action-guard';

import { revalidatePath } from 'next/cache';
import { setOnSiteCarcass, type CarcassResult } from '@/modules/studio/expected-closing-store';

/** On-site carcass (owner, 13 Nov 2026). Every check is in modules/studio/expected-closing-store.ts; this clips input and refreshes. */
export async function setOnSiteCarcassAction(projectId: string, on: boolean): Promise<CarcassResult> {
  return guarded('setOnSiteCarcassAction', { ok: false, error: SAVE_FAILED }, async () => {
  const id = String(projectId ?? '').slice(0, 64);
  const r = await setOnSiteCarcass(id, on === true);
  if (r.ok) {
    revalidatePath(`/studio/projects/${id}`);
    revalidatePath('/studio/projects');
    revalidatePath('/studio/design');
  }
  return r;
});
}
