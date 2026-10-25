/**
 * The project lifecycle (owner, 13 Oct 2026; docs/studio-os/PROJECT-LIFECYCLE.md).
 * Pure: the phases, the only moves between them, the provisional handover
 * step, the warranty dates and the project closure's arithmetic. Tested in
 * tests/project-lifecycle.test.ts. The writes that apply a move
 * (lifecycle.ts) call `movePhase` inside the same transaction that records
 * the event, so a phase never disagrees with what happened.
 *
 *   DESIGN ──design steps done──▶ PRE_EXECUTION ──pre-execution steps done──▶ EXECUTION
 *   DESIGN ──design sign-off (a plan with no pre-execution steps)──▶ EXECUTION
 *   EXECUTION ──provisional handover ticked──▶ CLOSURE
 *   CLOSURE ──closure fixed (final payment)──▶ SNAGS
 *   SNAGS ──client signs off the handover, no open snag──▶ WARRANTY
 *   WARRANTY ──past warrantyEndsOn (read, not written)──▶ CLOSED
 *
 * Nothing moves by itself except the last line, which is a reading of a
 * date: a warranty that has ended reads as CLOSED wherever it is shown.
 */

import { applyBps } from '@/lib/money';
import { addDays, istDay } from './working-days';

export const PHASES = ['DESIGN', 'PRE_EXECUTION', 'EXECUTION', 'CLOSURE', 'SNAGS', 'WARRANTY', 'CLOSED'] as const;
export type Phase = (typeof PHASES)[number];
export const isPhase = (v: unknown): v is Phase => typeof v === 'string' && (PHASES as readonly string[]).includes(v);

export const PHASE_LABEL: Record<Phase, string> = {
  DESIGN: 'Design',
  PRE_EXECUTION: 'Pre-execution',
  EXECUTION: 'Execution',
  CLOSURE: 'Project closure',
  SNAGS: 'Snags',
  WARRANTY: 'Warranty',
  CLOSED: 'Closed',
};

/** The execution step whose tick is the provisional handover (the last step of the template). */
export const PROVISIONAL_HANDOVER = 'Provisional handover';

/** What happened, as far as the phase is concerned. */
export type LifecycleEvent =
  | { kind: 'design.signed_off' }
  /** Every design step ticked (the design process, owner 24 Oct 2026; DESIGN-PROCESS-PLAN.md Decision 10): the execution team owns the project. */
  | { kind: 'design.done' }
  /** Every pre-execution step ticked: execution begins. */
  | { kind: 'preexecution.done' }
  | { kind: 'handover.provisional' }
  /** The provisional handover step was unticked (owner/PM correction). */
  | { kind: 'handover.provisional_undone' }
  | { kind: 'closure.fixed' }
  | { kind: 'handover.signed'; openSnags: number };

export type Move = { ok: true; phase: Phase; changed: boolean } | { ok: false; error: string };

const stay = (phase: Phase): Move => ({ ok: true, phase, changed: false });
const go = (phase: Phase): Move => ({ ok: true, phase, changed: true });

/**
 * The phase after an event. Never moves backwards except an unticked
 * provisional handover before the closure is fixed. An event that does not
 * apply to the phase leaves it where it is (`changed: false`); only the two
 * deliberate acts that need a precondition (fixing the closure, the client's
 * sign-off) are refused with a reason.
 */
export function movePhase(current: Phase, event: LifecycleEvent): Move {
  switch (event.kind) {
    case 'design.signed_off':
      return current === 'DESIGN' ? go('EXECUTION') : stay(current);
    case 'design.done':
      return current === 'DESIGN' ? go('PRE_EXECUTION') : stay(current);
    case 'preexecution.done':
      return current === 'DESIGN' || current === 'PRE_EXECUTION' ? go('EXECUTION') : stay(current);
    case 'handover.provisional':
      // An older project may still read DESIGN (no design sign-off before design steps existed).
      return current === 'DESIGN' || current === 'PRE_EXECUTION' || current === 'EXECUTION' ? go('CLOSURE') : stay(current);
    case 'handover.provisional_undone':
      return current === 'CLOSURE' ? go('EXECUTION') : stay(current);
    case 'closure.fixed':
      if (current !== 'CLOSURE') return { ok: false, error: 'The project closure opens once the provisional handover step is ticked.' };
      return go('SNAGS');
    case 'handover.signed':
      if (current !== 'SNAGS') return { ok: false, error: 'There is no handover to sign off yet.' };
      if (event.openSnags > 0) return { ok: false, error: `${event.openSnags} snag${event.openSnags === 1 ? ' is' : 's are'} still open. Sign off once every snag is closed.` };
      return go('WARRANTY');
  }
}

