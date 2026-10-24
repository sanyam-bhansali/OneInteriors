import 'server-only';

/**
 * The design phase's writes (Studio OS Phase 2, docs/studio-os/PHASE-2-DESIGN.md):
 * picking the designer, ticking and moving design steps, the mood board,
 * site visits, measurements, drawings and the client's answers, the design
 * final and closing the design, and the studio's design steps template.
 * Rules in rules.ts and template.ts; reads in store.ts.
 *
 * Easy, not automatic: every write here is somebody's decision. The only
 * things that happen by themselves are the customer's notice when something
 * is shared with them (push, else email; never WhatsApp: notify/service.ts)
 * and, as everywhere in the step tracker, the DESIGN stage showing done when
 * its last in-scope step is ticked (project/stage-settle.ts).
 *
 * Access (studio/roles.ts, checked here through `memberOnProject` on every
 * call): design work (`design.work`) — the owner, the PM on the project, the
 * designer on it; picking the designer and closing the design
 * (`design.assign`) — the owner and the PM; editing a step's who, file and
 * gate, and applying the studio's steps to an older project (`plan.edit`);
 * the studio's design steps (`design.template`) — the owner. The client's
 * answer to a drawing is theirs: the owner of the brief, not family.
 *
 * Every write is one transaction with its `HomeProjectEvent`.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { notify } from '@/modules/notify/service';
import { storeProjectDoc } from '@/modules/storage/project-docs';
import { currentMember, memberOnProject } from '@/modules/studio/access';
import { can, needsAssignment } from '@/modules/studio/roles';
import { recordEvent, type ProjectActor } from '@/modules/project/events';
import { canSupersede } from '@/modules/project/locker-rules';
import { settleStageAfterTicks } from '@/modules/project/stage-settle';
import { applyPhaseEvent } from '@/modules/project/lifecycle';
import { dayFromDb, dayToDb, istDay, istTime } from '@/modules/project/working-days';
import { readSignedStages } from '@/modules/portal/payments';
import { designStepsFor, type PlanItem } from '@/modules/portal/quote-to-plan';
import { ROOM_KEYS, type RoomKey } from '@/modules/prepare/rooms';
import { elementBySlug } from '@/modules/prepare/catalogue';
import { seedBoard } from '@/modules/prepare/board';
import type { BudgetTier, StyleTag } from '@/modules/brief/types';
import { copyQuote, quotesToCompareInStudio, totalsFor } from '@/modules/studio-quote/quotes';
import { compareToIssued } from '@/modules/studio-quote/revision';
import {
  applyRefusal,
  asksApproval,
  checkAnswer,
  checkDesignTick,
  checkMeasurements,
  checkVisit,
  DELAY_NOTE_MAX,
  DESIGN_KINDS,
  gateOf,
  isDelayReasonKey,
  approvalKindOfDrawing,
  isDesignKind,
  lateTickCheck,
  planStepMove,
  ROOM_MAX,
  sideOfReason,
  VISIT_NOTE_MAX,
  type MeasureInput,
} from './rules';
import { bhkOf, checkDesignTemplate, isResponsible, PRE_EXECUTION_GROUP, readDesignTemplate } from './template';
import { GATE_SELECT, gateStagesOf } from './store';
import { settleDesignPhase, tickApprovalStep } from './step-settle';

export type DesignResult = { ok: true; message: string; id?: string } | { ok: false; error: string };

class Refused extends Error {}

const GONE = 'That step is not on this plan any more. Reload the page.';
const MOOD_NOTE_MAX = 300;
const TITLE_MAX = 100;
const MOOD_ITEMS_MAX = 24;

/** The customer to tell, the studio's name, and the DESIGN stage. */
async function projectFacts(projectId: string) {
  return prisma.homeProject.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      cancelledAt: true,
      introduction: { select: { studioId: true, studio: { select: { tradeName: true } }, brief: { select: { id: true, userId: true } } } },
      stages: { where: { kind: 'DESIGN' }, take: 1, select: { id: true, plannedStart: true, plannedEnd: true } },
    },
  });
}

const tell = (userId: string | null | undefined, studio: string, title: string) => {
  if (userId) void notify(userId, { kind: 'design', studio, title });
};

// ── The designer ──────────────────────────────────────────────

/**
 * Picks (or clears) the project's designer: an active designer, PM or owner
 * of the studio. They go on the project's team, so they can open it; a
 * designer who is replaced comes off it (they were only on it to design).
 */
