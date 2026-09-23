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
import { planQuotation, type CatalogueProduct, type HomeConfig } from './configure';
import type { ComparableLine } from './revision';

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
  kitchenRunMm: number | null;
  bathrooms: number | null;
  /** The lines as the client first received them. Empty until issued. */
  issuedLines: ComparableLine[];
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
      kitchenRunMm: row.kitchenRunMm,
      bathrooms: row.bathrooms,
      issuedLines: readIssued(row.issuedLines),
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

export async function setQuoteStatus(
  quoteId: string,
  status: QuoteStatusName,
): Promise<ActionResult> {
  if (!(await ownedQuote(quoteId))) return { ok: false, error: 'That quotation is not yours.' };

  try {
    /* Stamped ONCE, and `issuedOn === null` is the test.
       The condition was `status === 'ISSUED'` alone, which meant pressing
       Reopen on a won or lost quotation sent it back to ISSUED and overwrote
       the date the client first received it — the date any dispute turns on,
       and the exact thing the comment here promised was stable. */
    const current = await prisma.studioQuote.findUnique({
      where: { id: quoteId },
      select: { issuedOn: true, issuedLines: true },
    });

    const firstIssue = status === 'ISSUED' && current?.issuedOn == null;

    /**
     * The copy the client receives, frozen on the way out.
     *
     * Taken on the FIRST issue only, guarded by `issuedLines` as well as
     * `issuedOn`. Re-sending a revised quotation must not overwrite it — the
     * whole value of the snapshot is that it is the version somebody is
     * holding while asking what changed, and a snapshot that updates itself
     * answers "nothing" every time.
     */
    const snapshot =
      firstIssue && current?.issuedLines == null
        ? await prisma.studioQuoteLine.findMany({
            where: { quoteId },
            orderBy: { sortOrder: 'asc' },
            select: { room: true, product: true, amountPaise: true },
          })
        : null;

    await prisma.studioQuote.update({
      where: { id: quoteId },
      data: {
        status,
        ...(firstIssue ? { issuedOn: new Date() } : {}),
        ...(snapshot
          ? {
              issuedLines: snapshot.map((l) => ({
                room: l.room,
                product: l.product,
                // Plain number, not BigInt: Json cannot hold one, and this is
                // read back by `readIssued` which expects exactly this shape.
                amountPaise: fromDb(l.amountPaise),
              })),
            }
          : {}),
      },
    });
    return { ok: true };
  } catch {
    return { ok: false, error: 'That did not save.' };
  }
}

// ── The whole quotation at once ────────────────────────────────

/**
 * Reading the frozen issued copy back.
 *
 * Defensive rather than trusting, because this column is Json: it was written
 * by an older version of this file at some point in the past, and the shape a
 * Json column holds is whatever was true the day it was written. A snapshot
 * that cannot be read produces an empty comparison — "we cannot show what
 * changed" — rather than a page that will not load.
 */
function readIssued(value: unknown): ComparableLine[] {
  if (!Array.isArray(value)) return [];

  const lines: ComparableLine[] = [];
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null) continue;
    const row = raw as Record<string, unknown>;
    if (typeof row.room !== 'string' || typeof row.product !== 'string') continue;
    if (typeof row.amountPaise !== 'number' || !Number.isFinite(row.amountPaise)) continue;
    lines.push({ room: row.room, product: row.product, amountPaise: row.amountPaise });
  }
  return lines;
}

/** One line as the builder hands it back. `id` is absent on a new line. */
export interface SaveLineInput {
  id?: string;
  room: string;
  product: string;
  code: WorkCodeName;
  unit: QuoteUnitName;
  details?: string | null;
  widthMm?: number | null;
  heightMm?: number | null;
  qtyMilli?: number | null;
  ratePaise: Paise;
  /** The agreed figure, overriding the arithmetic. Null returns the line to rate × quantity. */
  agreedPaise?: Paise | null;
}

