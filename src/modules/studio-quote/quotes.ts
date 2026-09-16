import 'server-only';

/**
 * A studio's own quotations.
 *
 * Same rule as `store.ts`, and it matters more here: **every query is scoped by
 * the studio id from the session, and nothing in this file takes one as an
 * argument.** These rows carry a named client, their phone number, their
 * address and what they are about to spend — for projects that in most cases
 * have nothing to do with us. We hold that as a processor, not an owner.
 *
 * The money is all in `pricing.ts`, which is pure and tested.
 */

import { prisma } from '@/lib/prisma';
import { fromDb, toDb, type Paise } from '@/lib/money';
import { myStudioId, myBranding } from './store';
import {
  computeTotals,
  lineAmount,
  type QuoteLineInput,
  type QuoteTotals,
  type QuoteUnitName,
  type WorkCodeName,
} from './pricing';

export type QuoteStatusName = 'DRAFT' | 'ISSUED' | 'ACCEPTED' | 'DECLINED';
export type QuoteStageName = 'SALES' | 'DESIGN';

export const STATUS_LABELS: Record<QuoteStatusName, string> = {
  DRAFT: 'Draft',
  ISSUED: 'Sent',
  ACCEPTED: 'Won',
  DECLINED: 'Lost',
};

export interface QuoteLineRow {
  id: string;
  room: string;
  product: string;
  code: WorkCodeName;
  unit: QuoteUnitName;
  details: string | null;
  widthMm: number | null;
  heightMm: number | null;
  qtyMilli: number | null;
  ratePaise: Paise;
  amountPaise: Paise;
  sortOrder: number;
}

export interface QuoteRow {
  id: string;
  number: string;
  stage: QuoteStageName;
  status: QuoteStatusName;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  society: string | null;
  locality: string | null;
  config: string | null;
  carpetSqft: number | null;
  fromMarketplace: boolean;
  feeBps: number;
  discountBps: number;
  onSpotPaise: Paise;
  bookingAdvancePaise: Paise;
  welcomeNote: string | null;
  terms: string | null;
  issuedOn: Date | null;
  updatedAt: Date;
  lines: QuoteLineRow[];
}

export interface QuoteSummary {
  id: string;
  number: string;
  status: QuoteStatusName;
  clientName: string;
  society: string | null;
  config: string | null;
  fromMarketplace: boolean;
  totalPaise: Paise;
  lineCount: number;
  updatedAt: Date;
}

/** The list. Newest activity first — a quotation you touched today is the one
 *  you are still thinking about. */
export async function myQuotes(): Promise<QuoteSummary[]> {
  const studioId = await myStudioId();
  if (!studioId) return [];

  try {
    const rows = await prisma.studioQuote.findMany({
      where: { studioId },
      orderBy: { updatedAt: 'desc' },
      include: { lines: true },
      take: 200,
    });

    return rows.map((row) => {
      const totals = computeTotals(row.lines.map(toLineInput), {
        feeBps: row.feeBps,
        discountBps: row.discountBps,
        onSpotPaise: fromDb(row.onSpotPaise),
        bookingAdvancePaise: fromDb(row.bookingAdvancePaise),
      });

      return {
        id: row.id,
        number: row.number,
        status: row.status as QuoteStatusName,
        clientName: row.clientName,
        society: row.society,
        config: row.config,
        fromMarketplace: row.briefId !== null || row.introductionId !== null,
        totalPaise: totals.totalPaise,
        lineCount: row.lines.length,
        updatedAt: row.updatedAt,
      };
    });
  } catch (error) {
    console.error('[studio-quote] myQuotes failed', error);
    return [];
  }
}

function toLineInput(l: {
  code: string;
  unit: string;
  ratePaise: bigint;
  widthMm: number | null;
  heightMm: number | null;
  qtyMilli: number | null;
  amountPaise: bigint;
}): QuoteLineInput {
  return {
    code: l.code as WorkCodeName,
    unit: l.unit as QuoteUnitName,
    ratePaise: fromDb(l.ratePaise),
    widthMm: l.widthMm,
    heightMm: l.heightMm,
    qtyMilli: l.qtyMilli,
    amountPaise: fromDb(l.amountPaise),
  };
}

