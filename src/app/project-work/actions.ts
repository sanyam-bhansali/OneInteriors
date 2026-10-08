'use server';

/**
 * The studio's and ops' actions on a customer's project (docs/CUSTOMER-
 * PLATFORM-PLAN.md, step 2), shared by /studio/updates and /ops/introductions.
 * Every one checks who is signed in against the project in project-store.ts.
 */

import { revalidatePath } from 'next/cache';
import { addDocument, fixSnag, postDecision, raiseSnagAsStaff, removeDocument, setSnagFixBy } from '@/modules/portal/project-store';

export type WorkResult = { ok: boolean; error?: string };

const refresh = () => {
  revalidatePath('/studio/updates');
  revalidatePath('/ops/introductions');
};

const photosOf = (form: FormData) => form.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0);

export async function postDecisionAction(form: FormData): Promise<WorkResult> {
  let options: unknown = null;
  try {
    options = JSON.parse(String(form.get('options') ?? 'null'));
  } catch {
    return { ok: false, error: 'The options could not be read.' };
  }
  const r = await postDecision(String(form.get('projectId') ?? ''), {
    title: form.get('title'),
    why: form.get('why'),
    dueOn: form.get('dueOn'),
    options,
  });
  refresh();
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function raiseSnagAction(form: FormData): Promise<WorkResult> {
  const r = await raiseSnagAsStaff(
    String(form.get('projectId') ?? ''),
    { title: form.get('title'), room: form.get('room'), note: form.get('note') },
    photosOf(form),
  );
  refresh();
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function fixSnagAction(form: FormData): Promise<WorkResult> {
  const r = await fixSnag(String(form.get('snagId') ?? ''), String(form.get('note') ?? ''), photosOf(form));
  refresh();
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function snagFixByAction(snagId: string, date: string): Promise<WorkResult> {
  const r = await setSnagFixBy(snagId, date);
  refresh();
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function addDocumentAction(form: FormData): Promise<WorkResult> {
  const file = form.get('file');
  const r = await addDocument(
    String(form.get('projectId') ?? ''),
    { kind: form.get('kind'), title: form.get('title') },
    file instanceof File ? file : null,
  );
  refresh();
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function removeDocumentAction(documentId: string): Promise<WorkResult> {
  const r = await removeDocument(documentId);
  refresh();
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}
