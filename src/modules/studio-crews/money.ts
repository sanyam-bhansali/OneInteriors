/**
 * What a crew is owed (Studio OS Phase 3). Hauspire's money rules
 * (docs/studio-os/HAUSPIRE-VENDOR-APP.md §2.3, §3.10), in integer paise:
 *
 * - **Measured beats quoted**: a line is paid on the site measurement when
 *   there is one, else on the quote's (or an estimate's) quantity.
 * - **An agreed amount beats rate × quantity** entirely.
 * - **Never store a total**: bill, paid and balance are added up here, from
 *   the lines and the payments, every time.
 * - **Variance** is what the bill came to above the quotation's own
 *   quantities (site measurement and extras). Advice, not a block.
 * - **Never pay above the balance** (₹1 of rounding allowed), except an
 *   advance, which may run ahead of the bill by the studio's advance limit.
 *
 * Pure, tested in tests/studio-crews-money.test.ts.
 */

import { applyBps, formatINR, type Paise } from '@/lib/money';

/** ₹1: what is left after rounding is not a balance. */
export const TOLERANCE_PAISE = 100;
/** Hauspire's quick amount. */
export const QUICK_FIXED_PAISE = 2_500_000;

export interface MoneyLine {
  ratePaise: number | null;
  qtyMilli: number | null;
  measuredQtyMilli: number | null;
  agreedPaise: number | null;
  isExtra: boolean;
  quotedAmountPaise: number | null;
  /** Taken off the work order: counts for nothing. */
  removed?: boolean;
}

export interface MoneyPayment {
  amountPaise: number;
  kind?: 'PAYMENT' | 'ADVANCE' | 'CORRECTION';
}

/** rate × thousandths, rounded once, half up (money.ts's rule). */
export const rateTimesQty = (ratePaise: number, qtyMilli: number): Paise => applyBps(ratePaise * qtyMilli, 10);

/** The quantity a line is paid on: measured, else quoted or estimated. */
export const effectiveQty = (l: Pick<MoneyLine, 'qtyMilli' | 'measuredQtyMilli'>): number | null => l.measuredQtyMilli ?? l.qtyMilli;

/** What one line comes to. An unpriced line is ₹0 here and "to price" on screen, never a silent zero in a paid bill. */
export function lineAmount(l: MoneyLine): Paise {
  if (l.removed) return 0;
  if (l.agreedPaise !== null) return l.agreedPaise;
  const q = effectiveQty(l);
  return l.ratePaise !== null && q !== null ? rateTimesQty(l.ratePaise, q) : 0;
}

/** What the line would have come to on the quotation's own quantity. An extra was never quoted: 0. */
export function lineAsQuoted(l: MoneyLine): Paise {
  if (l.removed || l.isExtra) return 0;
  if (l.agreedPaise !== null) return l.agreedPaise;
  return l.ratePaise !== null && l.qtyMilli !== null ? rateTimesQty(l.ratePaise, l.qtyMilli) : 0;
}

export type Pending = 'price' | 'qty' | null;

/** What a line still needs before it can be paid: a price, a quantity, or nothing. */
export function linePending(l: MoneyLine): Pending {
  if (l.removed || l.agreedPaise !== null) return null;
  if (l.ratePaise === null || l.ratePaise <= 0) return 'price';
  if (effectiveQty(l) === null) return 'qty';
  return null;
}

/** Measured above what the quotation allowed for. */
export const overQuote = (l: Pick<MoneyLine, 'qtyMilli' | 'measuredQtyMilli' | 'isExtra'>): boolean =>
  !l.isExtra && l.qtyMilli !== null && l.measuredQtyMilli !== null && l.measuredQtyMilli > l.qtyMilli;

export interface WorkOrderMoney {
  billPaise: Paise;
  asQuotedPaise: Paise;
  extrasPaise: Paise;
  /** bill − as quoted: site measurement and extras above the quotation. */
  variancePaise: Paise;
  /** What the client is charged for these lines. */
  clientValuePaise: Paise;
  paidPaise: Paise;
  /** bill − paid. Negative while an advance runs ahead of the bill. */
  balancePaise: Paise;
  /** Paid ahead of the bill, to be recovered from later work. */
  advanceOutPaise: Paise;
  pendingLines: number;
  needPrice: number;
  needQty: number;
  /** Nothing left to pay: a bill, and the balance within ₹1. */
  settled: boolean;
}

export function workOrderMoney(lines: readonly MoneyLine[], payments: readonly MoneyPayment[]): WorkOrderMoney {
  const live = lines.filter((l) => !l.removed);
  const billPaise = live.reduce((s, l) => s + lineAmount(l), 0);
  const asQuotedPaise = live.reduce((s, l) => s + lineAsQuoted(l), 0);
  const extrasPaise = live.filter((l) => l.isExtra).reduce((s, l) => s + lineAmount(l), 0);
  const clientValuePaise = live.reduce((s, l) => s + (l.quotedAmountPaise ?? 0), 0);
  const paidPaise = payments.reduce((s, p) => s + p.amountPaise, 0);
  const balancePaise = billPaise - paidPaise;
  const pending = live.map(linePending);
  return {
    billPaise,
    asQuotedPaise,
    extrasPaise,
    variancePaise: billPaise - asQuotedPaise,
    clientValuePaise,
    paidPaise,
    balancePaise,
    advanceOutPaise: balancePaise < 0 ? -balancePaise : 0,
    pendingLines: pending.filter(Boolean).length,
    needPrice: pending.filter((p) => p === 'price').length,
    needQty: pending.filter((p) => p === 'qty').length,
    settled: billPaise > 0 && Math.abs(balancePaise) <= TOLERANCE_PAISE,
  };
}

