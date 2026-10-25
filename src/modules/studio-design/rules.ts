/**
 * The design phase's rules (Studio OS Phase 2, docs/studio-os/PHASE-2-DESIGN.md):
 * building the design steps, their linked days, payment gates, what a tick
 * needs, moving a late step, drawings and the client's answers, site visits,
 * measurements and a designer's load. Pure — days are 'YYYY-MM-DD' strings
 * (project/working-days.ts) — so the office, the customer's app and the tests
 * read the same answers. Tested in tests/studio-design-rules.test.ts.
 *
 * Nothing here decides for anybody: a gate says the step is locked and why,
 * a late step says how late; people tick, move and answer.
 */

import { splitAcross } from '@/lib/money';
import { addDays, daysBetween, isDay } from '@/modules/project/working-days';
import { DESIGN_GROUP, DESIGN_SHARE_BP, designerDaysFor, PRE_EXECUTION_GROUP, DESIGNER_MONTH_DAYS, scaledEffort, scaledGaps, type ApprovalKind, type DesignTemplateStep, type Responsible, type StepGroup } from './template';

// ── Building the steps ────────────────────────────────────────

/**
 * Each step's day: the previous step's plus its gap, with the gaps scaled so
 * the last step lands on the end of the window (`length` days after `start`).
 * Rounded on the running total, so the days never go backwards and the last
 * is exactly on the end. With no length, the gaps are used as they are.
 */
export function linkedDays(gaps: readonly number[], start: string, length: number | null): string[] {
  const clean = gaps.map((g) => (Number.isFinite(g) && g > 0 ? Math.round(g) : 0));
  const total = clean.reduce((a, b) => a + b, 0);
  let run = 0;
  return clean.map((g) => {
    run += g;
    if (length === null) return addDays(start, run);
    if (total === 0) return addDays(start, Math.max(0, length));
    return addDays(start, Math.round((run * Math.max(0, length)) / total));
  });
}

/**
 * The steps' weights as basis points of the whole project: the DESIGN
 * stage's share, split by effort (DESIGN-PROCESS-PLAN.md Decision 3). A step
 * with no effort (the client's) weighs nothing; when no step has any effort,
 * they share it equally.
 */
export function designWeights(efforts: readonly number[]): number[] {
  if (efforts.length === 0) return [];
  const clean = efforts.map((e) => (Number.isFinite(e) && e > 0 ? e : 0));
  const at = clean.map((e, i) => (e > 0 ? i : -1)).filter((i) => i >= 0);
  if (at.length === 0) return splitAcross(DESIGN_SHARE_BP, clean.map(() => 1));
  const parts = splitAcross(DESIGN_SHARE_BP, at.map((i) => clean[i]!));
  const out = clean.map(() => 0);
  at.forEach((i, k) => (out[i] = parts[k]!));
  return out;
}

/** The index of the payment stage a gate word names ("design advance" → "Design advance 5%"), or null. */
export function gateIndexFor(word: string | null | undefined, payments: readonly { label: string }[]): number | null {
  const w = (word ?? '').trim().toLowerCase();
  if (!w) return null;
  const i = payments.findIndex((p) => p.label.toLowerCase().includes(w));
  return i >= 0 ? i : null;
}

export interface DesignPlanStep {
  room: string;
  label: string;
  quoteLineId: null;
  sortOrder: number;
  weightBp: number;
  inScope: true;
  plannedOn: string;
  responsible: Responsible;
  needsDocument: boolean;
  gatePayment: number | null;
  gapDays: number;
  /** Starred: a milestone. */
  customerMilestone: boolean;
  /** Effort for this home, in minutes. */
  effortMin: number;
  /** On a client's approval step: what approves it in the app. */
  approvalKind: ApprovalKind | null;
  /** To-dos seeded inside the step. */
  tasks: string[];
}

/**
 * The design steps of a new project from the DESIGN stage's start: each the
 * previous one's day plus its days, exactly (never stretched to a window;
 * DESIGN-PROCESS-PLAN.md Decision 1), days and effort scaled by the flat's
 * size, weights by effort, gates matched to its payment stages.
 */
