import 'server-only';

/**
 * The studio editing a customer's plan from the office (studio workspace
 * Phase 3 and the step tracker, docs/studio-workspace/STEP-TRACKER.md):
 * move a date with a reason, untick a step, edit the steps, mark a stage
 * done or reopen it, rename a stage — and the Plan tab's read. Rules in
 * project-rules.ts and step-rules.ts; the customer reads the result through
 * the projection (portal/tracker-view.ts), so there is no separate "tell the
 * customer" step.
 *
 * Ticking a step is NOT here: a tick needs a photo and a sentence, so it is
 * a site post (site-log.ts `postSiteLog`) — from site mode, or from the
 * office's "Tick with a photo", which posts into today's site log the same
 * way.
 *
 * Access (studio/roles.ts, checked here through `memberOnProject` on every
 * call, not only in the UI):
 * - move a date, rename a stage, rename / add / remove / re-weight a step,
 *   mark it in or out of scope, untick it: `plan.edit` — the owner, or the
 *   PM on the project. Never a supervisor.
 * - mark a stage done / reopen it: `checklist.tick` — the owner, the PM or
 *   the supervisor on the project.
 * - read the plan: `project.read`.
 *
 * Every write is one transaction with its `HomeProjectEvent`. Date changes
 * are append-only (`HomeProjectDateChange`, tests/append-only.test.ts): the
 * stage's column holds today's date, the rows hold its history. Steps are
 * not append-only (they are the plan), but a ticked step is never removed,
 * and its photo stays in the site log when it is unticked.
 */

import { prisma } from '@/lib/prisma';
import { memberOnProject } from '@/modules/studio/access';
import { PLAN_KINDS, type PlanKind } from '@/modules/portal/tracker';
import { movesOf, type CustomerMove } from '@/modules/portal/tracker-view';
import { recordEvent, type ProjectActor } from './events';
import {
  canMarkStageDone,
  currentStatus,
  gateWords,
  handoverStage,
  isDelayReason,
  overallDelay,
  planMove,
  stageStatuses,
  type DateField,
  type DoneGate,
  type OverallDelay,
  type RuleChange,
  type RuleStage,
  type StageKind,
  type StageStatus,
} from './project-rules';
import { bpToPct, checkGroup, checkLabel, checkRemove, checkScope, checkWeight, progressOf } from './step-rules';
import { countedSteps, photosByStage, settleStageAfterTicks, shiftStepsWithStage, writeDone } from './stage-settle';
import { calendarOf, dayFromDb, dayToDb, istDay } from './working-days';

export { settleStageAfterTicks } from './stage-settle';

export type PlanEditResult = { ok: true; message: string } | { ok: false; error: string };

export const NOTE_MAX = 500;
export const STAGE_NAME_MAX = 40;
/** Steps one stage may hold: the template's largest stage has 22. */
export const STEPS_PER_STAGE_MAX = 60;

const isKind = (k: string): k is PlanKind => (PLAN_KINDS as readonly string[]).includes(k);
const day = (d: Date) => istDay(d);
const GONE = 'That step is not on this plan any more. Reload the page.';

// ── Move a date ───────────────────────────────────────────────

export interface MoveDateInput {
  projectId: string;
  stageId: string;
  field: 'PLANNED_START' | 'PLANNED_END';
  /** The new day, 'YYYY-MM-DD'. */
  to: string;
  reason: unknown;
  /** A late decision of the customer's: makes it customer delay. */
  decisionId?: string | null;
  /** The PM's own words. Only the team sees them. */
  note?: string | null;
  /** Move the later stages by the same number of days. */
  shiftLater?: boolean;
}

const toRule = (s: { id: string; kind: string; name: string; plannedStart: Date; plannedEnd: Date; actualEnd: Date | null }): RuleStage => ({
  id: s.id,
  kind: s.kind as StageKind,
  name: s.name,
  plannedStart: day(s.plannedStart),
  plannedEnd: day(s.plannedEnd),
  actualEnd: s.actualEnd ? day(s.actualEnd) : null,
});

/**
 * Moves a plan date. One transaction: each stage's new dates and its steps'
 * planned days (moved by the same number of days, step-rules.ts
 * `shiftStepDay`), one `HomeProjectDateChange` per date that moved (all
 * with the same `at`, so the customer sees them as one move), and one
 * `date.moved` event. A reason is required; a decision makes it the
 * customer's delay.
 */
