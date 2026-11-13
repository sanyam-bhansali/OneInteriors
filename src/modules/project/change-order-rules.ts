/**
 * Change orders: extra work after design sign-off (owner, team meeting 15 Oct
 * 2026). "Jahan pe aap extra item add kar sakte ho, aur wo sabse pehle client
 * ke paas jayenge approval ke liye, aur payment ke liye." A loft the client
 * asks for mid-project is a new entry with its size and price; the client
 * approves it in the app, pays for it, and only then does it go to the
 * factory. Each project was leaving ₹1.5–2 lakh unbilled.
 *
 * Pure, and tested (tests/change-orders.test.ts): the statuses and who moves
 * them, the lines as typed (product master or custom), the price the
 * quotation's way, what is paid, and what the customer sees. The writes are
 * in change-orders.ts.
 *
 * ## The flow
 *
 * DRAFT → SENT_TO_CLIENT → APPROVED | DECLINED → PAID → RELEASED. The studio
 * (owner; PM and designer on the project, `extras.write`) creates, sends and
 * releases; the client (the owner of the brief) approves or declines with a
 * reason; accounts records the money with the existing payment recording
 * (`payment.record`), which moves it to PAID. A draft or a sent order the
 * client has not answered can be CANCELLED by the studio. Nothing else.
 *
 * ## Price
 *
 * Product lines are priced at the studio's rate from its product master,
 * sized like the quotation builder (W × H in mm → sq ft, sq ft, running ft or
 * each: pricing.ts `lineAmount`). Custom lines carry an amount. The order is
 * then priced like the quotation it belongs to: the quotation's modular
 * discount on modular lines, GST at the quotation's rate on what is left
 * (pricing.ts `computeTotals`, with no professional fee: an open question for
 * the owner). The signed lines are never touched; approving lands the total
 * on the final payment stage as a quote change.
 *
 * ## Safeguards, not harassment
 *
 * The owner's principle: safeguards protect the studio but must never become
 * a tool to harass a good client. So the client is told once when an order is
 * sent (no reminders from here), may decline with a reason and nothing
 * follows from it, and a studio cannot send an order with no price.
 */

import { computeTotals, lineAmount, QTY_SCALE, type QuoteUnitName, type WorkCodeName } from '@/modules/studio-quote/pricing';

export const CHANGE_ORDER_STATUSES = ['DRAFT', 'SENT_TO_CLIENT', 'APPROVED', 'DECLINED', 'PAID', 'RELEASED', 'CANCELLED'] as const;
export type ChangeOrderStatusName = (typeof CHANGE_ORDER_STATUSES)[number];

export const isChangeOrderStatus = (v: unknown): v is ChangeOrderStatusName => typeof v === 'string' && (CHANGE_ORDER_STATUSES as readonly string[]).includes(v);

/** Who may make each move. */
export type ChangeOrderMover = 'studio' | 'customer' | 'accounts';

const MOVES: Record<ChangeOrderStatusName, readonly ChangeOrderStatusName[]> = {
  DRAFT: ['SENT_TO_CLIENT', 'CANCELLED'],
  SENT_TO_CLIENT: ['APPROVED', 'DECLINED', 'CANCELLED'],
  APPROVED: ['PAID'],
  DECLINED: [],
  PAID: ['RELEASED'],
  RELEASED: [],
  CANCELLED: [],
};

const MOVER: Record<ChangeOrderStatusName, ChangeOrderMover | null> = {
  DRAFT: null,
  SENT_TO_CLIENT: 'studio',
  APPROVED: 'customer',
  DECLINED: 'customer',
  PAID: 'accounts',
  RELEASED: 'studio',
  CANCELLED: 'studio',
};

export function canMove(from: ChangeOrderStatusName, to: ChangeOrderStatusName, by: ChangeOrderMover): boolean {
  return MOVES[from].includes(to) && MOVER[to] === by;
}

