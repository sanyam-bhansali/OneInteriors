/**
 * A studio's payment stages for its own sales (Studio OS Phase 1,
 * docs/studio-os/PHASE-1-SALES.md §4). Pure, and tested
 * (tests/studio-sales-template.test.ts).
 *
 * ## The shape
 *
 * Each stage is either a FIXED amount (Hauspire's ₹25,000 booking advance)
 * or a PERCENT. The fixed amounts come off the contract first; the
 * percentages are of what is left, and they must total exactly 100. Every
 * stage carries what the client gets in it ("Designer assigned; mood board,
 * 2D layout"), and a stage may be refundable for a number of days (the
 * booking advance: 3).
 *
 * ## Exactly the contract
 *
 * `scheduleAmounts` splits the remainder with `splitAcross`, so the stages
 * always add up to the contract to the paisa — the same promise the
 * project's `paymentSchedule` keeps (portal/quote-to-plan.ts), which reads
 * these amounts at booking.
 *
 * ## Where it lives
 *
 * `Studio.paymentTemplate` (Settings, Payment stages; owner). Copied onto a
 * quotation's sales final when it is marked, where the salesperson may edit
 * it for this one client first. A stored value that fails the checks reads
 * as Hauspire's default rather than half a schedule.
 */

import { splitAcross, type Paise } from '@/lib/money';

export type StageKindName = 'FIXED' | 'PCT';

export interface PaymentStage {
  label: string;
  /** What the client gets in this stage. */
  note: string;
  kind: StageKindName;
  /** FIXED: the amount, paise. */
  amountPaise?: number;
  /** PCT: percent of the contract after the fixed stages; up to two decimals. */
  pct?: number;
  /** Refundable for this many days after it is paid (the booking advance). */
  refundDays?: number | null;
}

export const STAGES_MIN = 1;
export const STAGES_MAX = 10;
export const LABEL_MAX = 60;
export const NOTE_MAX = 200;
/** A refund window longer than a month is not a booking advance any more. */
export const REFUND_DAYS_MAX = 30;
/** The default refund window on the booking advance. */
export const DEFAULT_REFUND_DAYS = 3;

/** Hauspire's six (owner, 12 Oct 2026). Any studio starts here and changes it. */
export const HAUSPIRE_TEMPLATE: readonly PaymentStage[] = [
  {
    label: 'Booking advance',
    note: 'Designer assigned; mood board, 2D layout, furniture layout',
    kind: 'FIXED',
    amountPaise: 2_500_000,
    refundDays: DEFAULT_REFUND_DAYS,
  },
  { label: 'Design advance', note: '2D revisions, first 3D, final renders, final quotation', kind: 'PCT', pct: 5 },
  { label: 'Design closure', note: 'Design locked; detailed technical drawings', kind: 'PCT', pct: 10 },
  { label: 'Material procurement', note: 'Materials bought and sent to the factory; on-site work starts', kind: 'PCT', pct: 40 },
  { label: 'Material dispatch', note: 'Furniture delivered and installed; décor ordered', kind: 'PCT', pct: 40 },
  { label: 'Project handover', note: 'Snags resolved; home handed over', kind: 'PCT', pct: 5 },
];

/** A percent in basis points, so 12.5 + 87.5 is exactly 100. */
const bps = (pct: number) => Math.round(pct * 100);

/** The problem with a set of stages, in the studio's words — or null when it is sound. */
export function checkStages(stages: readonly PaymentStage[]): string | null {
  if (stages.length < STAGES_MIN) return 'Add at least one payment stage.';
  if (stages.length > STAGES_MAX) return `At most ${STAGES_MAX} payment stages.`;
  for (const s of stages) {
    const label = s.label.trim();
    if (!label) return 'Every stage needs a name.';
    if (label.length > LABEL_MAX) return `Stage names are at most ${LABEL_MAX} characters.`;
    if (s.note.trim().length > NOTE_MAX) return `"What the client gets" is at most ${NOTE_MAX} characters.`;
    if (s.kind === 'FIXED') {
      const a = s.amountPaise;
      if (typeof a !== 'number' || !Number.isInteger(a) || a <= 0 || a >= 1e11) return `${label}: enter an amount in rupees.`;
    } else if (s.kind === 'PCT') {
      const p = s.pct;
      if (typeof p !== 'number' || !Number.isFinite(p) || p <= 0 || p > 100) return `${label}: a percent between 0 and 100.`;
      if (Math.abs(bps(p) - p * 100) > 1e-6) return `${label}: at most two decimals in a percent.`;
    } else {
      return `${label}: pick a fixed amount or a percent.`;
    }
    const r = s.refundDays;
    if (r !== undefined && r !== null && (!Number.isInteger(r) || r < 0 || r > REFUND_DAYS_MAX)) {
      return `${label}: refundable for 0 to ${REFUND_DAYS_MAX} days.`;
    }
  }
  const pcts = stages.filter((s) => s.kind === 'PCT');
  if (pcts.length === 0) return 'At least one stage has to be a percent, so the stages always add up to the contract.';
  const total = pcts.reduce((sum, s) => sum + bps(s.pct ?? 0), 0);
  if (total !== 10_000) return `The percentages add up to ${trimPct(total / 100)}%, not 100%.`;
  return null;
}

