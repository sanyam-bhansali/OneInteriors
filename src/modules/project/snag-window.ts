/**
 * The snag window (owner, team meeting 15 Oct 2026): "once the handover
 * payment is complete, the snag list opens on the client's side for a month,
 * whatever our timespan is."
 *
 * How it sits in the lifecycle (docs/studio-os/PROJECT-LIFECYCLE.md): the
 * closure fixes the final account and puts the final amount on the last
 * payment stage (the handover payment). The window **opens** the day that
 * stage is recorded in full by the studio (counted or waiting for the
 * client's yes — the studio has said the money is in), and never before the
 * closure is fixed. It runs `Studio.snagWindowDays` (Settings, Warranty;
 * default 30) days. Until the client signs off the handover:
 *
 * - before the window opens, snags are raised as they always were (the
 *   handover walk-through and anything found on site);
 * - inside it, as before;
 * - after it, the client can no longer raise a snag in the app: they sign off
 *   the handover, and during the warranty raise it as a warranty snag.
 *
 * During the warranty a snag is a warranty snag and after it none
 * (snag-flow.ts, unchanged). Pure, tested in tests/snag-window.test.ts.
 */

import { addDays, isDay } from './working-days';

export const SNAG_WINDOW_DAYS_DEFAULT = 30;
export const SNAG_WINDOW_DAYS_MAX = 365;

/** The studio's window, repaired: a whole number of days, 1 to 365; anything else is 30. */
export function readSnagWindowDays(v: unknown): number {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= SNAG_WINDOW_DAYS_MAX ? n : SNAG_WINDOW_DAYS_DEFAULT;
}

/** The last payment stage as the ledger has it (payment-ledger.ts `LedgerStage` / `LedgerRow`). */
export interface HandoverLedger {
  stages: readonly { index: number; amountPaise: number; openPaise: number }[];
  rows: readonly { stageIndex: number; receivedOn: string; counts: boolean; status: string }[];
}

/**
 * The day the handover (last) payment was recorded in full: the latest day
 * money counted or waiting arrived on it. Null while anything is still open
 * on it, or when there are no stages.
 */
export function handoverPaidOn(l: HandoverLedger | null): string | null {
  if (!l || l.stages.length === 0) return null;
  const last = l.stages[l.stages.length - 1]!;
  if (last.openPaise > 0) return null;
  const days = l.rows
    .filter((r) => r.stageIndex === last.index && (r.counts || r.status === 'waiting') && isDay(r.receivedOn))
    .map((r) => r.receivedOn)
    .sort();
  return days[days.length - 1] ?? null;
}

export interface SnagWindow {
  opensOn: string;
  /** The last day a snag may be raised (inclusive). */
  endsOn: string;
}

/**
 * The window, once the closure is fixed (`closedOutOn`) and the handover
 * payment recorded (`paidOn`): from the later of the two, `days` long.
 * A closure with nothing left to pay opens it on the closure day.
 */
export function snagWindow(input: { closedOutOn: string | null; paidOn: string | null; nothingDue?: boolean; days: number }): SnagWindow | null {
  if (!input.closedOutOn || !isDay(input.closedOutOn)) return null;
  const paid = input.nothingDue ? input.closedOutOn : input.paidOn;
  if (!paid || !isDay(paid)) return null;
  const opensOn = paid > input.closedOutOn ? paid : input.closedOutOn;
  return { opensOn, endsOn: addDays(opensOn, readSnagWindowDays(input.days) - 1) };
}

/** The window from the closure day and the project's ledger; null without either (a project with no signed stages has none). */
export function windowFromLedger(closedOutOn: string | null, l: HandoverLedger | null, days: number): SnagWindow | null {
  if (!l || l.stages.length === 0) return null;
  const paidOn = handoverPaidOn(l);
  const last = l.stages[l.stages.length - 1]!;
  const nothingDue = paidOn === null && last.openPaise === 0;
  return snagWindow({ closedOutOn, paidOn, nothingDue, days });
}

export type RaiseRule = { ok: true; warranty: boolean } | { ok: false; reason: 'window_closed' | 'warranty_over' };

/** May the client raise a snag today, and is it a warranty snag? `phase` is the effective phase. */
export function mayRaiseSnag(phase: string, window: SnagWindow | null, today: string): RaiseRule {
  if (phase === 'CLOSED') return { ok: false, reason: 'warranty_over' };
  if (phase === 'WARRANTY') return { ok: true, warranty: true };
  if (window && today > window.endsOn) return { ok: false, reason: 'window_closed' };
  return { ok: true, warranty: false };
}

/** "17 Nov 2026". */
export function windowDayLabel(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