export const STATUS_LABEL: Record<ChangeOrderStatusName, string> = {
  DRAFT: 'Draft',
  SENT_TO_CLIENT: 'With the client',
  APPROVED: 'Approved · waiting for payment',
  DECLINED: 'Declined',
  PAID: 'Paid · ready to release',
  RELEASED: 'Released',
  CANCELLED: 'Cancelled',
};

/** The phases a new change order may be added in: after design sign-off, before the closure is fixed. */
export const EXTRAS_PHASES = ['PRE_EXECUTION', 'EXECUTION', 'CLOSURE'] as const;

export function extrasOpen(phase: string, closedOut: boolean, designFinal = false): { ok: true } | { ok: false; error: string } {
  if (closedOut) return { ok: false, error: 'This project is closed out: its final payment is fixed, so extra work cannot be added.' };
  /* Additional scope (owner, 12 Nov 2026): once the design final quotation is made, even while design steps remain. */
  if (phase === 'DESIGN' && designFinal) return { ok: true };
  if (phase === 'DESIGN') return { ok: false, error: 'Extra work is added after the design is signed off. Until then, change the design final.' };
  if (!(EXTRAS_PHASES as readonly string[]).includes(phase)) return { ok: false, error: 'Extra work cannot be added at this stage of the project.' };
  return { ok: true };
}

// ── Lines ─────────────────────────────────────────────────────

export const LINES_MAX = 30;
export const TITLE_MAX = 120;
export const TEXT_MAX = 600;
const AMOUNT_CAP = 10_000_000_00; // ₹1 crore in paise: a typo guard, not a business rule.
const MM_CAP = 30_000; // 30 m.

/** What the product master offers a change order (the studio's current rate). */
export interface ProductForExtra {
  id: string;
  name: string;
  code: WorkCodeName;
  unit: QuoteUnitName;
  details: string | null;
  ratePaise: number;
}

/** A priced line, ready to store. */
export interface ExtraLine {
  productId: string | null;
  room: string | null;
  product: string;
  details: string | null;
  code: WorkCodeName;
  unit: QuoteUnitName;
  widthMm: number | null;
  heightMm: number | null;
  qtyMilli: number | null;
  ratePaise: number;
  /** Before discount and GST. */
  amountPaise: number;
}

const clean = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** A whole number of millimetres, 1 to 30 m. */
function mmIn(v: unknown): number | null {
  const t = typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim() : '';
  if (!/^\d{1,5}$/.test(t)) return null;
  const n = Number(t);
  return n > 0 && n <= MM_CAP ? n : null;
}

/** "12.5" → 12500 thousandths; up to three decimals. */
function qtyIn(v: unknown): number | null {
  const t = typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim() : '';
  if (!/^\d{1,6}(\.\d{1,3})?$/.test(t)) return null;
  const n = Math.round(Number(t) * QTY_SCALE);
  return n > 0 ? n : null;
}

