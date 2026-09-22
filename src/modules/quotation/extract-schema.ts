/**
 * What the extractor is allowed to hand back, and how it is checked.
 *
 * Pure, and deliberately separate from the module that makes the API call —
 * everything that can go *wrong* here is in the parsing and the validation,
 * not in the HTTP, so the part worth testing is the part with no I/O in it.
 * CONTRIBUTING §9.5, and the same split `portfolio-draft.ts` makes next to
 * `portfolio-agent.ts`.
 *
 * ## Why this is strict to the point of rudeness
 *
 * The numbers that come out of here become the price a homeowner is quoted.
 * A model reading a smudged PDF will occasionally produce a width in metres,
 * an amount with a digit dropped, or a confident line item for a row that was
 * a subtotal. Prompting does not prevent any of that; a validator does.
 *
 * Every rule below discards rather than repairs. A guessed correction is a
 * number nobody can trace to a document, which is the one thing a filed rate
 * must never be.
 */

import type { IngestedLine, IngestedQuotation } from './ingest';
import { ROOMS, type Room } from './catalogue';

/** One line as the model is asked to report it. Rupees, not paise. */
export interface RawLine {
  room: string | null;
  product: string;
  workCode: string | null;
  details: string | null;
  widthMm: number | null;
  heightMm: number | null;
  amountRupees: number;
}

export interface RawQuotation {
  /** The studio's own reference, or the filename. Used only to group. */
  reference: string;
  bhk: number | null;
  dated: string | null;
  lines: RawLine[];
}

export interface ExtractIssue {
  /** Which quotation, by the reference the model gave it. */
  reference: string;
  reason: string;
}

export interface ExtractCheck {
  quotations: IngestedQuotation[];
  issues: ExtractIssue[];
}

/**
 * The largest single line item we will believe without a person.
 *
 * ₹25 lakh for one row. A real line can be large — a full modular kitchen
 * runs to several lakh — but an order of magnitude above that is a decimal
 * point in the wrong place or a grand total mistaken for a line, and both
 * would drag a median somewhere no document supports.
 */
const MAX_LINE_RUPEES = 25_00_000;

/** Below this a "line" is a rounding artefact, a note, or a blank row. */
const MIN_LINE_RUPEES = 100;

/** A 12-metre wardrobe is a unit error, not a wardrobe. */
const MAX_DIMENSION_MM = 9_000;

function isRoom(v: string): v is Room {
  return (ROOMS as readonly string[]).includes(v);
}

/**
 * Parse whatever came back, and keep only what survives.
 *
 * Returns the quotations shaped for `ingestQuotations`, plus one issue per
 * thing dropped. The issues are not decoration: an extractor that quietly
 * loses half the lines and a studio whose archive genuinely has half as many
 * lines look identical in the output, and ops has to be able to tell them
 * apart before approving a rate.
 */
export function checkExtraction(raw: unknown): ExtractCheck {
  const issues: ExtractIssue[] = [];
  const quotations: IngestedQuotation[] = [];

  if (!Array.isArray(raw)) {
    return { quotations: [], issues: [{ reference: '—', reason: 'Not a list of quotations.' }] };
  }

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const q = entry as Partial<RawQuotation>;
    const reference = typeof q.reference === 'string' && q.reference.trim() ? q.reference.trim() : '—';

    if (!Array.isArray(q.lines) || q.lines.length === 0) {
      issues.push({ reference, reason: 'No line items read from this document.' });
      continue;
    }

    const lines: IngestedLine[] = [];

    for (const entryLine of q.lines) {
      if (!entryLine || typeof entryLine !== 'object') continue;
      const l = entryLine as Partial<RawLine>;

      const product = typeof l.product === 'string' ? l.product.trim() : '';
      if (product.length < 2) continue;

      const rupees = typeof l.amountRupees === 'number' ? l.amountRupees : NaN;
      if (!Number.isFinite(rupees)) {
        issues.push({ reference, reason: `"${product}" had no readable amount.` });
        continue;
      }
      if (rupees < MIN_LINE_RUPEES) continue;
      if (rupees > MAX_LINE_RUPEES) {
        /* Named, because this is the shape a grand total takes when it is
           mistaken for a line — and one of those in an archive moves a
           median further than any number of small errors. */
        issues.push({
          reference,
          reason: `"${product}" came back at ₹${Math.round(rupees).toLocaleString('en-IN')} — too large for one line. Dropped; it is usually a total.`,
        });
        continue;
      }

      const room = typeof l.room === 'string' && isRoom(l.room) ? l.room : null;

      lines.push({
        quotationId: reference,
        room,
        product,
        workCode: typeof l.workCode === 'string' && l.workCode.trim() ? l.workCode.trim() : null,
        details: typeof l.details === 'string' && l.details.trim() ? l.details.trim() : null,
        widthMm: dimension(l.widthMm),
        heightMm: dimension(l.heightMm),
        // Rupees in, paise stored. The model is asked for rupees because that
        // is what the document says, and one conversion in one place is one
        // place to get it wrong.
        amountPaise: Math.round(rupees * 100),
      });
    }

    if (lines.length === 0) {
      issues.push({ reference, reason: 'Every line was unreadable or out of range.' });
      continue;
    }

    quotations.push({
      quotationId: reference,
      /* 3 BHK when the document does not say. `ingestQuotations` uses bhk for
         grouping rather than for pricing, and the commonest flat in the
         archive is the least distorting assumption — but it IS an assumption,
         so it is worth knowing it is here. */
      bhk: typeof q.bhk === 'number' && q.bhk >= 1 && q.bhk <= 5 ? Math.round(q.bhk) : 3,
      dated: typeof q.dated === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(q.dated) ? q.dated : null,
      lines,
    });
  }

  return { quotations, issues };
}

function dimension(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return null;
  if (v > MAX_DIMENSION_MM) return null;
  return Math.round(v);
}