export async function assignDesigner(projectId: string, memberId: string | null): Promise<DesignResult> {
  const check = await memberOnProject(projectId, 'design.assign');
  if (!check.ok) return check;
  const p = await prisma.homeProject.findUnique({
    where: { id: projectId },
    select: { designerId: true, designer: { select: { id: true, role: true } } },
  });
  if (!p) return { ok: false, error: 'That project is not one of yours.' };
  const target = memberId
    ? await prisma.studioMember.findFirst({
        where: { id: memberId, studioId: check.member.studioId, status: 'ACTIVE', role: { in: ['DESIGNER', 'PM', 'OWNER'] } },
        select: { id: true, role: true, user: { select: { name: true } } },
      })
    : null;
  if (memberId && !target) return { ok: false, error: 'Pick a designer from your team. Add one in Settings, Team.' };
  if ((p.designerId ?? null) === (target?.id ?? null)) return { ok: true, message: 'No change.' };
  const actor: ProjectActor = { type: 'STUDIO', id: check.member.userId };
  await prisma.$transaction(async (tx) => {
    await tx.homeProject.update({ where: { id: projectId }, data: { designerId: target?.id ?? null } });
    if (target && needsAssignment(target.role)) {
      const onIt = await tx.studioProjectMember.findUnique({ where: { homeProjectId_memberId: { homeProjectId: projectId, memberId: target.id } }, select: { id: true } });
      if (!onIt) await tx.studioProjectMember.create({ data: { homeProjectId: projectId, memberId: target.id } });
    }
    if (p.designer && p.designer.id !== target?.id && p.designer.role === 'DESIGNER') {
      await tx.studioProjectMember.deleteMany({ where: { homeProjectId: projectId, memberId: p.designer.id } });
    }
    await recordEvent(tx, { projectId, type: 'designer.assigned', actor, refId: target?.id ?? null, payload: { cleared: !target } });
  });
  return { ok: true, message: target ? `${target.user.name || 'They'} ${target.user.name ? 'is' : 'are'} the designer now, and can open this project.` : 'No designer on this project now.' };
}

// ── Design steps ──────────────────────────────────────────────


/** A design step as stored, from the plan: its who, file, gate, days, effort, approval and to-dos. */
export function designItemData(stageId: string, st: PlanItem): Prisma.HomeChecklistItemUncheckedCreateInput {
  return {
    stageId,
    room: st.room,
    label: st.label,
    sortOrder: st.sortOrder,
    weightBp: st.weightBp,
    inScope: st.inScope,
    plannedOn: st.plannedOn,
    responsible: st.responsible ?? null,
    needsDocument: st.needsDocument === true,
    gatePayment: st.gatePayment ?? null,
    gapDays: st.gapDays ?? null,
    customerMilestone: st.customerMilestone === true,
    effortMin: st.effortMin ?? null,
    approvalKind: st.approvalKind ?? null,
    ...(st.tasks && st.tasks.length ? { tasks: { create: st.tasks.map((label, k) => ({ label, sortOrder: k })) } } : {}),
  };
}

const STEP_SELECT = {
  id: true,
  label: true,
  responsible: true,
  inScope: true,
  doneAt: true,
  plannedOn: true,
  needsDocument: true,
  gatePayment: true,
  stageId: true,
} as const;

/**
 * Ticks a design step: its payment recorded, its file attached when it needs
 * one (filed in the locker — only the team sees it unless "show the client"),
 * an optional sentence for the team. The stage shows done when its last
 * in-scope step is ticked.
 */
