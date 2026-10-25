import 'server-only';

/**
 * Design steps count from the payment that opens them (owner and Hauspire's
 * design team, 24 Oct 2026; docs/studio-os/DESIGN-PROCESS-PLAN.md Decision 5).
 * Called after a payment is recorded (project/payments-flow.ts): when the
 * client paid later than the plan assumed, the step the payment opens and
 * every open step after it move later by the same days (rules.ts
 * `planRedateAfterPayment`), and the wait is filed as the client's delay
 * ("Payment pending") on the Delays list. Never earlier; never fails the
 * payment: a failure here is logged and the plan stays as it was.
 */

import { prisma } from '@/lib/prisma';
import { recordEvent, type ProjectActor } from '@/modules/project/events';
import { dayFromDb, dayToDb } from '@/modules/project/working-days';
import { planRedateAfterPayment } from './rules';
import { GATE_SELECT, gateStagesOf } from './store';

export async function redateAfterPayment(projectId: string, paidOn: string, byUserId: string): Promise<void> {
  try {
    const p = await prisma.homeProject.findUnique({
      where: { id: projectId },
      select: {
        ...GATE_SELECT,
        stages: {
          where: { kind: 'DESIGN' },
          take: 1,
          select: { items: { orderBy: { sortOrder: 'asc' }, select: { id: true, plannedOn: true, doneAt: true, inScope: true, gatePayment: true, gapDays: true } } },
        },
      },
    });
    const items = p?.stages[0]?.items ?? [];
    if (!p || items.length === 0) return;
    const plan = planRedateAfterPayment(
      items.map((i) => ({ id: i.id, plannedOn: i.plannedOn ? dayFromDb(i.plannedOn) : null, done: i.doneAt !== null, inScope: i.inScope, gatePayment: i.gatePayment, gapDays: i.gapDays })),
      gateStagesOf(p),
      paidOn,
    );
    if (!plan) return;
    const first = plan.moves[0]!;
    const actor: ProjectActor = { type: 'STUDIO', id: byUserId };
    await prisma.$transaction(async (tx) => {
      for (const m of plan.moves) await tx.homeChecklistItem.update({ where: { id: m.id }, data: { plannedOn: dayToDb(m.to) } });
      await tx.homeStepDelay.create({
        data: { projectId, stepId: plan.stepId, fromDate: dayToDb(first.from), toDate: dayToDb(first.to), side: 'CLIENT', reason: 'PAYMENT_PENDING', note: null, byId: byUserId },
      });
      await recordEvent(tx, { projectId, type: 'design.step_moved', actor, refId: plan.stepId, payload: { days: plan.days, steps: plan.moves.length, reason: 'PAYMENT_PENDING', side: 'CLIENT', after: 'payment' } });
    });
  } catch (error) {
    console.error('[studio-design] redateAfterPayment failed', error);
  }
}
