/**
 * The work-order rules that are not money (Studio OS Phase 3): statuses, who
 * may move one where, changing the crew, removing, the "build from the final"
 * plan, and the PM's view with every money field taken out. Pure, tested in
 * tests/studio-crews-rules.test.ts.
 *
 * ## PM sees quantities only (owner, 12 Oct 2026)
 *
 * The PM builds work orders, picks crews, enters measured quantities and
 * extras, and marks work done; rates, amounts, balances and payments are the
 * owner's and accounts'. `stripMoney` is applied on the server to every read
 * for a member without `workorder.money`, so the money never reaches the PM's
 * browser — hiding it in the UI alone would be a sign, not a lock. The writes
 * refuse money fields for them too (crew-flow.ts).
 */

import { routeProduct, type RouteTable } from './trades';
import type { Pending } from './money';
import type { CarpentryModeName, QtySourceName } from './pricing';
import type { CrewUnitName } from './trades';

export type WorkOrderStatusName = 'DRAFT' | 'ISSUED' | 'IN_PROGRESS' | 'WORK_DONE' | 'SETTLED';

export const STATUS_LABEL: Record<WorkOrderStatusName, string> = {
  DRAFT: 'Draft',
  ISSUED: 'Issued',
  IN_PROGRESS: 'In progress',
  WORK_DONE: 'Work done',
  SETTLED: 'Settled',
};

/**
 * Where a work order may go next, and who may move it. The PM drives the
 * work (issue, start, work done, reopen); owner and accounts close the money
 * (settled, and back from settled when a correction reopens a balance).
 */
export function checkStatus(
  from: WorkOrderStatusName,
  to: WorkOrderStatusName,
  who: { build: boolean; money: boolean },
  money: { settled: boolean } | null,
): { ok: true } | { ok: false; error: string } {
  if (from === to) return { ok: false, error: `It is ${STATUS_LABEL[to].toLowerCase()} already.` };
  const work: Partial<Record<WorkOrderStatusName, WorkOrderStatusName[]>> = {
    DRAFT: ['ISSUED'],
    ISSUED: ['IN_PROGRESS', 'WORK_DONE', 'DRAFT'],
    IN_PROGRESS: ['WORK_DONE', 'ISSUED'],
    WORK_DONE: ['IN_PROGRESS'],
  };
  if (to === 'SETTLED') {
    if (!who.money) return { ok: false, error: 'Owner or accounts mark a work order settled.' };
    if (from === 'DRAFT') return { ok: false, error: 'Issue it first.' };
    if (!money?.settled) return { ok: false, error: 'There is still a balance on it. Pay it, or correct the bill, first.' };
    return { ok: true };
  }
  if (from === 'SETTLED') {
    if (!who.money) return { ok: false, error: 'Owner or accounts reopen a settled work order.' };
    return to === 'WORK_DONE' ? { ok: true } : { ok: false, error: 'A settled work order reopens as work done.' };
  }
  if (!who.build) return { ok: false, error: 'The project manager or the owner moves the work along.' };
  return work[from]?.includes(to) ? { ok: true } : { ok: false, error: `A ${STATUS_LABEL[from].toLowerCase()} work order cannot go to ${STATUS_LABEL[to].toLowerCase()}.` };
}

/** Once anything is paid the crew cannot be swapped: the payment history would point at someone never paid. */
export function canSwapCrew(paymentCount: number, newCrewHasOrder: boolean): { ok: true } | { ok: false; error: string } {
  if (paymentCount > 0) return { ok: false, error: 'Something is paid on this work order, so its crew cannot change. Archive it and raise a new one.' };
  if (newCrewHasOrder) return { ok: false, error: 'That crew already has a work order on this project. Add the work to theirs instead, so their balance stays in one place.' };
  return { ok: true };
}

/** A work order is removed only while nothing is paid; after that it is archived. */
export function canRemoveOrder(paymentCount: number): { ok: true } | { ok: false; error: string } {
  return paymentCount > 0 ? { ok: false, error: 'Something is paid on this work order, so it stays on the record. Archive it instead.' } : { ok: true };
}

// ── Building from the final ───────────────────────────────────

export interface SourceLine {
  id: string;
  room: string;
  product: string;
  code: 'MODULAR' | 'ONSITE';
  unit: 'AREA' | 'SQFT' | 'RFT' | 'UNIT';
  details: string | null;
  widthMm: number | null;
  heightMm: number | null;
  qtyMilli: number | null;
  amountPaise: number;
}