export async function tickDesignStep(
  projectId: string,
  stepId: string,
  input: { note?: unknown; share?: unknown; reason?: unknown; reasonNote?: unknown },
  file: File | null,
  now = new Date(),
): Promise<DesignResult> {
  const check = await memberOnProject(projectId, 'design.work');
  if (!check.ok) return check;
  const p = await prisma.homeProject.findUnique({
    where: { id: projectId },
    select: {
      ...GATE_SELECT,
      introduction: { select: { studio: { select: { tradeName: true } }, brief: { select: { userId: true } } } },
      stages: { where: { kind: 'DESIGN' }, take: 1, select: { id: true, items: { where: { id: stepId }, select: STEP_SELECT } } },
    },
  });
  const step = p?.stages[0]?.items[0];
  if (!p || !step) return { ok: false, error: GONE };
  const note = typeof input.note === 'string' ? input.note.replace(/\r\n/g, '\n').trim() : '';
  const hasFile = Boolean(file && file.size > 0);
  const gate = gateOf(step.gatePayment, gateStagesOf(p));
  const ok = checkDesignTick({ done: step.doneAt !== null, inScope: step.inScope, needsDocument: step.needsDocument, label: step.label }, gate, hasFile, note);
  if (!ok.ok) return ok;
  // A late step says why (DESIGN-PROCESS-PLAN.md Decision 6); filed on the Delays list.
  const plannedDay = step.plannedOn ? dayFromDb(step.plannedOn) : null;
  const late = lateTickCheck({ plannedOn: plannedDay, responsible: step.responsible }, istDay(now), input.reason);
  if (!late.ok) return late;
  const reasonNote = typeof input.reasonNote === 'string' ? input.reasonNote.trim() : '';
  if (reasonNote.length > DELAY_NOTE_MAX) return { ok: false, error: `Keep the note under ${DELAY_NOTE_MAX} characters.` };
  let stored: { path: string } | null = null;
  if (hasFile) {
    const s = await storeProjectDoc(projectId, file!);
    if (!s.ok) return s;
    stored = s;
  }
  const share = input.share === true || input.share === 'true' || input.share === 'on';
  const actor: ProjectActor = { type: 'STUDIO', id: check.member.userId };
  try {
    const outcome = await prisma.$transaction(async (tx) => {
      let docId: string | null = null;
      if (stored && file) {
        const doc = await tx.homeDocument.create({
          data: {
            projectId,
            kind: 'DRAWINGS',
            title: step.label.slice(0, TITLE_MAX),
            storageKey: stored.path,
            originalName: file.name.slice(0, 200),
            contentType: file.type,
            bytes: file.size,
            uploadedById: check.member.userId,
            byStudio: true,
            sharedAt: share ? now : null,
            designKind: 'WORKING',
          },
          select: { id: true },
        });
        docId = doc.id;
        await recordEvent(tx, { projectId, type: 'document.filed', actor, refId: doc.id, payload: { kind: 'DRAWINGS', version: 1, shared: share } });
        if (share) await recordEvent(tx, { projectId, type: 'document.shared', actor, refId: doc.id, payload: { version: 1 } });
      }
      const { count } = await tx.homeChecklistItem.updateMany({
        where: { id: step.id, doneAt: null, inScope: true },
        data: { doneAt: now, doneById: check.member.userId, doneSource: 'TICK', doneNote: note || null, doneDocumentId: docId },
      });
      if (count !== 1) throw new Refused('Already ticked.');
      if (late.delay && plannedDay) {
        await tx.homeStepDelay.create({
          data: { projectId, stepId: step.id, fromDate: dayToDb(plannedDay), toDate: dayToDb(istDay(now)), side: late.delay.side, reason: late.delay.reason, note: reasonNote || null, byId: check.member.userId },
        });
      }
      await recordEvent(tx, { projectId, type: 'design.ticked', actor, refId: step.id, payload: { file: docId !== null, ...(late.delay ? { lateDays: late.delay.days, side: late.delay.side } : {}) } });
      const settled = await settleStageAfterTicks(tx, projectId, step.stageId, actor, now);
      await settleDesignPhase(tx, projectId, actor, now);
      return settled;
    });
    if (share && stored) tell(p.introduction.brief.userId, p.introduction.studio.tradeName, step.label);
    return { ok: true, message: `Ticked: ${step.label}.${outcome === 'mark-done' ? ' Every design step is done: design shows finished.' : ''}` };
  } catch (e) {
    if (e instanceof Refused) return { ok: false, error: e.message };
    throw e;
  }
}

/**
 * A design step is late: its new day, and why (client side or studio side).
 * The step and every open step after it move by the same days (linked); one
 * history row for the step that moved. The plan's stage dates are not moved
 * by this: the Design tab says how far past the plan design now ends.
 */
export async function moveDesignStep(projectId: string, stepId: string, input: { to: unknown; reason: unknown; note?: unknown }, now = new Date()): Promise<DesignResult> {
  const check = await memberOnProject(projectId, 'design.work');
  if (!check.ok) return check;
  if (!isDelayReasonKey(input.reason)) return { ok: false, error: 'Pick why it is late: on the client side or ours.' };
  const reason = input.reason;
  const note = typeof input.note === 'string' ? input.note.trim() : '';
  if (note.length > DELAY_NOTE_MAX) return { ok: false, error: `Keep the note under ${DELAY_NOTE_MAX} characters.` };
  const stage = await prisma.homeProjectStage.findFirst({
    where: { projectId, kind: 'DESIGN' },
    select: { items: { orderBy: { sortOrder: 'asc' }, select: { id: true, label: true, plannedOn: true, doneAt: true, inScope: true } } },
  });
  if (!stage) return { ok: false, error: GONE };
  const steps = stage.items.filter((i) => i.inScope || i.id === stepId).map((i) => ({ id: i.id, plannedOn: i.plannedOn ? dayFromDb(i.plannedOn) : null, done: i.doneAt !== null }));
  const plan = planStepMove(steps, stepId, typeof input.to === 'string' ? input.to : '');
  if (!plan.ok) return plan;
  const moved = plan.moves[0]!;
  const actor: ProjectActor = { type: 'STUDIO', id: check.member.userId };
  await prisma.$transaction(async (tx) => {
    for (const m of plan.moves) await tx.homeChecklistItem.update({ where: { id: m.id }, data: { plannedOn: dayToDb(m.to) } });
    await tx.homeStepDelay.create({
      data: { projectId, stepId, fromDate: dayToDb(moved.from), toDate: dayToDb(moved.to), side: sideOfReason(reason), reason, note: note || null, byId: check.member.userId, at: now },
    });
    await recordEvent(tx, { projectId, type: 'design.step_moved', actor, refId: stepId, payload: { days: plan.days, steps: plan.moves.length, side: sideOfReason(reason) }, at: now });
  });
  const label = stage.items.find((i) => i.id === stepId)?.label ?? 'The step';
  const later = plan.moves.length - 1;
  return { ok: true, message: `${label} moved ${Math.abs(plan.days)} day${Math.abs(plan.days) === 1 ? '' : 's'} ${plan.days > 0 ? 'later' : 'earlier'}${later ? `, with the ${later} open step${later === 1 ? '' : 's'} after it` : ''}. The client sees the new day and the reason, never your note.` };
}

