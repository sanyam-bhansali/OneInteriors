'use server';

import { guarded, SAVE_FAILED } from '@/lib/action-guard';

import { revalidatePath } from 'next/cache';
import { saveRate, setRateActive, type ElectricalResult } from '@/modules/project/electrical-bill';

/** The electrical rate list (owner, 22 Nov 2026). The checks are in the module. */
function done(r: ElectricalResult): ElectricalResult {
  if (r.ok) revalidatePath('/studio/products/electrical');
  return r;
}

export async function saveRateAction(input: { id?: string; name: string; unit: string; details: string; rate: string }) {
  return guarded('saveRateAction', { ok: false, error: SAVE_FAILED }, async () => {
  return done(await saveRate(input));
});
}

export async function setRateActiveAction(id: string, active: boolean) {
  return guarded('setRateActiveAction', { ok: false, error: SAVE_FAILED }, async () => {
  return done(await setRateActive(id, active));
});
}
