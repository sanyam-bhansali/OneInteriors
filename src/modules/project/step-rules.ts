/**
 * The step tracker's rules (docs/studio-workspace/STEP-TRACKER.md): how much
 * each step counts, how far the project and each stage have got, each step's
 * planned day, and what the studio may change. Pure — days are 'YYYY-MM-DD'
 * strings (working-days.ts) — so the office, site mode and the customer's
 * tracker read the same numbers. Tested in tests/step-rules.test.ts.
 *
 * ## Weights
 *
 * A step's stored weight is basis points (10 000 = 100%). What counts is its
 * **effective** weight: the in-scope steps share exactly 10 000 between them
 * in proportion to their stored weights (`splitAcross`, so the parts are
 * whole and sum exactly), and a not-in-scope step counts 0. So marking a
 * step not in scope shares its weight across the rest in proportion, and
 * the stored weights need not add to 100% after an edit — progress still
 * reaches exactly 100% when every in-scope step is ticked. If every in-scope
 * step weighs 0, they share equally.
 *
 * ## Progress
 *
 * Overall = done in-scope effective weight / 10 000; a stage = its done
 * in-scope weight / its in-scope weight. Shown as whole percent rounded
 * down, so 100% means every in-scope step is ticked, never "nearly".
 *
 * ## Planned days
 *
 * The template keeps each step's day on the source sheet. Inside a stage the
 * steps keep their spacing: the first falls on the stage's start, the last
 * on its end, the rest in proportion. When the stage's dates move, its
 * steps' days move by the same number of days, kept inside the new window.
 */

import { splitAcross } from '@/lib/money';
import { addDays, daysBetween } from './working-days';

export const FULL_BP = 10_000;
export const STEP_LABEL_MIN = 2;
export const STEP_LABEL_MAX = 120;
export const GROUP_MAX = 60;

export interface RuleStep {
  id: string;
  stageId: string;
  weightBp: number;
  inScope: boolean;
  done: boolean;
}

// ── Weights ───────────────────────────────────────────────────

/**
 * Each step's effective weight in basis points: in-scope steps sum to
 * exactly 10 000, not-in-scope steps are 0. Empty when nothing is in scope.
 */
export function effectiveWeights(steps: readonly Pick<RuleStep, 'id' | 'weightBp' | 'inScope'>[]): Map<string, number> {
  const out = new Map<string, number>(steps.map((s) => [s.id, 0]));
  const live = steps.filter((s) => s.inScope);
  if (live.length === 0) return out;
  const raw = live.map((s) => Math.max(0, Math.round(s.weightBp)));
  const weights = raw.some((w) => w > 0) ? raw : raw.map(() => 1);
  /* splitAcross gives the rounding remainder to the last weight; put the
     heaviest step last so the remainder can never push a part below 0. */
  const order = weights.map((_, i) => i);
  const heaviest = weights.indexOf(Math.max(...weights));
  order.splice(heaviest, 1);
  order.push(heaviest);
  const parts = splitAcross(FULL_BP, order.map((i) => weights[i]!));
  order.forEach((i, k) => out.set(live[i]!.id, parts[k]!));
  return out;
}

/** Basis points as a percentage for display: 213 → 2.13, 50 → 0.5. */
export const bpToPct = (bp: number): number => Math.round(bp) / 100;

/** A percentage the studio typed ("2", "0.5", "2.25") as basis points, or null when it is not one. */
export function parsePercent(raw: string): number | null {
  const s = raw.trim().replace(/%$/, '').trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return null;
  const bp = Math.round(Number(s) * 100);
  return bp >= 0 && bp <= FULL_BP ? bp : null;
}

// ── Progress ──────────────────────────────────────────────────

export interface StageProgress {
  /** Done in-scope weight of the stage, in basis points of the project. */
  doneBp: number;
  /** In-scope weight of the stage, in basis points of the project. */
  totalBp: number;
  /** Whole percent of the stage, rounded down; null when nothing in it is in scope. */
  pct: number | null;
  /** In-scope steps ticked / in-scope steps. */
  done: number;
  total: number;
  /** Every in-scope step ticked (and there is at least one). */
  complete: boolean;
}

export interface Progress {
  /** Whole percent of the project, rounded down: 100 only when every in-scope step is ticked. */
  pct: number;
  doneBp: number;
  weights: Map<string, number>;
  stages: Map<string, StageProgress>;
}

/** Overall and per-stage progress from the steps' ticks and weights. */
export function progressOf(steps: readonly RuleStep[]): Progress {
  const weights = effectiveWeights(steps);
  const stages = new Map<string, StageProgress>();
  let doneBp = 0;
  for (const s of steps) {
    const st = stages.get(s.stageId) ?? { doneBp: 0, totalBp: 0, pct: null, done: 0, total: 0, complete: false };
    if (s.inScope) {
      const w = weights.get(s.id) ?? 0;
      st.totalBp += w;
      st.total += 1;
      if (s.done) {
        st.doneBp += w;
        st.done += 1;
        doneBp += w;
      }
    }
    stages.set(s.stageId, st);
  }
  for (const st of stages.values()) {
    st.complete = st.total > 0 && st.done === st.total;
    st.pct = st.total === 0 ? null : st.complete ? 100 : st.totalBp > 0 ? Math.min(99, Math.floor((st.doneBp * 100) / st.totalBp)) : Math.floor((st.done * 100) / st.total);
  }
  const allDone = steps.some((s) => s.inScope) && steps.every((s) => !s.inScope || s.done);
  return { pct: allDone ? 100 : Math.min(99, Math.floor(doneBp / 100)), doneBp, weights, stages };
}

