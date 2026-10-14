'use server';

/**
 * The Payments tab and the Home locker card (studio workspace Phase 5).
 * Every check is in the module: `payment.record` to record or correct money
 * (accounts and the owner), `document.upload` for the locker (owner, or the
 * PM on the project).
 */

import { revalidatePath } from 'next/cache';
import { correctPayment, recordPayment } from '@/modules/project/payments-flow';
import { removeDocument, setMaterialCode, shareDocument, uploadDocument } from '@/modules/project/locker';
import { setPaymentStage } from '@/modules/portal/project-store';

export type MoneyActionResult = { ok: boolean; error?: string };

const refresh = (projectId: string) => {
  revalidatePath(`/studio/projects/${projectId}`);
  revalidatePath('/studio/payments');
};

const id = (v: unknown) => String(v ?? '').slice(0, 64);

export async function recordPaymentAction(form: FormData): Promise<MoneyActionResult> {
  const projectId = id(form.get('projectId'));
  const receipt = form.get('receipt');
  const r = await recordPayment(
    projectId,
    { stageIndex: form.get('stageIndex'), amount: form.get('amount'), receivedOn: form.get('receivedOn'), mode: form.get('mode'), note: form.get('note') },
    receipt instanceof File && receipt.size > 0 ? receipt : null,
  );
  if (r.ok) refresh(projectId);
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function correctPaymentAction(projectId: string, paymentId: string, amount: string): Promise<MoneyActionResult> {
  const r = await correctPayment(id(paymentId), { amount });
  if (r.ok) refresh(id(projectId));
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function uploadDocumentAction(form: FormData): Promise<MoneyActionResult> {
  const projectId = id(form.get('projectId'));
  const file = form.get('file');
  const r = await uploadDocument(
    projectId,
    { kind: form.get('kind'), title: form.get('title'), share: form.get('share'), supersedesId: form.get('supersedesId') },
    file instanceof File ? file : null,
  );
  if (r.ok) refresh(projectId);
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function shareDocumentAction(projectId: string, documentId: string): Promise<MoneyActionResult> {
  const r = await shareDocument(id(documentId));
  if (r.ok) refresh(id(projectId));
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function removeDraftAction(projectId: string, documentId: string): Promise<MoneyActionResult> {
  const r = await removeDocument(id(documentId));
  if (r.ok) refresh(id(projectId));
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function materialCodeAction(projectId: string, materialId: string, code: string, ordered: boolean): Promise<MoneyActionResult> {
  const r = await setMaterialCode(id(materialId), { code, ordered });
  if (r.ok) refresh(id(projectId));
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

/** When a stage is due (accounts, the owner, or the PM on the project). The last one waits for every snag to close (Phase 4's gate, in setPaymentStage). */
export async function setDueAction(projectId: string, index: number, day: string): Promise<MoneyActionResult> {
  const r = await setPaymentStage(id(projectId), Number(index), { dueOn: day || null });
  if (r.ok) refresh(id(projectId));
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}