/** A line that survives the trip back from a browser. */
function cleanLine(raw: SaveLineInput): SaveLineInput | null {
  const room = String(raw.room ?? '').trim();
  const product = String(raw.product ?? '').trim();
  if (room.length === 0 || product.length === 0) return null;

  const code: WorkCodeName = raw.code === 'ONSITE' ? 'ONSITE' : 'MODULAR';
  const unit: QuoteUnitName =
    raw.unit === 'SQFT' || raw.unit === 'RFT' || raw.unit === 'UNIT' ? raw.unit : 'AREA';

  const whole = (value: unknown): number | null => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    const n = Math.round(value);
    /* Refused, not clamped. A negative width is a typo and a hundred-metre
       wardrobe is a slipped decimal point; both should come back as a line
       somebody looks at again rather than a number that prints. */
    return n > 0 && n < 100_000_000 ? n : null;
  };

  const money = (value: unknown): Paise => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
    const n = Math.round(value);
    return n >= 0 ? n : 0;
  };

  return {
    id: typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : undefined,
    room: room.slice(0, 80),
    product: product.slice(0, 200),
    code,
    unit,
    details: typeof raw.details === 'string' ? raw.details.slice(0, 2_000) : null,
    widthMm: whole(raw.widthMm),
    heightMm: whole(raw.heightMm),
    qtyMilli: whole(raw.qtyMilli),
    ratePaise: money(raw.ratePaise),
    agreedPaise: raw.agreedPaise == null ? null : money(raw.agreedPaise),
  };
}

/**
 * Save the whole quotation in one go.
 *
 * ## Why this replaced a save per line
 *
 * The builder used to write each row on its own the moment it changed. Nothing
 * was ever unsaved, which sounds like the safe choice and was the wrong one:
 * pricing a job is forty lines of arithmetic where each number depends on the
 * last, and forty round trips means the total on screen lags behind the
 * figures being discussed. A designer needs to see what a change costs while
 * the client is still asking.
 *
 * So the builder holds the lines, recalculates as they type, and this writes
 * the result — one transaction, one `updatedAt`, one entry in the client's
 * sense of what happened.
 *
 * ## Diffed rather than deleted and recreated
 *
 * The obvious build deletes every line and inserts the new set. It is shorter,
 * and it throws away the ids — which the issued comparison does not need, but
 * anything later that references a line would. Matching on id keeps a line the
 * same line across an edit, which is what it is.
 */
