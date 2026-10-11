/**
 * The money on a signed project, computed from the payment rows every time
 * (studio workspace Phase 5; brief §6 "paid / balance always equal the
 * payment rows"). Pure, and tested (tests/payments-flow.test.ts). Nothing
 * here is stored: not a paid total, not a balance, not a stage's state.
 *
 * ## What a stage is owed
 *
 * The stage as signed (`HomeProject.paymentPhases`), plus every recorded
 * change on the quote that lands on it (`HomeQuoteChange.stageIndex`; a
 * decision's price difference lands on the final stage). So when the
 * customer picks a dearer finish, the final payment grows by exactly that,
 * and nobody types the new figure.
 *
 * ## Which rows count as paid
 *
 * A row is LIVE when no later row corrects it (`correctsId` points at the row
 * it replaces; corrections chain). A live row is then one of:
 *
 * - `confirmed` — the customer said yes, this arrived. Counts as paid.
 * - `earlier` — recorded before confirmations existed (the migration's
 *   backfill from `paidPhases`, `recordedById = 'backfill:paidPhases'`, ids
 *   `hpp_…`). The studio had already told the customer it was received and
 *   nobody disputed it for weeks, so it COUNTS AS PAID, shown as "recorded
 *   before confirmations started". The customer can still confirm it with
 *   one tap, or say "I didn't pay this", which takes it out like any other.
 * - `waiting` — recorded by the studio, the customer has not answered yet.
 *   Not paid yet (brief §2: "a payment counts only after the customer
 *   confirms it"), but it is money the studio says it has, so it is held
 *   against the stage: a second record of the same money is refused.
 * - `disputed` — the customer said "I didn't pay this". Neither paid nor
 *   held; our team looks into it, and the stage is owed again.
 *
 * A row replaced by a correction is `replaced` and counts for nothing. A
 * correction to ₹0 is how "recorded by mistake" is said.
 *
 * ## Overpayment
 *
 * A new payment on a stage is refused when it would take paid plus waiting
 * past what the stage is owed, with the difference said in rupees — the
 * `canPay()` rule of studio-practice/ledger.ts, at the keyboard rather than
 * at reconciliation.
 */

import { formatINR } from '@/lib/money';

/** Who the migration says recorded a backfilled row. */
export const BACKFILL_RECORDER = 'backfill:paidPhases';

export const PAYMENT_MODES = ['UPI', 'BANK', 'CHEQUE', 'CASH'] as const;
export type PaymentModeName = (typeof PAYMENT_MODES)[number];

export const MODE_LABEL: Record<PaymentModeName, string> = { UPI: 'UPI', BANK: 'Bank transfer', CHEQUE: 'Cheque', CASH: 'Cash' };

export const isPaymentMode = (v: unknown): v is PaymentModeName => typeof v === 'string' && (PAYMENT_MODES as readonly string[]).includes(v);

export interface LedgerStageInput {
  label: string;
  pct: number | null;
  amountPaise: number;
}

export interface LedgerChangeInput {
  deltaPaise: number;
  /** The stage it lands on; null means the final stage. */
  stageIndex: number | null;
}

export interface LedgerRowInput {
  id: string;
  stageIndex: number;
  amountPaise: number;
  /** "YYYY-MM-DD". */
  receivedOn: string;
  mode: PaymentModeName | null;
  receiptDocumentId: string | null;
  correctsId: string | null;
  /** ISO instant; orders rows recorded the same day. */
  recordedAt: string;
  customerConfirmedAt: string | null;
  disputedAt: string | null;
  /** Backfilled from paidPhases before confirmations existed (see `isBackfilled`). */
  backfilled: boolean;
}

export type RowStatus = 'confirmed' | 'earlier' | 'waiting' | 'disputed' | 'replaced';

export interface LedgerRow extends LedgerRowInput {
  status: RowStatus;
  /** Counts in `paidPaise`. */
  counts: boolean;
  /** The row this one replaced, when it is a correction. */
  replaces: string | null;
}

export type StageState = 'paid' | 'waiting' | 'part' | 'due' | 'later';