/** "12,000" / "₹12000.50" → paise; null when it is not a positive amount. */
export function rupeesIn(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? Math.round(v * 100) : null;
  if (typeof v !== 'string') return null;
  const t = v.replace(/[₹,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const p = Math.round(Number(t) * 100);
  return p > 0 ? p : null;
}

export type LinesCheck = { ok: true; lines: ExtraLine[] } | { ok: false; error: string };

/**
 * The lines as typed, priced. A product line: `{ productId, room?, widthMm,
 * heightMm }` for W × H, `{ productId, room?, qty }` otherwise; the product,
 * its unit, work code and rate come from the product master, never from the
 * browser. A custom line: `{ description, amount, code?, room? }` (on-site
 * unless said modular).
 */
export function checkExtraLines(raw: unknown, products: ReadonlyMap<string, ProductForExtra>): LinesCheck {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: 'Add at least one line: a product from your product master, or a custom line with an amount.' };
  if (raw.length > LINES_MAX) return { ok: false, error: `Up to ${LINES_MAX} lines on one change order.` };
  const lines: ExtraLine[] = [];
  for (const [i, r] of raw.entries()) {
    const o = r && typeof r === 'object' ? (r as Record<string, unknown>) : {};
    const n = i + 1;
    const room = clean(o.room, 80) || null;
    const productId = typeof o.productId === 'string' && o.productId ? o.productId : null;
    if (productId) {
      const p = products.get(productId);
      if (!p) return { ok: false, error: `Line ${n}: that product is not in your product master any more. Pick it again.` };
      let widthMm: number | null = null;
      let heightMm: number | null = null;
      let qtyMilli: number | null = null;
      if (p.unit === 'AREA') {
        widthMm = mmIn(o.widthMm);
        heightMm = mmIn(o.heightMm);
        if (widthMm === null || heightMm === null) return { ok: false, error: `Line ${n} (${p.name}): enter the width and height in millimetres.` };
      } else {
        qtyMilli = qtyIn(o.qty);
        if (qtyMilli === null) return { ok: false, error: `Line ${n} (${p.name}): enter the ${p.unit === 'SQFT' ? 'square feet' : p.unit === 'RFT' ? 'running feet' : 'quantity'}.` };
      }
      if (p.ratePaise <= 0) return { ok: false, error: `Line ${n} (${p.name}) has no rate in your product master. Set its rate first, or use a custom line.` };
      const amountPaise = lineAmount({ unit: p.unit, code: p.code, ratePaise: p.ratePaise, widthMm, heightMm, qtyMilli });
      if (amountPaise <= 0) return { ok: false, error: `Line ${n} (${p.name}) comes to nothing. Check the size.` };
      if (amountPaise > AMOUNT_CAP) return { ok: false, error: `Line ${n} (${p.name}) comes to more than ₹1 crore. Check the size.` };
      lines.push({ productId: p.id, room, product: p.name, details: p.details, code: p.code, unit: p.unit, widthMm, heightMm, qtyMilli, ratePaise: p.ratePaise, amountPaise });
      continue;
    }
    const description = clean(o.description, 200);
    const amountPaise = rupeesIn(o.amount);
    if (!description && amountPaise === null) continue; // an empty row left in the form
    if (!description) return { ok: false, error: `Line ${n}: say what the work is.` };
    if (amountPaise === null) return { ok: false, error: `Line ${n} (${description}): enter the amount in rupees.` };
    if (amountPaise > AMOUNT_CAP) return { ok: false, error: `Line ${n} (${description}): more than ₹1 crore. Check the amount.` };
    lines.push({
      productId: null,
      room,
      product: description,
      details: clean(o.details, TEXT_MAX) || null,
      code: o.code === 'MODULAR' ? 'MODULAR' : 'ONSITE',
      unit: 'UNIT',
      widthMm: null,
      heightMm: null,
      qtyMilli: QTY_SCALE,
      ratePaise: amountPaise,
      amountPaise,
    });
  }
  if (lines.length === 0) return { ok: false, error: 'Add at least one line: a product from your product master, or a custom line with an amount.' };
  return { ok: true, lines };
}

export interface ExtraTotals {
  workPaise: number;
  modularPaise: number;
  discountPaise: number;
  gstPaise: number;
  /** What the client pays, GST included. */
  totalPaise: number;
}

/** The order priced the quotation's way: its modular discount, then GST at its rate. No professional fee. */
export function extraTotals(lines: readonly Pick<ExtraLine, 'code' | 'unit' | 'ratePaise' | 'widthMm' | 'heightMm' | 'qtyMilli' | 'amountPaise'>[], terms: { discountBps: number; gstBps: number }): ExtraTotals {
  const t = computeTotals(
    lines.map((l) => ({ unit: l.unit, code: l.code, ratePaise: l.ratePaise, widthMm: l.widthMm, heightMm: l.heightMm, qtyMilli: l.qtyMilli, amountPaise: l.amountPaise })),
    { feeBps: 0, discountBps: Math.max(0, terms.discountBps), gstBps: Math.max(0, terms.gstBps) },
  );
  return { workPaise: t.workPaise, modularPaise: t.modularPaise, discountPaise: t.discountPaise, gstPaise: t.gstPaise, totalPaise: t.totalPaise };
}

/** "1200 × 600 mm" / "12.5 sq ft" / "3 rft" / "2 nos"; null for a custom lump sum. */
export function sizeLabel(l: Pick<ExtraLine, 'unit' | 'widthMm' | 'heightMm' | 'qtyMilli' | 'productId'>): string | null {
  if (l.unit === 'AREA') return l.widthMm && l.heightMm ? `${l.widthMm} × ${l.heightMm} mm` : null;
  if (!l.productId) return null;
  const q = l.qtyMilli ? (l.qtyMilli / QTY_SCALE).toFixed(3).replace(/\.?0+$/, '') : '0';
  return l.unit === 'SQFT' ? `${q} sq ft` : l.unit === 'RFT' ? `${q} rft` : `${q} nos`;
}

export function checkTitle(v: unknown): string | null {
  const t = clean(v, TITLE_MAX);
  return t.length >= 2 ? t : null;
}

export function checkDeclineReason(v: unknown): { ok: true; reason: string } | { ok: false; error: string } {
  const t = clean(v, TEXT_MAX);
  if (t.length < 3) return { ok: false, error: 'Tell the studio why, in a few words.' };
  return { ok: true, reason: t };
}

// ── Money received ────────────────────────────────────────────

/** A payment row recorded for the order, with its ledger status (payment-ledger.ts). */
export interface ExtraPaymentRow {
  amountPaise: number;
  status: 'confirmed' | 'earlier' | 'waiting' | 'disputed' | 'replaced';
}

export interface ExtraPaid {
  /** Recorded by the studio and not disputed or replaced (confirmed or waiting). */
  recordedPaise: number;
  /** Confirmed by the client. */
  confirmedPaise: number;
  /** What is still to be recorded. */
  openPaise: number;
  /** Recorded money covers the order. */
  covered: boolean;
  /** Some of it is waiting for the client's yes. */
  waiting: boolean;
  /** The client said they did not pay an entry. */
  disputed: boolean;
}

export function extraPaid(totalPaise: number, rows: readonly ExtraPaymentRow[]): ExtraPaid {
  const live = rows.filter((r) => r.status === 'confirmed' || r.status === 'earlier' || r.status === 'waiting');
  const recordedPaise = live.reduce((a, r) => a + r.amountPaise, 0);
  const confirmedPaise = live.filter((r) => r.status !== 'waiting').reduce((a, r) => a + r.amountPaise, 0);
  return {
    recordedPaise,
    confirmedPaise,
    openPaise: Math.max(0, totalPaise - recordedPaise),
    covered: totalPaise > 0 && recordedPaise >= totalPaise,
    waiting: live.some((r) => r.status === 'waiting'),
    disputed: rows.some((r) => r.status === 'disputed'),
  };
}

/** May the studio release it to the factory / the work? Paid in full, nothing disputed. */
export function releaseRefusal(status: ChangeOrderStatusName, paid: ExtraPaid): string | null {
  if (status === 'RELEASED') return 'Already released.';
  if (status !== 'PAID') return 'Release it once the client has approved and paid.';
  if (paid.disputed) return 'The client says a payment for this was not made. Our team is looking into it; release it once that is settled.';
  if (!paid.covered) return 'The payment recorded does not cover it yet.';
  return null;
}

/** The quote change approving writes: on the final stage, GST included. */
export const extraChangeLabel = (number: number, title: string): string => `Extra work ${number}: ${title}`.slice(0, 160);

// ── What the client sees ──────────────────────────────────────

export type CustomerExtraState = 'waiting' | 'approved' | 'declined' | 'paid' | 'released';

const CUSTOMER_STATE: Partial<Record<ChangeOrderStatusName, CustomerExtraState>> = {
  SENT_TO_CLIENT: 'waiting',
  APPROVED: 'approved',
  DECLINED: 'declined',
  PAID: 'paid',
  RELEASED: 'released',
};

/** Drafts and cancelled orders never reach the client. */
export const customerSeesExtra = (status: ChangeOrderStatusName): boolean => CUSTOMER_STATE[status] !== undefined;

export interface CustomerExtraLine {
  product: string;
  room: string | null;
  details: string | null;
  size: string | null;
  amountPaise: number;
}

export interface CustomerExtra {
  id: string;
  number: number;
  title: string;
  reason: string | null;
  state: CustomerExtraState;
  lines: CustomerExtraLine[];
  workPaise: number;
  discountPaise: number;
  gstBps: number;
  gstPaise: number;
  totalPaise: number;
  /** Recorded so far (waiting for their yes included). */
  paidPaise: number;
  /** Still to pay once approved. */
  duePaise: number;
  sentOn: string | null;
  decidedOn: string | null;
  declineReason: string | null;
  /** The photo or drawing, a signed link; null when none. */
  photoUrl: string | null;
  /** The owner of the brief may approve or decline now. */
  canAnswer: boolean;
  /** Additional scope (owner, 12 Nov 2026): extra days the work adds, and the day its payment is due (at once). Null on ordinary extra work. */
  daysRequired: number | null;
  dueOn: string | null;
  /**
   * Additional scope (owner, 13 Nov 2026): what it does to the timeline, in
   * the client's words ("Your handover moves by 7 days" / "No change to your
   * handover" / "This item comes by 5 Dec"). Null on ordinary extra work.
   * daysRequired and dueOn above are kept for app builds that predate it:
   * they are set only when the project moves, so an older app never says
   * "Adds 0 days".
   */
  impact: ScopeImpactView | null;
  /** The amounts are what the client pays, GST included (simple scope: no GST line, no discount). */
  inclGst: boolean;
}

export interface ExtraRowForCustomer {
  id: string;
  number: number;
  title: string;
  reason: string | null;
  status: ChangeOrderStatusName;
  workPaise: number;
  discountPaise: number;
  gstBps: number;
  gstPaise: number;
  totalPaise: number;
  sentAt: string | null;
  decidedAt: string | null;
  declineReason: string | null;
  lines: (Pick<ExtraLine, 'product' | 'room' | 'details' | 'unit' | 'widthMm' | 'heightMm' | 'qtyMilli' | 'productId' | 'amountPaise'>)[];
  payments: ExtraPaymentRow[];
  /** Additional scope: extra days the work needs, and the day its payment is due. */
  daysRequired?: number | null;
  dueOn?: string | null;
  /** Additional scope (13 Nov 2026): `scopeImpactOf` the row; null or absent on ordinary extra work. */
  impact?: ScopeImpactView | null;
  /** Simple scope: the amounts include GST. */
  inclGst?: boolean;
}

/** One order as the client sees it, field by field (never the studio's ids, who made it or the rate). */
export function toCustomerExtra(r: ExtraRowForCustomer, owner: boolean, photoUrl: string | null): CustomerExtra | null {
  const state = CUSTOMER_STATE[r.status];
  if (!state) return null;
  const paid = extraPaid(r.totalPaise, r.payments);
  return {
    id: r.id,
    number: r.number,
    title: r.title,
    reason: r.reason,
    state,
    lines: r.lines.map((l) => ({ product: l.product, room: l.room, details: l.details, size: sizeLabel(l), amountPaise: l.amountPaise })),
    workPaise: r.workPaise,
    discountPaise: r.discountPaise,
    gstBps: r.gstBps,
    gstPaise: r.gstPaise,
    totalPaise: r.totalPaise,
    paidPaise: paid.recordedPaise,
    duePaise: state === 'approved' ? paid.openPaise : 0,
    sentOn: r.sentAt ? r.sentAt.slice(0, 10) : null,
    decidedOn: r.decidedAt ? r.decidedAt.slice(0, 10) : null,
    declineReason: state === 'declined' ? r.declineReason : null,
    photoUrl,
    canAnswer: owner && state === 'waiting',
    daysRequired: r.impact && r.impact.kind !== 'MOVES_PROJECT' ? null : (r.daysRequired ?? null),
    dueOn: r.impact && r.impact.kind !== 'MOVES_PROJECT' ? null : (r.dueOn ?? null),
    impact: r.impact ?? null,
    inclGst: r.inclGst === true,
  };
}

// ── Additional scope (owner, 12 Nov 2026) ─────────────────────

export const SCOPE_DAYS_MAX = 365;

/** The days the additional work needs: a whole number of days, 0 to a year. */
export function checkDaysRequired(raw: unknown): { ok: true; days: number } | { ok: false; error: string } {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw.trim()) : NaN;
  if (!Number.isInteger(n) || n < 0 || n > SCOPE_DAYS_MAX) return { ok: false, error: 'Say how many days the additional work needs: 0 to 365.' };
  return { ok: true, days: n };
}

