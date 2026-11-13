'use server';

import { revalidatePath } from 'next/cache';
import { assignDesigner, type DesignResult } from '@/modules/studio-design/design-flow';

/**
 * Assign designer, from "New projects" (owner, 13 Nov 2026). Every check is
 * in `assignDesigner` (`design.assign` on the project); this clips input and
 * refreshes the pages the project shows on.
 */
export async function assignNewProjectAction(projectId: string, memberId: string): Promise<DesignResult> {
  const id = String(projectId ?? '').slice(0, 64);
  const who = String(memberId ?? '').slice(0, 64);
  if (!who) return { ok: false, error: 'Pick a designer.' };
  const r = await assignDesigner(id, who);
  if (r.ok) {
    revalidatePath('/studio/design');
    revalidatePath('/studio/home');
    revalidatePath(`/studio/projects/${id}`);
  }
  return r;
}