export function designSteps(template: readonly DesignTemplateStep[], start: string, payments: readonly { label: string }[], bhk: number | null = null): DesignPlanStep[] {
  const gaps = scaledGaps(template.map((t) => t.days), bhk);
  const days = linkedDays(gaps, start, null);
  const efforts = template.map((t) => scaledEffort(t.effortMin, bhk));
  const weights = designWeights(efforts);
  return template.map((t, i) => ({
    room: t.group as StepGroup,
    label: t.label,
    quoteLineId: null,
    sortOrder: i,
    weightBp: weights[i]!,
    inScope: true,
    plannedOn: days[i]!,
    responsible: t.responsible,
    needsDocument: t.needsDocument,
    gatePayment: gateIndexFor(t.gate, payments),
    gapDays: gaps[i]!,
    customerMilestone: t.milestone === true,
    effortMin: efforts[i]!,
    approvalKind: t.approval,
    tasks: [...t.tasks],
  }));
}

// ── Gates and ticks ───────────────────────────────────────────

/** A payment stage as the gate reads it (payment-ledger.ts `LedgerStage`). */
export interface GateStage {
  index: number;
  label: string;
  state: 'paid' | 'waiting' | 'part' | 'due' | 'later';
}

export type GateState = { open: true } | { open: false; payment: string };

/**
 * Is the step's payment gate open? Open when it has none, when the project
 * has no payment stages to check (a tracker ops started by hand), when the
 * stage is not on the project, or when the payment is RECORDED: paid, or
 * recorded and waiting for the customer's confirmation (the studio says the
 * money is in; the customer confirming it is a separate question).
 */
export function gateOf(gatePayment: number | null | undefined, stages: readonly GateStage[] | null): GateState {
  if (gatePayment === null || gatePayment === undefined || !stages) return { open: true };
  const st = stages.find((s) => s.index === gatePayment);
  if (!st) return { open: true };
  return st.state === 'paid' || st.state === 'waiting' ? { open: true } : { open: false, payment: st.label };
}

/**
 * Which open steps wait on a payment (DESIGN-PROCESS-PLAN.md Decision 5):
 * the first open step whose payment is not recorded, and every open step
 * after it, wait on that payment (the first draft waits on the design
 * advance, and so does everything after it until the design closure). Each
 * entry is the payment's name, or null. Done and out-of-scope steps never
 * wait. In plan order.
 */
export function chainLocks(steps: readonly { gatePayment: number | null; done: boolean; inScope?: boolean }[], stages: readonly GateStage[] | null): (string | null)[] {
  let waiting: string | null = null;
  return steps.map((s) => {
    if (s.done || s.inScope === false) return null;
    if (!waiting) {
      const g = gateOf(s.gatePayment, stages);
      if (!g.open) waiting = g.payment;
    }
    return waiting;
  });
}

/**
 * After a payment is recorded (DESIGN-PROCESS-PLAN.md Decision 5): the first
 * open step whose gate is now open counts its days from the payment's day,
 * not from the plan. When it was planned earlier than that (the client paid
 * late), it and every open step after it move later by the same days, so the
 * days stay linked. Never earlier: a payment made early leaves the plan as it
 * is. Null when nothing moves, so running it twice moves nothing twice.
 */
export function planRedateAfterPayment(
  steps: readonly { id: string; plannedOn: string | null; done: boolean; inScope: boolean; gatePayment: number | null; gapDays: number | null }[],
  stages: readonly GateStage[] | null,
  paidOn: string,
): { stepId: string; days: number; moves: { id: string; from: string; to: string }[] } | null {
  if (!stages || !isDay(paidOn)) return null;
  const at = steps.findIndex((s) => !s.done && s.inScope && s.gatePayment !== null && gateOf(s.gatePayment, stages).open);
  if (at < 0) return null;
  // Only when no open step before it is still waiting: the chain reads in order.
  if (chainLocks(steps.slice(0, at), stages).some(Boolean)) return null;
  const step = steps[at]!;
  if (!step.plannedOn) return null;
  const earliest = addDays(paidOn, Math.max(0, step.gapDays ?? 0));
  const days = daysBetween(step.plannedOn, earliest);
  if (days <= 0) return null;
  const moves = steps
    .slice(at)
    .filter((s, k) => (k === 0 || (!s.done && s.inScope)) && s.plannedOn)
    .map((s) => ({ id: s.id, from: s.plannedOn!, to: addDays(s.plannedOn!, days) }));
  return { stepId: step.id, days, moves };
}

