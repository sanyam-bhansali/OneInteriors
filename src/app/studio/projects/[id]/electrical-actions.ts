'use server';

import { revalidatePath } from 'next/cache';
import { cancelExtra, sendExtra } from '@/modules/project/change-orders';
import { saveElectricalDraft } from '@/modules/project/electrical-bill';

/** The electrical bill (owner, 22 Nov 2026). Saving checks the rate list; sending and cancelling are the change order's own. */
type Result = { ok: true; message: string; id?: string } | { ok: false; error: string };

function done(projectId: string, r: { ok: boolean; message?: string; error?: string; id?: string }, fallback: string): Result {
  if (r.ok) {
    revalidatePath(`/studio/projects/${projectId}`);
    return { ok: true, message: r.message ?? fallback, id: r.id };
  }
  return { ok: false, error: r.error ?? 'That did not go through. Try again.' };
}

export async function saveElectricalAction(projectId: string, input: { id?: string; lines: { itemId: string; qty: string; note: string }[] }): Promise<Result> {
  return done(projectId, await saveElectricalDraft(projectId, input), 'Saved.');
}

export async function sendElectricalAction(projectId: string, id: string): Promise<Result> {
  return done(projectId, await sendExtra(id), 'Sent to the client to approve in the app.');
}

export async function cancelElectricalAction(projectId: string, id: string): Promise<Result> {
  return done(projectId, await cancelExtra(id), 'Cancelled.');
}
