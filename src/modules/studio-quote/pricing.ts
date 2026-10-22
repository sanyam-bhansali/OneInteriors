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
 * basis points. Rounding happens exactly once per step, and since 22 Oct 2026
 * it is Hauspire's own rounding, to the whole rupee (`lineAmount`,
 * `pctOfRupees`, `splitRupees`): the owner asked for the builder to give the
 * old app's figures exactly, and `hauspire-calc.ts` holds the old code as the
 * yardstick the tests compare against, to the paisa.
 *
 * ## The one rule worth knowing before reading the maths
 *
 * A discount applies to MODULAR work only. Factory-made units carry the margin
 * that can be given away; site labour does not. Discounting the whole quotation
 * is how a studio wins a job and loses money on it, and it is common enough in
 * this industry that the structure should make it awkward rather than easy.
 */

import { splitAcross, splitRupees, type Paise } from '@/lib/money';

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
 *
 * The arithmetic is Hauspire's, to the rupee (owner, 22 Oct 2026: the
 * builder works exactly like their old app, rounding included): a W × H line
 * is `round((W × H) / 92,903.04 × rate)`, a square-foot, running-foot or
 * unit line `round(quantity × rate)`, each rounded ONCE to a whole rupee, in
 * the old app's own order of operations (`hauspire-calc.ts` is the
 * yardstick, pinned by tests/quote-parity-calc.test.ts). The rate may carry
 * paise (₹26.5 / sq ft); the line never does.
 */
export function lineAmount(line: QuoteLineInput): Paise {
  if (line.amountPaise != null) return line.amountPaise;
  const rate = line.ratePaise / PAISE_PER_RUPEE;
  if (line.unit === 'AREA') {
    if (!line.widthMm || !line.heightMm) return 0;
    return wholeRupees(((line.widthMm * line.heightMm) / MM_PER_SQFT) * rate);
  }
  return wholeRupees(((line.qtyMilli ?? 0) / QTY_SCALE) * rate);
}

const PAISE_PER_RUPEE = 100;

/**
 * A rupee figure from the old app's arithmetic, rounded as it rounds
 * (`Math.round`, half up), as paise. `+ 0` keeps a −0 out of the totals.
 */
function wholeRupees(rupees: number): Paise {
  return Math.round(rupees) * PAISE_PER_RUPEE + 0;
}

/**
 * A percentage of a paise amount, rounded to the rupee as Hauspire's app
 * rounds its fee, discount and GST (`Math.round(rupees × pct)`). 700 bps is
 * the same double as the old app's `0.07`, so the two agree to the paisa.
 */
export function pctOfRupees(amountPaise: Paise, bps: number): Paise {
  if (!bps) return 0;
  return wholeRupees((amountPaise / PAISE_PER_RUPEE) * (bps / 10_000));
}

export interface QuoteTerms {
  /** Professional fee, basis points on the work value. 700 = 7%. */
  feeBps: number;
  /** Discount, basis points, on MODULAR work only. */
  discountBps: number;
  /** A flat figure knocked off to close the deal. */
  onSpotPaise?: Paise;
  /** Taken up front, and excluded from the percentage stages below. */
  bookingAdvancePaise?: Paise;
  /** GST, basis points (0 or 1800), on the total after every discount. */
  gstBps?: number;
  /**
   * The studio's own payment schedule, percentages of what the client pays
   * (`payment-phases.ts`). When present it replaces the booking advance and
   * the standard stages: their booking is one of their phases.
   */
  phases?: { label: string; pct: number }[] | null;
}

/** The GST rate a quotation can carry. Interiors work is 18%. */
export const GST_BPS = 1800;

/**
 * The professional fee: 7% for every studio (owner, 12 Oct 2026), on or off
 * per quotation as in Hauspire's builder — never another percentage. The
 * modular discount stays the studio's own.
 */
export const FEE_BPS = 700;

/** A fee as stored: 7% when on, nothing when off. */
export function feeBpsOf(on: boolean): number {
  return on ? FEE_BPS : 0;
}

/**
 * The fee a quotation keeps when its box is ticked or unticked. A quotation
 * made before the fee was fixed at 7% keeps its own figure while the box
 * stays on; only turning a fee on from off sets 7%. Saving a line must never
 * reprice a quotation already sent.
 */
export function keptFeeBps(storedBps: number, on: boolean): number {
  if (!on) return 0;
  return Number.isInteger(storedBps) && storedBps > 0 ? storedBps : FEE_BPS;
}

/**
 * Names for the flat discount, exactly as Hauspire's picker lists them
 * (`DiscountPicker.tsx`); free text is allowed too. The first is the name a
 * discount gets when nobody picks one, and what prints when none is stored.
 */
export const DISCOUNT_NAMES = ['On-Spot Discount', 'Festive Discount', 'Referral Discount', 'Loyalty Discount', 'Negotiated Discount'] as const;
export const DEFAULT_DISCOUNT_NAME: string = DISCOUNT_NAMES[0];