/** A step's who, file-needed and payment gate (owner, PM). */
export async function editDesignStep(projectId: string, stepId: string, input: { responsible: unknown; needsDocument: unknown; gatePayment: unknown }): Promise<DesignResult> {
  const check = await memberOnProject(projectId, 'plan.edit');
  if (!check.ok) return check;
  const p = await prisma.homeProject.findUnique({
    where: { id: projectId },
    select: { paymentPhases: true, stages: { where: { kind: 'DESIGN' }, take: 1, select: { items: { where: { id: stepId }, select: { id: true, label: true } } } } },
  });
  const step = p?.stages[0]?.items[0];
  if (!p || !step) return { ok: false, error: GONE };
  if (input.responsible !== null && input.responsible !== '' && !isResponsible(input.responsible)) return { ok: false, error: 'Pick who does this step.' };
  const payments = readSignedStages(p.paymentPhases) ?? [];
  const gate = input.gatePayment === null || input.gatePayment === '' || input.gatePayment === undefined ? null : Number(input.gatePayment);
  if (gate !== null && (!Number.isInteger(gate) || gate < 0 || gate >= payments.length)) return { ok: false, error: 'Pick a payment from this project, or none.' };
  const actor: ProjectActor = { type: 'STUDIO', id: check.member.userId };
  await prisma.$transaction(async (tx) => {
    await tx.homeChecklistItem.update({
      where: { id: step.id },
      data: { responsible: isResponsible(input.responsible) ? input.responsible : null, needsDocument: input.needsDocument === true || input.needsDocument === 'on', gatePayment: gate },
    });
    await recordEvent(tx, { projectId, type: 'design.step_edited', actor, refId: step.id, payload: { gate } });
  });
  return { ok: true, message: `${step.label} saved.` };
}

/**
 * For a project started before Phase 2 (its DESIGN stage has the one
 * "Final design and drawings signed off" step): replace the stage's steps
 * with the studio's design steps, inside the stage's dates, gates matched to
 * its payments. Refused once any design step is ticked.
 */
export async function applyDesignSteps(projectId: string, now = new Date()): Promise<DesignResult> {
  const check = await memberOnProject(projectId, 'plan.edit');
  if (!check.ok) return check;
  const p = await prisma.homeProject.findUnique({
    where: { id: projectId },
    select: {
      paymentPhases: true,
      introduction: { select: { studio: { select: { designTemplate: true } }, brief: { select: { propertyType: true } } } },
      stages: { where: { kind: 'DESIGN' }, take: 1, select: { id: true, plannedStart: true, plannedEnd: true, items: { select: { id: true, doneAt: true, responsible: true } } } },
    },
  });
  const stage = p?.stages[0];
  if (!p || !stage) return { ok: false, error: 'This project has no design stage.' };
  const refusal = applyRefusal(stage.items);
  if (refusal) return { ok: false, error: refusal };
  const steps = designStepsFor(stage.plannedStart, readDesignTemplate(p.introduction.studio.designTemplate), readSignedStages(p.paymentPhases) ?? [], bhkOf(p.introduction.brief.propertyType));
  const actor: ProjectActor = { type: 'STUDIO', id: check.member.userId };
  try {
    await prisma.$transaction(async (tx) => {
      // Again inside the transaction: a second press, or another tab, may have applied them (or ticked one) since.
      const current = await tx.homeChecklistItem.findMany({ where: { stageId: stage.id }, select: { doneAt: true, responsible: true } });
      const again = applyRefusal(current);
      if (again) throw new Refused(again);
      await tx.homeChecklistItem.deleteMany({ where: { stageId: stage.id, doneAt: null } });
      for (const st of steps) await tx.homeChecklistItem.create({ data: designItemData(stage.id, st), select: { id: true } });
      await recordEvent(tx, { projectId, type: 'design.steps_applied', actor, refId: stage.id, payload: { steps: steps.length } });
      await settleStageAfterTicks(tx, projectId, stage.id, actor, now);
    });
  } catch (e) {
    if (e instanceof Refused) return { ok: false, error: e.message };
    throw e;
  }
  return { ok: true, message: `The design now has your studio's ${steps.length} steps, planned inside its dates.` };
}

// ── Mood board ────────────────────────────────────────────────

/** Shares the mood board with the client (again, with a new message, if asked): they get a notice and a card in the app. */
export async function shareMoodBoard(projectId: string, note: unknown, now = new Date()): Promise<DesignResult> {
  const check = await memberOnProject(projectId, 'design.work');
  if (!check.ok) return check;
  const text = typeof note === 'string' ? note.replace(/\s+/g, ' ').trim() : '';
  if (text.length > MOOD_NOTE_MAX) return { ok: false, error: `Keep the message under ${MOOD_NOTE_MAX} characters.` };
  const p = await projectFacts(projectId);
  if (!p) return { ok: false, error: 'That project is not one of yours.' };
  const actor: ProjectActor = { type: 'STUDIO', id: check.member.userId };
  await prisma.$transaction(async (tx) => {
    await tx.homeProject.update({ where: { id: projectId }, data: { moodBoardSharedAt: now, moodBoardNote: text || null } });
    await recordEvent(tx, { projectId, type: 'moodboard.shared', actor });
  });
  tell(p.introduction.brief.userId, p.introduction.studio.tradeName, 'Your mood board is ready: pick what you like for each room.');
  return { ok: true, message: 'Shared. The client has a notice and a "Fill your mood board" card in the app.' };
}