/** The additional-scope quotation's number: the design final's, then -A1, -A2… (never one taken). */
export function scopeNumber(base: string, taken: readonly string[]): string {
  const root = base.replace(/-A\d+$/, '');
  for (let n = 1; ; n += 1) if (!taken.includes(`${root}-A${n}`)) return `${root}-A${n}`;
}

/**
 * When the additional scope's payment is recorded, the plan moves later by
 * the days the project waited on it (on hold from the approval) plus the
 * days the work needs: the client's side, never our delay.
 */
export function scopePaidDays(holdDays: number, daysRequired: number | null): number {
  return Math.max(0, holdDays) + Math.max(0, daysRequired ?? 0);
}

// ── Simple additional scope (owner, 13 Nov 2026) ──────────────
//
// "It should not open the whole quotation builder. It's an additional item:
// it should just have a cost and a day." "Like a quotation: serial number,
// item, details, cost, then days it needs, and send it for approval." "No
// discount on these. One line item costing, take it or leave it." Each
// amount is what the client pays, GST included: no discount, no GST toggle.

export const SCOPE_IMPACTS = ['MOVES_PROJECT', 'WITHIN_TIMELINE', 'ITEM_ONLY'] as const;
export type ScopeImpactName = (typeof SCOPE_IMPACTS)[number];
export const isScopeImpact = (v: unknown): v is ScopeImpactName => typeof v === 'string' && (SCOPE_IMPACTS as readonly string[]).includes(v);

