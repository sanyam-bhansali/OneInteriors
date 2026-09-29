'use server';

import { revalidatePath } from 'next/cache';
import { postStudioUpdate } from '@/modules/portal/tracker-store';

export async function postStudioUpdateAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const r = await postStudioUpdate(
    String(formData.get('projectId') ?? ''),
    String(formData.get('note') ?? ''),
    String(formData.get('stage') ?? '') || null,
    formData.getAll('photos').filter((f): f is File => f instanceof File),
  );
  revalidatePath('/studio/updates');
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}