export async function moveDate(input: MoveDateInput, now = new Date()): Promise<PlanEditResult> {
  const check = await memberOnProject(input.projectId, 'plan.edit');
  if (!check.ok) return check;
  const note = (input.note ?? '').replace(/\r\n/g, '\n').trim();
  if (note.length > NOTE_MAX) return { ok: false, error: `Keep the note under ${NOTE_MAX} characters.` };
  if (input.field !== 'PLANNED_START' && input.field !== 'PLANNED_END') return { ok: false, error: 'Pick which date is moving.' };
  if (!isDelayReason(input.reason)) return { ok: false, error: 'Pick why the date is moving. It decides whose delay it is.' };
  let reason = input.reason;
  const decisionId = input.decisionId || null;

  const rows = await prisma.homeProjectStage.findMany({
    where: { projectId: input.projectId },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, kind: true, name: true, plannedStart: true, plannedEnd: true, actualEnd: true },
  });
  if (rows.length === 0) return { ok: false, error: 'This project has no plan built from its quote yet.' };
  if (decisionId) {
    const d = await prisma.homeDecision.findFirst({ where: { id: decisionId, projectId: input.projectId }, select: { id: true } });
    if (!d) return { ok: false, error: 'That decision is not on this project.' };
    reason = 'CUSTOMER_CHANGE'; // a late decision is the customer's delay, whatever was picked
  }
  const stages = rows.map(toRule);
  const planned = planMove(stages, { stageId: input.stageId, field: input.field, to: input.to, reason, shiftLater: input.shiftLater === true });
  if (!planned.ok) return planned;
  const { plan } = planned;
  const actor: ProjectActor = { type: 'STUDIO', id: check.member.userId };
  const before = new Map(stages.map((s) => [s.id, { start: s.plannedStart, end: s.plannedEnd }]));

  await prisma.$transaction(async (tx) => {
    for (const s of plan.stages) {
      await tx.homeProjectStage.update({
        where: { id: s.stageId },
        data: { plannedStart: dayToDb(s.plannedStart), plannedEnd: dayToDb(s.plannedEnd) },
      });
      // Its steps' planned days move with it.
      await shiftStepsWithStage(tx, s.stageId, before.get(s.stageId)!, { start: s.plannedStart, end: s.plannedEnd });
    }
    let leadId: string | null = null;
    for (const [i, r] of plan.rows.entries()) {
      const row = await tx.homeProjectDateChange.create({
        data: {
          projectId: input.projectId,
          stageId: r.stageId,
          field: r.field,
          fromDate: dayToDb(r.from),
          toDate: dayToDb(r.to),
          reason,
          decisionId,
          // The PM's words go on the move itself, never on the rows that followed it.
          note: i === 0 && note ? note : null,
          byId: check.member.userId,
          at: now,
        },
        select: { id: true },
      });
      leadId ??= row.id;
    }
    await recordEvent(tx, {
      projectId: input.projectId,
      type: 'date.moved',
      actor,
      refId: leadId,
      payload: { stageId: input.stageId, field: plan.rows[0]!.field, days: plan.days, rows: plan.rows.length, reason, customer: reason === 'CUSTOMER_CHANGE' || decisionId !== null },
      at: now,
    });
  });

  const moved = stages.find((s) => s.id === input.stageId)!;
  const later = plan.stages.length - 1;
  return {
    ok: true,
    message: `${moved.name} moved${later > 0 ? `, with ${later} later stage${later === 1 ? '' : 's'}` : ''}. Its steps moved with it. The customer's app shows the new date and the reason now.`,
  };
}

// ── Stages done ───────────────────────────────────────────────

/**
 * Marks a stage done by hand (a stage with no step in scope, or every one
 * ticked) or reopens it. Done needs a site photo from the stage.
 */