// ── Planned days ──────────────────────────────────────────────

/**
 * Each step's planned day inside its stage's window, from the template's
 * sheet days (in the stage's step order): the first sheet day lands on the
 * stage's start, the last on its end, the rest in proportion, rounded to a
 * whole day. A stage whose steps share one sheet day (Design's single step)
 * puts them on its end: that is when a one-step stage finishes.
 */
export function spreadStepDays(sheetDays: readonly string[], stage: { start: string; end: string }): string[] {
  if (sheetDays.length === 0) return [];
  const length = Math.max(0, daysBetween(stage.start, stage.end));
  const first = sheetDays.reduce((a, d) => (d < a ? d : a), sheetDays[0]!);
  const last = sheetDays.reduce((a, d) => (d > a ? d : a), sheetDays[0]!);
  const span = daysBetween(first, last);
  if (span <= 0) return sheetDays.map(() => addDays(stage.start, length));
  return sheetDays.map((d) => addDays(stage.start, Math.round((daysBetween(first, d) * length) / span)));
}

/**
 * A step's planned day after its stage's dates moved: by the days the
 * stage's end moved (or its start, when only the start moved), kept inside
 * the new window.
 */
export function shiftStepDay(day: string | null, before: { start: string; end: string }, after: { start: string; end: string }): string | null {
  if (!day) return null;
  const endMoved = daysBetween(before.end, after.end);
  const delta = endMoved !== 0 ? endMoved : daysBetween(before.start, after.start);
  const moved = addDays(day, delta);
  if (moved < after.start) return after.start;
  if (moved > after.end) return after.end;
  return moved;
}

/**
 * A DESIGN step's planned day after the design stage's dates moved (Studio OS
 * Phase 2). Design steps are linked: each is the one before plus its gap, and
 * "running late" (studio-design/rules.ts `planStepMove`) has already moved the
 * late step and every open one after it. So they move as one block with the
 * stage's START only — never by the end, which is usually moved to catch up
 * with that very overrun (moving them again would shift them twice) — and are
 * never clamped into the window, which would pile them on one day. A step past
 * the new end shows as the design running over on the Design tab.
 */
export function shiftDesignStepDay(day: string | null, before: { start: string; end: string }, after: { start: string; end: string }): string | null {
  if (!day) return null;
  return addDays(day, daysBetween(before.start, after.start));
}

// ── What the studio may change ────────────────────────────────

export type StepCheck = { ok: true } | { ok: false; error: string };

/** A step's name, cleaned: spaces collapsed, trimmed. */
export const cleanLabel = (raw: string): string => raw.replace(/\s+/g, ' ').trim();

export function checkLabel(raw: string): { ok: true; label: string } | { ok: false; error: string } {
  const label = cleanLabel(raw);
  if (label.length < STEP_LABEL_MIN) return { ok: false, error: 'Give the step a name.' };
  if (label.length > STEP_LABEL_MAX) return { ok: false, error: `Keep the name under ${STEP_LABEL_MAX} characters.` };
  return { ok: true, label };
}

export function checkGroup(raw: string): { ok: true; group: string } | { ok: false; error: string } {
  const group = cleanLabel(raw);
  if (group.length < 2) return { ok: false, error: 'Pick which group the step goes in.' };
  if (group.length > GROUP_MAX) return { ok: false, error: `Keep the group name under ${GROUP_MAX} characters.` };
  return { ok: true, group };
}

export function checkWeight(bp: unknown): StepCheck {
  if (typeof bp !== 'number' || !Number.isInteger(bp) || bp < 0 || bp > FULL_BP) return { ok: false, error: 'Type a percentage from 0 to 100, like 4 or 0.5.' };
  return { ok: true };
}

/** May this step be removed? Never a ticked one, never the project's last in-scope step. */
export function checkRemove(step: Pick<RuleStep, 'id' | 'done' | 'inScope'>, all: readonly Pick<RuleStep, 'id' | 'inScope'>[]): StepCheck {
  if (step.done) return { ok: false, error: 'This step is ticked, so it stays. Untick it first if it was ticked by mistake.' };
  if (step.inScope && !all.some((s) => s.id !== step.id && s.inScope)) return { ok: false, error: 'A plan needs at least one step in scope.' };
  return { ok: true };
}

/** May this step's scope change to `inScope`? Not out of scope while ticked, and never the last in-scope step. */
export function checkScope(step: Pick<RuleStep, 'id' | 'done' | 'inScope'>, inScope: boolean, all: readonly Pick<RuleStep, 'id' | 'inScope'>[]): StepCheck {
  if (inScope || !step.inScope) return { ok: true };
  if (step.done) return { ok: false, error: 'This step is ticked. Untick it first, then mark it not in scope.' };
  if (!all.some((s) => s.id !== step.id && s.inScope)) return { ok: false, error: 'A plan needs at least one step in scope.' };
  return { ok: true };
}

/** "Done: POP framing" — the label a step's photo carries in the site log and the customer's feed. */
export const doneLabel = (step: string): string => `Done: ${step}`;
