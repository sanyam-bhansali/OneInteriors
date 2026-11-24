'use server';

import { guarded, SAVE_FAILED } from '@/lib/action-guard';

import { revalidatePath } from 'next/cache';
import { saveTeamNotes } from '@/modules/studio/workspace';

/** The "Only your team" notes on a project. Checked in the module: `plan.edit` on this project. */
export async function saveTeamNotesAction(projectId: string, notes: string): Promise<{ ok: boolean; error?: string }> {
  return guarded('saveTeamNotesAction', { ok: false, error: SAVE_FAILED }, async () => {
  const id = String(projectId).slice(0, 64);
  const r = await saveTeamNotes(id, String(notes ?? ''));
  if (r.ok) revalidatePath(`/studio/projects/${id}`);
  return r.ok ? { ok: true } : { ok: false, error: r.error };
});
}
