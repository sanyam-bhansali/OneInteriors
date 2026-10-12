import 'server-only';

/**
 * Which execution steps of a project are locked by a client payment not yet
 * recorded (Studio OS Phase 3 §7; rules in exec-gates.ts). Read by site mode
 * and the office tick (project/site-log.ts) so a locked step is neither
 * offered nor ticked, with Phase 2's gate (studio-design `gateOf`).
 */

import { prisma } from '@/lib/prisma';
import { readSignedStages } from '@/modules/portal/payments';
import { GATE_SELECT, gateStagesOf } from '@/modules/studio-design/store';
import { execGate } from './exec-gates';
import { readCrewSettings } from './settings';

/** Step id → the payment it waits for, for every open execution step that is locked. Empty when nothing is. */
export async function lockedSteps(projectId: string): Promise<Map<string, string>> {
  const p = await prisma.homeProject.findUnique({
    where: { id: projectId },
    select: {
      ...GATE_SELECT,
      introduction: { select: { studio: { select: { crewSettings: true } } } },
      stages: { where: { kind: { not: 'DESIGN' } }, select: { items: { where: { doneAt: null, inScope: true }, select: { id: true, label: true, gatePayment: true } } } },
    },
  });
  const out = new Map<string, string>();
  if (!p) return out;
  const stages = gateStagesOf(p);
  if (!stages) return out;
  const payments = readSignedStages(p.paymentPhases) ?? [];
  const rules = readCrewSettings(p.introduction.studio.crewSettings).execGates;
  for (const s of p.stages) {
    for (const i of s.items) {
      const g = execGate({ label: i.label, gatePayment: i.gatePayment }, rules, payments, stages);
      if (!g.open) out.set(i.id, g.payment);
    }
  }
  return out;
}
