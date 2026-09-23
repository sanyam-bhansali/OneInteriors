'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createQuote,
  setQuoteStatus,
  saveQuoteLines,
  applyConfiguration,
  clearQuoteLines,
  type QuoteStatusName,
  type SaveLineInput,
} from '@/modules/studio-quote/quotes';
import type { HomeConfig } from '@/modules/studio-quote/configure';

// `State` and `IDLE` live in studio/form-state.ts. A 'use server'
// file may only export async functions — and Turbopack rejects even a
// type-only re-export here, so this import is for local use and
// callers take the type from form-state directly.
import type { State } from '../form-state';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

function refresh(quoteId?: string) {
  revalidatePath('/studio/quotations');
  revalidatePath('/studio');
  if (quoteId) revalidatePath(`/studio/quotations/${quoteId}`);
}

export async function createQuoteAction(_prev: State, form: FormData): Promise<State> {
  const carpet = Number(str(form, 'carpetSqft'));

  const result = await createQuote({
    clientName: str(form, 'clientName'),
    clientPhone: str(form, 'clientPhone'),
    society: str(form, 'society'),
    config: str(form, 'config'),
    carpetSqft: Number.isFinite(carpet) && carpet > 0 ? Math.round(carpet) : undefined,
  });

  if (!result.ok) return result;

  refresh();
  // Straight into the builder. A confirmation screen between "new quotation"
  // and "add the first line" buys nobody anything.
  redirect(`/studio/quotations/${result.id}`);
}

/**
 * The per-line writes that used to live here are gone.
 *
 * `addLineAction`, `editLineAction` and `removeLineAction` each wrote one row
 * the moment it changed. The builder now holds the lines and sends them
 * together through `saveLinesAction`, and keeping the old path alongside it
 * would be two ways to write a quotation line that round differently the
 * first time one of them is changed and the other is not.
 *
 * Recoverable from git history if a single-line write is ever wanted again.
 */

export async function setStatusAction(quoteId: string, status: QuoteStatusName): Promise<State> {
  const result = await setQuoteStatus(quoteId, status);
  if (!result.ok) return result;
  refresh(quoteId);
  return { ok: true };
}

/**
 * The builder's Save: the whole quotation, in one call.
 *
 * Takes an array rather than a FormData. This is the one place in the studio
 * surface that does, and the reason is that the payload is forty rows of
 * numbers with an order that matters — serialising that through form fields
 * means `lines[7].widthMm` string keys and a parser to match, which is a
 * second place for the shape to be wrong.
 *
 * The array is still untrusted. `saveQuoteLines` cleans every field and
 * refuses ids that are not on this quotation; nothing here assumes the
 * browser sent what the builder renders.
 */
export async function saveLinesAction(quoteId: string, lines: SaveLineInput[]): Promise<State> {
  const result = await saveQuoteLines(quoteId, lines);
  if (!result.ok) return result;
  refresh(quoteId);
  return { ok: true };
}

export type BuildState =
  | { ok: true; added: number; notes: string[] }
  | { ok: false; error: string }
  | null;

/** Build the standard quotation for this flat. Replaces whatever is there. */
export async function applyConfigAction(quoteId: string, home: HomeConfig): Promise<BuildState> {
  const result = await applyConfiguration({ quoteId, home });
  if (!result.ok) return result;
  refresh(quoteId);
  return result;
}

export async function clearLinesAction(quoteId: string): Promise<State> {
  const result = await clearQuoteLines(quoteId);
  if (!result.ok) return result;
  refresh(quoteId);
  return { ok: true };
}
