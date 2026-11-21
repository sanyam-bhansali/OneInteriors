'use server';

import { revalidatePath } from 'next/cache';
import { clearSignImage, replaceSignImage, saveInvoiceSettings } from '@/modules/project/invoice-settings';

/** Settings → Invoices (owner, 21 Nov 2026). The owner check is in the module. */
export interface InvoiceFormState {
  status: 'idle' | 'saved' | 'error';
  message?: string;
}

function done(r: { ok: true; message: string } | { ok: false; error: string }): InvoiceFormState {
  if (r.ok) revalidatePath('/studio/settings/invoices');
  return r.ok ? { status: 'saved', message: r.message } : { status: 'error', message: r.error };
}

export async function saveInvoiceSettingsAction(_prev: InvoiceFormState, form: FormData): Promise<InvoiceFormState> {
  return done(await saveInvoiceSettings(Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === 'string'))));
}

/** The signature or the stamp: `kind` is "signature" or "stamp", the file is `image`. */
export async function uploadSignImageAction(_prev: InvoiceFormState, form: FormData): Promise<InvoiceFormState> {
  const kind = form.get('kind') === 'stamp' ? 'stamp' : 'signature';
  const file = form.get('image');
  if (!(file instanceof File) || file.size === 0) return { status: 'error', message: 'Choose an image first.' };
  return done(await replaceSignImage(kind, file));
}

export async function clearSignImageAction(_prev: InvoiceFormState, form: FormData): Promise<InvoiceFormState> {
  return done(await clearSignImage(form.get('kind') === 'stamp' ? 'stamp' : 'signature'));
}
