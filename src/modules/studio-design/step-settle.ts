import 'server-only';

/**
 * What happens by itself after design steps change (owner and Hauspire's
 * design team, 24 Oct 2026; docs/studio-os/DESIGN-PROCESS-PLAN.md): the
 * project's phase after design ticks (Decision 10), and a client's approval
 * step ticked by the client's own answer in the app (Decision 4). Inside the
 * caller's transaction. Kept apart from design-flow.ts so the quotation
 * sign-off (project/signoffs.ts) can call it without importing the design
 * writes.
 */

import type { Prisma } from '@prisma/client';
import { recordEvent, type ProjectActor } from '@/modules/project/events';
import { applyPhaseEvent } from '@/modules/project/lifecycle';
import { settleStageAfterTicks, shiftStepsWithStage } from '@/modules/project/stage-settle';
import type { RuleStage, StageKind } from '@/modules/project/project-rules';
import { dayFromDb, dayToDb, istDay } from '@/modules/project/working-days';
import { designPhaseAfterTicks, lateTickCheck, lateTickPlanMove, lateTickShift, type DelaySideName } from './rules';
import type { ApprovalKind } from './template';

/**
 * After design ticks: the project moves to pre-execution when every design
 * step is done, and to execution when every pre-execution step is done. Never
 * backwards.
 */
export async function settleDesignPhase(tx: Prisma.TransactionClient, projectId: string, actor: ProjectActor, now: Date): Promise<void> {
  const stage = await tx.homeProjectStage.findFirst({ where: { projectId, kind: 'DESIGN' }, select: { items: { select: { room: true, inScope: true, doneAt: true } } } });
  const event = designPhaseAfterTicks((stage?.items ?? []).map((i) => ({ room: i.room, inScope: i.inScope, done: i.doneAt !== null })));
  if (event === 'preexecution.done') {
    // Straight from design too: a project switched in at its last step.
    await applyPhaseEvent(tx, projectId, { kind: 'design.done' }, actor, now);
    await applyPhaseEvent(tx, projectId, { kind: 'preexecution.done' }, actor, now);
  } else if (event === 'design.done') {
    await applyPhaseEvent(tx, projectId, { kind: 'design.done' }, actor, now);
  }
}

/**
 * Has this step been ticked before (and unticked since)? Then the first
 * tick's answer stands (owner, 12 Nov 2026): a re-tick asks nothing and
 * moves nothing again.
 */
export async function tickedBefore(db: Prisma.TransactionClient, projectId: string, stepId: string): Promise<boolean> {
  const e = await db.homeProjectEvent.findFirst({ where: { projectId, type: 'design.ticked', refId: stepId }, select: { id: true } });
  return e !== null;
}

/**
 * A design step was ticked late (owner, 12 Nov 2026): every later open step
 * moves by the days it was late (planned days and gaps kept), and so do the
 * design's end and every later stage of the plan, handover included. The
 * plan's moves are filed as the client's change or our delay, so the
 * studio's counts leave out the client's days. Inside the caller's
 * transaction. The number of steps moved.
 */
