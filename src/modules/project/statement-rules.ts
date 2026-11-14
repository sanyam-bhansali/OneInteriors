/**
 * The project statement and the studio's money-due list (owner, 13 Nov 2026:
 * "first the quotation, after it ends the electrical one, then the
 * additional items in their format, then the total, paid and remaining. And
 * analytics here: who owes how much"). Pure, and tested
 * (tests/closure-statement.test.ts).
 *
 * Every total is the payment ledger's (payment-ledger.ts `ledger`), the same
 * figures as the Payments tab: Total = `totalPaise`, Paid = `paidPaise`
 * (confirmed, or recorded before confirmations), Remaining = `balancePaise`
 * (total less paid; money waiting for the client's yes is still in it, and
 * is shown on its own line). The sections only break the total down:
 *
 * - **Quotation**: the stages as signed, with what is paid on each.
 * - **Electrical**: approved extra work whose title reads as electrical
 *   (wiring, points, switches). There is no separate electrical quotation in
 *   the data: the electrical quotation is a drawing set (documents.ts
 *   ELECTRICAL), and electrical work priced after sign-off is a change order.
 * - **Additional items**: every other approved change order (extra work and
 *   additional scope), each with its lines, amount and what is paid on it.
 * - **Other changes**: decisions and the closure's lines (`HomeQuoteChange`
 *   rows with no change order).
 * - Extra work sent but not approved yet is listed apart and is NOT in the
 *   total, as it is not in the ledger.
 */

import type { Ledger, RowStatus } from './payment-ledger';

export const ELECTRICAL_WORDS = /electric|wiring|\bpoints?\b|switch|socket|\bmcb\b|db box/i;

/** An approved change order reads as electrical work by its title. */
export const isElectrical = (title: string): boolean => ELECTRICAL_WORDS.test(title);

/** Change orders whose price is in the ledger (approved: a `HomeQuoteChange` landed on the last stage). */
export const IN_TOTAL_STATUSES = ['APPROVED', 'PAID', 'RELEASED'] as const;
/** Sent, not answered yet: shown apart, not in the total. */
export const PENDING_STATUSES = ['SENT_TO_CLIENT'] as const;

export interface StatementOrderInput {
  id: string;
  /** "CO-3", or the additional-scope quotation's number ("101-A1"). */
  number: string;
  title: string;
  status: string;
  /** The order's own total (GST included). */
  totalPaise: number;
  lines: { room: string | null; product: string; amountPaise: number }[];
}

export interface StatementChangeInput {
  label: string;
  deltaPaise: number;
  changeOrderId: string | null;
}

export interface StatementPaymentInput {
  changeOrderId: string | null;
  amountPaise: number;
  status: RowStatus;
}

export interface StatementOrder {
  id: string;
  number: string;
  title: string;
  lines: { room: string | null; product: string; amountPaise: number }[];
  /** In the ledger (the price that landed on the last stage), else the order's own total. */
  amountPaise: number;
  /** Confirmed, or recorded before confirmations: counts as paid. */
  paidPaise: number;
  waitingPaise: number;
  /** Amount less paid. */
  remainingPaise: number;
  paidLabel: string;
}

export interface Statement {
  quotation: {
    number: string | null;
    signedPaise: number;
    stages: { label: string; pct: number | null; signedPaise: number; owedPaise: number; paidPaise: number; remainingPaise: number }[];
  };
  electrical: StatementOrder[];
  additional: StatementOrder[];
  /** Sent to the client, not approved: not in the total. */
  pending: StatementOrder[];
  otherChanges: { label: string; deltaPaise: number }[];
  totals: { totalPaise: number; paidPaise: number; waitingPaise: number; remainingPaise: number };
}

const counts = (s: RowStatus) => s === 'confirmed' || s === 'earlier';

function paidLabel(amount: number, paid: number, waiting: number): string {
  if (amount <= 0) return '—';
  if (paid >= amount) return 'Paid';
  if (paid + waiting >= amount) return 'Recorded · waiting for the client to confirm';
  if (paid + waiting > 0) return 'Part paid';
  return 'Not paid';
}

