'use server';

import { revalidatePath } from 'next/cache';
import { rupeesToPaise } from '@/lib/money';
import {
  addVendor,
  addWorkOrder,
  addWorkOrderLine,
  recordPayment,
  type PaymentModeName,
} from '@/modules/studio-practice/vendors';
import type { QuoteUnitName } from '@/modules/studio-quote/pricing';

export type State = { ok: true } | { ok: false; error: string } | { idle: true };
export const IDLE: State = { idle: true };

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

function refresh() {
  revalidatePath('/studio/vendors');
  revalidatePath('/studio/projects');
  revalidatePath('/studio');
}

export async function addVendorAction(_prev: State, form: FormData): Promise<State> {
  const result = await addVendor({
    name: str(form, 'name'),
    trade: str(form, 'trade'),
    phone: str(form, 'phone'),
  });
  if (!result.ok) return result;
  refresh();
  return { ok: true };
}

export async function addWorkOrderAction(_prev: State, form: FormData): Promise<State> {
  const result = await addWorkOrder({
    projectId: str(form, 'projectId'),
    vendorId: str(form, 'vendorId'),
    dueOn: str(form, 'dueOn') || undefined,
  });
  if (!result.ok) return result;
  refresh();
  return { ok: true };
}

export async function addLineAction(_prev: State, form: FormData): Promise<State> {
  const qty = Number(str(form, 'qty'));
  const rate = Number(str(form, 'rate'));

  if (!Number.isFinite(qty) || qty <= 0) return { ok: false, error: 'A quantity, please.' };
  if (!Number.isFinite(rate) || rate < 0) return { ok: false, error: 'A rate, please.' };

  const result = await addWorkOrderLine({
    workOrderId: str(form, 'workOrderId'),
    description: str(form, 'description'),
    unit: (str(form, 'unit') || 'SQFT') as QuoteUnitName,
    qty,
    ratePaise: rupeesToPaise(rate),
  });

  if (!result.ok) return result;
  refresh();
  return { ok: true };
}

/**
 * Money going out.
 *
 * The amount is checked against the outstanding balance inside `recordPayment`,
 * which refuses anything that would take the order past its bill and says by
 * how much. Accepting it and showing a negative balance means the mistake is
 * found at reconciliation rather than at the keyboard — and by then somebody
 * has been paid twice.
 */
export async function payAction(_prev: State, form: FormData): Promise<State> {
  const amount = Number(str(form, 'amount'));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'How much?' };
  }

  const result = await recordPayment({
    workOrderId: str(form, 'workOrderId'),
    amountPaise: rupeesToPaise(amount),
    mode: (str(form, 'mode') || 'BANK') as PaymentModeName,
    reference: str(form, 'reference'),
    paidOn: str(form, 'paidOn') || undefined,
  });

  if (!result.ok) return result;
  refresh();
  return { ok: true };
}