export async function markStageDone(projectId: string, stageId: string, done: boolean, now = new Date()): Promise<PlanEditResult> {
  const check = await memberOnProject(projectId, 'checklist.tick');
  if (!check.ok) return check;
  const stage = await prisma.homeProjectStage.findFirst({
    where: { id: stageId, projectId },
    select: { id: true, kind: true, name: true, actualEnd: true, items: { select: { doneAt: true, inScope: true, donePhotoId: true, doneSource: true } } },
  });
  if (!stage) return { ok: false, error: 'That stage is not on this plan any more. Reload the page.' };
  if ((stage.actualEnd !== null) === done) return { ok: true, message: done ? 'Already done.' : 'Already open.' };
  if (done) {
    const photos = (await photosByStage(prisma, projectId, [stage])).get(stage.id) ?? 0;
    const gate = canMarkStageDone({ items: countedSteps(stage.items).map((i) => ({ done: i.doneAt !== null })), photos });
    if (!gate.ok) return { ok: false, error: gateWords(gate) };
  }
  const actor: ProjectActor = { type: 'STUDIO', id: check.member.userId };
  await prisma.$transaction(async (tx) => writeDone(tx, projectId, stage, done, actor, now));
  return { ok: true, message: done ? `${stage.name} is done. The customer sees it ticked off.` : `${stage.name} is open again.` };
}

/** Renames a stage. The studio owns names; we own the kind, so nothing that reads the plan changes. */
export async function renameStage(projectId: string, stageId: string, name: string): Promise<PlanEditResult> {
  const check = await memberOnProject(projectId, 'plan.edit');
  if (!check.ok) return check;
  const clean = name.replace(/\s+/g, ' ').trim();
  if (clean.length < 2) return { ok: false, error: 'Give the stage a name.' };
  if (clean.length > STAGE_NAME_MAX) return { ok: false, error: `Keep it under ${STAGE_NAME_MAX} characters.` };
  const stage = await prisma.homeProjectStage.findFirst({ where: { id: stageId, projectId }, select: { id: true, name: true } });
  if (!stage) return { ok: false, error: 'That stage is not on this plan any more. Reload the page.' };
  if (stage.name === clean) return { ok: true, message: 'No change.' };
  const actor: ProjectActor = { type: 'STUDIO', id: check.member.userId };
  await prisma.$transaction(async (tx) => {
    await tx.homeProjectStage.update({ where: { id: stage.id }, data: { name: clean } });
    await recordEvent(tx, { projectId, type: 'stage.renamed', actor, refId: stage.id });
  });
  return { ok: true, message: `Renamed to ${clean}. The customer sees the new name.` };
}

// ── Editing the steps (owner, PM: plan.edit) ──────────────────

const STEP_SELECT = { id: true, stageId: true, label: true, room: true, weightBp: true, inScope: true, doneAt: true, plannedOn: true, sortOrder: true, customerMilestone: true } as const;

/** One step of this project, and every step of it (for the rules that look at the whole plan). */
async function stepOn(projectId: string, stepId: string) {
  const all = await prisma.homeChecklistItem.findMany({ where: { stage: { projectId } }, select: STEP_SELECT });
  const step = all.find((s) => s.id === stepId) ?? null;
  return { step, all: all.map((s) => ({ id: s.id, inScope: s.inScope, done: s.doneAt !== null })) };
}

/**
 * Unticks a step: a correction, owner or PM only. Its photo stays in the
 * site log (append-only); the step just stops pointing at it. Reopens the
 * stage if it was done.
 */
export async function untickStep(projectId: string, stepId: string, now = new Date()): Promise<PlanEditResult> {
  const check = await memberOnProject(projectId, 'plan.edit');
  if (!check.ok) return check;
  const { step } = await stepOn(projectId, stepId);
  if (!step) return { ok: false, error: GONE };
  if (step.doneAt === null) return { ok: true, message: 'Already open.' };
  const actor: ProjectActor = { type: 'STUDIO', id: check.member.userId };
  const outcome = await prisma.$transaction(async (tx) => {
    await tx.homeChecklistItem.update({
      where: { id: step.id },
      // A design step's note and file stay in the locker and the event log; the step just lets go of them.
      data: { doneAt: null, doneById: null, doneSource: null, doneSiteLogId: null, donePhotoId: null, doneNote: null, doneDocumentId: null },
    });
    await recordEvent(tx, { projectId, type: 'checklist.unticked', actor, refId: step.id, at: now });
    return settleStageAfterTicks(tx, projectId, step.stageId, actor, now);
  });
  const tail = outcome === 'reopen' ? ' The stage is open again.' : '';
  return { ok: true, message: `Unticked: ${step.label}. Its photo stays in the site log.${tail}` };
}