/**
 * Where the design stage's ticks put the project (DESIGN-PROCESS-PLAN.md
 * Decision 10): every in-scope pre-execution step done → execution; every
 * in-scope design step done (and pre-execution steps to come) →
 * pre-execution; else nothing. A plan without pre-execution steps (older
 * projects) moves on the design sign-off instead, as before.
 */
export function designPhaseAfterTicks(items: readonly { room: string; inScope: boolean; done: boolean }[]): 'design.done' | 'preexecution.done' | null {
  const inScope = items.filter((i) => i.inScope);
  const design = inScope.filter((i) => i.room === DESIGN_GROUP);
  const pre = inScope.filter((i) => i.room === PRE_EXECUTION_GROUP);
  if (pre.length === 0) return null;
  if (pre.every((i) => i.done) && design.every((i) => i.done)) return 'preexecution.done';
  if (design.length > 0 && design.every((i) => i.done)) return 'design.done';
  return null;
}

/**
 * Re-links the days after a step moved or was added (DESIGN-PROCESS-PLAN.md
 * Decision 8): from `from` on, each open step is the step before it plus its
 * days after; a done step keeps its day and the next counts from it. The
 * moves to make, oldest first.
 */
export function rechainDays(steps: readonly { id: string; plannedOn: string | null; done: boolean; gapDays: number | null }[], from: number): { id: string; from: string | null; to: string }[] {
  const days = steps.map((s) => s.plannedOn);
  const moves: { id: string; from: string | null; to: string }[] = [];
  for (let k = Math.max(1, from); k < steps.length; k += 1) {
    const s = steps[k]!;
    const prev = days[k - 1];
    if (s.done || !prev) continue;
    const to = addDays(prev, Math.max(0, s.gapDays ?? 0));
    if (to !== s.plannedOn) moves.push({ id: s.id, from: s.plannedOn, to });
    days[k] = to;
  }
  return moves;
}

export const TASK_MAX = 120;

/** A to-do's words, cleaned; or why not. */
export function checkTask(raw: unknown): { ok: true; label: string } | { ok: false; error: string } {
  const label = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
  if (label.length < 2) return { ok: false, error: 'Say what the task is.' };
  if (label.length > TASK_MAX) return { ok: false, error: `Keep it under ${TASK_MAX} characters.` };
  return { ok: true, label };
}

export type DesignCheck = { ok: true } | { ok: false; error: string };

export const DONE_NOTE_MAX = 500;

/** May this design step be ticked now? In scope, open, its payment recorded, and its file there when one is needed. */
export function checkDesignTick(step: { done: boolean; inScope: boolean; needsDocument: boolean; label: string }, gate: GateState, hasFile: boolean, note = ''): DesignCheck {
  if (!step.inScope) return { ok: false, error: 'This step is not in scope for this home.' };
  if (step.done) return { ok: false, error: 'Already ticked.' };
  if (!gate.open) return { ok: false, error: `${step.label} opens when the ${gate.payment} is recorded. Ask accounts to record it.` };
  if (step.needsDocument && !hasFile) return { ok: false, error: `${step.label} needs its file. Attach it, then tick.` };
  if (note.length > DONE_NOTE_MAX) return { ok: false, error: `Keep the note under ${DONE_NOTE_MAX} characters.` };
  return { ok: true };
}

/** The step to do next: the first open, in-scope one, in order. */
export function nextStep<T extends { done: boolean; inScope: boolean }>(steps: readonly T[]): T | null {
  return steps.find((s) => s.inScope && !s.done) ?? null;
}

/**
 * Why the studio's design steps may not replace this DESIGN stage's steps, or
 * null when they may: only a stage made before Phase 2 (no step has a
 * responsible role — the one "Final design and drawings signed off" step),
 * and nothing in it ticked. Applying twice would wipe the project's own
 * edits and its moved days.
 */
export function applyRefusal(items: readonly { doneAt: Date | null; responsible: string | null }[]): string | null {
  if (items.some((i) => i.doneAt)) return 'A design step is ticked already. Edit the steps in the Plan tab instead.';
  if (items.some((i) => i.responsible)) return 'This project has its design steps already. Edit them here or in the Plan tab.';
  return null;
}

// ── Late steps ────────────────────────────────────────────────

