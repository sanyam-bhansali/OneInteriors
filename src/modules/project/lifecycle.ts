/**
 * Applies the project lifecycle (lifecycle-rules.ts) inside the transaction
 * that records the event, so the phase never disagrees with what happened.
 * Every write that can move a phase calls `applyPhaseEvent` with its own
 * transaction client: design sign-off (studio-design/design-flow.ts
 * `closeDesign`), a tick or untick in the Handover stage (stage-settle.ts
 * `settleStageAfterTicks`, which every tick path goes through), the closure
 * fixed (closure.ts) and the client's handover sign-off (handover.ts).
 */

import type { Prisma } from '@prisma/client';
import { recordEvent, type ProjectActor } from './events';
import { isPhase, movePhase, provisionalStepOf, readWarrantyMonths, warrantyEndFrom, type LifecycleEvent, type Move } from './lifecycle-rules';
import { dayToDb } from './working-days';

type Db = Prisma.TransactionClient;

/** Moves the project's phase for this event (or leaves it), with the timestamps and a `phase.changed` event. */
export async function applyPhaseEvent(db: Db, projectId: string, event: LifecycleEvent, actor: ProjectActor, now: Date): Promise<Move> {
  const p = await db.homeProject.findUnique({
    where: { id: projectId },
    select: { phase: true, introduction: { select: { studio: { select: { warrantyMonths: true } } } } },
  });
  if (!p || !isPhase(p.phase)) return { ok: false, error: 'That project is gone.' };
  const m = movePhase(p.phase, event);
  if (!m.ok || !m.changed) return m;
  const data: Prisma.HomeProjectUpdateInput = { phase: m.phase, phaseAt: now };
  if (event.kind === 'handover.provisional') data.provisionalHandoverAt = now;
  if (event.kind === 'handover.provisional_undone') data.provisionalHandoverAt = null;
  if (event.kind === 'closure.fixed') data.closedOutAt = now;
  if (event.kind === 'handover.signed') {
    data.handoverSignedAt = now;
    data.handoverSignedById = actor.type === 'CUSTOMER' ? actor.id : null;
    data.warrantyEndsOn = dayToDb(warrantyEndFrom(now, readWarrantyMonths(p.introduction.studio.warrantyMonths)));
  }
  await db.homeProject.update({ where: { id: projectId }, data });
  await recordEvent(db, { projectId, type: 'phase.changed', actor, at: now, payload: { from: p.phase, to: m.phase } });
  return m;
}

/**
 * After any tick, untick, scope change or removal in the Handover stage:
 * the provisional handover step ticked moves the project to the closure;
 * unticked (an owner/PM correction) before the closure is fixed moves it back.
 */
export async function syncProvisionalHandover(db: Db, projectId: string, stageId: string, actor: ProjectActor, now: Date): Promise<void> {
  const items = await db.homeChecklistItem.findMany({
    where: { stageId },
    select: { id: true, label: true, inScope: true, sortOrder: true, doneAt: true },
  });
  const step = provisionalStepOf(items);
  if (!step) return;
  await applyPhaseEvent(db, projectId, { kind: step.doneAt ? 'handover.provisional' : 'handover.provisional_undone' }, actor, now);
}
