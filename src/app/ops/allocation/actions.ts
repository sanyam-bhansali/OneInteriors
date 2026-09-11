'use server';

import { revalidatePath } from 'next/cache';
import { autoPauseSweep, pauseStudio, resumeStudio, setCapacity } from '@/modules/studio/allocation';

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function pauseAction(studioId: string, reason: string): Promise<ActionResult> {
  const result = await pauseStudio(studioId, reason);
  if (result.ok) revalidatePath('/ops/allocation');
  return result;
}

export async function resumeAction(studioId: string): Promise<ActionResult> {
  const result = await resumeStudio(studioId);
  if (result.ok) revalidatePath('/ops/allocation');
  return result;
}

export async function capacityAction(
  studioId: string,
  capacity: number | null,
): Promise<ActionResult> {
  const result = await setCapacity(studioId, capacity);
  if (result.ok) revalidatePath('/ops/allocation');
  return result;
}

export type SweepActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

/**
 * Run the pause sweep on demand.
 *
 * A button rather than only a schedule, because the first thing anyone does
 * after changing a studio's capacity is want to see the effect — and because a
 * sweep that only ever runs at 3am is a sweep nobody trusts.
 */
export async function sweepAction(): Promise<SweepActionResult> {
  try {
    const r = await autoPauseSweep();
    const parts: string[] = [];
    if (r.pausedAtCapacity.length) parts.push(`${r.pausedAtCapacity.length} paused at capacity`);
    if (r.pausedUnpaid.length) parts.push(`${r.pausedUnpaid.length} paused for non-payment`);
    if (r.resumed.length) parts.push(`${r.resumed.length} put back in rotation`);

    revalidatePath('/ops/allocation');
    revalidatePath('/ops');

    return {
      ok: true,
      message: parts.length ? parts.join(', ') + '.' : 'Nothing needed changing.',
    };
  } catch (error) {
    console.error('[allocation] sweep failed', error);
    return { ok: false, error: 'The sweep did not finish. Nothing was changed.' };
  }
}
