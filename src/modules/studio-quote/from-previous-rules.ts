/**
 * "Start from a previous quotation" (owner, 17 Nov 2026: "While building a
 * quotation i want an option to use previous quotation as template").
 *
 * Pure, and tested (tests/studio-quote-from-previous.test.ts); the database
 * side is in `from-previous.ts`.
 *
 * What a template carries is decided HERE, by listing what is copied rather
 * than what is dropped: the lines (rooms, products, sizes, quantities, rates,
 * agreed amounts, notes) and the commercial terms (fee, discount, GST, the
 * flat discount, the advance, the payment stages, the welcome note and the
 * terms text), plus the flat facts the lines were sized for (kitchen run,
 * bathrooms). Never the old client's name, phone, email, address, lead,
 * marketplace links, status, sent copy, revisions, sales-final / design-final
 * marks or sign-offs — those are not in this list, so they cannot leak in.
 *
 * Photos are not stored on a line: a line shows the photo of the product it
 * names (product master → item), so a copied line shows the same photo.
 */

import type { Prisma } from '@prisma/client';
import { lineAmount, type QuoteUnitName, type WorkCodeName } from './pricing';

/** A source line, as read from the database (money as BigInt). */
export interface SourceLine {
  room: string;
  product: string;
  code: string;
  unit: string;
  details: string | null;
  widthMm: number | null;
  heightMm: number | null;
  qtyMilli: number | null;
  ratePaise: bigint;
  amountPaise: bigint;
  note: string | null;
  sortOrder: number;
}

/** The source quotation's fields a template may read. Client fields are deliberately absent. */
export interface SourceQuote {
  feeBps: number;
  discountBps: number;
  onSpotPaise: bigint;
  onSpotLabel: string | null;
  bookingAdvancePaise: bigint;
  gstBps: number;
  phases: unknown;
  welcomeNote: string | null;
  terms: string | null;
  kitchenRunMm: number | null;
  bathrooms: number | null;
  lines: SourceLine[];
}

/** What is written onto the new quotation (besides its lines). */
export interface TemplateTerms {
  feeBps: number;
  discountBps: number;
  onSpotPaise: bigint;
  onSpotLabel: string | null;
  bookingAdvancePaise: bigint;
  gstBps: number;
  phases: Prisma.InputJsonValue | undefined;
  welcomeNote: string | null;
  terms: string | null;
  kitchenRunMm: number | null;
  bathrooms: number | null;
}

/** A line ready for `studioQuoteLine.create` (without `quoteId`). */
export interface TemplateLine {
  room: string;
  product: string;
  code: WorkCodeName;
  unit: QuoteUnitName;
  details: string | null;
  widthMm: number | null;
  heightMm: number | null;
  qtyMilli: number | null;
  ratePaise: bigint;
  amountPaise: bigint;
  note: string | null;
  sortOrder: number;
}

const code = (c: string): WorkCodeName => (c === 'ONSITE' ? 'ONSITE' : 'MODULAR');
const unit = (u: string): QuoteUnitName => (u === 'SQFT' || u === 'RFT' || u === 'UNIT' ? u : 'AREA');

/** The terms a template carries, and nothing else. */
export function templateTerms(source: SourceQuote): TemplateTerms {
  return {
    feeBps: source.feeBps,
    discountBps: source.discountBps,
    onSpotPaise: source.onSpotPaise,
    onSpotLabel: source.onSpotLabel,
    bookingAdvancePaise: source.bookingAdvancePaise,
    gstBps: source.gstBps,
    phases: (source.phases ?? undefined) as Prisma.InputJsonValue | undefined,
    welcomeNote: source.welcomeNote,
    terms: source.terms,
    kitchenRunMm: source.kitchenRunMm,
    bathrooms: source.bathrooms,
  };
}

/** The lines, in their order, exactly as priced on the source (an agreed amount stays agreed). */
export function templateLines(lines: readonly SourceLine[]): TemplateLine[] {
  return [...lines]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((l, i) => ({
      room: l.room,
      product: l.product,
      code: code(l.code),
      unit: unit(l.unit),
      details: l.details,
      widthMm: l.widthMm,
      heightMm: l.heightMm,
      qtyMilli: l.qtyMilli,
      ratePaise: l.ratePaise,
      amountPaise: l.amountPaise,
      note: l.note,
      sortOrder: (i + 1) * 10,
    }));
}