export interface LedgerStage {
  index: number;
  label: string;
  pct: number | null;
  /** As signed. */
  signedPaise: number;
  /** Recorded changes landing here (decisions on the final stage). */
  changesPaise: number;
  /** What the stage is owed now: signed + changes, never below zero. */
  amountPaise: number;
  paidPaise: number;
  waitingPaise: number;
  /** Owed, minus paid and waiting: what may still be recorded. */
  openPaise: number;
  state: StageState;
  /** The day the last counted payment arrived, once the stage is fully paid. */
  paidOn: string | null;
}

export interface Ledger {
  signedPaise: number;
  changesPaise: number;
  /** Signed plus changes: what the whole job costs now. */
  totalPaise: number;
  paidPaise: number;
  waitingPaise: number;
  /** Total minus paid. Waiting money is not paid yet, so it is still in here. */
  balancePaise: number;
  stages: LedgerStage[];
  /** Every row, oldest first, with its status. */
  rows: LedgerRow[];
}

export const isBackfilled = (r: { id: string; recordedById?: string | null }): boolean =>
  r.recordedById === BACKFILL_RECORDER || r.id.startsWith('hpp_');

/** The status of each row, given every row on the project. */
export function rowStatuses(rows: LedgerRowInput[]): LedgerRow[] {
  const corrected = new Set(rows.map((r) => r.correctsId).filter((id): id is string => Boolean(id)));
  return [...rows]
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.id.localeCompare(b.id))
    .map((r) => {
      const status: RowStatus = corrected.has(r.id)
        ? 'replaced'
        : r.disputedAt
          ? 'disputed'
          : r.customerConfirmedAt
            ? 'confirmed'
            : r.backfilled
              ? 'earlier'
              : 'waiting';
      return { ...r, status, counts: status === 'confirmed' || status === 'earlier', replaces: r.correctsId };
    });
}

/** The project's money, from the stages as signed, the quote changes and the payment rows. */
export function ledger(stages: LedgerStageInput[], changes: LedgerChangeInput[], rows: LedgerRowInput[]): Ledger {
  const last = stages.length - 1;
  const landsOn = (c: LedgerChangeInput) => (c.stageIndex !== null && c.stageIndex >= 0 && c.stageIndex <= last ? c.stageIndex : last);
  const annotated = rowStatuses(rows);
  let nextFound = false;
  const out: LedgerStage[] = stages.map((s, index) => {
    const changesPaise = changes.filter((c) => landsOn(c) === index).reduce((n, c) => n + c.deltaPaise, 0);
    const amountPaise = Math.max(0, s.amountPaise + changesPaise);
    const mine = annotated.filter((r) => r.stageIndex === index);
    const paidPaise = mine.filter((r) => r.counts).reduce((n, r) => n + r.amountPaise, 0);
    const waitingPaise = mine.filter((r) => r.status === 'waiting').reduce((n, r) => n + r.amountPaise, 0);
    const openPaise = Math.max(0, amountPaise - paidPaise - waitingPaise);
    let state: StageState;
    if (paidPaise >= amountPaise) state = 'paid';
    else if (openPaise === 0) state = 'waiting';
    else if (paidPaise + waitingPaise > 0) state = 'part';
    else state = nextFound ? 'later' : 'due';
    if (state !== 'paid' && state !== 'waiting') nextFound = true;
    const counted = mine.filter((r) => r.counts).map((r) => r.receivedOn).sort();
    return {
      index,
      label: s.label,
      pct: s.pct,
      signedPaise: s.amountPaise,
      changesPaise,
      amountPaise,
      paidPaise,
      waitingPaise,
      openPaise,
      state,
      paidOn: state === 'paid' && counted.length ? counted[counted.length - 1]! : null,
    };
  });
  const signedPaise = stages.reduce((n, s) => n + s.amountPaise, 0);
  const changesPaise = changes.reduce((n, c) => n + c.deltaPaise, 0);
  const totalPaise = out.reduce((n, s) => n + s.amountPaise, 0);
  const paidPaise = annotated.filter((r) => r.counts).reduce((n, r) => n + r.amountPaise, 0);
  const waitingPaise = annotated.filter((r) => r.status === 'waiting').reduce((n, r) => n + r.amountPaise, 0);
  return { signedPaise, changesPaise, totalPaise, paidPaise, waitingPaise, balancePaise: totalPaise - paidPaise, stages: out, rows: annotated };
}

