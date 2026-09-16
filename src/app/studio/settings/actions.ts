'use server';

import { revalidatePath } from 'next/cache';
import { rupeesToPaise } from '@/lib/money';
import { saveBranding } from '@/modules/studio-quote/store';

export type State = { ok: true } | { ok: false; error: string } | { idle: true };
export const IDLE: State = { idle: true };

/**
 * Percentages arrive as percentages and are stored as basis points.
 *
 * A studio types 7.5, we store 750. Doing it here rather than in the store
 * keeps the conversion at the edge, where every other unit conversion in this
 * codebase lives, and means the store's validation can be about integers
 * without also having to guess what unit it was handed.
 */
function toBps(raw: string): number | null {
  const pct = Number(raw.trim());
  if (!Number.isFinite(pct) || pct < 0) return null;
  return Math.round(pct * 100);
}

export async function saveBrandingAction(_prev: State, form: FormData): Promise<State> {
  const str = (k: string) => String(form.get(k) ?? '').trim();

  const feeBps = toBps(str('feePct') || '0');
  const discountBps = toBps(str('discountPct') || '0');
  if (feeBps === null) return { ok: false, error: 'The professional fee needs to be a number.' };
  if (discountBps === null) return { ok: false, error: 'The discount needs to be a number.' };

  const advance = Number(str('bookingAdvance') || '0');
  if (!Number.isFinite(advance) || advance < 0) {
    return { ok: false, error: 'The booking advance needs to be a number.' };
  }

  const result = await saveBranding({
    legalName: str('legalName'),
    addressLine: str('addressLine'),
    city: str('city'),
    pincode: str('pincode'),
    gstin: str('gstin'),
    phone: str('phone'),
    email: str('email'),
    website: str('website'),
    welcomeNote: str('welcomeNote'),
    terms: str('terms'),
    feeBps,
    discountBps,
    bookingAdvancePaise: rupeesToPaise(advance),
  });

  if (!result.ok) return result;

  revalidatePath('/studio/settings');
  revalidatePath('/studio/quotations');
  return { ok: true };
}