const trimPct = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ''));

/** One stage as stored: only the fields its kind uses, trimmed. */
function cleanStage(s: PaymentStage): PaymentStage {
  const base = { label: s.label.trim(), note: s.note.trim(), kind: s.kind };
  const refund = s.refundDays === undefined || s.refundDays === null ? {} : { refundDays: s.refundDays };
  return s.kind === 'FIXED' ? { ...base, amountPaise: s.amountPaise, ...refund } : { ...base, pct: s.pct, ...refund };
}

/** Stages as they will be stored, or the reason they cannot be. */
export function cleanStages(stages: readonly PaymentStage[]): { ok: true; stages: PaymentStage[] } | { ok: false; error: string } {
  const problem = checkStages(stages);
  return problem ? { ok: false, error: problem } : { ok: true, stages: stages.map(cleanStage) };
}

/** A stored template (JSON), or null when it is missing or fails the checks. */
export function readStages(raw: unknown): PaymentStage[] | null {
  if (!Array.isArray(raw)) return null;
  const out: PaymentStage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null;
    const r = item as Record<string, unknown>;
    if (typeof r.label !== 'string' || (r.kind !== 'FIXED' && r.kind !== 'PCT')) return null;
    out.push({
      label: r.label,
      note: typeof r.note === 'string' ? r.note : '',
      kind: r.kind,
      ...(typeof r.amountPaise === 'number' ? { amountPaise: r.amountPaise } : {}),
      ...(typeof r.pct === 'number' ? { pct: r.pct } : {}),
      ...(typeof r.refundDays === 'number' ? { refundDays: r.refundDays } : {}),
    });
  }
  return checkStages(out) === null ? out.map(cleanStage) : null;
}

/** The studio's template, or Hauspire's when it has none (or a broken one). */
export function templateOrDefault(raw: unknown): PaymentStage[] {
  return readStages(raw) ?? HAUSPIRE_TEMPLATE.map(cleanStage);
}

export interface ScheduledStage {
  label: string;
  note: string;
  kind: StageKindName;
  /** The percent for a PCT stage; null for a fixed one. */
  pct: number | null;
  amountPaise: Paise;
  refundDays: number | null;
}

export type ScheduleResult = { ok: true; stages: ScheduledStage[] } | { ok: false; error: string };

/**
 * Each stage in rupees on this contract: fixed amounts as they are, the
 * rest split by the percentages with `splitAcross`, so the stages add up to
 * the contract exactly. Refused when the fixed amounts alone are more than
 * the contract.
 */
export function scheduleAmounts(stages: readonly PaymentStage[], contractPaise: Paise): ScheduleResult {
  const problem = checkStages(stages);
  if (problem) return { ok: false, error: problem };
  if (!Number.isInteger(contractPaise) || contractPaise <= 0) return { ok: false, error: 'There is no total to split yet.' };
  const fixed = stages.reduce((sum, s) => sum + (s.kind === 'FIXED' ? (s.amountPaise ?? 0) : 0), 0);
  if (fixed > contractPaise) return { ok: false, error: 'The fixed amounts are more than the whole contract.' };
  const pcts = stages.filter((s) => s.kind === 'PCT');
  const parts = splitAcross(contractPaise - fixed, pcts.map((s) => bps(s.pct ?? 0)));
  let next = 0;
  return {
    ok: true,
    stages: stages.map((s) => ({
      label: s.label.trim(),
      note: s.note.trim(),
      kind: s.kind,
      pct: s.kind === 'PCT' ? (s.pct ?? 0) : null,
      amountPaise: s.kind === 'FIXED' ? (s.amountPaise ?? 0) : parts[next++]!,
      refundDays: s.refundDays ?? null,
    })),
  };
}

/** The booking advance: the first stage, which is what is paid to book. */
export function bookingStage(stages: readonly PaymentStage[]): PaymentStage | null {
  return stages[0] ?? null;
}

/** The refund window of the booking stage, in days (the default when it does not say). */
export function refundDaysOf(stages: readonly PaymentStage[]): number {
  const r = stages[0]?.refundDays;
  return typeof r === 'number' ? r : DEFAULT_REFUND_DAYS;
}

/** "₹25,000" or "5%": how a stage reads in a list. */
export function stageAmountText(s: PaymentStage, rupees: (paise: number) => string): string {
  return s.kind === 'FIXED' ? rupees(s.amountPaise ?? 0) : `${trimPct(s.pct ?? 0)}%`;
}
