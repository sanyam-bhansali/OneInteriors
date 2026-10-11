'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createQuote,
  setQuoteStatus,
  saveQuoteLines,
  applyConfiguration,
  clearQuoteLines,
  saveQuoteTerms,
  saveQuoteClient,
  copyQuote,
  deleteQuote,
  type QuoteClientInput,
  type QuoteStatusName,
  type QuoteTermsInput,
  type SaveLineInput,
} from '@/modules/studio-quote/quotes';
import { isConfigName, type HomeConfig } from '@/modules/studio-quote/configure';
import { finalQuoteForClient } from '@/modules/studio-quote/final';
import { addClient } from '@/modules/studio-practice/clients';

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

/**
 * Start a quotation — and, unless asked not to, build it.
 *
 * ## Why the build happens here rather than on the next screen
 *
 * Because "new quotation" followed by an empty page is the difference
 * between a builder and a filing cabinet. The facts the build needs — who it
 * is for, how big the flat is, how long the kitchen is — are the same facts
 * anybody types when starting one, so asking for them once and arriving at
 * forty priced lines is strictly better than asking for them once, arriving
 * at nothing, and asking for them again.
 *
 * Blank is still one press away, for the one-room job where a standard build
 * is noise.
 *
 * ## The build failing does not fail the creation
 *
 * A studio whose catalogue has nothing marked standard gets an empty
 * quotation rather than an error and no quotation. They are then on the
 * builder, where the panel says what to tick and where — which is a better
 * place to learn it than a form they have just been bounced out of.
 */
export async function createQuoteAction(_prev: State, form: FormData): Promise<State> {
  const carpet = Number(str(form, 'carpetSqft'));
  const config = str(form, 'config');

  /* The lead it is for (Studio OS Phase 1): one picked on the screen, or —
     when "add them to my leads" is ticked — a new one made now. A phone
     already on a lead is refused with the name, so the person picks that
     lead instead of making a second. */
  let clientId = str(form, 'clientId') || undefined;
  if (!clientId && str(form, 'addLead') === 'yes') {
    const added = await addClient({
      name: str(form, 'clientName'),
      phone: str(form, 'clientPhone'),
      society: str(form, 'society'),
      config,
      source: 'OTHER',
    });
    if (!added.ok) {
      if ('duplicate' in added) {
        return { ok: false, error: `${added.duplicate.name} already has that number. Search for them in "Who is it for" and pick them.` };
      }
      return added;
    }
    clientId = added.id;
  }

  const result = await createQuote({
    clientName: str(form, 'clientName'),
    clientPhone: str(form, 'clientPhone'),
    society: str(form, 'society'),
    config,
    carpetSqft: Number.isFinite(carpet) && carpet > 0 ? Math.round(carpet) : undefined,
    clientId,
  });

  if (!result.ok) return result;

  if (str(form, 'build') === 'yes' && isConfigName(config)) {
    const run = Number(str(form, 'kitchenRunMm'));
    const baths = Number(str(form, 'bathrooms'));

    await applyConfiguration({
      quoteId: result.id,
      home: {
        config,
        kitchenRunMm: Number.isFinite(run) && run > 0 ? Math.round(run) : null,
        bathrooms: Number.isFinite(baths) && baths >= 0 ? Math.round(baths) : 2,
        study: str(form, 'study') === 'yes',
        balcony: str(form, 'balcony') === 'yes',
      },
    });
  }

  refresh();
  // Straight into the builder. A confirmation screen between "new quotation"
  // and "the quotation" buys nobody anything.
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
export async function saveLinesAction(quoteId: string, lines: SaveLineInput[], terms?: QuoteTermsInput): Promise<State> {
  const result = await saveQuoteLines(quoteId, lines);
  if (!result.ok) return result;
  if (terms) {
    const saved = await saveQuoteTerms(quoteId, terms);
    if (!saved.ok) return saved;
  }
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

/** Use as template (new client) or make the Design Final; opens the new one. */
export async function copyQuoteAction(quoteId: string, kind: 'template' | 'design-final', clientName = ''): Promise<State> {
  const result = await copyQuote(
    quoteId,
    kind === 'template' ? { kind: 'template', clientName: String(clientName) } : { kind: 'design-final' },
  );
  if (!result.ok) return result;
  refresh(result.id);
  redirect(`/studio/quotations/${result.id}`);
}

/** Delete a draft that was never sent. */
export async function deleteQuoteAction(quoteId: string): Promise<State> {
  const result = await deleteQuote(quoteId);
  if (!result.ok) return result;
  revalidatePath('/studio/quotations');
  redirect('/studio/quotations');
}

/** Correct who the quotation is for. */
export async function saveClientAction(quoteId: string, input: QuoteClientInput): Promise<State> {
  const result = await saveQuoteClient(quoteId, input);
  if (!result.ok) return result;
  refresh(quoteId);
  return { ok: true };
}

export async function clearLinesAction(quoteId: string): Promise<State> {
  const result = await clearQuoteLines(quoteId);
  if (!result.ok) return result;
  refresh(quoteId);
  return { ok: true };
}

/**
 * The final quote for a client One Interiors introduced: opens the one that
 * exists, or starts it from the standard build, linked so the customer can
 * read and sign it in the app once it is issued.
 */
export async function finalQuoteAction(clientId: string): Promise<State> {
  const result = await finalQuoteForClient(clientId);
  if (!result.ok) return result;
  refresh(result.id);
  redirect(`/studio/quotations/${result.id}`);
}
