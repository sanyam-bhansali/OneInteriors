'use server';

import { revalidatePath } from 'next/cache';
import { createDecision } from '@/modules/project/decision-flow';

/**
 * The New decision form (studio workspace Phase 5). Checked in the module:
 * `decision.create` on this project (owner, or the PM on it), the options
 * (two or three), the date, the amounts.
 */
export async function createDecisionAction(form: FormData): Promise<{ ok: boolean; id?: string; error?: string }> {
  const projectId = String(form.get('projectId') ?? '').slice(0, 64);
  let options: unknown = null;
  try {
    options = JSON.parse(String(form.get('options') ?? 'null'));
  } catch {
    return { ok: false, error: 'The options could not be read. Reload the page and try again.' };
  }
  const photos = [0, 1, 2].map((i) => {
    const f = form.get(`photo${i}`);
    return f instanceof File && f.size > 0 ? f : null;
  });
  const r = await createDecision(
    projectId,
    { title: form.get('title'), why: form.get('why'), dueOn: form.get('dueOn'), quoteLineId: form.get('quoteLineId') || null, options },
    photos,
  );
  if (r.ok) revalidatePath(`/studio/projects/${projectId}`);
  return r.ok ? { ok: true, id: r.id } : { ok: false, error: r.error };
}