/** Renames a step. The customer sees the new name. */
export async function renameStep(projectId: string, stepId: string, name: string): Promise<PlanEditResult> {
  const check = await memberOnProject(projectId, 'plan.edit');
  if (!check.ok) return check;
  const label = checkLabel(name);
  if (!label.ok) return label;
  const { step } = await stepOn(projectId, stepId);
  if (!step) return { ok: false, error: GONE };
  if (step.label === label.label) return { ok: true, message: 'No change.' };
  const actor: ProjectActor = { type: 'STUDIO', id: check.member.userId };
  await prisma.$transaction(async (tx) => {
    await tx.homeChecklistItem.update({ where: { id: step.id }, data: { label: label.label } });
    await recordEvent(tx, { projectId, type: 'step.renamed', actor, refId: step.id });
  });
  return { ok: true, message: `Renamed to “${label.label}”.${step.customerMilestone ? ' It is starred, so the customer sees the new name.' : ''}` };
}

/** Changes a step's weight (basis points). The in-scope steps are shared again so the project still adds to 100%. */
export async function reweightStep(projectId: string, stepId: string, weightBp: number): Promise<PlanEditResult> {
  const check = await memberOnProject(projectId, 'plan.edit');
  if (!check.ok) return check;
  const ok = checkWeight(weightBp);
  if (!ok.ok) return ok;
  const { step } = await stepOn(projectId, stepId);
  if (!step) return { ok: false, error: GONE };
  if (step.weightBp === weightBp) return { ok: true, message: 'No change.' };
  const actor: ProjectActor = { type: 'STUDIO', id: check.member.userId };
  await prisma.$transaction(async (tx) => {
    await tx.homeChecklistItem.update({ where: { id: step.id }, data: { weightBp } });
    await recordEvent(tx, { projectId, type: 'step.reweighted', actor, refId: step.id, payload: { from: step.weightBp, to: weightBp } });
  });
  return { ok: true, message: `${step.label} now weighs ${bpToPct(weightBp)}%. Every step's share was worked out again so the project still adds up to 100%.` };
}

/**
 * Marks a step in or out of scope. Out of scope: hidden from the customer,
 * its weight shared across the rest, never needed to finish its stage — so
 * the stage may finish now, or reopen when a step comes back in.
 */
export async function scopeStep(projectId: string, stepId: string, inScope: boolean, now = new Date()): Promise<PlanEditResult> {
  const check = await memberOnProject(projectId, 'plan.edit');
  if (!check.ok) return check;
  const { step, all } = await stepOn(projectId, stepId);
  if (!step) return { ok: false, error: GONE };
  if (step.inScope === inScope) return { ok: true, message: 'No change.' };
  const ok = checkScope({ id: step.id, done: step.doneAt !== null, inScope: step.inScope }, inScope, all);
  if (!ok.ok) return ok;
  const actor: ProjectActor = { type: 'STUDIO', id: check.member.userId };
  const outcome = await prisma.$transaction(async (tx) => {
    await tx.homeChecklistItem.update({ where: { id: step.id }, data: { inScope } });
    await recordEvent(tx, { projectId, type: 'step.scoped', actor, refId: step.id, payload: { inScope } });
    return settleStageAfterTicks(tx, projectId, step.stageId, actor, now);
  });
  const tail = outcome === 'mark-done' ? ' Every other step is ticked, so the stage now shows done.' : outcome === 'reopen' ? ' The stage is open again.' : '';
  return {
    ok: true,
    message: inScope
      ? `${step.label} is back in scope.${step.customerMilestone ? ' It is starred, so the customer sees it again.' : ''}${tail}`
      : `${step.label} is not in scope. Its weight is shared across the other steps${step.customerMilestone ? ', and the customer no longer sees it' : ''}.${tail}`,
  };
}