export interface QuoteStage {
  label: string;
  detail: string;
  amountPaise: Paise;
  /** The phase's percentage, when the schedule is the studio's own. */
  pct?: number;
}

export interface QuoteTotals {
  modularPaise: Paise;
  onsitePaise: Paise;
  workPaise: Paise;
  feePaise: Paise;
  subTotalPaise: Paise;
  discountPaise: Paise;
  onSpotPaise: Paise;
  /** After every discount, before GST. */
  beforeTaxPaise: Paise;
  gstPaise: Paise;
  /** What the client pays, GST included when it is on. */
  totalPaise: Paise;
  stages: QuoteStage[];
}

/**
 * The payment schedule after the booking advance: Hauspire's five stages,
 * labels and End Deliverables word for word as their app prints them (its
 * `computeTotals` stages; **bold** prints bold), each a share of what is
 * left once the advance is taken.
 *
 * Each share is rounded to the rupee exactly as the old app rounds it
 * (`Math.round(after × 5%)`), with ONE difference, on purpose: the last
 * stage takes whatever is left, so the stages add up to the contract to the
 * paisa (`splitRupees`). The old app rounds the last one on its own too,
 * which can leave its schedule ₹1–2 off its own total; a schedule that does
 * not add up is the first thing a client notices, and the booking ledger
 * reads these amounts. Every other stage is the old app's figure.
 */
export const BOOKING_LABEL = 'Booking Advance (Fully refundable within 3 days)';
export const BOOKING_DETAIL = 'Your dedicated designer is assigned. You receive your **Mood Board, 2D Layout and Furniture Layout**.';
export const HAUSPIRE_STAGES = [
  { label: 'Design Advance', detail: 'Your design comes to life: **2D drawing revisions, first 3D design, final 3D renders** and your **Final Quotation**.', weight: 5 },
  { label: 'Design Closure', detail: 'Your design is locked. You receive the **detailed technical drawings** our factory and site team build from.', weight: 10 },
  {
    label: 'Material Procurement',
    detail:
      'All materials for your home are **purchased and sent to our factory** for manufacturing. **All on-site work begins** at your home, such as false ceiling, electrical and civil work.',
    weight: 40,
  },
  { label: 'Material Dispatch', detail: 'Your furniture is **delivered to your home and carpentry installation begins**. Décor items, glass and finishing materials are ordered.', weight: 40 },
  { label: 'Project Handover', detail: 'Once this payment is received, we **resolve the final snag list** and **hand over your home**, ready to move in.', weight: 5 },
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
  /* Each rounded once, to the rupee, as Hauspire's app rounds them:
     Math.round((MO + NM) × 7%), Math.round(MO × 15%), Math.round(TPV × 18%). */
  const feePaise = pctOfRupees(workPaise, terms.feeBps);
  const subTotalPaise = workPaise + feePaise;

  // Modular only. See the note at the top of this file.
  const discountPaise = pctOfRupees(modularPaise, terms.discountBps);
  const onSpotPaise = terms.onSpotPaise ?? 0;

  const beforeTaxPaise = subTotalPaise - discountPaise - onSpotPaise;
  // GST last, on what is actually charged — Hauspire's order, and the law's.
  // As the old app does, even on a total a discount has pushed below zero
  // (a quotation nobody sends, but one the two apps must still agree on).
  const gstPaise = pctOfRupees(beforeTaxPaise, terms.gstBps ?? 0);
  const totalPaise = beforeTaxPaise + gstPaise;

  const stages: QuoteStage[] = [];

  /* The studio's own schedule, when it has one: percentages of the whole,
     booking included. Split with `splitAcross` like the standard stages, so
     it adds up to the total exactly. */
  const phases = terms.phases?.filter((p) => p.pct > 0) ?? [];
  if (phases.length > 0) {
    if (totalPaise > 0) {
      const parts = splitAcross(totalPaise, phases.map((p) => p.pct));
      phases.forEach((p, i) => stages.push({ label: p.label, detail: '', amountPaise: parts[i]!, pct: p.pct }));
    }
    return { modularPaise, onsitePaise, workPaise, feePaise, subTotalPaise, discountPaise, onSpotPaise, beforeTaxPaise, gstPaise, totalPaise, stages };
  }

  const advance = Math.min(terms.bookingAdvancePaise ?? 0, Math.max(0, totalPaise));
  const balance = totalPaise - advance;

  if (advance > 0) {
    stages.push({ label: BOOKING_LABEL, detail: BOOKING_DETAIL, amountPaise: advance });
  }

  // `splitAcross` throws on a non-positive total, and a quotation can legitimately
  // be at zero while it is still being built.
  if (balance > 0) {
    const parts = splitRupees(
      balance,
      HAUSPIRE_STAGES.map((s) => s.weight),
    );
    HAUSPIRE_STAGES.forEach((stage, i) => {
      stages.push({ label: stage.label, detail: stage.detail, amountPaise: parts[i]!, pct: stage.weight });
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
    beforeTaxPaise,
    gstPaise,
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
