/**
 * "Add an existing project" — the rules (owner, 15 and 20 Oct 2026;
 * docs/studio-os/BRING-IN-PROJECTS.md). Pure; tests/bring-in-rules.test.ts.
 *
 * A running project is built exactly as a booked one (the same plan, the
 * same payment stages from its sales final), then three facts are laid on it:
 *
 * 1. **Where it is now.** A phase (design, execution, snags, warranty) and,
 *    inside it, the last step done. Every step before it is done "before
 *    joining One Interiors" (no photo; only in this flow). Snags and warranty
 *    mean every step is done.
 * 2. **Dates from today.** The plan is the existing date rules', anchored so
 *    the first open step is planned for today (every date moves by the same
 *    number of days); a project with nothing open is anchored on its handover
 *    day. Done steps keep their planned day, never later than today.
 * 3. **Money already received.** One row per payment, on the sales final's
 *    stages, never more than a stage is owed; recorded as 'earlier' (counts
 *    as paid, no client confirmation for past payments).
 */

import { isPaymentMode, type PaymentModeName } from '@/modules/project/payment-ledger';
import { PROVISIONAL_HANDOVER } from '@/modules/project/lifecycle-rules';
import { addDays, daysBetween, isDay } from '@/modules/project/working-days';

export const BRING_IN_PHASES = ['DESIGN', 'EXECUTION', 'SNAGS', 'WARRANTY'] as const;
export type BringInPhase = (typeof BRING_IN_PHASES)[number];
export const isBringInPhase = (v: unknown): v is BringInPhase => typeof v === 'string' && (BRING_IN_PHASES as readonly string[]).includes(v);

export const PHASE_WORDS: Record<BringInPhase, string> = {
  DESIGN: 'Design',
  EXECUTION: 'Execution',
  SNAGS: 'Snags (handed over, snags being closed)',
  WARRANTY: 'Warranty (handover signed off)',
};

export const BEFORE_JOINING = 'Done before joining One Interiors';

/** How far back a running project may have started: three years. */
export const MAX_BACK_DAYS = 3 * 366;

/** The plan as the pure builder gives it (portal/quote-to-plan.ts `PlanStage`), the fields used here. */
export interface RuleStage {
  kind: string;
  name: string;
  plannedStart: Date;
  plannedEnd: Date;
  items: { label: string; room: string; inScope: boolean; plannedOn: Date | null }[];
}

/** A step to pick as "the last step done": `${stage}:${item}` in the plan's order. */
export interface StepChoice {
  key: string;
  stageKind: string;
  stageName: string;
  group: string;
  label: string;
}

export const stepKey = (stage: number, item: number): string => `${stage}:${item}`;

function parseKey(key: unknown): { stage: number; item: number } | null {
  if (typeof key !== 'string' || !/^\d{1,2}:\d{1,3}$/.test(key)) return null;
  const [s, i] = key.split(':').map(Number) as [number, number];
  return { stage: s, item: i };
}

const isProvisional = (label: string) => label.trim().toLowerCase() === PROVISIONAL_HANDOVER.toLowerCase();

/** The steps a phase lets the person pick: design steps in design; execution steps (not the handover itself) in execution; none after. */
export function stepChoices(stages: readonly RuleStage[], phase: BringInPhase): StepChoice[] {
  if (phase === 'SNAGS' || phase === 'WARRANTY') return [];
  const out: StepChoice[] = [];
  stages.forEach((s, si) => {
    if ((phase === 'DESIGN') !== (s.kind === 'DESIGN')) return;
    s.items.forEach((it, ii) => {
      if (!it.inScope) return;
      if (phase === 'EXECUTION' && s.kind === 'HANDOVER' && isProvisional(it.label)) return;
      out.push({ key: stepKey(si, ii), stageKind: s.kind, stageName: s.name, group: it.room, label: it.label });
    });
  });
  return out;
}

export type DoneMap = { stage: number; items: Set<number>; complete: boolean }[];

/**
 * Which steps are done. `lastKey` null in design means nothing is done yet;
 * in execution, that design is done and no execution step yet.
 */
export function doneSteps(stages: readonly RuleStage[], phase: BringInPhase, lastKey: unknown): { ok: true; done: DoneMap } | { ok: false; error: string } {
  const all = phase === 'SNAGS' || phase === 'WARRANTY';
  const key = lastKey === null || lastKey === undefined || lastKey === '' ? null : parseKey(lastKey);
  if (lastKey && !key) return { ok: false, error: 'Pick the last step that is done from the list.' };
  if (key && !stepChoices(stages, phase).some((c) => c.key === stepKey(key.stage, key.item))) {
    return { ok: false, error: phase === 'DESIGN' ? 'Pick one of the design steps.' : 'Pick one of the execution steps (the handover itself is the Snags phase).' };
  }
  const done: DoneMap = stages.map((s, si) => {
    const items = new Set<number>();
    s.items.forEach((_, ii) => {
      const before = all || (phase === 'EXECUTION' && s.kind === 'DESIGN') || (key !== null && (si < key.stage || (si === key.stage && ii <= key.item)));
      if (before) items.add(ii);
    });
    const counted = s.items.map((it, ii) => ({ it, ii })).filter((x) => x.it.inScope);
    return { stage: si, items, complete: counted.length > 0 && counted.every((x) => items.has(x.ii)) };
  });
  return { ok: true, done };
}