/**
 * Adds pieces to a room of the client's mood board, for them to see and keep
 * or remove. A room they never opened starts from its usual suggestions, so
 * nothing they would have seen goes missing.
 */
export async function addMoodBoardPieces(projectId: string, roomKey: unknown, slugs: unknown): Promise<DesignResult> {
  const check = await memberOnProject(projectId, 'design.work');
  if (!check.ok) return check;
  if (typeof roomKey !== 'string' || !(ROOM_KEYS as readonly string[]).includes(roomKey)) return { ok: false, error: 'Pick a room.' };
  const add = Array.isArray(slugs) ? [...new Set(slugs.filter((s): s is string => typeof s === 'string' && elementBySlug(s) !== null))] : [];
  if (add.length === 0) return { ok: false, error: 'Pick at least one piece.' };
  const p = await prisma.homeProject.findUnique({
    where: { id: projectId },
    select: { introduction: { select: { brief: { select: { id: true, styleLikes: true, styleDislikes: true, tier: true } } } } },
  });
  if (!p) return { ok: false, error: 'That project is not one of yours.' };
  const b = p.introduction.brief;
  const existing = await prisma.prepRoom.findUnique({ where: { briefId_roomKey: { briefId: b.id, roomKey } }, select: { items: true } });
  const base = existing ? existing.items : seedBoard(roomKey as RoomKey, b.styleLikes as StyleTag[], b.styleDislikes as StyleTag[], (b.tier as BudgetTier | null) ?? null);
  const items = [...new Set([...base, ...add])].slice(0, MOOD_ITEMS_MAX);
  const actor: ProjectActor = { type: 'STUDIO', id: check.member.userId };
  await prisma.$transaction(async (tx) => {
    await tx.prepRoom.upsert({ where: { briefId_roomKey: { briefId: b.id, roomKey } }, create: { briefId: b.id, roomKey, items }, update: { items } });
    await recordEvent(tx, { projectId, type: 'moodboard.edited', actor, payload: { room: roomKey, added: add.length } });
  });
  return { ok: true, message: `Added ${add.length} piece${add.length === 1 ? '' : 's'}. The client sees them on their board.` };
}

// ── Site visits and measurements ─────────────────────────────

const whenWords = (at: Date) =>
  at.toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

/** Books a site visit: the client sees the day, time and what it is for, and gets a notice. The note stays inside. */
export async function bookVisit(projectId: string, input: { day: unknown; time: unknown; purpose: unknown; note?: unknown }, now = new Date()): Promise<DesignResult> {
  const check = await memberOnProject(projectId, 'design.work');
  if (!check.ok) return check;
  const v = checkVisit(input, istDay(now));
  if (!v.ok) return v;
  const note = typeof input.note === 'string' ? input.note.trim() : '';
  if (note.length > VISIT_NOTE_MAX) return { ok: false, error: `Keep the note under ${VISIT_NOTE_MAX} characters.` };
  const p = await projectFacts(projectId);
  if (!p) return { ok: false, error: 'That project is not one of yours.' };
  const at = istTime(v.day, v.time);
  const actor: ProjectActor = { type: 'STUDIO', id: check.member.userId };
  const made = await prisma.$transaction(async (tx) => {
    const row = await tx.homeSiteVisit.create({ data: { projectId, at, purpose: v.purpose, note: note || null, byId: check.member.userId }, select: { id: true } });
    await recordEvent(tx, { projectId, type: 'visit.booked', actor, refId: row.id });
    return row;
  });
  tell(p.introduction.brief.userId, p.introduction.studio.tradeName, `Site visit: ${v.purpose}, ${whenWords(at)}`);
  return { ok: true, id: made.id, message: `Booked for ${whenWords(at)}. The client sees it in the app.` };
}

/** Marks a visit done or cancelled (or booked again). */
export async function setVisitStatus(projectId: string, visitId: string, status: unknown): Promise<DesignResult> {
  const check = await memberOnProject(projectId, 'design.work');
  if (!check.ok) return check;
  if (status !== 'BOOKED' && status !== 'DONE' && status !== 'CANCELLED') return { ok: false, error: 'Pick done or cancelled.' };
  const visit = await prisma.homeSiteVisit.findFirst({ where: { id: visitId, projectId }, select: { id: true, status: true } });
  if (!visit) return { ok: false, error: 'That visit is not on this project.' };
  if (visit.status === status) return { ok: true, message: 'No change.' };
  const actor: ProjectActor = { type: 'STUDIO', id: check.member.userId };
  await prisma.$transaction(async (tx) => {
    await tx.homeSiteVisit.update({ where: { id: visit.id }, data: { status } });
    await recordEvent(tx, { projectId, type: 'visit.updated', actor, refId: visit.id, payload: { status } });
  });
  return { ok: true, message: status === 'DONE' ? 'Marked done.' : status === 'CANCELLED' ? 'Cancelled. The client no longer sees it.' : 'Booked again.' };
}