export async function getQuote(id: string): Promise<QuoteRow | null> {
  const studioId = await myStudioId();
  if (!studioId) return null;

  try {
    // Scoped by studioId as well as id. A quotation id in a URL is not proof
    // of anything, and this is a client's name and phone number.
    const row = await prisma.studioQuote.findFirst({
      where: { id, studioId },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!row) return null;

    return {
      id: row.id,
      number: row.number,
      stage: row.stage as QuoteStageName,
      status: row.status as QuoteStatusName,
      clientName: row.clientName,
      clientPhone: row.clientPhone,
      clientEmail: row.clientEmail,
      society: row.society,
      locality: row.locality,
      config: row.config,
      carpetSqft: row.carpetSqft,
      fromMarketplace: row.briefId !== null || row.introductionId !== null,
      feeBps: row.feeBps,
      discountBps: row.discountBps,
      onSpotPaise: fromDb(row.onSpotPaise),
      bookingAdvancePaise: fromDb(row.bookingAdvancePaise),
      welcomeNote: row.welcomeNote,
      terms: row.terms,
      issuedOn: row.issuedOn,
      updatedAt: row.updatedAt,
      lines: row.lines.map((l) => ({
        id: l.id,
        room: l.room,
        product: l.product,
        code: l.code as WorkCodeName,
        unit: l.unit as QuoteUnitName,
        details: l.details,
        widthMm: l.widthMm,
        heightMm: l.heightMm,
        qtyMilli: l.qtyMilli,
        ratePaise: fromDb(l.ratePaise),
        amountPaise: fromDb(l.amountPaise),
        sortOrder: l.sortOrder,
      })),
    };
  } catch (error) {
    console.error('[studio-quote] getQuote failed', error);
    return null;
  }
}

export function totalsFor(quote: QuoteRow): QuoteTotals {
  return computeTotals(quote.lines, {
    feeBps: quote.feeBps,
    discountBps: quote.discountBps,
    onSpotPaise: quote.onSpotPaise,
    bookingAdvancePaise: quote.bookingAdvancePaise,
  });
}

export type QuoteResult = { ok: true; id: string } | { ok: false; error: string };
export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * The next quotation number for this studio.
 *
 * Per studio, per year, computed rather than sequenced — two studios must never
 * share a counter, and a studio's numbering is something clients see and
 * accountants reconcile against. Editable afterwards, because most studios
 * already have a numbering scheme and ours should not fight it.
 */
async function nextNumber(studioId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `${year}-`;

  const last = await prisma.studioQuote.findFirst({
    where: { studioId, number: { startsWith: prefix } },
    orderBy: { number: 'desc' },
    select: { number: true },
  });

  const n = last ? Number(last.number.slice(prefix.length)) : 0;
  const next = Number.isFinite(n) ? n + 1 : 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
}

export interface NewQuoteInput {
  clientName: string;
  clientPhone?: string;
  society?: string;
  config?: string;
  carpetSqft?: number;
}

export async function createQuote(input: NewQuoteInput): Promise<QuoteResult> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };

  const clientName = input.clientName.trim();
  if (clientName.length < 2) return { ok: false, error: 'Who is it for?' };

  /**
   * Branding is required, not optional.
   *
   * A quotation with no registered name on it is a document a client cannot
   * act on and a studio cannot stand behind. Better to send them to Settings
   * once than to let them build forty lines and discover it at the print
   * screen.
   */
  const branding = await myBranding();
  if (!branding) {
    return {
      ok: false,
      error: 'Set your studio details first — a quotation has to carry your registered name.',
    };
  }

  try {
    const quote = await prisma.studioQuote.create({
      data: {
        studioId,
        number: await nextNumber(studioId),
        clientName,
        clientPhone: input.clientPhone?.trim() || null,
        society: input.society?.trim() || null,
        config: input.config?.trim() || null,
        carpetSqft: input.carpetSqft ?? null,
        // Snapshotted at creation. Changing the defaults in Settings later must
        // never rewrite a quotation already sent to a client.
        feeBps: branding.feeBps,
        discountBps: branding.discountBps,
        bookingAdvancePaise: toDb(branding.bookingAdvancePaise),
        welcomeNote: branding.welcomeNote,
        terms: branding.terms,
      },
      select: { id: true },
    });

    return { ok: true, id: quote.id };
  } catch (error) {
    console.error('[studio-quote] createQuote failed', error);
    return { ok: false, error: 'That did not save.' };
  }
}

/** Ownership check, reused by every write below. */
async function ownedQuote(quoteId: string): Promise<string | null> {
  const studioId = await myStudioId();
  if (!studioId) return null;

  const row = await prisma.studioQuote.findFirst({
    where: { id: quoteId, studioId },
    select: { id: true },
  });
  return row?.id ?? null;
}

export interface AddLineInput {
  quoteId: string;
  room: string;
  productId: string;
}

/**
 * Put a product on a quotation.
 *
 * Copies the product's name, rate, unit and defaults onto the line as a
 * SNAPSHOT. Editing the product master afterwards must never change a quotation
 * already sent — that is how a studio ends up in an argument it cannot win
 * about what it quoted.
 */
