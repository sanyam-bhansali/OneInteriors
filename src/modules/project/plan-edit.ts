import 'server-only';

/**
 * The studio editing a customer's plan from the office (studio workspace
 * Phase 3): move a date with a reason, tick checklist items, mark a stage
 * done or reopen it, rename a stage — and the Plan tab's read. Rules in
 * project-rules.ts; the customer reads the result through the projection
 * (portal/tracker-view.ts), so there is no separate "tell the customer" step.
 *
 * Access (studio/roles.ts, checked here through `memberOnProject` on every
 * call, not only in the UI):
 * - move a date, rename a stage: `plan.edit` — the owner, or the PM on the
 *   project. Never a supervisor.
 * - tick / untick, mark a stage done / reopen it: `checklist.tick` — the
 *   owner, the PM or the supervisor on the project.
 * - read the plan: `project.read`.
 *
 * Every write is one transaction with its `HomeProjectEvent`. Date changes
 * are append-only (`HomeProjectDateChange`, tests/append-only.test.ts): the
 * stage's column holds today's date, the rows hold its history.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { memberOnProject } from '@/modules/studio/access';
import { KIND_TRACKER_KEYS, PLAN_KINDS, type PlanKind } from '@/modules/portal/tracker';
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
  settleStage,
  stageCompletion,
  stageStatuses,
  type Completion,
  type DateField,
  type DoneGate,
  type OverallDelay,
  type RuleChange,
  type RuleStage,
  type StageKind,
  type StageStatus,
} from './project-rules';
import { calendarOf, dayFromDb, dayToDb, istDay } from './working-days';

export type PlanEditResult = { ok: true; message: string } | { ok: false; error: string };

export const NOTE_MAX = 500;
export const STAGE_NAME_MAX = 40;

type Db = Prisma.TransactionClient;

const isKind = (k: string): k is PlanKind => (PLAN_KINDS as readonly string[]).includes(k);
const day = (d: Date) => istDay(d);

/**
 * Site photos posted during each stage: photos on a site log whose stage it
 * is (Phase 2), plus photos on the older free-text updates tagged with one of
 * the stage kind's tracker keys, so projects from before site mode can
 * still finish a stage.
 */
async function photosByStage(db: Db, projectId: string, stages: readonly { id: string; kind: string }[]): Promise<Map<string, number>> {
  const ids = stages.map((s) => s.id);
  const [logs, updates] = await Promise.all([
    db.homeSiteLog.findMany({
      where: { projectId, stageId: { in: ids } },
      select: { stageId: true, _count: { select: { photos: true } } },
    }),
    db.homeProjectUpdate.findMany({
      where: { projectId, stage: { not: null }, NOT: { photoPaths: { isEmpty: true } } },
      select: { stage: true, photoPaths: true },
    }),
  ]);
  const out = new Map<string, number>(ids.map((id) => [id, 0]));
  for (const l of logs) if (l.stageId) out.set(l.stageId, (out.get(l.stageId) ?? 0) + l._count.photos);
  for (const s of stages) {
    if (!isKind(s.kind)) continue;
    const keys = KIND_TRACKER_KEYS[s.kind] as readonly string[];
    const legacy = updates.filter((u) => u.stage !== null && keys.includes(u.stage)).reduce((n, u) => n + u.photoPaths.length, 0);
    out.set(s.id, (out.get(s.id) ?? 0) + legacy);
  }
  return out;
}

/** The old `doneStages` keys for a kind, kept in step while the app still reads them (tracker-store.ts `writeStageDone`). */
async function syncDoneStages(db: Db, projectId: string, kind: PlanKind, done: boolean): Promise<void> {
  const p = await db.homeProject.findUnique({ where: { id: projectId }, select: { doneStages: true } });
  if (!p) return;
  const keys = KIND_TRACKER_KEYS[kind] as readonly string[];
  const next = done ? [...new Set([...p.doneStages, ...keys])] : p.doneStages.filter((k) => !keys.includes(k));
  if (next.length !== p.doneStages.length || next.some((k, i) => k !== p.doneStages[i])) {
    await db.homeProject.update({ where: { id: projectId }, data: { doneStages: next } });
  }
}