export const SCOPE_LINES_MAX = 10;
const SCOPE_ITEM_MAX = 120;
/** How far ahead an item-only date may be: two years, a typo guard. */
const SCOPE_DATE_AHEAD_DAYS = 730;

/** One line as sent; its serial number is its place in the list. */
export interface ScopeLine {
  item: string;
  details: string | null;
  /** What the client pays for it, GST included. */
  amountPaise: number;
}

/** The lines as typed: `{ item, details?, amount }`, 1 to 10; an empty row left in the form is skipped. */
export function checkScopeLines(raw: unknown): { ok: true; lines: ScopeLine[]; totalPaise: number } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: 'Add at least one item with its cost.' };
  const lines: ScopeLine[] = [];
  for (const [i, r] of raw.entries()) {
    const o = r && typeof r === 'object' ? (r as Record<string, unknown>) : {};
    const n = i + 1;
    const item = clean(o.item, SCOPE_ITEM_MAX);
    const details = clean(o.details, TEXT_MAX) || null;
    const blankAmount = o.amount === undefined || o.amount === null || (typeof o.amount === 'string' && o.amount.trim() === '');
    if (!item && !details && blankAmount) continue;
    if (!item) return { ok: false, error: `Line ${n}: write the item.` };
    const amountPaise = rupeesIn(o.amount);
    if (amountPaise === null) return { ok: false, error: `Line ${n} (${item}): write the cost in rupees.` };
    if (amountPaise > AMOUNT_CAP) return { ok: false, error: `Line ${n} (${item}): more than ₹1 crore. Check the cost.` };
    lines.push({ item, details, amountPaise });
  }
  if (lines.length === 0) return { ok: false, error: 'Add at least one item with its cost.' };
  if (lines.length > SCOPE_LINES_MAX) return { ok: false, error: `Up to ${SCOPE_LINES_MAX} items at a time.` };
  return { ok: true, lines, totalPaise: lines.reduce((a, l) => a + l.amountPaise, 0) };
}

