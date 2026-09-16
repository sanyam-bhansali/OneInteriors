'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { rupeesToPaise } from '@/lib/money';
import {
  createQuote,
  addLine,
  editLine,
  removeLine,
  setQuoteStatus,
  type QuoteStatusName,
} from '@/modules/studio-quote/quotes';
import { QTY_SCALE } from '@/modules/studio-quote/pricing';

export type State = { ok: true } | { ok: false; error: string } | { idle: true };
export const IDLE: State = { idle: true };

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

export async function addLineAction(quoteId: string, room: string, productId: string): Promise<State> {
  const result = await addLine({ quoteId, room, productId });
  if (!result.ok) return result;
  refresh(quoteId);
  return { ok: true };
}

/**
 * Edit one line.
 *
 * Dimensions arrive in millimetres and quantities in whole units; the quantity
 * is scaled to thousandths here, at the edge, so the store never has to guess
 * which unit it was handed.
 *
 * An empty "agreed" field CLEARS the override rather than setting zero — those
 * are different answers, and conflating them would silently zero a line the
 * moment somebody tabbed through it.
 */
export async function editLineAction(_prev: State, form: FormData): Promise<State> {
  const lineId = str(form, 'lineId');
  const quoteId = str(form, 'quoteId');
  if (!lineId) return { ok: false, error: 'No line.' };

  const num = (k: string): number | null => {
    const raw = str(form, k);
    if (raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const width = num('widthMm');
  const height = num('heightMm');
  const qty = num('qty');
  const rate = num('rate');
  const agreedRaw = str(form, 'agreed');

  if (str(form, 'rate') !== '' && rate === null) {
    return { ok: false, error: 'The rate needs to be a number.' };
  }

  const result = await editLine({
    lineId,
    widthMm: width,
    heightMm: height,
    qtyMilli: qty === null ? null : Math.round(qty * QTY_SCALE),
    ratePaise: rate === null ? undefined : rupeesToPaise(rate),
    agreedPaise: agreedRaw === '' ? null : rupeesToPaise(Number(agreedRaw)),
  });

  if (!result.ok) return result;
  refresh(quoteId);
  return { ok: true };
}

export async function removeLineAction(lineId: string, quoteId: string): Promise<State> {
  const result = await removeLine(lineId);
  if (!result.ok) return result;
  refresh(quoteId);
  return { ok: true };
}

export async function setStatusAction(quoteId: string, status: QuoteStatusName): Promise<State> {
  const result = await setQuoteStatus(quoteId, status);
  if (!result.ok) return result;
  refresh(quoteId);
  return { ok: true };
}