export async function shiftAfterLateTick(
  tx: Prisma.TransactionClient,
  input: { projectId: string; stepId: string; label: string; side: DelaySideName; today: string; byId: string; actor: ProjectActor; now: Date },
): Promise<number> {
  const stage = await tx.homeProjectStage.findFirst({
    where: { projectId: input.projectId, kind: 'DESIGN' },
    select: { items: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], select: { id: true, plannedOn: true, doneAt: true } } },
  });
  if (!stage) return 0;
  const steps = stage.items.map((i) => ({ id: i.id, plannedOn: i.plannedOn ? dayFromDb(i.plannedOn) : null, done: i.doneAt !== null && i.id !== input.stepId }));
  const shift = lateTickShift(steps, input.stepId, input.today);
  if (shift.days <= 0) return 0;
  for (const m of shift.moves) await tx.homeChecklistItem.update({ where: { id: m.id }, data: { plannedOn: dayToDb(m.to) } });

  const rows = await tx.homeProjectStage.findMany({
    where: { projectId: input.projectId },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, kind: true, name: true, plannedStart: true, plannedEnd: true, actualEnd: true },
  });
  const stages: RuleStage[] = rows.map((s) => ({ id: s.id, kind: s.kind as StageKind, name: s.name, plannedStart: istDay(s.plannedStart), plannedEnd: istDay(s.plannedEnd), actualEnd: s.actualEnd ? istDay(s.actualEnd) : null }));
  const plan = lateTickPlanMove(stages, shift.days, input.side);
  if (plan) {
    for (const s of plan.stages) {
      await tx.homeProjectStage.update({ where: { id: s.stageId }, data: { plannedStart: dayToDb(s.plannedStart), plannedEnd: dayToDb(s.plannedEnd) } });
      const was = stages.find((x) => x.id === s.stageId)!;
      // The design stage's own steps moved above, by the late days; a later stage's steps move with it.
      if (was.kind !== 'DESIGN') await shiftStepsWithStage(tx, s.stageId, { start: was.plannedStart, end: was.plannedEnd }, { start: s.plannedStart, end: s.plannedEnd });
    }
    const reason = input.side === 'CLIENT' ? 'CUSTOMER_CHANGE' : 'STUDIO';
    const note = `“${input.label}” ticked ${shift.days} day${shift.days === 1 ? '' : 's'} late: ${input.side === 'CLIENT' ? "the client's delay" : 'our delay'}.`;
    let leadId: string | null = null;
    for (const r of plan.rows) {
      const row = await tx.homeProjectDateChange.create({
        data: { projectId: input.projectId, stageId: r.stageId, field: r.field, fromDate: dayToDb(r.from), toDate: dayToDb(r.to), reason, note, byId: input.byId, at: input.now },
        select: { id: true },
      });
      leadId ??= row.id;
    }
    await recordEvent(tx, {
      projectId: input.projectId,
      type: 'date.moved',
      actor: input.actor,
      refId: leadId,
      payload: { stageId: plan.rows[0]!.stageId, field: plan.rows[0]!.field, days: plan.days, rows: plan.rows.length, reason, customer: input.side === 'CLIENT', stepId: input.stepId },
      at: input.now,
    });
  }
  return shift.moves.length;
}

/**
 * Plans made before 1 Nov 2026 carry "Post-validation approval" as a working-
 * drawings approval. Validation drawings tick it; working drawings no longer do.
 */
const OLD_POST_VALIDATION = 'Post-validation approval';
function approvalWhere(kind: ApprovalKind): Prisma.HomeChecklistItemWhereInput {
  if (kind === 'VALIDATION') return { OR: [{ approvalKind: 'VALIDATION' }, { approvalKind: 'WORKING', label: OLD_POST_VALIDATION }] };
  if (kind === 'WORKING') return { approvalKind: 'WORKING', NOT: { label: OLD_POST_VALIDATION } };
  return { approvalKind: kind };
}

/**
 * The client approved in the app: the first open client step that this kind
 * of approval ticks is ticked, by the client, with a line saying so. Late,
 * it is the client's delay (filed for the Delays list). Nothing when no such
 * step is open (an older plan, or already ticked by hand).
 */
export async function tickApprovalStep(tx: Prisma.TransactionClient, projectId: string, kind: ApprovalKind, userId: string, now: Date): Promise<boolean> {
  const step = await tx.homeChecklistItem.findFirst({
    where: { stage: { projectId, kind: 'DESIGN' }, doneAt: null, inScope: true, ...approvalWhere(kind) },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, stageId: true, label: true, plannedOn: true, responsible: true },
  });
  if (!step) return false;
  const again = (await tickedBefore(tx, projectId, step.id)) || (await tx.homeProjectHold.count({ where: { projectId, status: 'ON' } })) > 0;
  const { count } = await tx.homeChecklistItem.updateMany({
    where: { id: step.id, doneAt: null },
    data: { doneAt: now, doneById: userId, doneSource: 'TICK', doneNote: 'Approved by the client in the app.' },
  });
  if (count !== 1) return false;
  const actor: ProjectActor = { type: 'CUSTOMER', id: userId };
  const planned = step.plannedOn ? dayFromDb(step.plannedOn) : null;
  const late = again ? null : lateTickCheck({ plannedOn: planned, responsible: 'CLIENT' }, istDay(now), null);
  let shifted = 0;
  if (late?.ok && late.delay && planned) {
    await tx.homeStepDelay.create({
      data: { projectId, stepId: step.id, fromDate: dayToDb(planned), toDate: dayToDb(istDay(now)), side: 'CLIENT', reason: late.delay.reason, note: null, byId: userId },
    });
    shifted = await shiftAfterLateTick(tx, { projectId, stepId: step.id, label: step.label, side: 'CLIENT', today: istDay(now), byId: userId, actor, now });
  }
  await recordEvent(tx, { projectId, type: 'design.ticked', actor, refId: step.id, at: now, payload: { file: false, approval: kind, ...(late?.ok && late.delay ? { lateDays: late.delay.days, side: 'CLIENT', shifted } : {}) } });
  await settleStageAfterTicks(tx, projectId, step.stageId, actor, now);
  await settleDesignPhase(tx, projectId, actor, now);
  return true;
}