async function writeDone(db: Db, projectId: string, stage: { id: string; kind: string }, done: boolean, actor: ProjectActor, now: Date): Promise<void> {
  await db.homeProjectStage.update({ where: { id: stage.id }, data: { actualEnd: done ? now : null } });
  if (isKind(stage.kind)) await syncDoneStages(db, projectId, stage.kind, done);
  await recordEvent(db, { projectId, type: done ? 'stage.done' : 'stage.reopened', actor, refId: stage.id });
}

/**
 * After ticks change: finish the stage when its last item is ticked and it
 * has a photo, reopen it when an item is unticked. Call inside the same
 * transaction as the ticks (Phase 2's site post can call it too). Returns
 * what changed.
 */
export async function settleStageAfterTicks(db: Db, projectId: string, stageId: string, actor: ProjectActor, now = new Date()): Promise<'mark-done' | 'reopen' | 'keep'> {
  const stage = await db.homeProjectStage.findFirst({
    where: { id: stageId, projectId },
    select: { id: true, kind: true, actualEnd: true, items: { select: { doneAt: true } } },
  });
  if (!stage) return 'keep';
  const photos = (await photosByStage(db, projectId, [stage])).get(stage.id) ?? 0;
  const outcome = settleStage({ items: stage.items.map((i) => ({ done: i.doneAt !== null })), photos, done: stage.actualEnd !== null });
  if (outcome !== 'keep') await writeDone(db, projectId, stage, outcome === 'mark-done', actor, now);
  return outcome;
}

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
 * Moves a plan date. One transaction: each stage's new dates, one
 * `HomeProjectDateChange` per date that moved (all with the same `at`, so
 * the customer sees them as one move), and one `date.moved` event. A reason
 * is required; a decision makes it the customer's delay.
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

  await prisma.$transaction(async (tx) => {
    for (const s of plan.stages) {
      await tx.homeProjectStage.update({
        where: { id: s.stageId },
        data: { plannedStart: dayToDb(s.plannedStart), plannedEnd: dayToDb(s.plannedEnd) },
      });
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
    message: `${moved.name} moved${later > 0 ? `, with ${later} later stage${later === 1 ? '' : 's'}` : ''}. The customer's app shows the new date and the reason now.`,
  };
}

// ── Ticks and done ────────────────────────────────────────────

/** Ticks or unticks one checklist item from the office, and finishes or reopens its stage if that follows. */
export async function tickItem(projectId: string, itemId: string, done: boolean, now = new Date()): Promise<PlanEditResult> {
  const check = await memberOnProject(projectId, 'checklist.tick');
  if (!check.ok) return check;
  const item = await prisma.homeChecklistItem.findFirst({
    where: { id: itemId, stage: { projectId } },
    select: { id: true, label: true, doneAt: true, stageId: true },
  });
  if (!item) return { ok: false, error: 'That item is not on this plan any more. Reload the page.' };
  if ((item.doneAt !== null) === done) return { ok: true, message: done ? 'Already ticked.' : 'Already open.' };
  const actor: ProjectActor = { type: 'STUDIO', id: check.member.userId };
  const outcome = await prisma.$transaction(async (tx) => {
    await tx.homeChecklistItem.update({
      where: { id: item.id },
      data: done
        ? { doneAt: now, doneById: check.member.userId, doneSource: 'TICK', doneSiteLogId: null }
        : { doneAt: null, doneById: null, doneSource: null, doneSiteLogId: null },
    });
    await recordEvent(tx, { projectId, type: done ? 'checklist.ticked' : 'checklist.unticked', actor, refId: item.id });
    return settleStageAfterTicks(tx, projectId, item.stageId, actor, now);
  });
  const tail = outcome === 'mark-done' ? ' That was the last one: the stage now shows done.' : outcome === 'reopen' ? ' The stage is open again.' : '';
  return { ok: true, message: `${done ? 'Ticked' : 'Unticked'}: ${item.label}.${tail}` };
}

/**
 * Marks a stage done by hand (a stage with no checklist, or every item
 * ticked) or reopens it. Done needs a site photo from the stage.
 */
export async function markStageDone(projectId: string, stageId: string, done: boolean, now = new Date()): Promise<PlanEditResult> {
  const check = await memberOnProject(projectId, 'checklist.tick');
  if (!check.ok) return check;
  const stage = await prisma.homeProjectStage.findFirst({
    where: { id: stageId, projectId },
    select: { id: true, kind: true, name: true, actualEnd: true, items: { select: { doneAt: true } } },
  });
  if (!stage) return { ok: false, error: 'That stage is not on this plan any more. Reload the page.' };
  if ((stage.actualEnd !== null) === done) return { ok: true, message: done ? 'Already done.' : 'Already open.' };
  if (done) {
    const photos = (await photosByStage(prisma, projectId, [stage])).get(stage.id) ?? 0;
    const gate = canMarkStageDone({ items: stage.items.map((i) => ({ done: i.doneAt !== null })), photos });
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

// ── The Plan tab's read ───────────────────────────────────────

export interface PlanItemView {
  id: string;
  label: string;
  done: boolean;
  doneOn: string | null;
  /** Ticked from a voice note in site mode. */
  fromVoice: boolean;
}

export interface PlanStageView extends StageStatus {
  photos: number;
  completion: Completion;
  gate: DoneGate;
  rooms: { room: string; items: PlanItemView[] }[];
}

export interface PlanMoveView extends CustomerMove {
  /** The PM's note: only the team sees it. */
  note: string | null;
}

export interface StudioPlan {
  projectId: string;
  today: string;
  stages: PlanStageView[];
  overall: OverallDelay;
  current: ReturnType<typeof currentStatus>;
  moves: PlanMoveView[];
  /** The customer's decisions, for "waiting on their decision". */
  decisions: { id: string; title: string; dueOn: string; picked: boolean }[];
  canEdit: boolean;
  canTick: boolean;
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
          items: { orderBy: { sortOrder: 'asc' }, select: { id: true, room: true, label: true, doneAt: true, doneSource: true } },
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

  return {
    ok: true,
    plan: {
      projectId,
      today,
      stages: statuses.map((s, i) => {
        const items = stored[i]!.items;
        const flags = items.map((it) => ({ done: it.doneAt !== null }));
        const n = photos.get(s.id) ?? 0;
        const rooms = new Map<string, PlanItemView[]>();
        for (const it of items) {
          const list = rooms.get(it.room) ?? [];
          list.push({ id: it.id, label: it.label, done: it.doneAt !== null, doneOn: it.doneAt ? day(it.doneAt) : null, fromVoice: it.doneSource === 'VOICE' });
          rooms.set(it.room, list);
        }
        return {
          ...s,
          photos: n,
          completion: stageCompletion(flags),
          gate: canMarkStageDone({ items: flags, photos: n }),
          rooms: [...rooms.entries()].map(([room, list]) => ({ room, items: list })),
        };
      }),
      overall: overallDelay(stages, changes, today, cal),
      current: currentStatus(statuses),
      moves: movesOf(changes, names, handoverStage(stages)?.id ?? null).map((m) => ({ ...m, note: notes.get(Date.parse(m.at)) ?? null })),
      decisions: p.decisions.map((d) => ({ id: d.id, title: d.title, dueOn: istDay(d.dueOn), picked: d.chosenIndex !== null })),
      canEdit: check.access.may('plan.edit'),
      canTick: check.access.may('checklist.tick'),
      changes,
      calendar: { workingDays: [...cal.workingDays], holidays: [...cal.holidays] },
    },
  };
}