const istDayOf = (d: Date) => d.toISOString().slice(0, 10);

/**
 * How many days to move the plan built from `today` so the first open
 * in-scope step lands on today; with nothing open, so the last step lands on
 * `handoverOn`. Positive = the plan starts earlier. Refused past three years.
 */
export function anchorDays(stages: readonly RuleStage[], done: DoneMap, today: string, handoverOn: string): { ok: true; days: number } | { ok: false; error: string } {
  let first: string | null = null;
  let last: string | null = null;
  stages.forEach((s, si) =>
    s.items.forEach((it, ii) => {
      if (!it.inScope || !it.plannedOn) return;
      const d = istDayOf(it.plannedOn);
      if (!last || d > last) last = d;
      if (!done[si]!.items.has(ii) && (!first || d < first)) first = d;
    }),
  );
  const target = first ?? last;
  if (!target) return { ok: true, days: 0 };
  const days = daysBetween(first ? today : handoverOn, target);
  if (days > MAX_BACK_DAYS) return { ok: false, error: 'That puts the start more than three years back. Check the phase and the last step done.' };
  return { ok: true, days: Math.max(0, days) };
}

/** The start day for the shifted plan. */
export const shiftedStart = (today: string, days: number): string => addDays(today, -days);

// ── Payments received ──────────────────────────────────────────

export interface PaymentInput {
  stageIndex: unknown;
  amountPaise: unknown;
  receivedOn: unknown;
  mode: unknown;
  note?: unknown;
}

export interface CheckedPayment {
  stageIndex: number;
  amountPaise: number;
  receivedOn: string;
  mode: PaymentModeName;
  note: string | null;
}

export const PAYMENTS_MAX = 30;

/** The payments already received, against the stages' amounts. Rows with no amount are skipped. */
export function checkPayments(
  raw: readonly PaymentInput[],
  stages: readonly { label: string; amountPaise: number }[],
  today: string,
): { ok: true; value: CheckedPayment[] } | { ok: false; error: string } {
  if (raw.length > PAYMENTS_MAX) return { ok: false, error: `At most ${PAYMENTS_MAX} payments here; record the rest on the Payments tab.` };
  const out: CheckedPayment[] = [];
  const per = new Map<number, number>();
  for (const r of raw) {
    const amount = typeof r.amountPaise === 'number' ? r.amountPaise : Number(r.amountPaise);
    if (!amount) continue;
    const idx = typeof r.stageIndex === 'number' ? r.stageIndex : Number(r.stageIndex);
    const stage = Number.isInteger(idx) ? stages[idx] : undefined;
    if (!stage) return { ok: false, error: 'A payment is on a stage this quotation does not have.' };
    if (!Number.isInteger(amount) || amount <= 0) return { ok: false, error: `The amount for ${stage.label} should be in rupees, more than nothing.` };
    if (!isDay(r.receivedOn) || r.receivedOn < '2020-01-01') return { ok: false, error: `Pick the day the ${stage.label} payment arrived.` };
    if (r.receivedOn > today) return { ok: false, error: `The ${stage.label} payment cannot be dated in the future.` };
    if (!isPaymentMode(r.mode)) return { ok: false, error: `Say how the ${stage.label} payment was made: UPI, bank transfer, cash or cheque.` };
    const sum = (per.get(idx) ?? 0) + amount;
    if (sum > stage.amountPaise) return { ok: false, error: `More than ${stage.label} is owed was entered. Put the extra on the next stage.` };
    per.set(idx, sum);
    const note = typeof r.note === 'string' ? r.note.trim().replace(/\s+/g, ' ').slice(0, 120) || null : null;
    out.push({ stageIndex: idx, amountPaise: amount, receivedOn: r.receivedOn, mode: r.mode, note });
  }
  return { ok: true, value: out };
}

/** The lead's and the project's line: "Brought in from the Hauspire quotation app (Q-2312)". */
export function broughtInLine(sourceNumber: string | null): string {
  return sourceNumber ? `Brought in from the Hauspire quotation app (Q-${sourceNumber.replace(/^Q-?/i, '')})` : 'Brought in as a running project, with a quotation built in the builder';
}