/** Saves the rooms' measurements: the list as typed replaces the one before. */
export async function saveMeasurements(projectId: string, rows: readonly MeasureInput[]): Promise<DesignResult> {
  const check = await memberOnProject(projectId, 'design.work');
  if (!check.ok) return check;
  const c = checkMeasurements(rows);
  if (!c.ok) return c;
  const actor: ProjectActor = { type: 'STUDIO', id: check.member.userId };
  await prisma.$transaction(async (tx) => {
    await tx.homeMeasurement.deleteMany({ where: { projectId } });
    if (c.rows.length) {
      await tx.homeMeasurement.createMany({ data: c.rows.map((r, i) => ({ projectId, ...r, sortOrder: i, updatedById: check.member.userId })) });
    }
    await recordEvent(tx, { projectId, type: 'measurements.saved', actor, payload: { rooms: c.rows.length } });
  });
  return { ok: true, message: `${c.rows.length} room${c.rows.length === 1 ? '' : 's'} saved. The client sees the sizes.` };
}

// ── Drawings ──────────────────────────────────────────────────

/**
 * Uploads a drawing for a room (2D layout, furniture layout, 3D render,
 * working drawing, site photo), new or as the next version of one already
 * there. Shared at once or kept as a draft. Sharing one the client approves
 * sends them one notice; nothing chases them after that.
 */
export async function uploadDrawing(
  projectId: string,
  input: { kind: unknown; room?: unknown; title?: unknown; supersedesId?: unknown; share?: unknown },
  file: File | null,
  now = new Date(),
): Promise<DesignResult> {
  const check = await memberOnProject(projectId, 'design.work');
  if (!check.ok) return check;
  const supersedesId = typeof input.supersedesId === 'string' && input.supersedesId ? input.supersedesId.slice(0, 64) : null;
  let previous: { designKind: string | null; room: string | null; title: string } | null = null;
  let version = 1;
  if (supersedesId) {
    const all = await prisma.homeDocument.findMany({ where: { projectId }, select: { id: true, version: true, supersedesId: true, sharedAt: true, deletedAt: true, designKind: true, room: true, title: true } });
    const doc = all.find((d) => d.id === supersedesId);
    if (!doc || !isDesignKind(doc.designKind)) return { ok: false, error: 'That drawing is not on this project.' };
    const allowed = canSupersede(doc, all);
    if (!allowed.ok) return allowed;
    version = allowed.version;
    previous = doc;
  }
  const kind = previous?.designKind ?? input.kind;
  if (!isDesignKind(kind)) return { ok: false, error: 'Pick what it is: 2D layout, furniture layout, 3D render…' };
  const room = (typeof input.room === 'string' ? input.room.replace(/\s+/g, ' ').trim() : '') || previous?.room || '';
  if (room.length > ROOM_MAX) return { ok: false, error: `Keep the room name under ${ROOM_MAX} characters.` };
  const typed = typeof input.title === 'string' ? input.title.replace(/\s+/g, ' ').trim().slice(0, TITLE_MAX) : '';
  const title = typed || previous?.title || [DESIGN_KINDS[kind], room].filter(Boolean).join(', ');
  if (!file || file.size === 0) return { ok: false, error: 'Choose the file.' };
  const stored = await storeProjectDoc(projectId, file);
  if (!stored.ok) return stored;
  const share = input.share === true || input.share === 'true' || input.share === 'on';
  const p = await projectFacts(projectId);
  if (!p) return { ok: false, error: 'That project is not one of yours.' };
  const actor: ProjectActor = { type: 'STUDIO', id: check.member.userId };
  const doc = await prisma.$transaction(async (tx) => {
    const row = await tx.homeDocument.create({
      data: {
        projectId,
        kind: kind === 'SITE_PHOTO' ? 'OTHER' : 'DRAWINGS',
        title,
        storageKey: stored.path,
        originalName: file.name.slice(0, 200),
        contentType: file.type,
        bytes: file.size,
        uploadedById: check.member.userId,
        byStudio: true,
        sharedAt: share ? now : null,
        version,
        supersedesId,
        designKind: kind,
        room: room || null,
      },
      select: { id: true },
    });
    await recordEvent(tx, {
      projectId,
      type: supersedesId ? 'document.superseded' : 'document.filed',
      actor,
      refId: row.id,
      payload: { kind: 'DRAWINGS', version, shared: share, ...(supersedesId ? { supersedes: supersedesId } : {}) },
    });
    if (share) {
      await recordEvent(tx, { projectId, type: 'document.shared', actor, refId: row.id, payload: { version } });
      await recordEvent(tx, { projectId, type: 'design.shared', actor, refId: row.id, payload: { version, approval: asksApproval(kind) } });
    }
    return row;
  });
  if (share) tell(p.introduction.brief.userId, p.introduction.studio.tradeName, asksApproval(kind) ? `${title}${version > 1 ? ` (version ${version})` : ''}: approve it, or say what to change.` : title);
  return { ok: true, id: doc.id, message: share ? (asksApproval(kind) ? 'Shared for approval. The client has one notice; nothing chases them after that.' : 'Shared with the client.') : 'Saved as a draft. Only your team sees it.' };
}

