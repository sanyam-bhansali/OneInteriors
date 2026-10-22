/**
 * Hauspire's quotation arithmetic, ported line for line from its own app
 * (`Quotation hosted/src/lib/pricing.ts`, `components/PrintDocument.tsx`,
 * `CALCULATIONS.md`), in RUPEES, with its JavaScript rounding exactly as it
 * runs there (owner, 22 Oct 2026: "same functionality, everything exactly
 * similar", calculations included, rounding included).
 *
 * ## Why a second copy of the maths
 *
 * This file is the yardstick, not the engine. `pricing.ts` is what every
 * screen, PDF and ledger here uses, and it works in integer paise. This is
 * the old app's code with nothing changed but the types, so a test can feed
 * the same quotation to both and demand the same answer to the paisa
 * (tests/quote-parity-calc.test.ts), and the Hauspire import can say, for
 * every quotation it brings in, whether our total is the one the old app
 * printed (scripts/import-hauspire-quotes.ts). If the two ever disagree, this
 * file is right by definition and `pricing.ts` has the bug.
 *
 * Do not "improve" anything here: the float order of operations
 * (`(w × h) / 92903.04 × rate`), `Math.round` at each step, and the payment
 * stages each rounded on their own are the old app's behaviour, and the
 * point is to reproduce it. Pure, no imports.
 */

export const MM_PER_SQFT = 92903.04;
export const FEE_RATE = 0.07;
export const MODULAR_DISCOUNT = 0.15;
export const BOOKING_ADVANCE = 25000;
export const GST_RATE = 0.18;

/** The old app's rooms per configuration (`BHK_ROOMS`). */
export const BHK_ROOMS: Record<string, string[]> = {
  '1 BHK': ['Kitchen', 'Master Bedroom', 'Living, Dining & Foyer', 'Other Services'],
  '2 BHK': ['Kitchen', 'Master Bedroom', 'Kids Bedroom', 'Living, Dining & Foyer', 'Other Services'],
  '3 BHK': ['Kitchen', 'Master Bedroom', 'Kids Bedroom', 'Guest Bedroom', 'Living, Dining & Foyer', 'Other Services'],
  '4 BHK': ['Kitchen', 'Master Bedroom', 'Kids Bedroom', 'Guest Bedroom', 'Parents Bedroom', 'Living, Dining & Foyer', 'Other Services'],
};

export function feetInchesToMm(ft: number, inch = 0): number {
  return Math.round(ft * 304.8 + inch * 25.4);
}

/** L-kitchen: run ≈ (width + depth) − 900 mm, never under 600. */
export function estimateKitchenRun(widthMm: number, depthMm: number): number {
  return Math.max(600, widthMm + depthMm - 900);
}

export function areaAmount(widthMm: number, heightMm: number, ratePerSqft: number): number {
  return Math.round(((widthMm * heightMm) / MM_PER_SQFT) * ratePerSqft);
}

export function sqftAmount(sqft: number, ratePerSqft: number): number {
  return Math.round(sqft * ratePerSqft);
}

export function rftAmount(rft: number, ratePerRft: number): number {
  return Math.round(rft * ratePerRft);
}

/** A unit line as the old builder table re-prices it: `Math.round(qty × unitPrice)`. */
export function unitAmount(qty: number, unitPrice: number): number {
  return Math.round(qty * unitPrice);
}

/** One line of the old app (its `QuoteLine`, the fields the totals read). */
export interface OldLine {
  wc: 'MO-01' | 'NM-01' | string;
  amount: number;
}

export interface OldStage {
  label: string;
  amount: number;
  desc: string;
}

export interface OldTotals {
  mo: number;
  nm: number;
  fee: number;
  subTotal: number;
  discount: number;
  onSpot: number;
  modularPct: number;
  tpv: number;
  stages: OldStage[];
  feeOn: boolean;
  gstOn: boolean;
  gst: number;
  grandTotal: number;
}

export interface OldOpts {
  modularPct?: number;
  onSpot?: number;
  feeOn?: boolean;
  gstOn?: boolean;
}

/** The old app's payment stages: label, share of what is left after the advance, End Deliverable (**bold** prints bold). */
export const OLD_STAGES: { label: string; share: number | null; desc: string }[] = [
  { label: 'Booking Advance (Fully refundable within 3 days)', share: null, desc: 'Your dedicated designer is assigned. You receive your **Mood Board, 2D Layout and Furniture Layout**.' },
  { label: 'Design Advance (5%)', share: 0.05, desc: 'Your design comes to life: **2D drawing revisions, first 3D design, final 3D renders** and your **Final Quotation**.' },
  { label: 'Design Closure (10%)', share: 0.1, desc: 'Your design is locked. You receive the **detailed technical drawings** our factory and site team build from.' },
  {
    label: 'Material Procurement (40%)',
    share: 0.4,
    desc: 'All materials for your home are **purchased and sent to our factory** for manufacturing. **All on-site work begins** at your home, such as false ceiling, electrical and civil work.',
  },
  { label: 'Material Dispatch (40%)', share: 0.4, desc: 'Your furniture is **delivered to your home and carpentry installation begins**. Décor items, glass and finishing materials are ordered.' },
  { label: 'Project Handover (5%)', share: 0.05, desc: 'Once this payment is received, we **resolve the final snag list** and **hand over your home**, ready to move in.' },
];

/** `computeTotals` of the old app, unchanged. */
export function oldComputeTotals(lines: readonly OldLine[], opts: OldOpts = {}): OldTotals {
  const modularPct = opts.modularPct ?? MODULAR_DISCOUNT;
  const onSpot = opts.onSpot ?? 0;
  const feeOn = opts.feeOn ?? true;
  const gstOn = opts.gstOn ?? false;
  let mo = 0;
  let nm = 0;
  for (const l of lines) {
    if (l.wc === 'MO-01') mo += l.amount;
    else nm += l.amount;
  }
  const fee = feeOn ? Math.round((mo + nm) * FEE_RATE) : 0;
  const subTotal = mo + nm + fee;
  const discount = Math.round(mo * modularPct);
  const tpv = subTotal - discount - onSpot;
  const gst = gstOn ? Math.round(tpv * GST_RATE) : 0;
  const grandTotal = tpv + gst;
  const after = grandTotal - BOOKING_ADVANCE;
  const stages = OLD_STAGES.map((s) => ({ label: s.label, desc: s.desc, amount: s.share === null ? BOOKING_ADVANCE : Math.round(after * s.share) }));
  return { mo, nm, fee, subTotal, discount, onSpot, modularPct, tpv, stages, feeOn, gstOn, gst, grandTotal };
}

/** The PDF's "Discounted (₹)" for one line (`PrintDocument` `discOf`): modular lines only. */
export function oldDiscounted(line: OldLine, modularPct: number): number {
  return line.wc === 'MO-01' ? Math.round(line.amount * (1 - modularPct)) : line.amount;
}

/** `Math.round(n).toLocaleString("en-IN")`, as every figure on the old PDF prints. */
export function oldFmt(n: number): string {
  return Math.round(n).toLocaleString('en-IN');
}