/**
 * Stars or unstars a step (owner, 12 Oct 2026; docs/studio-os/CUSTOMER-MILESTONES.md):
 * a starred step is one of its stage's milestones the customer sees; every
 * other step is the studio's own. Percentages do not change. No limit: the
 * Plan and Design tabs only warn when a stage has none or more than
 * `MILESTONES_WARN_ABOVE`.
 */
export async function starStep(projectId: string, stepId: string, starred: boolean): Promise<PlanEditResult> {
  const check = await memberOnProject(projectId, 'plan.edit');
  if (!check.ok) return check;
  const { step } = await stepOn(projectId, stepId);
  if (!step) return { ok: false, error: GONE };
  if (step.customerMilestone === starred) return { ok: true, message: 'No change.' };
  const actor: ProjectActor = { type: 'STUDIO', id: check.member.userId };
  await prisma.$transaction(async (tx) => {
    await tx.homeChecklistItem.update({ where: { id: step.id }, data: { customerMilestone: starred } });
    await recordEvent(tx, { projectId, type: 'step.starred', actor, refId: step.id, payload: { starred } });
  });
  return {
    ok: true,
    message: starred
      ? `Starred “${step.label}”. The client sees it as a milestone${step.inScope ? '' : ' once it is back in scope'}.`
      : `“${step.label}” is no longer starred. Only your team sees it.`,
  };
}

/** Adds a step to a group of a stage, after the group's last step, with its planned day. */
export async function addStep(
  projectId: string,
  input: { stageId: string; group: string; label: string; weightBp: number },
  now = new Date(),
): Promise<PlanEditResult> {
  const check = await memberOnProject(projectId, 'plan.edit');
  if (!check.ok) return check;
  const label = checkLabel(input.label);
  if (!label.ok) return label;
  const group = checkGroup(input.group);
  if (!group.ok) return group;
  const weight = checkWeight(input.weightBp);
  if (!weight.ok) return weight;
  const stage = await prisma.homeProjectStage.findFirst({
    where: { id: input.stageId, projectId },
    select: { id: true, name: true, plannedEnd: true, items: { orderBy: { sortOrder: 'asc' }, select: { id: true, room: true, sortOrder: true, plannedOn: true } } },
  });
  if (!stage) return { ok: false, error: 'That stage is not on this plan any more. Reload the page.' };
  if (stage.items.length >= STEPS_PER_STAGE_MAX) return { ok: false, error: `A stage holds up to ${STEPS_PER_STAGE_MAX} steps.` };
  const inGroup = stage.items.filter((i) => i.room === group.group);
  const after = inGroup[inGroup.length - 1] ?? stage.items[stage.items.length - 1] ?? null;
  const sortOrder = after ? after.sortOrder + 1 : 0;
  const actor: ProjectActor = { type: 'STUDIO', id: check.member.userId };
  await prisma.$transaction(async (tx) => {
    // Make room after the group's last step, so the new one sits inside its group.
    for (const later of stage.items.filter((i) => i.sortOrder >= sortOrder)) {
      await tx.homeChecklistItem.update({ where: { id: later.id }, data: { sortOrder: later.sortOrder + 1 } });
    }
    const made = await tx.homeChecklistItem.create({
      data: {
        stageId: stage.id,
        room: group.group,
        label: label.label,
        sortOrder,
        weightBp: input.weightBp,
        inScope: true,
        plannedOn: after?.plannedOn ?? stage.plannedEnd,
      },
      select: { id: true },
    });
    await recordEvent(tx, { projectId, type: 'step.added', actor, refId: made.id, payload: { stageId: stage.id, weightBp: input.weightBp } });
    // A stage that was done has an open step now.
    await settleStageAfterTicks(tx, projectId, stage.id, actor, now);
  });
  return { ok: true, message: `Added “${label.label}” to ${group.group}. Only your team sees it until you star it.` };
}