/** Shares a draft drawing with the client. */
export async function shareDrawing(projectId: string, documentId: string, now = new Date()): Promise<DesignResult> {
  const check = await memberOnProject(projectId, 'design.work');
  if (!check.ok) return check;
  const doc = await prisma.homeDocument.findFirst({ where: { id: documentId, projectId, deletedAt: null, designKind: { not: null } }, select: { id: true, title: true, version: true, sharedAt: true, designKind: true } });
  if (!doc) return { ok: false, error: 'That drawing is not on this project.' };
  if (doc.sharedAt) return { ok: true, message: 'Already shared.' };
  const p = await projectFacts(projectId);
  if (!p) return { ok: false, error: 'That project is not one of yours.' };
  const actor: ProjectActor = { type: 'STUDIO', id: check.member.userId };
  const shared = await prisma.$transaction(async (tx) => {
    const { count } = await tx.homeDocument.updateMany({ where: { id: doc.id, sharedAt: null }, data: { sharedAt: now } });
    if (count === 0) return false;
    await recordEvent(tx, { projectId, type: 'document.shared', actor, refId: doc.id, payload: { version: doc.version } });
    await recordEvent(tx, { projectId, type: 'design.shared', actor, refId: doc.id, payload: { version: doc.version, approval: asksApproval(doc.designKind) } });
    return true;
  });
  if (shared) tell(p.introduction.brief.userId, p.introduction.studio.tradeName, asksApproval(doc.designKind) ? `${doc.title}: approve it, or say what to change.` : doc.title);
  return { ok: true, message: 'Shared with the client.' };
}

/**
 * The client approves a drawing or asks for changes with a comment — the
 * owner of the brief only (family see it, the owner decides). A new answer
 * is a new row; the newest on the newest version is the drawing's state.
 */
export async function answerDrawing(userId: string, documentId: string, verdict: unknown, comment: unknown, now = new Date()): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const doc = await prisma.homeDocument.findUnique({
    where: { id: documentId.slice(0, 64) },
    select: {
      id: true,
      projectId: true,
      designKind: true,
      sharedAt: true,
      deletedAt: true,
      // Only a newer version the client can see blocks an answer: a draft v2 is the studio's, not theirs.
      supersededBy: { where: { deletedAt: null, sharedAt: { not: null } }, select: { id: true } },
      project: { select: { cancelledAt: true, introduction: { select: { brief: { select: { userId: true } } } } } },
    },
  });
  if (!doc || doc.project.cancelledAt || doc.project.introduction.brief.userId !== userId) return { ok: false, error: 'That drawing is not on your project.' };
  const ok = checkAnswer(doc, doc.supersededBy.length > 0, verdict, comment);
  if (!ok.ok) return ok;
  const row = await prisma.$transaction(async (tx) => {
    const r = await tx.homeDesignReview.create({ data: { projectId: doc.projectId, documentId: doc.id, verdict: ok.verdict, comment: ok.comment, byUserId: userId, at: now }, select: { id: true } });
    await recordEvent(tx, { projectId: doc.projectId, type: 'design.answered', actor: { type: 'CUSTOMER', id: userId }, refId: doc.id, payload: { verdict: ok.verdict }, at: now });
    // The client's approval ticks their approval step (DESIGN-PROCESS-PLAN.md Decision 4).
    const approves = ok.verdict === 'APPROVED' ? approvalKindOfDrawing(doc.designKind) : null;
    if (approves) await tickApprovalStep(tx, doc.projectId, approves, userId, now);
    return r;
  });
  return { ok: true, id: row.id };
}

// ── Design final ──────────────────────────────────────────────

async function designFinalOf(projectId: string, studioId: string) {
  const p = await prisma.homeProject.findUnique({ where: { id: projectId }, select: { signedQuoteId: true, designFinalQuoteId: true, designClosedAt: true } });
  if (!p?.signedQuoteId) return { p, df: null };
  const df = await prisma.studioQuote.findFirst({
    where: p.designFinalQuoteId ? { id: p.designFinalQuoteId, studioId } : { studioId, basedOnId: p.signedQuoteId, stage: 'DESIGN' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, number: true, status: true },
  });
  return { p, df };
}

/**
 * Makes the Design Final from the signed quotation — the existing copy
 * ("2026-004-D", studio-quote/quotes.ts `copyQuote`), called, never changed
 * here — or opens the one that exists.
 */
export async function makeDesignFinal(projectId: string): Promise<DesignResult> {
  const check = await memberOnProject(projectId, 'design.assign');
  if (!check.ok) return check;
  const { p, df } = await designFinalOf(projectId, check.member.studioId);
  if (!p?.signedQuoteId) return { ok: false, error: 'This project was not started from a quotation, so there is no sales final to copy.' };
  if (df) return { ok: true, id: df.id, message: `The Design Final is ${df.number}.` };
  const made = await copyQuote(p.signedQuoteId, { kind: 'design-final' });
  if (!made.ok) return made;
  return { ok: true, id: made.id, message: 'Design Final made. Change what the design changed, then send it to the client.' };
}

