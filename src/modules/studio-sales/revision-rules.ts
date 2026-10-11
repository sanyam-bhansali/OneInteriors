/**
 * Quotation revisions and the sales final (Studio OS Phase 1,
 * docs/studio-os/PHASE-1-SALES.md §3). Pure, and tested
 * (tests/studio-sales-revisions.test.ts).
 *
 * - Each time a quotation is SENT, a frozen, numbered revision is kept:
 *   R1, R2, R3… Drafts in between are not revisions. Sending the same thing
 *   twice does not make a new number.
 * - Any two revisions can be compared (studio-quote/revision.ts, the same
 *   comparison as "what changed since we sent it").
 * - One revision is marked the sales final. Marking a later one moves the
 *   mark, and the lead's timeline says so. Once the booking is recorded the
 *   mark stays where it is.
 */

import type { ComparableLine } from '@/modules/studio-quote/revision';

/** A line as it was sent. Paise as plain numbers: Json cannot hold a BigInt. */
export interface RevisionLine {
  room: string;
  product: string;
  code: 'MODULAR' | 'ONSITE';
  unit: 'AREA' | 'SQFT' | 'RFT' | 'UNIT';
  details: string | null;
  widthMm: number | null;
  heightMm: number | null;
  qtyMilli: number | null;
  ratePaise: number;
  amountPaise: number;
}

/** The terms a revision was priced on. */
export interface RevisionTerms {
  feeBps: number;
  discountBps: number;
  onSpotPaise: number;
  onSpotLabel: string | null;
  bookingAdvancePaise: number;
  gstBps: number;
  phases: { label: string; pct: number }[] | null;
}

/** The total's parts, for the comparison table. */
export interface RevisionTotals {
  workPaise: number;
  feePaise: number;
  discountPaise: number;
  onSpotPaise: number;
  gstPaise: number;
  totalPaise: number;
}

export const revisionLabel = (n: number): string => `R${n}`;

/** The next number after the ones this quotation already has. */
export function nextRevisionNumber(existing: readonly number[]): number {
  return existing.reduce((max, n) => Math.max(max, n), 0) + 1;
}

/** One string for "what was sent", so sending the same thing twice is seen as the same. */
export function contentKey(lines: readonly RevisionLine[], terms: RevisionTerms): string {
  return JSON.stringify({
    l: lines.map((l) => [l.room, l.product, l.code, l.unit, l.details ?? '', l.widthMm, l.heightMm, l.qtyMilli, l.ratePaise, l.amountPaise]),
    t: [terms.feeBps, terms.discountBps, terms.onSpotPaise, terms.onSpotLabel ?? '', terms.bookingAdvancePaise, terms.gstBps, terms.phases ?? null],
  });
}

