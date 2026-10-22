/**
 * Writing a pipeline preset plan (`pipeline-preset.ts planPreset`) into a
 * studio, inside the caller's transaction. One place for it, so Settings →
 * Pipeline's "Use the Hauspire pipeline" (stages.ts) and the go-live script
 * that sets Hauspire's production studio up (scripts/apply-hauspire-pipeline.ts,
 * owner, 22 Oct 2026) can never do it two different ways.
 *
 * No `server-only`: the script runs outside Next with its own Prisma client.
 */

import type { Prisma } from '@prisma/client';
import type { PresetPlan } from './pipeline-preset';

export async function writePresetPlan(tx: Prisma.TransactionClient, studioId: string, plan: PresetPlan): Promise<void> {
  /* Renames go through a temporary name first, so two columns swapping
     names never trip the one-name-per-studio rule mid-way. */
  for (const r of plan.renames) await tx.studioStage.updateMany({ where: { id: r.id, studioId }, data: { name: `__preset_${r.id}` } });
  for (const r of plan.renames) await tx.studioStage.updateMany({ where: { id: r.id, studioId }, data: { name: r.to } });
  const made = new Map<string, string>();
  for (const c of plan.creates) {
    const row = await tx.studioStage.create({ data: { studioId, name: c.name, kind: c.kind, colour: c.colour, sortOrder: 10_000 + made.size, isIntake: false, isCallStep: c.isCallStep === true }, select: { id: true } });
    made.set(`new:${c.name}`, row.id);
  }
  /* Junk (owner, 21 Oct 2026) becomes a lost column: its leads take the
     preset's reason where they have none, and lose their follow-up. */
  for (const k of plan.kindChanges) {
    await tx.studioStage.updateMany({ where: { id: k.id, studioId }, data: { kind: k.to } });
    if (k.to === 'LOST') {
      await tx.studioClient.updateMany({ where: { studioId, stageId: k.id, lostReason: null }, data: { lostReason: k.lostReason ?? 'OTHER', lostNote: k.name } });
      await tx.studioClient.updateMany({ where: { studioId, stageId: k.id }, data: { nextAction: null, nextActionOn: null } });
    }
  }
  const idOf = (slot: string) => made.get(slot) ?? slot;
  /* Calling 1–4 are the calling steps (owner, 21 Oct 2026). Only set,
     never cleared: a column of yours you marked yourself stays marked. */
  const steps = plan.callSteps.map(idOf);
  if (steps.length) await tx.studioStage.updateMany({ where: { studioId, id: { in: steps }, kind: 'OPEN' }, data: { isCallStep: true } });
  for (const [i, slot] of plan.order.entries()) await tx.studioStage.updateMany({ where: { id: idOf(slot), studioId }, data: { sortOrder: i } });
  const intake = idOf(plan.intake);
  await tx.studioStage.updateMany({ where: { studioId, id: { not: intake } }, data: { isIntake: false } });
  await tx.studioStage.updateMany({ where: { studioId, id: intake }, data: { isIntake: true, kind: 'OPEN' } });
}