/**
 * Closes the design: records the Design Final and keeps a frozen "what
 * changed against the sales final" — the existing comparison — for the
 * client. The Design Final must have been sent (it is what the work is
 * built against). Ticking the design steps stays the team's job.
 */
export async function closeDesign(projectId: string, now = new Date()): Promise<DesignResult> {
  // Design sign-off (owner, 13 Oct 2026): owner, and the PM or designer on the project.
  const check = await memberOnProject(projectId, 'design.close');
  if (!check.ok) return check;
  const { p, df } = await designFinalOf(projectId, check.member.studioId);
  if (!p) return { ok: false, error: 'That project is not one of yours.' };
  if (p.designClosedAt) return { ok: true, message: 'Design is closed already.' };
  if (!df) return { ok: false, error: 'Make the Design Final first.' };
  if (df.status === 'DRAFT') return { ok: false, error: `Send ${df.number} to the client first (mark it sent), then close the design.` };
  // design.close was checked on this project above; read the two quotations in the studio (a designer writes none).
  const cmp = await quotesToCompareInStudio(df.id, check.member.studioId);
  if (!cmp) return { ok: false, error: 'We could not read the two quotations to compare. Open the Design Final and try again.' };
  const changes = compareToIssued(
    cmp.base.lines.map((l) => ({ room: l.room, product: l.product, amountPaise: l.amountPaise })),
    cmp.current.lines.map((l) => ({ room: l.room, product: l.product, amountPaise: l.amountPaise })),
  );
  const summary = {
    salesTotalPaise: totalsFor(cmp.base).totalPaise,
    designTotalPaise: totalsFor(cmp.current).totalPaise,
    lines: changes.changes
      .filter((c) => c.kind !== 'UNCHANGED')
      .slice(0, 200)
      .map((c) => ({ kind: c.kind, room: c.room, product: c.product, wasPaise: c.wasPaise, nowPaise: c.nowPaise })),
  };
  const facts = await projectFacts(projectId);
  const actor: ProjectActor = { type: 'STUDIO', id: check.member.userId };
  await prisma.$transaction(async (tx) => {
    await tx.homeProject.update({
      where: { id: projectId },
      data: { designClosedAt: now, designFinalQuoteId: df.id, designChanges: summary as unknown as Prisma.InputJsonValue },
    });
    await recordEvent(tx, { projectId, type: 'design.closed', actor, refId: df.id, payload: { lines: summary.lines.length } });
    // The project lifecycle: design sign-off moves an older plan (no pre-execution steps) to execution. A plan with the
    // design process moves on its own ticks instead: design done, then pre-execution done (DESIGN-PROCESS-PLAN.md Decision 10).
    const pre = await tx.homeChecklistItem.count({ where: { stage: { projectId, kind: 'DESIGN' }, room: PRE_EXECUTION_GROUP } });
    if (pre === 0) await applyPhaseEvent(tx, projectId, { kind: 'design.signed_off' }, actor, now);
  });
  if (facts) tell(facts.introduction.brief.userId, facts.introduction.studio.tradeName, 'Your design is final. See what changed against your first quotation.');
  return { ok: true, message: `Design signed off on ${df.number}. The client sees what changed against the sales final.` };
}

// ── The studio's design steps (Settings) ──────────────────────

/** Saves the studio's design steps (owner). New projects use them; running ones keep theirs. */
export async function saveDesignTemplate(raw: unknown): Promise<DesignResult> {
  const member = await currentMember();
  if (!member || !can(member, 'design.template')) return { ok: false, error: 'Only the studio owner sets the design steps.' };
  const c = checkDesignTemplate(raw);
  if (!c.ok) return c;
  await prisma.studio.update({ where: { id: member.studioId }, data: { designTemplate: c.steps as unknown as Prisma.InputJsonValue } });
  return { ok: true, message: `Saved ${c.steps.length} design steps. New projects start with them; running projects keep their own.` };
}

/** Back to Hauspire's steps (owner). */
export async function resetDesignTemplate(): Promise<DesignResult> {
  const member = await currentMember();
  if (!member || !can(member, 'design.template')) return { ok: false, error: 'Only the studio owner sets the design steps.' };
  await prisma.studio.update({ where: { id: member.studioId }, data: { designTemplate: Prisma.DbNull } });
  return { ok: true, message: 'Back to the standard design steps.' };
}

/** The studio's design steps, for the Settings page (owner). */
export async function myDesignTemplate() {
  const member = await currentMember();
  if (!member || !can(member, 'design.template')) return null;
  const s = await prisma.studio.findUnique({ where: { id: member.studioId }, select: { designTemplate: true } });
  return { steps: readDesignTemplate(s?.designTemplate ?? null), custom: Boolean(s?.designTemplate) };
}