/** A line for the First quote page's table: rate as it was, and the agreed amount kept where it differs from rate × size. */
export interface CopiedLine {
  room: string;
  product: string;
  code: WorkCodeName;
  unit: QuoteUnitName;
  details: string | null;
  widthMm: number | null;
  heightMm: number | null;
  qtyMilli: number | null;
  ratePaise: number;
  agreedPaise: number | null;
  note: string | null;
}

export function copiedLines(lines: readonly SourceLine[]): CopiedLine[] {
  return templateLines(lines).map((l) => {
    const ratePaise = Number(l.ratePaise);
    const amountPaise = Number(l.amountPaise);
    const computed = lineAmount({ code: l.code, unit: l.unit, ratePaise, widthMm: l.widthMm, heightMm: l.heightMm, qtyMilli: l.qtyMilli });
    return {
      room: l.room,
      product: l.product,
      code: l.code,
      unit: l.unit,
      details: l.details,
      widthMm: l.widthMm,
      heightMm: l.heightMm,
      qtyMilli: l.qtyMilli,
      ratePaise,
      agreedPaise: computed === amountPaise ? null : amountPaise,
      note: l.note,
    };
  });
}

/** A product whose product master rate is not the rate on the old quotation. */
export interface RateChange {
  product: string;
  wasPaise: number;
  nowPaise: number;
}

/**
 * Products whose rate has changed in the product master since the old
 * quotation was priced. Matched by name (any case, spaces squeezed), as the
 * builder matches; a product no longer in the master, or with no rate there,
 * is not a change worth reporting. One entry per product, first rate seen.
 */
export function rateChanges(lines: readonly { product: string; ratePaise: number | bigint }[], products: readonly { name: string; ratePaise: number; isActive?: boolean }[]): RateChange[] {
  const key = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
  const master = new Map<string, number>();
  for (const p of products) {
    if (p.isActive === false || !(p.ratePaise > 0)) continue;
    if (!master.has(key(p.name))) master.set(key(p.name), p.ratePaise);
  }
  const seen = new Set<string>();
  const out: RateChange[] = [];
  for (const l of lines) {
    const k = key(l.product);
    if (seen.has(k)) continue;
    seen.add(k);
    const now = master.get(k);
    const was = Number(l.ratePaise);
    if (now !== undefined && now !== was) out.push({ product: l.product.trim(), wasPaise: was, nowPaise: now });
  }
  return out;
}

/**
 * Where to look for quotations to copy: the person's own read scope (`base`,
 * which already carries their studio and their leads), the studio again,
 * only quotations with lines, and the search — client name, quote number,
 * society or the BHK — any part, any case.
 */
export function previousQuotesWhere(base: Prisma.StudioQuoteWhereInput, studioId: string, search: string): Prisma.StudioQuoteWhereInput {
  const q = search.trim().slice(0, 80);
  const and: Prisma.StudioQuoteWhereInput[] = [base, { studioId }, { lines: { some: {} } }];
  if (q) {
    and.push({
      OR: [
        { clientName: { contains: q, mode: 'insensitive' } },
        { number: { contains: q, mode: 'insensitive' } },
        { society: { contains: q, mode: 'insensitive' } },
        { locality: { contains: q, mode: 'insensitive' } },
        { config: { contains: q, mode: 'insensitive' } },
      ],
    });
  }
  return { AND: and };
}

/** Why this quotation cannot take a template's lines, or null. Only a fresh draft with nothing on it. */
export function fillRefusal(target: { status: string; issuedOn: Date | null; lineCount: number; revisionCount: number }, withLines: boolean): string | null {
  if (target.status !== 'DRAFT' || target.issuedOn || target.revisionCount > 0) return 'Only a new draft can start from a previous quotation.';
  if (withLines && target.lineCount > 0) return 'This quotation already has lines. Start a new quotation to copy one.';
  return null;
}