export const CLIENT_REASONS = {
  CLIENT_UNAVAILABLE: 'Client not available',
  CLIENT_NOT_RESPONDING: 'Client not responding',
  POSSESSION_LATE: 'Possession is late',
  PAYMENT_PENDING: 'Payment pending',
  MANY_CHANGES: 'Many changes by the client',
} as const;

export const STUDIO_REASONS = {
  DESIGNER_LEAVE: 'Designer on leave',
  STUDIO_WORKLOAD: 'Too much work at the studio',
  STUDIO_OTHER: 'Our own delay',
} as const;

export type DelayReasonKey = keyof typeof CLIENT_REASONS | keyof typeof STUDIO_REASONS;
export type DelaySideName = 'CLIENT' | 'STUDIO';

export const isDelayReasonKey = (v: unknown): v is DelayReasonKey => typeof v === 'string' && (v in CLIENT_REASONS || v in STUDIO_REASONS);
export const sideOfReason = (r: DelayReasonKey): DelaySideName => (r in CLIENT_REASONS ? 'CLIENT' : 'STUDIO');
export const reasonLabel = (r: string): string => (CLIENT_REASONS as Record<string, string>)[r] ?? (STUDIO_REASONS as Record<string, string>)[r] ?? 'Other';

/** What the customer reads for a moved step: plain words, never the studio's note. */
export const CUSTOMER_REASON: Record<DelayReasonKey, string> = {
  CLIENT_UNAVAILABLE: 'Moved to a day that suits you.',
  CLIENT_NOT_RESPONDING: 'Waiting to hear from you.',
  POSSESSION_LATE: 'Waiting for possession of the flat.',
  PAYMENT_PENDING: 'Waiting for the payment.',
  MANY_CHANGES: 'Your changes are being worked in.',
  DESIGNER_LEAVE: "The studio's own delay.",
  STUDIO_WORKLOAD: "The studio's own delay.",
  STUDIO_OTHER: "The studio's own delay.",
};

export const DELAY_NOTE_MAX = 500;

/**
 * A late step's tick needs a reason (DESIGN-PROCESS-PLAN.md Decision 6):
 * whose delay and why, filed on the Delays list for somebody to check. A
 * client's step is the client's delay by itself ("Client not responding")
 * when nobody says otherwise. A step on time needs nothing. `delay` is what
 * to file, or null.
 */
export function lateTickCheck(
  step: { plannedOn: string | null; responsible: string | null },
  today: string,
  reason: unknown,
): { ok: true; delay: { reason: DelayReasonKey; side: DelaySideName; days: number } | null } | { ok: false; error: string } {
  const days = step.plannedOn ? Math.max(0, daysBetween(step.plannedOn, today)) : 0;
  if (days === 0) return { ok: true, delay: null };
  if (isDelayReasonKey(reason)) return { ok: true, delay: { reason, side: sideOfReason(reason), days } };
  if (step.responsible === 'CLIENT') return { ok: true, delay: { reason: 'CLIENT_NOT_RESPONDING', side: 'CLIENT', days } };
  return { ok: false, error: `This step is ${days === 1 ? '1 day' : `${days} days`} late. Say why: on the client side or ours.` };
}

export interface StepDay {
  id: string;
  plannedOn: string | null;
  done: boolean;
}

export type MovePlan = { ok: true; days: number; moves: { id: string; from: string; to: string }[] } | { ok: false; error: string };

/**
 * Moving a design step to a later (or earlier) day: the step and every OPEN
 * step after it move by the same number of days (the days are linked), done
 * steps stay where they were. Refused for a ticked step or a day that is not
 * a day.
 */
export function planStepMove(steps: readonly StepDay[], stepId: string, to: string): MovePlan {
  if (!isDay(to)) return { ok: false, error: 'Pick the new day.' };
  const at = steps.findIndex((s) => s.id === stepId);
  if (at < 0) return { ok: false, error: 'That step is not on this plan any more. Reload the page.' };
  const step = steps[at]!;
  if (step.done) return { ok: false, error: 'This step is done; there is nothing to move.' };
  if (!step.plannedOn) return { ok: false, error: 'This step has no planned day to move.' };
  const days = daysBetween(step.plannedOn, to);
  if (days === 0) return { ok: false, error: 'That is the day it is planned already.' };
  const moves = steps
    .slice(at)
    .filter((s, k) => (k === 0 || !s.done) && s.plannedOn)
    .map((s) => ({ id: s.id, from: s.plannedOn!, to: addDays(s.plannedOn!, days) }));
  return { ok: true, days, moves };
}