/** Whether there is anything to pay: more than ₹1 outstanding. */
export const hasBalance = (m: Pick<WorkOrderMoney, 'balancePaise'>): boolean => m.balancePaise > TOLERANCE_PAISE;

export type PayKind = 'PAYMENT' | 'ADVANCE';
export type Check = { ok: true } | { ok: false; error: string };

/**
 * May this be paid? A payment: more than nothing, never above the balance
 * (+₹1). An advance: before the work is priced or measured, it may run ahead
 * of the bill by the studio's advance limit, no further.
 */
export function canPayCrew(m: Pick<WorkOrderMoney, 'billPaise' | 'balancePaise'>, amountPaise: number, kind: PayKind, advanceLimitPaise: number): Check {
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) return { ok: false, error: 'A payment has to be more than nothing.' };
  if (kind === 'ADVANCE') {
    const most = m.balancePaise + Math.max(0, advanceLimitPaise);
    if (amountPaise > most + TOLERANCE_PAISE) {
      return {
        ok: false,
        error:
          most <= 0
            ? `Advances on this work order have reached the ${formatINR(advanceLimitPaise)} limit. Price the work first.`
            : `An advance can run at most ${formatINR(advanceLimitPaise)} ahead of the bill: ${formatINR(most)} is the most you can pay now.`,
      };
    }
    return { ok: true };
  }
  if (m.billPaise <= 0) return { ok: false, error: 'Nothing on this work order is priced yet. Price the work, or pay it as an advance.' };
  if (m.balancePaise <= TOLERANCE_PAISE) return { ok: false, error: 'Nothing is outstanding on this work order.' };
  if (amountPaise > m.balancePaise + TOLERANCE_PAISE) return { ok: false, error: `That is more than the ${formatINR(m.balancePaise)} outstanding on this work order.` };
  return { ok: true };
}

/** Quick amounts: the full balance, half (to the rupee), ₹25,000 (never above the balance). Only what is positive and different. */
export function quickAmounts(balancePaise: number): { label: string; amountPaise: number }[] {
  if (balancePaise <= TOLERANCE_PAISE) return [];
  const half = Math.round(balancePaise / 200) * 100;
  const out = [
    { label: 'Full balance', amountPaise: balancePaise },
    { label: 'Half', amountPaise: half },
    { label: formatINR(QUICK_FIXED_PAISE), amountPaise: Math.min(QUICK_FIXED_PAISE, balancePaise) },
  ];
  const seen = new Set<number>();
  return out.filter((q) => q.amountPaise > 0 && !seen.has(q.amountPaise) && (seen.add(q.amountPaise), true));
}

/** May this payment be corrected? Once, and never a correction itself. */
export function canCorrect(p: { kind: string; amountPaise: number }, alreadyCorrected: boolean): Check {
  if (p.kind === 'CORRECTION') return { ok: false, error: 'A correction cannot be corrected. Record the right payment instead.' };
  if (alreadyCorrected) return { ok: false, error: 'That payment is corrected already.' };
  if (p.amountPaise <= 0) return { ok: false, error: 'There is nothing to correct on that payment.' };
  return { ok: true };
}

// ── Labour cost against the contract (owner) ──────────────────

export interface LabourSummary {
  contractPaise: number | null;
  /** The crews' cost on the quotation's own quantities. */
  expectedPaise: Paise;
  /** What the work orders come to now (measured, agreed, extras). */
  committedPaise: Paise;
  paidPaise: Paise;
  extrasPaise: Paise;
  pendingLines: number;
  /** contract − committed. */
  marginPaise: Paise | null;
  /** Basis points of the contract. */
  marginBp: number | null;
  /** The margin is below the studio's target. */
  warn: boolean;
}

export function labourSummary(contractPaise: number | null, orders: readonly WorkOrderMoney[], targetPct: number): LabourSummary {
  const sum = (f: (m: WorkOrderMoney) => number) => orders.reduce((s, m) => s + f(m), 0);
  const committed = sum((m) => m.billPaise);
  const margin = contractPaise !== null && contractPaise > 0 ? contractPaise - committed : null;
  const marginBp = margin !== null && contractPaise ? Math.round((margin * 10_000) / contractPaise) : null;
  return {
    contractPaise,
    expectedPaise: sum((m) => m.asQuotedPaise),
    committedPaise: committed,
    paidPaise: sum((m) => m.paidPaise),
    extrasPaise: sum((m) => m.extrasPaise),
    pendingLines: sum((m) => m.pendingLines),
    marginPaise: margin,
    marginBp,
    warn: marginBp !== null && marginBp < Math.round(targetPct * 100),
  };
}

/** "34.39" from thousandths; "—" for none. */
export function qtyWords(milli: number | null): string {
  if (milli === null) return '—';
  return (milli / 1000).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

/** A typed quantity ("34.5") to thousandths, or null when it is not one. Must be more than 0. */
export function parseQty(raw: unknown): number | null {
  const s = String(raw ?? '').trim().replace(/,/g, '');
  if (!/^\d{1,7}(\.\d{1,3})?$/.test(s)) return null;
  const n = Math.round(Number(s) * 1000);
  return n > 0 ? n : null;
}

/** Typed rupees ("1,500" or "1500.50") to paise, or null. Must be more than 0. */
export function parseRupeesPaise(raw: unknown): number | null {
  const s = String(raw ?? '').trim().replace(/[₹,\s]/g, '');
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  const n = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  return n > 0 ? n : null;
}
