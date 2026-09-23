'use server';

import { revalidatePath } from 'next/cache';
import { rupeesToPaise } from '@/lib/money';
import { saveBranding } from '@/modules/studio-quote/store';
import { replaceLogo, clearLogo, setHideOurMark } from '@/modules/studio-quote/store';

// `State` and `IDLE` live in studio/form-state.ts. A 'use server'
// file may only export async functions — and Turbopack rejects even a
// type-only re-export here, so this import is for local use and
// callers take the type from form-state directly.
import type { State } from '../form-state';

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
    /* No registered name, address or GSTIN: those are the registration
       step's, and Settings shows them rather than asking again. */
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

// ── Logo and the attribution mark ──────────────────────────────

export interface BrandAssetState {
  status: 'idle' | 'saved' | 'error';
  error?: string;
}

/**
 * Take a new logo.
 *
 * Its own action and its own `<form>`, because a file input cannot live
 * inside the branding form — HTML has no nested forms, and putting the file
 * on the main form would mean every save of a phone number re-uploaded the
 * logo.
 */
export async function uploadLogoAction(
  _prev: BrandAssetState,
  form: FormData,
): Promise<BrandAssetState> {
  const file = form.get('logo');
  if (!(file instanceof File) || file.size === 0) {
    return { status: 'error', error: 'Choose an image first.' };
  }

  const result = await replaceLogo(file);
  if (!result.ok) return { status: 'error', error: result.error };

  revalidatePath('/studio', 'layout');
  return { status: 'saved' };
}

export async function clearLogoAction(
  _prev: BrandAssetState,
  _form: FormData,
): Promise<BrandAssetState> {
  const result = await clearLogo();
  if (!result.ok) return { status: 'error', error: result.error };

  revalidatePath('/studio', 'layout');
  return { status: 'saved' };
}

/**
 * Record what they want about our mark.
 *
 * Stored whatever their tier is — see `showsOurMark()`. Saving the wish for a
 * studio who cannot yet act on it is what makes an upgrade take effect
 * without anybody coming back to this screen.
 */
export async function setMarkAction(
  _prev: BrandAssetState,
  form: FormData,
): Promise<BrandAssetState> {
  const result = await setHideOurMark(form.get('hide') === 'on');
  if (!result.ok) return { status: 'error', error: result.error };

  revalidatePath('/studio', 'layout');
  return { status: 'saved' };
}
