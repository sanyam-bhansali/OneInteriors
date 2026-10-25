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
import { settleStageAfterTicks } from '@/modules/project/stage-settle';
import { dayFromDb, dayToDb, istDay } from '@/modules/project/working-days';
import { designPhaseAfterTicks, lateTickCheck } from './rules';
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
 * The client approved in the app: the first open client step that this kind
 * of approval ticks is ticked, by the client, with a line saying so. Late,
 * it is the client's delay (filed for the Delays list). Nothing when no such
 * step is open (an older plan, or already ticked by hand).
 */
export async function tickApprovalStep(tx: Prisma.TransactionClient, projectId: string, kind: ApprovalKind, userId: string, now: Date): Promise<boolean> {
  const step = await tx.homeChecklistItem.findFirst({
    where: { stage: { projectId, kind: 'DESIGN' }, approvalKind: kind, doneAt: null, inScope: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, stageId: true, label: true, plannedOn: true, responsible: true },
  });
  if (!step) return false;
  const { count } = await tx.homeChecklistItem.updateMany({
    where: { id: step.id, doneAt: null },
    data: { doneAt: now, doneById: userId, doneSource: 'TICK', doneNote: 'Approved by the client in the app.' },
  });
  if (count !== 1) return false;
  const actor: ProjectActor = { type: 'CUSTOMER', id: userId };
  const planned = step.plannedOn ? dayFromDb(step.plannedOn) : null;
  const late = lateTickCheck({ plannedOn: planned, responsible: 'CLIENT' }, istDay(now), null);
  if (late.ok && late.delay && planned) {
    await tx.homeStepDelay.create({
      data: { projectId, stepId: step.id, fromDate: dayToDb(planned), toDate: dayToDb(istDay(now)), side: 'CLIENT', reason: late.delay.reason, note: null, byId: userId },
    });
  }
  await recordEvent(tx, { projectId, type: 'design.ticked', actor, refId: step.id, at: now, payload: { file: false, approval: kind } });
  await settleStageAfterTicks(tx, projectId, step.stageId, actor, now);
  await settleDesignPhase(tx, projectId, actor, now);
  return true;
}
