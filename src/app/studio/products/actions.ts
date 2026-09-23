'use server';

import { revalidatePath } from 'next/cache';
import { rupeesToPaise } from '@/lib/money';
import {
  setProductRate,
  setProductActive,
  setProductStandard,
  addProduct,
  type SaveResult,
} from '@/modules/studio-quote/store';
import type { QuoteUnitName, WorkCodeName } from '@/modules/studio-quote/pricing';

/**
 * The product master's writes.
 *
 * Every one of these re-checks ownership inside `store.ts` — a product id
 * arriving in a form is not proof that it belongs to the studio submitting it,
 * and the store scopes each update by `studioId` so a stolen id matches nothing
 * rather than editing a competitor's price list.
 */

// `State` and `IDLE` live in studio/form-state.ts. A 'use server'
// file may only export async functions — and Turbopack rejects even a
// type-only re-export here, so this import is for local use and
// callers take the type from form-state directly.
import type { State } from '../form-state';

function done(result: SaveResult): State {
  if (!result.ok) return result;
  revalidatePath('/studio/products');
  revalidatePath('/studio/quotations');
  return { ok: true };
}

/**
 * Rates arrive in rupees because that is what a studio thinks in, and are
 * stored in paise because that is what the ledger is in. `rupeesToPaise` is the
 * only conversion point — it rounds once, and it throws rather than silently
 * truncating on something that is not a number.
 */
export async function saveRateAction(_prev: State, form: FormData): Promise<State> {
  const id = String(form.get('id') ?? '');
  const raw = String(form.get('rate') ?? '').trim();

  if (!id) return { ok: false, error: 'No product.' };
  if (raw === '') return done(await setProductRate(id, 0));

  const rupees = Number(raw);
  if (!Number.isFinite(rupees) || rupees < 0) {
    return { ok: false, error: 'A number, please.' };
  }

  return done(await setProductRate(id, rupeesToPaise(rupees)));
}

export async function toggleActiveAction(id: string, isActive: boolean): Promise<State> {
  return done(await setProductActive(id, isActive));
}

export async function addProductAction(_prev: State, form: FormData): Promise<State> {
  const rupees = Number(String(form.get('rate') ?? '0').trim() || '0');
  if (!Number.isFinite(rupees) || rupees < 0) {
    return { ok: false, error: 'A number for the rate, please.' };
  }

  return done(
    await addProduct({
      name: String(form.get('name') ?? ''),
      code: (String(form.get('code') ?? 'MODULAR') as WorkCodeName) || 'MODULAR',
      unit: (String(form.get('unit') ?? 'AREA') as QuoteUnitName) || 'AREA',
      ratePaise: rupeesToPaise(rupees),
      rooms: form.getAll('rooms').map(String),
      details: String(form.get('details') ?? ''),
    }),
  );
}

/**
 * Tick a product into the standard build.
 *
 * What this decides: whether the quotation builder puts it on the page when a
 * studio presses "Build the 3 BHK". See `StandardCell` for why it lives on
 * the product rather than in a list of its own.
 */
export async function toggleStandardAction(id: string, standard: boolean): Promise<State> {
  return done(await setProductStandard(id, standard));
}
