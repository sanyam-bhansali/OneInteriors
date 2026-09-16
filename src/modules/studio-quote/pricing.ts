/**
 * What a studio's own quotation adds up to.
 *
 * Pure, and with no `server-only`, so the tests can reach it —
 * CONTRIBUTING §9.5.
 *
 * ## Ported, not copied
 *
 * The shape of this comes from Hauspire's quotation app, which is calibrated
 * against 943 real workbooks and is the only pricing logic in any of these
 * codebases that has been checked against documents real clients actually
 * signed. What did NOT come across is how it stores money: that app works in
 * rupees as plain JavaScript numbers, and this codebase is integer paise
 * everywhere, for the reason `money.ts` gives — a float and a ledger disagree
 * eventually, and the disagreement is always found by a vendor.
 *
 * So every figure here is paise, every rate is paise, and every percentage is
 * basis points. Rounding happens exactly once per step, through `applyBps` and
 * `splitAcross`, which is what keeps the payment stages summing to the total.
 *
 * ## The one rule worth knowing before reading the maths
 *
 * A discount applies to MODULAR work only. Factory-made units carry the margin
 * that can be given away; site labour does not. Discounting the whole quotation
 * is how a studio wins a job and loses money on it, and it is common enough in
 * this industry that the structure should make it awkward rather than easy.
 */

import { applyBps, splitAcross, type Paise } from '@/lib/money';

/** Square millimetres in one square foot. 1 ft = 304.8 mm. */
export const MM_PER_SQFT = 92_903.04;

/** Quantities are stored as integer thousandths. 34.39 sqft is 34390. */
export const QTY_SCALE = 1000;

export type QuoteUnitName = 'AREA' | 'SQFT' | 'RFT' | 'UNIT';
export type WorkCodeName = 'MODULAR' | 'ONSITE';

export const UNIT_LABELS: Record<QuoteUnitName, string> = {
  AREA: 'W × H',
  SQFT: 'Sq ft',
  RFT: 'Running ft',
  UNIT: 'Each',
};

export const WORK_CODE_LABELS: Record<WorkCodeName, string> = {
  MODULAR: 'Modular',
  ONSITE: 'On-site',
};

/** Everything the maths needs from a line. A superset of what is stored. */
export interface QuoteLineInput {
  unit: QuoteUnitName;
  code: WorkCodeName;
  ratePaise: Paise;
  widthMm?: number | null;
  heightMm?: number | null;
  /** Thousandths. */
  qtyMilli?: number | null;
  /**
   * What the studio actually agreed, overriding the arithmetic.
   *
   * Present on every stored line because a designer rounds a figure to
   * something sayable far more often than not, and the number that prints must
   * be the number that was agreed.
   */
  amountPaise?: Paise | null;
}

/**
 * Square feet in an area line, as thousandths.
 *
 * Returns 0 rather than null for a missing dimension: a line with no width is
 * unpriced, not wrongly priced, and the builder surfaces it as something to
 * fill in rather than as a silent zero in a total.
 */
export function areaMilli(widthMm?: number | null, heightMm?: number | null): number {
  if (!widthMm || !heightMm) return 0;
  return Math.round(((widthMm * heightMm) / MM_PER_SQFT) * QTY_SCALE);
}

/** The quantity a line is priced on, in thousandths, whatever its unit. */
export function lineQtyMilli(line: QuoteLineInput): number {
  if (line.unit === 'AREA') return areaMilli(line.widthMm, line.heightMm);
  return line.qtyMilli ?? 0;
}

/**
 * What one line comes to.
 *
 * An explicit `amountPaise` wins over the arithmetic, always. That is not a
 * loophole — it is the point: the rate card produces a proposal and the studio
 * decides.
 */
export function lineAmount(line: QuoteLineInput): Paise {
  if (line.amountPaise != null) return line.amountPaise;
  return applyBps(line.ratePaise * lineQtyMilli(line), PER_MILLI_BPS);
}

/**
 * Dividing by the quantity scale, expressed in basis points.
 *
 * 10 bps is ÷1000, which is what turns thousandths back into whole units. Going
 * through `applyBps` rather than writing the division out means the rounding
 * rule here is the same one `money.ts` applies everywhere else — half-up,
 * exactly once — instead of a second convention that agrees with it until it
 * doesn't.
 */
const PER_MILLI_BPS = 10_000 / QTY_SCALE;

