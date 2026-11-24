'use server';

import { guarded, SAVE_FAILED } from '@/lib/action-guard';

import { revalidatePath } from 'next/cache';
import { giveCash, reviewExpense, type PettyResult } from '@/modules/petty-cash/store';

/** Accounts' petty cash (owner, 21 Nov 2026). The checks are in the module (petty-cash/). */

function done(r: PettyResult): PettyResult {
  if (r.ok) {
    revalidatePath('/studio/payments/petty-cash');
    revalidatePath('/studio/payments');
    revalidatePath('/studio/site/cash');
  }
  return r;
}

export async function giveCashAction(input: { memberId: string; amount: string; givenOn: string; note: string }): Promise<PettyResult> {
  return guarded('giveCashAction', { ok: false, error: SAVE_FAILED }, async () => {
  return done(await giveCash(input));
});
}

export async function reviewExpenseAction(id: string, action: 'clear' | 'reject' | 'undo', note: string): Promise<PettyResult> {
  return guarded('reviewExpenseAction', { ok: false, error: SAVE_FAILED }, async () => {
  return done(await reviewExpense(id, action, note));
});
}
