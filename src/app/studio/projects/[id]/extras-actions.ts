'use server';

/**
 * Extra work (change orders) and the client's digital sign-off (owner,
 * 15 Oct 2026). Every check is in the modules (project/change-orders.ts,
 * project/signoffs.ts): `extras.write` to add, send, cancel and release
 * extra work and `signoff.request` to ask for a signature (owner; PM and
 * designer on the project); `payment.record` to record the money (accounts
 * and the owner).
 */

import { revalidatePath } from 'next/cache';
import { cancelExtra, recordExtraPayment, releaseExtra, saveExtraDraft, sendExtra } from '@/modules/project/change-orders';
import { requestSignoff, withdrawSignoff } from '@/modules/project/signoffs';

export type ExtrasActionResult = { ok: true; id?: string; message?: string } | { ok: false; error: string };

const id = (v: unknown) => String(v ?? '').slice(0, 64);

const refresh = (projectId: string) => {
  revalidatePath(`/studio/projects/${projectId}`);
  revalidatePath('/studio/payments');
  revalidatePath('/studio/design');
};

/** FormData: projectId, id (to edit a draft), title, reason, lines (JSON), photo (optional). */
export async function saveExtraAction(form: FormData): Promise<ExtrasActionResult> {
  const projectId = id(form.get('projectId'));
  let lines: unknown = null;
  try {
    lines = JSON.parse(String(form.get('lines') ?? '[]'));
  } catch {
    return { ok: false, error: 'The lines did not come through. Try again.' };
  }
  const photo = form.get('photo');
  const r = await saveExtraDraft(
    projectId,
    { id: form.get('id') || undefined, title: form.get('title'), reason: form.get('reason'), lines },
    photo instanceof File && photo.size > 0 ? photo : null,
  );
  if (r.ok) refresh(projectId);
  return r;
}

export async function sendExtraAction(projectId: string, extraId: string): Promise<ExtrasActionResult> {
  const r = await sendExtra(id(extraId));
  if (r.ok) refresh(id(projectId));
  return r;
}

export async function cancelExtraAction(projectId: string, extraId: string): Promise<ExtrasActionResult> {
  const r = await cancelExtra(id(extraId));
  if (r.ok) refresh(id(projectId));
  return r;
}

export async function releaseExtraAction(projectId: string, extraId: string): Promise<ExtrasActionResult> {
  const r = await releaseExtra(id(extraId));
  if (r.ok) refresh(id(projectId));
  return r;
}

/** FormData: projectId, extraId, amount, receivedOn, mode, note, receipt (optional). */
export async function recordExtraPaymentAction(form: FormData): Promise<ExtrasActionResult> {
  const projectId = id(form.get('projectId'));
  const receipt = form.get('receipt');
  const r = await recordExtraPayment(
    id(form.get('extraId')),
    { amount: form.get('amount'), receivedOn: form.get('receivedOn'), mode: form.get('mode'), note: form.get('note') },
    receipt instanceof File && receipt.size > 0 ? receipt : null,
  );
  if (r.ok) refresh(projectId);
  return r;
}

export async function requestSignoffAction(projectId: string, kind: string): Promise<ExtrasActionResult> {
  const r = await requestSignoff(id(projectId), kind);
  if (r.ok) refresh(id(projectId));
  return r;
}

export async function withdrawSignoffAction(projectId: string, signoffId: string): Promise<ExtrasActionResult> {
  const r = await withdrawSignoff(id(signoffId));
  if (r.ok) refresh(id(projectId));
  return r;
}