/** Indian rupees with Indian grouping, never in lakhs: the exact figure an accountant types. */
export const rupees = (paise: number): string => formatINR(paise);

/**
 * May this amount be recorded against this stage? Refused past what is
 * still open on it, with the difference said (studio-practice/ledger.ts
 * `canPay`, the same rule).
 */
export function canRecord(l: Ledger, stageIndex: number, amountPaise: number): { ok: true } | { ok: false; error: string } {
  const stage = l.stages[stageIndex];
  if (!stage) return { ok: false, error: 'That payment stage is not on this project.' };
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) return { ok: false, error: 'Enter the amount received.' };
  if (amountPaise <= stage.openPaise) return { ok: true };
  if (stage.openPaise === 0) {
    return {
      ok: false,
      error:
        stage.waitingPaise > 0
          ? `${stage.label} is already recorded in full; ${rupees(stage.waitingPaise)} is waiting for the customer to confirm.`
          : `${stage.label} is already paid in full.`,
    };
  }
  return {
    ok: false,
    error: `That is ${rupees(amountPaise - stage.openPaise)} more than the ${rupees(stage.openPaise)} still due on ${stage.label}. Record the extra against the next stage.`,
  };
}

/** The stage a new payment most likely is for: the first with money still open. */
export function suggestedStage(l: Ledger): LedgerStage | null {
  return l.stages.find((s) => s.openPaise > 0) ?? null;
}

// ── Compatibility with the readers of `paidPhases` ──────────────

/** The marks as stored in `HomeProject.paidPhases`. */
export interface Mark {
  index: number;
  dueOn?: string | null;
  paidOn?: string | null;
  remindedAt?: string | null;
}

/**
 * `paidPhases` with each stage's `paidOn` brought in line with the rows: set
 * when what is paid and waiting covers the stage (the studio has said the
 * money is in, so the old readers stop reminding the customer), cleared when
 * it no longer does (a dispute, a correction). Due dates and reminder stamps
 * are kept as they are; they are the schedule, not money received.
 * Kept until every reader of `paidPhases` (moneyView, the reminder cron, the
 * projects list) reads the rows (PHASES-2-5-FOUNDATION §2).
 */
export function mirrorPaidOn(marksRaw: unknown, l: Ledger): Mark[] {
  const marks: Mark[] = Array.isArray(marksRaw)
    ? marksRaw.filter((m): m is Mark => Boolean(m) && typeof m === 'object' && Number.isInteger((m as Mark).index)).map((m) => ({ ...m }))
    : [];
  for (const s of l.stages) {
    const covered = s.amountPaise > 0 && s.openPaise === 0;
    const live = l.rows.filter((r) => r.stageIndex === s.index && (r.counts || r.status === 'waiting')).map((r) => r.receivedOn).sort();
    const paidOn = covered ? (live[live.length - 1] ?? null) : null;
    const at = marks.findIndex((m) => m.index === s.index);
    if (at >= 0) marks[at] = { ...marks[at]!, paidOn };
    else if (paidOn) marks.push({ index: s.index, paidOn });
  }
  return marks.sort((a, b) => a.index - b.index);
}

/** Read the due dates from `paidPhases`, by stage index. */
export function dueDates(marksRaw: unknown): Map<number, string> {
  const out = new Map<number, string>();
  if (!Array.isArray(marksRaw)) return out;
  for (const m of marksRaw) {
    if (!m || typeof m !== 'object') continue;
    const { index, dueOn } = m as Mark;
    if (Number.isInteger(index) && typeof dueOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dueOn)) out.set(index, dueOn);
  }
  return out;
}

/** "12,500" or "12500.50" or "₹ 12,500" → paise; null when it is not an amount. Negative only when allowed. */
export function parseRupees(v: unknown, opts: { negative?: boolean } = {}): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) : null;
  if (typeof v !== 'string') return null;
  const s = v.replace(/[₹,\s]/g, '').replace(/^\+/, '');
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  const paise = Math.round(Number(s) * 100);
  if (!Number.isSafeInteger(paise)) return null;
  if (paise < 0 && !opts.negative) return null;
  return paise;
}