/** What the scope does to the timeline, as stored and as shown. */
export type ScopeImpactView = { kind: 'MOVES_PROJECT'; days: number } | { kind: 'WITHIN_TIMELINE' } | { kind: 'ITEM_ONLY'; on: string };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const dayNumber = (d: string): number => Math.round(Date.parse(`${d}T00:00:00Z`) / 86_400_000);
const isRealDay = (d: string): boolean => DAY_RE.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;

/**
 * The impact chosen when sending (owner, 13 Nov 2026): (a) moves the project
 * by N days (1 to 365); (b) within the timeline, no date moves; (c) this item
 * only, with its own date (today or later), the project does not move.
 */
export function checkScopeImpact(raw: { impact: unknown; days?: unknown; date?: unknown }, today: string): { ok: true; impact: ScopeImpactView } | { ok: false; error: string } {
  if (!isScopeImpact(raw.impact)) return { ok: false, error: 'Pick what it does to the timeline.' };
  if (raw.impact === 'WITHIN_TIMELINE') return { ok: true, impact: { kind: 'WITHIN_TIMELINE' } };
  if (raw.impact === 'MOVES_PROJECT') {
    const d = checkDaysRequired(raw.days);
    if (!d.ok || d.days < 1) return { ok: false, error: 'Write how many days it moves the project: 1 to 365.' };
    return { ok: true, impact: { kind: 'MOVES_PROJECT', days: d.days } };
  }
  const on = typeof raw.date === 'string' ? raw.date.trim() : '';
  if (!isRealDay(on)) return { ok: false, error: 'Pick the date this item comes by.' };
  if (dayNumber(on) < dayNumber(today)) return { ok: false, error: 'The date this item comes by cannot be in the past.' };
  if (dayNumber(on) - dayNumber(today) > SCOPE_DATE_AHEAD_DAYS) return { ok: false, error: 'That date is more than two years away. Check it.' };
  return { ok: true, impact: { kind: 'ITEM_ONLY', on } };
}

