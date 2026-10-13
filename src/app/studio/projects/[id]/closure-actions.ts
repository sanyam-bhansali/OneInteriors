'use server';

/**
 * The project closure (owner, 13 Oct 2026; docs/studio-os/PROJECT-LIFECYCLE.md).
 * Every check is in the module (project/closure.ts): `project.closure` on the
 * project — owner, and the PM or designer on it.
 */

import { revalidatePath } from 'next/cache';
import { saveClosure } from '@/modules/project/closure';

export type ClosureActionResult = { ok: true; message: string } | { ok: false; error: string };

export async function saveClosureAction(projectId: string, input: { lines: unknown; note: unknown; fix: boolean }): Promise<ClosureActionResult> {
  const id = String(projectId ?? '').slice(0, 64);
  const r = await saveClosure(id, { lines: input.lines, note: input.note, fix: input.fix === true });
  if (r.ok) {
    revalidatePath(`/studio/projects/${id}`);
    revalidatePath('/studio/design');
    revalidatePath('/studio/home');
    revalidatePath('/studio/payments');
    return { ok: true, message: r.message };
  }
  return { ok: false, error: r.error };
}
