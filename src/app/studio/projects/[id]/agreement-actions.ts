'use server';

import { revalidatePath } from 'next/cache';
import { sendAgreement, uploadSignedAgreement } from '@/modules/agreement/store';

/** The client agreement on a project (docs/studio-os/CLIENT-AGREEMENT.md). Who may is checked in the module. */
type Out = { ok: boolean; message: string };
const out = (r: { ok: true; message: string } | { ok: false; error: string }): Out => (r.ok ? { ok: true, message: r.message } : { ok: false, message: r.error });
const safeId = (v: string) => (/^[A-Za-z0-9_-]{1,64}$/.test(v) ? v : '');

export async function sendAgreementAction(projectId: string, fields: Record<string, string>): Promise<Out> {
  const id = safeId(String(projectId));
  const clean: Record<string, string> = {};
  for (const k of ['clientName', 'relation', 'address', 'pan', 'siteAddress', 'date']) clean[k] = String(fields?.[k] ?? '').slice(0, 500);
  const r = await sendAgreement(id, clean);
  if (r.ok) revalidatePath(`/studio/projects/${id}`);
  return out(r);
}

export async function uploadSignedAgreementAction(form: FormData): Promise<Out> {
  const id = safeId(String(form.get('projectId') ?? ''));
  const file = form.get('file');
  const r = await uploadSignedAgreement(id, file instanceof File ? file : null);
  if (r.ok) revalidatePath(`/studio/projects/${id}`);
  return out(r);
}
