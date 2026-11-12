'use server';

import { revalidatePath } from 'next/cache';
import { sendAdditionalScope } from '@/modules/project/change-orders';
import { startAdditionalScope } from '@/modules/studio-scope/scope';

/** Additional scope (owner, 12 Nov 2026). Every check is in the modules; these clip input and refresh. */

export type ScopeActionResult = { ok: true; id?: string; message?: string } | { ok: false; error: string };

const id = (v: unknown) => String(v ?? '').slice(0, 64);

const refresh = (projectId: string) => {
  revalidatePath(`/studio/projects/${projectId}`);
  revalidatePath('/studio/payments');
};

export async function startScopeAction(projectId: string): Promise<ScopeActionResult> {
  const r = await startAdditionalScope(id(projectId));
  if (r.ok) refresh(id(projectId));
  return r;
}

export async function sendScopeAction(projectId: string, quoteId: string, days: string): Promise<ScopeActionResult> {
  const r = await sendAdditionalScope(id(projectId), id(quoteId), String(days ?? '').slice(0, 6));
  if (r.ok) refresh(id(projectId));
  return r;
}
