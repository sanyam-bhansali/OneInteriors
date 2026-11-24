'use server';

import { guarded, SAVE_FAILED } from '@/lib/action-guard';

import { revalidatePath } from 'next/cache';
import { logExpense, markReceived, type PettyResult } from '@/modules/petty-cash/store';

/** Petty cash on the supervisor's phone (owner, 21 Nov 2026). The checks are in the module (petty-cash/). */

function done(r: PettyResult): PettyResult {
  if (r.ok) {
    revalidatePath('/studio/site/cash');
    revalidatePath('/studio/payments/petty-cash');
  }
  return r;
}

export async function logExpenseAction(form: FormData): Promise<PettyResult> {
  return guarded('logExpenseAction', { ok: false, error: SAVE_FAILED }, async () => {
  return done(await logExpense(form));
});
}

export async function markReceivedAction(cashId: string): Promise<PettyResult> {
  return guarded('markReceivedAction', { ok: false, error: SAVE_FAILED }, async () => {
  return done(await markReceived(cashId));
});
}