export async function addLine(input: AddLineInput): Promise<ActionResult> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };
  if (!(await ownedQuote(input.quoteId))) return { ok: false, error: 'That quotation is not yours.' };

  const product = await prisma.studioProduct.findFirst({
    where: { id: input.productId, studioId },
  });
  if (!product) return { ok: false, error: 'That product is not yours.' };

  try {
    const last = await prisma.studioQuoteLine.findFirst({
      where: { quoteId: input.quoteId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const ratePaise = fromDb(product.ratePaise);
    const line: QuoteLineInput = {
      unit: product.unit as QuoteUnitName,
      code: product.code as WorkCodeName,
      ratePaise,
      widthMm: product.defaultWidthMm,
      heightMm: product.defaultHeightMm,
      qtyMilli: product.defaultQty ? product.defaultQty * 1000 : null,
    };

    await prisma.studioQuoteLine.create({
      data: {
        quoteId: input.quoteId,
        room: input.room,
        product: product.name,
        code: product.code,
        unit: product.unit,
        details: product.details,
        widthMm: product.defaultWidthMm,
        heightMm: product.defaultHeightMm,
        qtyMilli: line.qtyMilli ?? null,
        ratePaise: product.ratePaise,
        amountPaise: toDb(lineAmount(line)),
        sortOrder: (last?.sortOrder ?? 0) + 10,
      },
    });

    await touch(input.quoteId);
    return { ok: true };
  } catch (error) {
    console.error('[studio-quote] addLine failed', error);
    return { ok: false, error: 'That did not save.' };
  }
}

export interface EditLineInput {
  lineId: string;
  widthMm?: number | null;
  heightMm?: number | null;
  qtyMilli?: number | null;
  ratePaise?: Paise;
  /** Null clears the override and returns the line to rate × quantity. */
  agreedPaise?: Paise | null;
}

export async function editLine(input: EditLineInput): Promise<ActionResult> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };

  const line = await prisma.studioQuoteLine.findFirst({
    where: { id: input.lineId, quote: { studioId } },
  });
  if (!line) return { ok: false, error: 'That line is not yours.' };

  const next: QuoteLineInput = {
    unit: line.unit as QuoteUnitName,
    code: line.code as WorkCodeName,
    ratePaise: input.ratePaise ?? fromDb(line.ratePaise),
    widthMm: input.widthMm !== undefined ? input.widthMm : line.widthMm,
    heightMm: input.heightMm !== undefined ? input.heightMm : line.heightMm,
    qtyMilli: input.qtyMilli !== undefined ? input.qtyMilli : line.qtyMilli,
    amountPaise: input.agreedPaise !== undefined ? input.agreedPaise : undefined,
  };

  try {
    await prisma.studioQuoteLine.update({
      where: { id: input.lineId },
      data: {
        widthMm: next.widthMm ?? null,
        heightMm: next.heightMm ?? null,
        qtyMilli: next.qtyMilli ?? null,
        ratePaise: toDb(next.ratePaise),
        amountPaise: toDb(lineAmount(next)),
      },
    });

    await touch(line.quoteId);
    return { ok: true };
  } catch (error) {
    console.error('[studio-quote] editLine failed', error);
    return { ok: false, error: 'That did not save.' };
  }
}

export async function removeLine(lineId: string): Promise<ActionResult> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };

  const line = await prisma.studioQuoteLine.findFirst({
    where: { id: lineId, quote: { studioId } },
    select: { id: true, quoteId: true },
  });
  if (!line) return { ok: false, error: 'That line is not yours.' };

  await prisma.studioQuoteLine.delete({ where: { id: lineId } });
  await touch(line.quoteId);
  return { ok: true };
}

export async function setQuoteStatus(
  quoteId: string,
  status: QuoteStatusName,
): Promise<ActionResult> {
  if (!(await ownedQuote(quoteId))) return { ok: false, error: 'That quotation is not yours.' };

  try {
    await prisma.studioQuote.update({
      where: { id: quoteId },
      data: {
        status,
        // Stamped once. A quotation re-sent after an edit keeps the date the
        // client first received it, which is the date any dispute turns on.
        ...(status === 'ISSUED' ? { issuedOn: new Date() } : {}),
      },
    });
    return { ok: true };
  } catch {
    return { ok: false, error: 'That did not save.' };
  }
}

/** The list sorts on `updatedAt`, so a line edit has to move the parent. */
async function touch(quoteId: string): Promise<void> {
  await prisma.studioQuote.update({ where: { id: quoteId }, data: { updatedAt: new Date() } });
}