/** A send makes a new revision unless what is being sent is exactly the last one. */
export function needsNewRevision(last: { lines: readonly RevisionLine[]; terms: RevisionTerms } | null, current: { lines: readonly RevisionLine[]; terms: RevisionTerms }): boolean {
  return last === null || contentKey(last.lines, last.terms) !== contentKey(current.lines, current.terms);
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** A stored revision's lines, read defensively: a row that does not parse is left out. */
export function readRevisionLines(raw: unknown): RevisionLine[] {
  if (!Array.isArray(raw)) return [];
  const out: RevisionLine[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    if (typeof r.room !== 'string' || typeof r.product !== 'string') continue;
    const amount = num(r.amountPaise);
    if (amount === null) continue;
    out.push({
      room: r.room,
      product: r.product,
      code: r.code === 'ONSITE' ? 'ONSITE' : 'MODULAR',
      unit: r.unit === 'SQFT' || r.unit === 'RFT' || r.unit === 'UNIT' ? r.unit : 'AREA',
      details: typeof r.details === 'string' ? r.details : null,
      widthMm: num(r.widthMm),
      heightMm: num(r.heightMm),
      qtyMilli: num(r.qtyMilli),
      ratePaise: num(r.ratePaise) ?? 0,
      amountPaise: amount,
    });
  }
  return out;
}

export function readRevisionTerms(raw: unknown): RevisionTerms {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const phases = Array.isArray(r.phases)
    ? (r.phases as unknown[]).flatMap((p) => {
        const o = p && typeof p === 'object' ? (p as Record<string, unknown>) : null;
        return o && typeof o.label === 'string' && typeof o.pct === 'number' ? [{ label: o.label, pct: o.pct }] : [];
      })
    : null;
  return {
    feeBps: num(r.feeBps) ?? 0,
    discountBps: num(r.discountBps) ?? 0,
    onSpotPaise: num(r.onSpotPaise) ?? 0,
    onSpotLabel: typeof r.onSpotLabel === 'string' ? r.onSpotLabel : null,
    bookingAdvancePaise: num(r.bookingAdvancePaise) ?? 0,
    gstBps: num(r.gstBps) ?? 0,
    phases: phases && phases.length > 0 ? phases : null,
  };
}

export function readRevisionTotals(raw: unknown): RevisionTotals {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    workPaise: num(r.workPaise) ?? 0,
    feePaise: num(r.feePaise) ?? 0,
    discountPaise: num(r.discountPaise) ?? 0,
    onSpotPaise: num(r.onSpotPaise) ?? 0,
    gstPaise: num(r.gstPaise) ?? 0,
    totalPaise: num(r.totalPaise) ?? 0,
  };
}

/** For `compareToIssued`: the room, product and amount of each line. */
export const comparable = (lines: readonly RevisionLine[]): ComparableLine[] =>
  lines.map((l) => ({ room: l.room, product: l.product, amountPaise: l.amountPaise }));

// ── The sales final ────────────────────────────────────────────

export interface SalesFinalFacts {
  /** The revision exists on this quotation. */
  revisionFound: boolean;
  /** SALES or DESIGN; a Design Final is after booking, not a sales final. */
  quoteStage: 'SALES' | 'DESIGN';
  /** A One Interiors client signs their final quote in the app instead. */
  fromOneInteriors: boolean;
  /** The booking advance is recorded against this quotation (project not cancelled). */
  booked: boolean;
  /** The revision already carries the mark (re-marking only changes the schedule). */
  alreadyMarked: boolean;
}

export const SALES_FINAL_ERRORS = {
  notFound: 'That revision is not on this quotation. Send the quotation first; each send is a revision.',
  design: 'This is the Design Final. The sales final is marked on the quotation the client booked on.',
  booked: 'The booking is recorded on the current sales final, so it stays. Refund the booking first to change it.',
} as const;

/** Why this revision cannot be marked the sales final, or null when it can. */
export function salesFinalRefusal(f: SalesFinalFacts): string | null {
  if (!f.revisionFound) return SALES_FINAL_ERRORS.notFound;
  if (f.quoteStage === 'DESIGN') return SALES_FINAL_ERRORS.design;
  if (f.booked) return SALES_FINAL_ERRORS.booked;
  return null;
}

/** The timeline line for marking (or moving) the sales final. */
export function salesFinalSummary(quoteNumber: string, n: number, previous: number | null): string {
  if (previous === null || previous === n) return `Marked ${revisionLabel(n)} of quotation ${quoteNumber} as the sales final`;
  return `Sales final moved from ${revisionLabel(previous)} to ${revisionLabel(n)} of quotation ${quoteNumber}`;
}

/** Whether the quotation's lines today are still what was sent in this revision. */
export function sameLinesAs(revision: readonly RevisionLine[], current: readonly RevisionLine[]): boolean {
  return contentKey(revision, ZERO_TERMS) === contentKey(current, ZERO_TERMS);
}

const ZERO_TERMS: RevisionTerms = { feeBps: 0, discountBps: 0, onSpotPaise: 0, onSpotLabel: null, bookingAdvancePaise: 0, gstBps: 0, phases: null };
