'use server';

import { revalidatePath } from 'next/cache';
import { cancelExtra, sendAdditionalScope, sendSimpleScope } from '@/modules/project/change-orders';

/** Additional scope (owner, 12 and 13 Nov 2026). Every check is in the modules; these clip input and refresh. */

export type ScopeActionResult = { ok: true; id?: string; message?: string } | { ok: false; error: string };

const id = (v: unknown) => String(v ?? '').slice(0, 64);
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

const refresh = (projectId: string) => {
  revalidatePath(`/studio/projects/${projectId}`);
  revalidatePath('/studio/payments');
};

export interface SimpleScopeForm {
  lines: { item: string; details: string; amount: string }[];
  impact: string;
  days: string;
  date: string;
}

/** The simple form (13 Nov 2026): lines, the impact, days or a date. */
export async function sendSimpleScopeAction(projectId: string, form: SimpleScopeForm): Promise<ScopeActionResult> {
  const rows = Array.isArray(form?.lines) ? form.lines.slice(0, 20) : [];
  const r = await sendSimpleScope(id(projectId), {
    lines: rows.map((l) => ({ item: text(l?.item, 200), details: text(l?.details, 800), amount: text(l?.amount, 20) })),
    impact: text(form?.impact, 20),
    days: text(form?.days, 6),
    date: text(form?.date, 10),
  });
  if (r.ok) refresh(id(projectId));
  return r;
}

/** Take back a scope the client has not answered yet. */
export async function cancelScopeAction(projectId: string, orderId: string): Promise<ScopeActionResult> {
  const r = await cancelExtra(id(orderId));
  if (r.ok) refresh(id(projectId));
  return r;
}

/** A 12 Nov builder-made scope draft: still sendable with its days. */
export async function sendScopeAction(projectId: string, quoteId: string, days: string): Promise<ScopeActionResult> {
  const r = await sendAdditionalScope(id(projectId), id(quoteId), String(days ?? '').slice(0, 6));
  if (r.ok) refresh(id(projectId));
  return r;
}