/** Removes a step that was never ticked. A ticked step stays: untick it first. */
export async function removeStep(projectId: string, stepId: string, now = new Date()): Promise<PlanEditResult> {
  const check = await memberOnProject(projectId, 'plan.edit');
  if (!check.ok) return check;
  const { step, all } = await stepOn(projectId, stepId);
  if (!step) return { ok: false, error: GONE };
  const ok = checkRemove({ id: step.id, done: step.doneAt !== null, inScope: step.inScope }, all);
  if (!ok.ok) return ok;
  const actor: ProjectActor = { type: 'STUDIO', id: check.member.userId };
  await prisma.$transaction(async (tx) => {
    await tx.homeChecklistItem.delete({ where: { id: step.id } });
    await recordEvent(tx, { projectId, type: 'step.removed', actor, refId: step.id, payload: { stageId: step.stageId, weightBp: step.weightBp } });
    // Removing the last open step may finish the stage.
    await settleStageAfterTicks(tx, projectId, step.stageId, actor, now);
  });
  return { ok: true, message: `Removed “${step.label}”. Its weight is shared across the other steps.` };
}

// ── The Plan tab's read ───────────────────────────────────────

export interface PlanStepView {
  id: string;
  label: string;
  group: string;
  /** The weight the studio set, in basis points and as a percentage. */
  weightBp: number;
  weightPct: number;
  /** What it counts for now: its share after not-in-scope steps are shared out. 0 when not in scope. */
  effectivePct: number;
  inScope: boolean;
  done: boolean;
  doneOn: string | null;
  plannedOn: string | null;
  /** Ticked from a voice note in site mode. */
  fromVoice: boolean;
  /** Ticked with a photo (in the site log). False for an older tick or a backfill. */
  hasPhoto: boolean;
  /** Ticked by the backfill because its stage was already done. */
  backfilled: boolean;
  /** Done before the project was brought onto One Interiors (docs/studio-os/BRING-IN-PROJECTS.md): no photo. */
  beforeJoining: boolean;
  /** Starred: a milestone the customer sees (docs/studio-os/CUSTOMER-MILESTONES.md). */
  milestone: boolean;
}

export interface PlanStageView extends StageStatus {
  photos: number;
  gate: DoneGate;
  /** Whole percent of the stage done (in-scope steps); null when nothing in it is in scope. */
  progressPct: number | null;
  /** The stage's share of the project, as a percentage. */
  sharePct: number;
  /** In-scope steps ticked / in scope; every in-scope step ticked. */
  completion: { done: number; total: number; open: number; complete: boolean };
  groups: { group: string; steps: PlanStepView[] }[];
  /** Starred steps in scope: what the customer sees under this stage. */
  milestones: number;
}

export interface PlanMoveView extends CustomerMove {
  /** The PM's note: only the team sees it. */
  note: string | null;
}

export interface StudioPlan {
  projectId: string;
  today: string;
  stages: PlanStageView[];
  /** Whole percent of the project done. */
  progressPct: number;
  /** The in-scope weights as set, added up: the editor shows it against 100%. */
  weightTotalPct: number;
  overall: OverallDelay;
  current: ReturnType<typeof currentStatus>;
  moves: PlanMoveView[];
  /** The customer's decisions, for "waiting on their decision". */
  decisions: { id: string; title: string; dueOn: string; picked: boolean }[];
  canEdit: boolean;
  canTick: boolean;
  /** May post to the site log (a tick from the office is a post). */
  canPost: boolean;
  /** For the Move a date preview, worked out in the browser with the same rules. */
  changes: RuleChange[];
  calendar: { workingDays: number[]; holidays: string[] };
}

export type StudioPlanResult = { ok: true; plan: StudioPlan | null } | { ok: false; error: string };


