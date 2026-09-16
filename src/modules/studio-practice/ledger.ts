/**
 * What a studio owes its trades.
 *
 * Pure, and with no `server-only`, so the tests can reach it —
 * CONTRIBUTING §9.5.
 *
 * ## Never store a total
 *
 * A work order's bill, what has been paid against it and what is left are
 * computed here from the lines and the payments, every time. Nothing is
 * cached and nothing is written back.
 *
 * That is not fastidiousness. A stored total and a payments table disagree
 * eventually — a payment recorded twice, a line edited after the fact, a
 * migration that half-ran — and the disagreement in a payments ledger is always
 * discovered by a vendor who has been paid twice, or not at all. Recomputing is
 * cheap; a carpenter who stops trusting your numbers is not.
 */

import { splitAcross, type Paise } from '@/lib/money';
import { lineAmount, type QuoteLineInput } from '@/modules/studio-quote/pricing';

export interface LedgerLine {
  unit: QuoteLineInput['unit'];
  qtyMilli?: number | null;
  ratePaise: Paise;
  amountPaise?: Paise | null;
}

export interface LedgerPayment {
  amountPaise: Paise;
}

export interface WorkOrderMoney {
  billPaise: Paise;
  paidPaise: Paise;
  balancePaise: Paise;
  /** True once nothing is outstanding. Zero-value orders count as settled. */
  settled: boolean;
  /** Paid beyond the bill. Always surfaced — see `overpaid` below. */
  overpaidPaise: Paise;
}

/**
 * A work-order line uses the same arithmetic as a quotation line, minus the
 * area case: vendors are paid on measured quantities, not on drawings.
 */
export function ledgerLineAmount(line: LedgerLine): Paise {
  return lineAmount({
    unit: line.unit,
    code: 'ONSITE',
    ratePaise: line.ratePaise,
    qtyMilli: line.qtyMilli,
    amountPaise: line.amountPaise,
  });
}

/**
 * The money on one work order.
 *
 * `overpaidPaise` is reported rather than clamped. Paying a vendor more than
 * the order says is usually a data-entry mistake and occasionally a deliberate
 * advance, and both are things somebody needs to see — silently flooring the
 * balance at zero hides the first and misrepresents the second.
 */
export function workOrderMoney(
  lines: LedgerLine[],
  payments: LedgerPayment[],
): WorkOrderMoney {
  const billPaise = lines.reduce((sum, l) => sum + ledgerLineAmount(l), 0);
  const paidPaise = payments.reduce((sum, p) => sum + p.amountPaise, 0);
  const balancePaise = billPaise - paidPaise;

  return {
    billPaise,
    paidPaise,
    balancePaise,
    settled: balancePaise <= 0,
    overpaidPaise: balancePaise < 0 ? -balancePaise : 0,
  };
}

/**
 * Can this payment be recorded?
 *
 * Refused when it would take the order past its bill, with a sentence saying by
 * how much. The alternative — accepting it and showing a negative balance —
 * means the mistake is found at reconciliation instead of at the keyboard.
 *
 * A zero-value order accepts nothing: there is nothing to pay against until
 * somebody has said what the work is.
 */
export function canPay(
  money: WorkOrderMoney,
  amountPaise: Paise,
): { ok: true } | { ok: false; error: string } {
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    return { ok: false, error: 'A payment has to be more than nothing.' };
  }
  if (money.billPaise === 0) {
    return { ok: false, error: 'Add what the work is before paying for it.' };
  }
  if (amountPaise > money.balancePaise) {
    return {
      ok: false,
      error:
        money.balancePaise <= 0
          ? 'This work order is already settled.'
          : `That is more than the ${formatShort(money.balancePaise)} outstanding.`,
    };
  }
  return { ok: true };
}

function formatShort(paise: Paise): string {
  const rupees = Math.round(paise / 100);
  if (rupees >= 100_000) return `₹${(rupees / 100_000).toFixed(2).replace(/\.00$/, '')}L`;
  return `₹${rupees.toLocaleString('en-IN')}`;
}

/**
 * A studio's whole position, across every open order.
 *
 * The number a studio actually wants on a Monday: what is going out, and to
 * whom. Grouped by vendor rather than by project, because that is who rings.
 */
export interface VendorPosition {
  vendorId: string;
  vendorName: string;
  trade: string;
  billPaise: Paise;
  paidPaise: Paise;
  balancePaise: Paise;
  openOrders: number;
}

export function byVendor(
  orders: {
    vendorId: string;
    vendorName: string;
    trade: string;
    lines: LedgerLine[];
    payments: LedgerPayment[];
  }[],
): VendorPosition[] {
  const map = new Map<string, VendorPosition>();

  for (const order of orders) {
    const money = workOrderMoney(order.lines, order.payments);
    const existing = map.get(order.vendorId);

    if (existing) {
      existing.billPaise += money.billPaise;
      existing.paidPaise += money.paidPaise;
      existing.balancePaise += money.balancePaise;
      if (!money.settled) existing.openOrders += 1;
    } else {
      map.set(order.vendorId, {
        vendorId: order.vendorId,
        vendorName: order.vendorName,
        trade: order.trade,
        billPaise: money.billPaise,
        paidPaise: money.paidPaise,
        balancePaise: money.balancePaise,
        openOrders: money.settled ? 0 : 1,
      });
    }
  }

  // Most owed first. This list is read to decide who gets paid today.
  return [...map.values()].sort((a, b) => b.balancePaise - a.balancePaise);
}

/**
 * Split a lump-sum work order into stages.
 *
 * Uses `splitAcross`, so the parts sum to the order exactly. Offered because
 * trades are frequently paid in thirds — advance, midway, on completion — and
 * three independently rounded numbers that do not add up to the order is the
 * argument nobody wants to have on site.
 */
export function stageSplit(totalPaise: Paise, parts: number): Paise[] {
  if (parts < 1) return [];
  if (totalPaise <= 0) return new Array(parts).fill(0);
  return splitAcross(totalPaise, new Array(parts).fill(1));
}