/** Days a step is late on `today`: past its planned day and still open. 0 when not late. */
export function lateDays(step: { plannedOn: string | null; done: boolean }, today: string): number {
  if (step.done || !step.plannedOn) return 0;
  return Math.max(0, daysBetween(step.plannedOn, today));
}

// ── Drawings and the client's answers ─────────────────────────

export const DESIGN_KINDS = {
  LAYOUT_2D: '2D layout',
  FURNITURE: 'Furniture layout',
  RENDER_3D: '3D & renders',
  WORKING: 'Working drawings',
  SITE_PHOTO: 'Site photo',
  /* Project documents (24 Oct 2026; DESIGN-PROCESS-PLAN.md §3; documents.ts). */
  ELECTRICAL: 'Electrical drawings & quotation',
  MATERIAL_LIST: 'Material list',
  CUT_LIST: 'Factory cut list',
} as const;
export type DesignKind = keyof typeof DESIGN_KINDS;
export const isDesignKind = (v: unknown): v is DesignKind => typeof v === 'string' && v in DESIGN_KINDS;

/**
 * The kinds the client is asked to approve: the layouts, the 3D, and the
 * working drawings (the design process, 24 Oct 2026: working drawings are
 * approved by the client before they are final). Site photos are not.
 */
export const FOR_APPROVAL: readonly DesignKind[] = ['LAYOUT_2D', 'FURNITURE', 'RENDER_3D', 'WORKING', 'ELECTRICAL'];

/** Which client approval step a drawing's approval ticks (DESIGN-PROCESS-PLAN.md Decision 4). */
export function approvalKindOfDrawing(kind: string | null | undefined): ApprovalKind | null {
  if (kind === 'LAYOUT_2D' || kind === 'FURNITURE') return 'LAYOUT_2D';
  if (kind === 'RENDER_3D') return 'RENDER_3D';
  if (kind === 'WORKING') return 'WORKING';
  return null;
}
export const asksApproval = (k: string | null | undefined): boolean => (FOR_APPROVAL as readonly string[]).includes(k ?? '');

export const ROOM_MAX = 60;
export const COMMENT_MAX = 1000;
export const COMMENT_MIN = 3;
/** After this many days without an answer, the studio sees the reminder line. */
export const REMIND_AFTER_DAYS = 3;

export interface DrawingDoc {
  id: string;
  title: string;
  designKind: string | null;
  room: string | null;
  version: number;
  supersedesId: string | null;
  sharedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
}

export interface Answer {
  documentId: string;
  verdict: 'APPROVED' | 'CHANGES';
  comment: string | null;
  at: Date;
}

export type DrawingState = 'draft' | 'waiting' | 'approved' | 'changes' | 'shared';

export interface Drawing {
  /** The newest version's id. */
  id: string;
  title: string;
  kind: DesignKind;
  room: string | null;
  version: number;
  /** Versions shared before this one: the revisions so far. */
  revisions: number;
  state: DrawingState;
  sharedAt: Date | null;
  /** The client's last answer on this version. */
  answer: Answer | null;
  /** The comment that asked for this version: the last answer on the version before. */
  askedFor: string | null;
}

/**
 * Each drawing as one line: the newest live version of its chain, its state
 * and the client's last answer on that version. Drafts show as drafts (the
 * studio's list); a shared drawing for approval waits until the client
 * answers; working drawings and photos are just shared.
 */