/** The Plan tab: null `plan` for a project whose plan was never built from a quote. */
export async function planForStudio(projectId: string, now = new Date()): Promise<StudioPlanResult> {
  const check = await memberOnProject(projectId, 'project.read');
  if (!check.ok) return check;
  const p = await prisma.homeProject.findUnique({
    where: { id: projectId },
    select: {
      introduction: { select: { studio: { select: { workingDays: true, holidays: { select: { day: true } } } } } },
      stages: {
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          kind: true,
          name: true,
          plannedStart: true,
          plannedEnd: true,
          actualEnd: true,
          items: {
            orderBy: { sortOrder: 'asc' },
            select: { id: true, room: true, label: true, weightBp: true, inScope: true, plannedOn: true, doneAt: true, doneSource: true, donePhotoId: true, customerMilestone: true },
          },
        },
      },
      dateChanges: {
        orderBy: [{ at: 'asc' }, { id: 'asc' }],
        select: { stageId: true, field: true, fromDate: true, toDate: true, reason: true, decisionId: true, note: true, at: true },
      },
      decisions: { orderBy: { dueOn: 'asc' }, select: { id: true, title: true, dueOn: true, chosenIndex: true } },
    },
  });
  if (!p) return { ok: false, error: 'That project is not one of yours.' };
  const stored = p.stages.filter((s) => isKind(s.kind));
  if (stored.length === 0) return { ok: true, plan: null };

  const cal = calendarOf({ workingDays: p.introduction.studio.workingDays, holidays: p.introduction.studio.holidays });
  const today = istDay(now);
  const stages = stored.map(toRule);
  const changes: RuleChange[] = p.dateChanges.map((c) => ({
    stageId: c.stageId,
    field: c.field as DateField,
    from: dayFromDb(c.fromDate),
    to: dayFromDb(c.toDate),
    reason: c.reason,
    decisionId: c.decisionId,
    at: c.at,
  }));
  const photos = await photosByStage(prisma, projectId, stored);
  const statuses = stageStatuses(stages, changes, today, cal);
  const notes = new Map<number, string | null>();
  for (const c of p.dateChanges) if (!notes.has(c.at.getTime())) notes.set(c.at.getTime(), c.note);
  const names = new Map(stages.map((s) => [s.id, s.name]));
  const progress = progressOf(stored.flatMap((s) => s.items.map((it) => ({ id: it.id, stageId: s.id, weightBp: it.weightBp, inScope: it.inScope, done: it.doneAt !== null }))));
  const weightTotalBp = stored.reduce((a, s) => a + s.items.filter((i) => i.inScope).reduce((b, i) => b + i.weightBp, 0), 0);

  return {
    ok: true,
    plan: {
      projectId,
      today,
      progressPct: progress.pct,
      weightTotalPct: bpToPct(weightTotalBp),
      stages: statuses.map((s, i) => {
        const items = stored[i]!.items;
        const flags = countedSteps(items).map((it) => ({ done: it.doneAt !== null }));
        const n = photos.get(s.id) ?? 0;
        const sp = progress.stages.get(s.id);
        const groups = new Map<string, PlanStepView[]>();
        for (const it of items) {
          const list = groups.get(it.room) ?? [];
          list.push({
            id: it.id,
            label: it.label,
            group: it.room,
            weightBp: it.weightBp,
            weightPct: bpToPct(it.weightBp),
            effectivePct: bpToPct(progress.weights.get(it.id) ?? 0),
            inScope: it.inScope,
            done: it.doneAt !== null,
            doneOn: it.doneAt ? day(it.doneAt) : null,
            plannedOn: it.plannedOn ? dayFromDb(it.plannedOn) : null,
            fromVoice: it.doneSource === 'VOICE',
            hasPhoto: it.donePhotoId !== null,
            backfilled: it.doneSource === 'BACKFILL',
            beforeJoining: it.doneSource === 'BEFORE_JOINING',
            milestone: it.customerMilestone,
          });
          groups.set(it.room, list);
        }
        const done = flags.filter((f) => f.done).length;
        return {
          ...s,
          photos: n,
          gate: canMarkStageDone({ items: flags, photos: n }),
          progressPct: sp?.pct ?? null,
          sharePct: bpToPct(sp?.totalBp ?? 0),
          completion: { done, total: flags.length, open: flags.length - done, complete: flags.length > 0 && done === flags.length },
          groups: [...groups.entries()].map(([group, steps]) => ({ group, steps })),
          milestones: items.filter((it) => it.inScope && it.customerMilestone).length,
        };
      }),
      overall: overallDelay(stages, changes, today, cal),
      current: currentStatus(statuses),
      moves: movesOf(changes, names, handoverStage(stages)?.id ?? null).map((m) => ({ ...m, note: notes.get(Date.parse(m.at)) ?? null })),
      decisions: p.decisions.map((d) => ({ id: d.id, title: d.title, dueOn: istDay(d.dueOn), picked: d.chosenIndex !== null })),
      canEdit: check.access.may('plan.edit'),
      canTick: check.access.may('checklist.tick'),
      canPost: check.access.may('update.post'),
      changes,
      calendar: { workingDays: [...cal.workingDays], holidays: [...cal.holidays] },
    },
  };
}