export async function saveQuoteLines(
  quoteId: string,
  rawLines: SaveLineInput[],
): Promise<ActionResult> {
  if (!(await ownedQuote(quoteId))) return { ok: false, error: 'That quotation is not yours.' };

  if (rawLines.length > 500) {
    return { ok: false, error: 'That is more lines than a quotation can hold.' };
  }

  const lines = rawLines.map(cleanLine).filter((l): l is SaveLineInput => l !== null);

  try {
    const existing = await prisma.studioQuoteLine.findMany({
      where: { quoteId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((l) => l.id));

    /* Ids the browser sent that are not on this quotation are dropped to
       new lines rather than trusted. An id in a payload is not proof of
       anything, and writing to one would be writing to another studio's
       quotation. */
    const kept = new Set<string>();

    const writes = lines.map((line, index) => {
      const amountPaise = toDb(
        lineAmount({
          unit: line.unit,
          code: line.code,
          ratePaise: line.ratePaise,
          widthMm: line.widthMm,
          heightMm: line.heightMm,
          qtyMilli: line.qtyMilli,
          amountPaise: line.agreedPaise ?? undefined,
        }),
      );

      const data = {
        room: line.room,
        product: line.product,
        code: line.code,
        unit: line.unit,
        details: line.details ?? null,
        widthMm: line.widthMm ?? null,
        heightMm: line.heightMm ?? null,
        qtyMilli: line.qtyMilli ?? null,
        ratePaise: toDb(line.ratePaise),
        amountPaise,
        /* Position in the array IS the order. The builder lets lines be moved,
           and a sort key derived from anything else would fight it. */
        sortOrder: (index + 1) * 10,
      };

      if (line.id && existingIds.has(line.id)) {
        kept.add(line.id);
        return prisma.studioQuoteLine.update({ where: { id: line.id }, data });
      }
      return prisma.studioQuoteLine.create({ data: { ...data, quoteId } });
    });

    const gone = [...existingIds].filter((id) => !kept.has(id));

    await prisma.$transaction([
      ...(gone.length > 0
        ? [prisma.studioQuoteLine.deleteMany({ where: { id: { in: gone }, quoteId } })]
        : []),
      ...writes,
      prisma.studioQuote.update({ where: { id: quoteId }, data: { updatedAt: new Date() } }),
    ]);

    return { ok: true };
  } catch (error) {
    console.error('[studio-quote] saveQuoteLines failed', error);
    return { ok: false, error: 'That did not save. Nothing was changed.' };
  }
}

export interface ApplyConfigInput {
  quoteId: string;
  home: HomeConfig;
}

export type ApplyResult =
  | { ok: true; added: number; notes: string[] }
  | { ok: false; error: string };

/**
 * Build the standard quotation for this flat, from this studio's catalogue.
 *
 * ## It replaces, and it says so before it does
 *
 * Applying a configuration over existing lines discards them. That is the
 * behaviour anybody wants — "I picked 2 BHK and it is a 3" is the common case
 * — but it is destructive, so the builder asks first when there is anything to
 * lose. Doing it silently here, and confirming in the UI, keeps the
 * destructive step in one place instead of two.
 *
 * ## The configuration is kept
 *
 * Kitchen run and bathroom count are written onto the quotation, not just used
 * and forgotten. A studio who rebuilds after correcting one rate should not be
 * asked to measure the kitchen again.
 */
export async function applyConfiguration(input: ApplyConfigInput): Promise<ApplyResult> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };
  if (!(await ownedQuote(input.quoteId))) {
    return { ok: false, error: 'That quotation is not yours.' };
  }

  try {
    const products = await prisma.studioProduct.findMany({
      where: { studioId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    const catalogue: CatalogueProduct[] = products.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code as WorkCodeName,
      unit: p.unit as QuoteUnitName,
      details: p.details,
      ratePaise: fromDb(p.ratePaise),
      rooms: p.rooms,
      defaultWidthMm: p.defaultWidthMm,
      defaultHeightMm: p.defaultHeightMm,
      defaultQty: p.defaultQty,
      inStandardBuild: p.inStandardBuild,
      isActive: p.isActive,
      sortOrder: p.sortOrder,
    }));

    const { lines, notes } = planQuotation(input.home, catalogue);

    await prisma.$transaction([
      prisma.studioQuoteLine.deleteMany({ where: { quoteId: input.quoteId } }),
      ...lines.map((line, index) =>
        prisma.studioQuoteLine.create({
          data: {
            quoteId: input.quoteId,
            room: line.room,
            product: line.product,
            code: line.code,
            unit: line.unit,
            details: line.details,
            widthMm: line.widthMm,
            heightMm: line.heightMm,
            qtyMilli: line.qtyMilli,
            ratePaise: toDb(line.ratePaise),
            amountPaise: toDb(
              lineAmount({
                unit: line.unit,
                code: line.code,
                ratePaise: line.ratePaise,
                widthMm: line.widthMm,
                heightMm: line.heightMm,
                qtyMilli: line.qtyMilli,
              }),
            ),
            sortOrder: (index + 1) * 10,
          },
        }),
      ),
      prisma.studioQuote.update({
        where: { id: input.quoteId },
        data: {
          config: input.home.config,
          kitchenRunMm: input.home.kitchenRunMm,
          bathrooms: input.home.bathrooms,
          updatedAt: new Date(),
        },
      }),
    ]);

    return { ok: true, added: lines.length, notes };
  } catch (error) {
    console.error('[studio-quote] applyConfiguration failed', error);
    return { ok: false, error: 'That did not build. Nothing was changed.' };
  }
}

/** Start again from nothing, keeping the client and the terms. */
export async function clearQuoteLines(quoteId: string): Promise<ActionResult> {
  if (!(await ownedQuote(quoteId))) return { ok: false, error: 'That quotation is not yours.' };

  try {
    await prisma.$transaction([
      prisma.studioQuoteLine.deleteMany({ where: { quoteId } }),
      prisma.studioQuote.update({ where: { id: quoteId }, data: { updatedAt: new Date() } }),
    ]);
    return { ok: true };
  } catch {
    return { ok: false, error: 'That did not save.' };
  }
}