export function drawingsOf(docs: readonly DrawingDoc[], answers: readonly Answer[]): Drawing[] {
  const design = docs.filter((d) => isDesignKind(d.designKind) && !d.deletedAt);
  const replaced = new Set(design.map((d) => d.supersedesId).filter((x): x is string => Boolean(x)));
  const byId = new Map(design.map((d) => [d.id, d]));
  const lastAnswer = (id: string): Answer | null =>
    answers.filter((a) => a.documentId === id).reduce<Answer | null>((best, a) => (!best || a.at.getTime() >= best.at.getTime() ? a : best), null);
  return design
    .filter((d) => !replaced.has(d.id))
    .map((d) => {
      const answer = lastAnswer(d.id);
      const before = d.supersedesId ? byId.get(d.supersedesId) : undefined;
      const prior = before ? lastAnswer(before.id) : null;
      const kind = d.designKind as DesignKind;
      const state: DrawingState = !d.sharedAt ? 'draft' : !asksApproval(kind) ? 'shared' : answer ? (answer.verdict === 'APPROVED' ? 'approved' : 'changes') : 'waiting';
      return {
        id: d.id,
        title: d.title,
        kind,
        room: d.room,
        version: d.version,
        revisions: Math.max(0, d.version - 1),
        state,
        sharedAt: d.sharedAt,
        answer,
        askedFor: prior?.verdict === 'CHANGES' ? prior.comment : null,
      };
    })
    .sort((a, b) => (a.room ?? '').localeCompare(b.room ?? '') || a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title));
}

/** May the client answer this drawing? Only its newest shared version, only one asking approval, and a comment with changes. */
export function checkAnswer(
  doc: { id: string; designKind: string | null; sharedAt: Date | null; deletedAt: Date | null },
  newerExists: boolean,
  verdict: unknown,
  comment: unknown,
): { ok: true; verdict: 'APPROVED' | 'CHANGES'; comment: string | null } | { ok: false; error: string } {
  if (!doc.sharedAt || doc.deletedAt || !asksApproval(doc.designKind)) return { ok: false, error: 'That drawing is not waiting for your answer.' };
  if (newerExists) return { ok: false, error: 'There is a newer version of this drawing. Answer that one.' };
  if (verdict !== 'APPROVED' && verdict !== 'CHANGES') return { ok: false, error: 'Approve it, or say what to change.' };
  const text = typeof comment === 'string' ? comment.replace(/\r\n/g, '\n').trim() : '';
  if (text.length > COMMENT_MAX) return { ok: false, error: `Keep it under ${COMMENT_MAX} characters.` };
  if (verdict === 'CHANGES' && text.length < COMMENT_MIN) return { ok: false, error: 'Say what you would like changed.' };
  return { ok: true, verdict, comment: text || null };
}

/** Days a shared drawing has waited for an answer; 0 when it is not waiting. */
export function waitingDays(d: Pick<Drawing, 'state' | 'sharedAt'>, now: Date): number {
  if (d.state !== 'waiting' || !d.sharedAt) return 0;
  return Math.max(0, Math.floor((now.getTime() - d.sharedAt.getTime()) / 86_400_000));
}

/** The line a designer may copy into their own WhatsApp. We never send it. */
export function reminderText(customerFirst: string, drawing: Pick<Drawing, 'title' | 'room'>, studio: string): string {
  const what = drawing.room ? `the ${drawing.title} for the ${drawing.room}` : `the ${drawing.title}`;
  return `Hi ${customerFirst}, a gentle reminder: ${what} is waiting for your approval in the One Interiors app. Tell us if you would like any changes. — ${studio}`;
}

// ── Site visits and measurements ─────────────────────────────

export const PURPOSE_MAX = 80;
export const VISIT_NOTE_MAX = 500;

export function checkVisit(input: { day: unknown; time: unknown; purpose: unknown }, today: string): { ok: true; day: string; time: string; purpose: string } | { ok: false; error: string } {
  if (!isDay(input.day)) return { ok: false, error: 'Pick the day of the visit.' };
  if (typeof input.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) return { ok: false, error: 'Pick the time of the visit.' };
  if (daysBetween(today, input.day) < -30) return { ok: false, error: 'That day is more than a month ago.' };
  const purpose = typeof input.purpose === 'string' ? input.purpose.replace(/\s+/g, ' ').trim() : '';
  if (purpose.length < 2) return { ok: false, error: 'Say what the visit is for, like "Measurement".' };
  if (purpose.length > PURPOSE_MAX) return { ok: false, error: `Keep it under ${PURPOSE_MAX} characters.` };
  return { ok: true, day: input.day, time: input.time, purpose };
}

const MM_PER_FOOT = 304.8;
/** The tallest room size we take: 100 ft. */
const MAX_MM = 30_480;

/**
 * A length as typed on site, in millimetres: `10.5` (feet), `10'6`, `10' 6"`,
 * `10 ft 6 in`, `3200mm`, `3.2m`. Empty is null (not measured); anything else
 * is NaN.
 */
