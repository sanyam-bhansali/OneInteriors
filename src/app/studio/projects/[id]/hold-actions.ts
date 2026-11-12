'use server';

import { revalidatePath } from 'next/cache';
import { askHold, decideHold, endHold, withdrawHold, type HoldResult } from '@/modules/studio-hold/store';

/** A project on hold (owner, 12 Nov 2026). Every check is in modules/studio-hold/store.ts; these clip input and refresh. */

const id = (v: unknown) => String(v ?? '').slice(0, 64);

function done(projectId: string, r: HoldResult): HoldResult {
  if (r.ok) revalidatePath(`/studio/projects/${projectId}`);
  return r;
}

export async function askHoldAction(projectId: string, reason: string, note: string): Promise<HoldResult> {
  return done(id(projectId), await askHold(id(projectId), { reason: String(reason ?? '').slice(0, 40), note: String(note ?? '').slice(0, 600) }));
}

export async function decideHoldAction(projectId: string, holdId: string, approve: boolean): Promise<HoldResult> {
  return done(id(projectId), await decideHold(id(projectId), id(holdId), approve === true));
}

export async function withdrawHoldAction(projectId: string, holdId: string): Promise<HoldResult> {
  return done(id(projectId), await withdrawHold(id(projectId), id(holdId)));
}

export async function endHoldAction(projectId: string, holdId: string): Promise<HoldResult> {
  return done(id(projectId), await endHold(id(projectId), id(holdId)));
}