/** The statement, from the ledger and the change orders, quote changes and payment rows of one project. */
export function buildStatement(input: {
  quoteNumber: string | null;
  ledger: Ledger;
  orders: readonly StatementOrderInput[];
  changes: readonly StatementChangeInput[];
  payments: readonly StatementPaymentInput[];
}): Statement {
  const l = input.ledger;
  const order = (o: StatementOrderInput, inLedger: boolean): StatementOrder => {
    const landed = input.changes.filter((c) => c.changeOrderId === o.id).reduce((n, c) => n + c.deltaPaise, 0);
    const amountPaise = inLedger && input.changes.some((c) => c.changeOrderId === o.id) ? landed : o.totalPaise;
    const mine = input.payments.filter((p) => p.changeOrderId === o.id);
    const paidPaise = mine.filter((p) => counts(p.status)).reduce((n, p) => n + p.amountPaise, 0);
    const waitingPaise = mine.filter((p) => p.status === 'waiting').reduce((n, p) => n + p.amountPaise, 0);
    return {
      id: o.id,
      number: o.number,
      title: o.title,
      lines: o.lines,
      amountPaise,
      paidPaise,
      waitingPaise,
      remainingPaise: Math.max(0, amountPaise - paidPaise),
      paidLabel: inLedger ? paidLabel(amountPaise, paidPaise, waitingPaise) : 'Waiting for the client to approve',
    };
  };
  const inTotal = input.orders.filter((o) => (IN_TOTAL_STATUSES as readonly string[]).includes(o.status)).map((o) => order(o, true));
  return {
    quotation: {
      number: input.quoteNumber,
      signedPaise: l.signedPaise,
      /* Owed now = signed plus what landed on the stage (decisions, extra work, the closure on the last one): the Payments tab's figure. */
      stages: l.stages.map((s) => ({ label: s.label, pct: s.pct, signedPaise: s.signedPaise, owedPaise: s.amountPaise, paidPaise: s.paidPaise, remainingPaise: Math.max(0, s.amountPaise - s.paidPaise) })),
    },
    electrical: inTotal.filter((o) => isElectrical(o.title)),
    additional: inTotal.filter((o) => !isElectrical(o.title)),
    pending: input.orders.filter((o) => (PENDING_STATUSES as readonly string[]).includes(o.status)).map((o) => order(o, false)),
    otherChanges: input.changes.filter((c) => !c.changeOrderId && c.deltaPaise !== 0).map((c) => ({ label: c.label, deltaPaise: c.deltaPaise })),
    totals: { totalPaise: l.totalPaise, paidPaise: l.paidPaise, waitingPaise: l.waitingPaise, remainingPaise: l.balancePaise },
  };
}

// ── Money due, studio-wide ────────────────────────────────────

export interface MoneyDueInput {
  id: string;
  label: string;
  customer: string;
  ledger: Ledger | null;
}

export interface MoneyDueRow {
  id: string;
  label: string;
  customer: string;
  totalPaise: number;
  paidPaise: number;
  waitingPaise: number;
  remainingPaise: number;
  /** The first stage with money still open: what to ask for next. */
  nextStage: string | null;
}

/** Who owes how much: every project with a signed payment plan, the most owed first. Totals are the sums of the rows. */
export function moneyDue(projects: readonly MoneyDueInput[]): { rows: MoneyDueRow[]; totals: { totalPaise: number; paidPaise: number; waitingPaise: number; remainingPaise: number } } {
  const rows: MoneyDueRow[] = projects
    .filter((p): p is MoneyDueInput & { ledger: Ledger } => p.ledger !== null)
    .map((p) => ({
      id: p.id,
      label: p.label,
      customer: p.customer,
      totalPaise: p.ledger.totalPaise,
      paidPaise: p.ledger.paidPaise,
      waitingPaise: p.ledger.waitingPaise,
      remainingPaise: p.ledger.balancePaise,
      nextStage: p.ledger.stages.find((s) => s.openPaise > 0)?.label ?? null,
    }))
    .sort((a, b) => b.remainingPaise - a.remainingPaise || a.label.localeCompare(b.label));
  const sum = (k: 'totalPaise' | 'paidPaise' | 'waitingPaise' | 'remainingPaise') => rows.reduce((n, r) => n + r[k], 0);
  return { rows, totals: { totalPaise: sum('totalPaise'), paidPaise: sum('paidPaise'), waitingPaise: sum('waitingPaise'), remainingPaise: sum('remainingPaise') } };
}
