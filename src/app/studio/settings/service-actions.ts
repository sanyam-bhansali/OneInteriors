'use server';

import { revalidatePath } from 'next/cache';
import { saveServiceSettings } from '@/modules/aftercare/store';

/** Settings, Service visits. The owner check is in the module. */
export async function saveServiceChargesAction(charges: Record<string, string>, visits: string): Promise<{ ok: boolean; message: string }> {
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(charges ?? {}).slice(0, 20)) clean[String(k).slice(0, 20)] = String(v ?? '').slice(0, 12);
  const r = await saveServiceSettings(clean, String(visits ?? '').slice(0, 4));
  if (r.ok) revalidatePath('/studio/settings');
  return r.ok ? { ok: true, message: r.message } : { ok: false, message: r.error };
}