/** The phase as shown: a warranty that ended before today reads CLOSED. */
export function effectivePhase(phase: Phase, warrantyEndsOn: string | null, now: Date): Phase {
  if (phase === 'WARRANTY' && warrantyEndsOn && istDay(now) > warrantyEndsOn) return 'CLOSED';
  return phase;
}

export const WARRANTY_MONTHS_DEFAULT = 12;
export const WARRANTY_MONTHS_MAX = 120;

/** The studio's warranty length, repaired: a whole number of months, 0 to 120; anything else is 12. */
export function readWarrantyMonths(v: unknown): number {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= WARRANTY_MONTHS_MAX ? n : WARRANTY_MONTHS_DEFAULT;
}

/**
 * The last day of the warranty: the sign-off day (IST) plus the months,
 * minus a day ("12 months from 13 Oct 2026" runs to 12 Oct 2027). A month
 * end that does not exist falls back to the month's last day (31 Jan + 1
 * month = 28/29 Feb). Zero months: the sign-off day itself.
 */
export function warrantyEnd(signedOn: string, months: number): string {
  if (months <= 0) return signedOn;
  const [y, m, d] = signedOn.split('-').map(Number) as [number, number, number];
  const total = m - 1 + months;
  const ty = y + Math.floor(total / 12);
  const tm = total % 12;
  const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  const day = `${ty}-${String(tm + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
  return addDays(day, -1);
}

// ── The provisional handover step ─────────────────────────────

export interface HandoverItem {
  id: string;
  label: string;
  inScope: boolean;
  sortOrder: number;
  doneAt: Date | string | null;
}

/**
 * Which step of the HANDOVER stage is the provisional handover: the one
 * named so (any case), else the stage's last in-scope step (a studio that
 * renamed it keeps working). Null when the stage has no in-scope step.
 */
export function provisionalStepOf<T extends HandoverItem>(items: readonly T[]): T | null {
  const inScope = items.filter((i) => i.inScope);
  const named = inScope.find((i) => i.label.trim().toLowerCase() === PROVISIONAL_HANDOVER.toLowerCase());
  if (named) return named;
  return [...inScope].sort((a, b) => a.sortOrder - b.sortOrder).at(-1) ?? null;
}

// ── The project closure ──────────────────────────────────────

export type ClosureLineKind = 'EXTRA' | 'DEDUCTION';

export interface ClosureLineInput {
  kind: ClosureLineKind;
  description: string;
  /** Thousandths; null with a lump amount. */
  qtyMilli: number | null;
  ratePaise: number | null;
  /** Before GST, positive. Worked out from quantity × rate when both are given. */
  amountPaise: number;
  note: string | null;
}

export interface ClosureInput {
  /** The design final's total, else the signed total; GST included. */
  contractPaise: number;
  /** Decisions' agreed changes, GST included. */
  changesPaise: number;
  /** Approved change orders (extra work after sign-off), GST included; never the closure's own lines. */
  changeOrdersPaise?: number;
  lines: readonly ClosureLineInput[];
  /** The quotation's GST rate. */
  gstBps: number;
  /** Payments recorded and counted. */
  paidPaise: number;
}

export interface ClosureTotals {
  contractPaise: number;
  changesPaise: number;
  /** Approved change orders, GST included (read-only on the closure). */
  changeOrdersPaise: number;
  extrasPaise: number;
  deductionsPaise: number;
  /** Extra work less deductions, before GST. */
  netPaise: number;
  gstBps: number;
  /** GST on the net, the quotation's way: last, at its rate. A net credit carries its GST back too. */
  gstPaise: number;
  /** Contract + changes + change orders + net + GST. */
  totalPaise: number;
  paidPaise: number;
  /** Total less paid. Negative = the studio owes the client a refund. */
  finalDuePaise: number;
}

export function closureTotals(input: ClosureInput): ClosureTotals {
  const extrasPaise = input.lines.filter((l) => l.kind === 'EXTRA').reduce((a, l) => a + l.amountPaise, 0);
  const deductionsPaise = input.lines.filter((l) => l.kind === 'DEDUCTION').reduce((a, l) => a + l.amountPaise, 0);
  const netPaise = extrasPaise - deductionsPaise;
  const gstPaise = applyBps(netPaise, input.gstBps);
  const changeOrdersPaise = input.changeOrdersPaise ?? 0;
  const totalPaise = input.contractPaise + input.changesPaise + changeOrdersPaise + netPaise + gstPaise;
  return {
    contractPaise: input.contractPaise,
    changesPaise: input.changesPaise,
    changeOrdersPaise,
    extrasPaise,
    deductionsPaise,
    netPaise,
    gstBps: input.gstBps,
    gstPaise,
    totalPaise,
    paidPaise: input.paidPaise,
    finalDuePaise: totalPaise - input.paidPaise,
  };
}

export const CLOSURE_LINES_MAX = 60;
export const CLOSURE_TEXT_MAX = 200;
const AMOUNT_CAP = 100_000_000_00; // ₹10 crore in paise: a typo guard, not a business rule.

const clean = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** Rupees as typed ("1,250.50") to paise; null when it is not a positive amount. */
function rupeesIn(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) : null;
  if (typeof v !== 'string') return null;
  const t = v.replace(/[₹,\s]/g, '');
  if (t === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

function qtyIn(v: unknown): number | null {
  const t = typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim() : '';
  if (t === '') return null;
  if (!/^\d+(\.\d{1,3})?$/.test(t)) return null;
  return Math.round(Number(t) * 1000);
}

export type LinesCheck = { ok: true; lines: ClosureLineInput[] } | { ok: false; error: string };

/**
 * The closure's lines as typed: description, quantity and rate (amount =
 * quantity × rate), or an amount alone, and a note. Blank rows are dropped.
 * The first problem is said in plain words.
 */
export function checkClosureLines(raw: unknown): LinesCheck {
  if (!Array.isArray(raw)) return { ok: true, lines: [] };
  if (raw.length > CLOSURE_LINES_MAX) return { ok: false, error: `Keep it to ${CLOSURE_LINES_MAX} lines.` };
  const lines: ClosureLineInput[] = [];
  for (const [i, r] of raw.entries()) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const description = clean(o.description, CLOSURE_TEXT_MAX);
    const blank = !description && !clean(o.qty, 20) && !clean(o.rate, 20) && !clean(o.amount, 20);
    if (blank) continue;
    const n = i + 1;
    const kind: ClosureLineKind = o.kind === 'DEDUCTION' ? 'DEDUCTION' : 'EXTRA';
    if (description.length < 2) return { ok: false, error: `Line ${n}: say what it is for.` };
    const qtyMilli = qtyIn(o.qty);
    if (clean(o.qty, 20) && qtyMilli === null) return { ok: false, error: `Line ${n}: the quantity is a number, up to three decimals.` };
    const ratePaise = rupeesIn(o.rate);
    if (clean(o.rate, 20) && ratePaise === null) return { ok: false, error: `Line ${n}: the rate is an amount in rupees.` };
    let amountPaise: number | null;
    if (qtyMilli !== null && ratePaise !== null) amountPaise = Math.round((qtyMilli * ratePaise) / 1000);
    else amountPaise = rupeesIn(o.amount);
    if (amountPaise === null) return { ok: false, error: `Line ${n}: give a quantity and a rate, or an amount.` };
    if (amountPaise <= 0) return { ok: false, error: `Line ${n}: the amount is more than zero.` };
    if (amountPaise > AMOUNT_CAP) return { ok: false, error: `Line ${n}: that amount looks too large. Check it.` };
    const note = clean(o.note, CLOSURE_TEXT_MAX) || null;
    lines.push({ kind, description, qtyMilli, ratePaise, amountPaise, note });
  }
  return { ok: true, lines };
}

/** "N project closures remaining": projects past provisional handover and not closed out. */
export const closuresRemaining = (projects: readonly { phase: Phase }[]): number => projects.filter((p) => p.phase === 'CLOSURE').length;

export const remainingLine = (n: number): string => (n === 1 ? 'You have 1 project closure remaining' : `You have ${n} project closures remaining`);

/** The day the warranty ends from a sign-off instant. */
export const warrantyEndFrom = (signedAt: Date, months: number): string => warrantyEnd(istDay(signedAt), months);
