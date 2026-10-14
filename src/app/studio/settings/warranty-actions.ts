'use server';

import { revalidatePath } from 'next/cache';
import { saveSnagWindowDays, saveWarrantyMonths } from '@/modules/studio/warranty';

/** Settings, Warranty (months). The owner check is in the module. */
export async function saveWarrantyAction(months: string): Promise<{ ok: boolean; message: string }> {
  const r = await saveWarrantyMonths(String(months ?? '').slice(0, 4));
  if (r.ok) revalidatePath('/studio/settings');
  return r.ok ? { ok: true, message: r.message } : { ok: false, message: r.error };
}

/** Settings, Warranty (snag window, days). The owner check is in the module. */
export async function saveSnagWindowAction(days: string): Promise<{ ok: boolean; message: string }> {
  const r = await saveSnagWindowDays(String(days ?? '').slice(0, 4));
  if (r.ok) revalidatePath('/studio/settings');
  return r.ok ? { ok: true, message: r.message } : { ok: false, message: r.error };
}