/**
 * A change order's impact, or null when it is not additional scope. The
 * 12 Nov builder-made scope (a quotation behind it, no impact stored) moved
 * the plan by its days required, so it reads as MOVES_PROJECT.
 */
export function scopeImpactOf(o: { scopeImpact: ScopeImpactName | null; daysRequired: number | null; itemDueOn: string | null; builderScope: boolean }): ScopeImpactView | null {
  if (o.scopeImpact === 'MOVES_PROJECT') return { kind: 'MOVES_PROJECT', days: Math.max(0, o.daysRequired ?? 0) };
  if (o.scopeImpact === 'WITHIN_TIMELINE') return { kind: 'WITHIN_TIMELINE' };
  if (o.scopeImpact === 'ITEM_ONLY') return o.itemDueOn ? { kind: 'ITEM_ONLY', on: o.itemDueOn } : { kind: 'WITHIN_TIMELINE' };
  if (o.builderScope) return { kind: 'MOVES_PROJECT', days: Math.max(0, o.daysRequired ?? 0) };
  return null;
}

/** "5 Dec" from "2026-12-05". */
export const scopeShortDay = (d: string): string => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** The impact in plain words (owner, 13 Nov 2026), never a reason. English; the client apps carry hi/mr. */
export function scopeImpactWords(i: ScopeImpactView): string {
  if (i.kind === 'MOVES_PROJECT') return `Your handover moves by ${i.days} day${i.days === 1 ? '' : 's'}`;
  if (i.kind === 'WITHIN_TIMELINE') return 'No change to your handover';
  return `This item comes by ${scopeShortDay(i.on)}`;
}

/**
 * Paid (owner, 13 Nov 2026: "yes the whole project on hold", for every
 * kind): the hold ends and the plan moves by the days it was on hold, the
 * client's side as with any hold; only "moves the project" adds its days.
 */
export function scopeMoveDays(holdDays: number, impact: ScopeImpactView | null): number {
  return scopePaidDays(holdDays, impact?.kind === 'MOVES_PROJECT' ? impact.days : 0);
}

/** "Additional scope 2": the next number among the project's scopes. */
export const scopeTitle = (scopesSoFar: number): string => `Additional scope ${Math.max(0, scopesSoFar) + 1}`;