export interface PlannedLine extends SourceLine {
  trade: string;
  guessed: boolean;
}

/**
 * The final's lines grouped by trade, leaving out every line already on a
 * live work order of this project (nothing is billed twice) and lines worth
 * nothing to the client (headings, free items).
 */
export function planFromFinal(lines: readonly SourceLine[], table: RouteTable, alreadyOrdered: ReadonlySet<string>): Map<string, PlannedLine[]> {
  const out = new Map<string, PlannedLine[]>();
  for (const l of lines) {
    if (alreadyOrdered.has(l.id)) continue;
    const r = routeProduct(l.product, table);
    const list = out.get(r.trade) ?? [];
    list.push({ ...l, trade: r.trade, guessed: r.guessed });
    out.set(r.trade, list);
  }
  return out;
}

/** The next work order number on a project. */
export const nextNumber = (taken: readonly number[]): number => (taken.length ? Math.max(...taken) + 1 : 1);

// ── The views, and the PM's ───────────────────────────────────

export interface LineView {
  id: string;
  room: string;
  product: string;
  code: 'MODULAR' | 'ONSITE' | null;
  widthMm: number | null;
  heightMm: number | null;
  trade: string;
  tradeLabel: string;
  guessed: boolean;
  item: string;
  unit: CrewUnitName;
  carpentry: CarpentryModeName | null;
  qtyMilli: number | null;
  measuredQtyMilli: number | null;
  qtySource: QtySourceName;
  isExtra: boolean;
  pending: Pending;
  overQuote: boolean;
  /* Money: null for anyone without `workorder.money`. */
  ratePaise: number | null;
  rateEdited: boolean | null;
  agreedPaise: number | null;
  amountPaise: number | null;
  quotedAmountPaise: number | null;
}

export interface PaymentView {
  id: string;
  kind: 'PAYMENT' | 'ADVANCE' | 'CORRECTION';
  amountPaise: number;
  mode: string;
  reference: string | null;
  note: string | null;
  paidOn: string;
  byName: string;
  correctsId: string | null;
  corrected: boolean;
}

export interface MoneyView {
  billPaise: number;
  asQuotedPaise: number;
  extrasPaise: number;
  variancePaise: number;
  clientValuePaise: number;
  paidPaise: number;
  balancePaise: number;
  advanceOutPaise: number;
  settled: boolean;
}

export interface WorkOrderView {
  id: string;
  number: number;
  projectId: string;
  projectName: string;
  vendorId: string;
  crewName: string;
  crewPhone: string | null;
  trades: { key: string; label: string }[];
  status: WorkOrderStatusName;
  dueOn: string | null;
  archived: boolean;
  sourceKind: string | null;
  stepIds: string[];
  steps: { id: string; label: string; done: boolean }[];
  workDoneAt: string | null;
  workDoneByName: string | null;
  createdByName: string | null;
  lines: LineView[];
  needPrice: number;
  needQty: number;
  extras: number;
  overQuoteLines: number;
  paymentCount: number;
  money: MoneyView | null;
  payments: PaymentView[] | null;
}

/** The view with every money field taken out: rates, agreed amounts, amounts, the client's values, the totals, the payments. */
export function stripMoney(v: WorkOrderView): WorkOrderView {
  return {
    ...v,
    money: null,
    payments: null,
    lines: v.lines.map((l) => ({ ...l, ratePaise: null, rateEdited: null, agreedPaise: null, amountPaise: null, quotedAmountPaise: null })),
  };
}

/** The view a member gets: the whole thing with `workorder.money`, quantities only without. */
export const viewFor = (v: WorkOrderView, seesMoney: boolean): WorkOrderView => (seesMoney ? v : stripMoney(v));

// ── Statement on WhatsApp ─────────────────────────────────────

/**
 * Opens the studio's OWN WhatsApp with the crew's chat and a message. We send
 * nothing. The link in it opens the statement only for somebody signed in to
 * the studio: crews have no login, so the studio forwards the PDF if the crew
 * wants it.
 */
export function statementWhatsApp(phone: string | null, text: string): string {
  const ten = (phone ?? '').replace(/\D/g, '').slice(-10);
  const to = /^[6-9]\d{9}$/.test(ten) ? `91${ten}` : '';
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}