export function parseLength(raw: unknown): number | null {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : typeof raw === 'number' ? String(raw) : '';
  if (!s) return null;
  let mm: number;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d+(?:\.\d+)?)\s*mm$/))) mm = Number(m[1]);
  else if ((m = s.match(/^(\d+(?:\.\d+)?)\s*m$/))) mm = Number(m[1]) * 1000;
  else if ((m = s.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft|feet)?\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in|inch|inches)?)?$/))) {
    const feet = Number(m[1]);
    const inches = m[2] ? Number(m[2]) : 0;
    if (inches >= 12) return Number.NaN;
    mm = feet * MM_PER_FOOT + inches * 25.4;
  } else return Number.NaN;
  if (!Number.isFinite(mm) || mm <= 0 || mm > MAX_MM) return Number.NaN;
  return Math.round(mm);
}

/** Millimetres as feet and inches, the way site people say it: 3200 → 10' 6". */
export function formatLength(mm: number | null | undefined): string {
  if (!mm || mm <= 0) return '—';
  const inches = Math.round(mm / 25.4);
  const ft = Math.floor(inches / 12);
  const inch = inches % 12;
  return inch ? `${ft}' ${inch}"` : `${ft}'`;
}

export interface MeasureInput {
  room: unknown;
  length: unknown;
  width: unknown;
  height: unknown;
  note?: unknown;
}

export const MEASURE_ROWS_MAX = 40;

export function checkMeasurements(rows: readonly MeasureInput[]): { ok: true; rows: { room: string; lengthMm: number | null; widthMm: number | null; heightMm: number | null; note: string | null }[] } | { ok: false; error: string } {
  if (rows.length > MEASURE_ROWS_MAX) return { ok: false, error: `Up to ${MEASURE_ROWS_MAX} rooms.` };
  const out = [];
  for (const [i, r] of rows.entries()) {
    const room = typeof r.room === 'string' ? r.room.replace(/\s+/g, ' ').trim() : '';
    const sizes = [r.length, r.width, r.height].map(parseLength);
    if (!room && sizes.every((x) => x === null)) continue; // an empty row
    if (room.length < 2) return { ok: false, error: `Name the room on row ${i + 1}.` };
    if (room.length > ROOM_MAX) return { ok: false, error: `Keep the room name on row ${i + 1} under ${ROOM_MAX} characters.` };
    if (sizes.some((x) => x !== null && Number.isNaN(x))) return { ok: false, error: `Row ${i + 1}: type sizes in feet, like 10.5 or 10'6".` };
    const note = typeof r.note === 'string' ? r.note.trim().slice(0, 200) : '';
    out.push({ room, lengthMm: sizes[0] ?? null, widthMm: sizes[1] ?? null, heightMm: sizes[2] ?? null, note: note || null });
  }
  return { ok: true, rows: out };
}

// ── A designer's load ─────────────────────────────────────────

export interface LoadProject {
  bhk: number | null;
  /** Whole percent of the design stage done. */
  designPct: number;
}

/**
 * A rough load: the designer-days each open design project still needs
 * (its flat size's days × what is left of design), against a month of
 * working days. Rough on purpose — it says "Meera has too much", not when.
 */
export function designerLoad(projects: readonly LoadProject[]): { open: number; loadDays: number; capacityDays: number; pct: number } {
  const loadDays = Math.round(projects.reduce((a, p) => a + designerDaysFor(p.bhk) * (1 - Math.min(100, Math.max(0, p.designPct)) / 100), 0));
  return { open: projects.length, loadDays, capacityDays: DESIGNER_MONTH_DAYS, pct: Math.round((loadDays * 100) / DESIGNER_MONTH_DAYS) };
}

/** Open steps due in the next 7 days (today included) and those already late. A step waiting on a payment is neither. */
export function dueAndLate(steps: readonly { plannedOn: string | null; done: boolean; inScope: boolean; lockedBy?: string | null }[], today: string): { due: number; late: number } {
  let due = 0;
  let late = 0;
  for (const s of steps) {
    if (s.done || !s.inScope || !s.plannedOn || s.lockedBy) continue;
    const d = daysBetween(today, s.plannedOn);
    if (d < 0) late += 1;
    else if (d <= 6) due += 1;
  }
  return { due, late };
}