export interface QuoteTerms {
  /** Professional fee, basis points on the work value. 700 = 7%. */
  feeBps: number;
  /** Discount, basis points, on MODULAR work only. */
  discountBps: number;
  /** A flat figure knocked off to close the deal. */
  onSpotPaise?: Paise;
  /** Taken up front, and excluded from the percentage stages below. */
  bookingAdvancePaise?: Paise;
}

export interface QuoteStage {
  label: string;
  detail: string;
  amountPaise: Paise;
}

export interface QuoteTotals {
  modularPaise: Paise;
  onsitePaise: Paise;
  workPaise: Paise;
  feePaise: Paise;
  subTotalPaise: Paise;
  discountPaise: Paise;
  onSpotPaise: Paise;
  /** What the client pays. */
  totalPaise: Paise;
  stages: QuoteStage[];
}

/**
 * The payment schedule, after the booking advance is taken off the top.
 *
 * Weights rather than percentages, and split with `splitAcross`, so the stages
 * sum to the balance exactly. Rounding each stage independently — which is what
 * the source app does — leaves a rupee or two unaccounted for, and a schedule
 * that does not add up to the contract is the first thing a client notices.
 */
const STAGE_PLAN = [
  {
    label: 'Design first draft',
    detail: '2D drawings and the first 3D draft',
    weight: 5,
  },
  {
    label: 'Design closure',
    detail: 'Final renders, bill of quantities, walkthrough and final quotation',
    weight: 10,
  },
  {
    label: 'Material procurement',
    detail: 'Materials ordered and sent to the factory; false ceiling and electrical begin',
    weight: 40,
  },
  {
    label: 'Material dispatch',
    detail: 'Delivered to site for carpentry; décor, glass and fittings ordered',
    weight: 40,
  },
  {
    label: 'Handover',
    detail: 'Due before final handover and the closing of the snag list',
    weight: 5,
  },
] as const;

export function computeTotals(lines: QuoteLineInput[], terms: QuoteTerms): QuoteTotals {
  let modularPaise = 0;
  let onsitePaise = 0;

  for (const line of lines) {
    const amount = lineAmount(line);
    if (line.code === 'MODULAR') modularPaise += amount;
    else onsitePaise += amount;
  }

  const workPaise = modularPaise + onsitePaise;
  const feePaise = applyBps(workPaise, terms.feeBps);
  const subTotalPaise = workPaise + feePaise;

  // Modular only. See the note at the top of this file.
  const discountPaise = applyBps(modularPaise, terms.discountBps);
  const onSpotPaise = terms.onSpotPaise ?? 0;

  const totalPaise = subTotalPaise - discountPaise - onSpotPaise;

  const advance = Math.min(terms.bookingAdvancePaise ?? 0, Math.max(0, totalPaise));
  const balance = totalPaise - advance;

  const stages: QuoteStage[] = [];

  if (advance > 0) {
    stages.push({
      label: 'Booking advance',
      detail: 'Refundable for three days. Assigns a designer and starts the moodboard.',
      amountPaise: advance,
    });
  }

  // `splitAcross` throws on a non-positive total, and a quotation can legitimately
  // be at zero while it is still being built.
  if (balance > 0) {
    const parts = splitAcross(
      balance,
      STAGE_PLAN.map((s) => s.weight),
    );
    STAGE_PLAN.forEach((stage, i) => {
      stages.push({ label: stage.label, detail: stage.detail, amountPaise: parts[i]! });
    });
  }

  return {
    modularPaise,
    onsitePaise,
    workPaise,
    feePaise,
    subTotalPaise,
    discountPaise,
    onSpotPaise,
    totalPaise,
    stages,
  };
}

/** Thousandths to a readable quantity. 34390 → "34.39". */
export function formatQty(qtyMilli: number): string {
  return (qtyMilli / QTY_SCALE).toFixed(2).replace(/\.00$/, '');
}

/**
 * Is this line priced yet?
 *
 * An unpriced line is not an error — it is a line somebody still has to
 * measure — so it is surfaced as a count on the builder rather than blocking a
 * save. A quotation you cannot save until it is perfect is a quotation drafted
 * in Excel instead.
 */
export function isUnpriced(line: QuoteLineInput): boolean {
  if (line.amountPaise != null) return false;
  return lineQtyMilli(line) === 0 || line.ratePaise === 0;
}
