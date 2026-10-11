'use server';

import { revalidatePath } from 'next/cache';
import {
  addStep,
  markStageDone,
  moveDate,
  removeStep,
  renameStage,
  renameStep,
  reweightStep,
  scopeStep,
  untickStep,
  type PlanEditResult,
} from '@/modules/project/plan-edit';
import { parsePercent } from '@/modules/project/step-rules';

/**
 * The Plan tab's writes (studio workspace Phase 3 and the step tracker).
 * Every check — who may, on which project, with what reason — is in the
 * module (modules/project/plan-edit.ts); these only clip input and refresh
 * the page. Ticking a step is not here: it is a site post with its photo
 * (/api/studio/site/post), sent from the browser like site mode's.
 */

const id = (v: unknown) => String(v ?? '').slice(0, 64);

function done(projectId: string, r: PlanEditResult): PlanEditResult {
  if (r.ok) revalidatePath(`/studio/projects/${projectId}`);
  return r;
}

export async function moveDateAction(input: {
  projectId: string;
  stageId: string;
  field: 'PLANNED_START' | 'PLANNED_END';
  to: string;
  reason: string;
  decisionId: string | null;
  note: string;
  shiftLater: boolean;
}): Promise<PlanEditResult> {
  const projectId = id(input.projectId);
  return done(
    projectId,
    await moveDate({
      projectId,
      stageId: id(input.stageId),
      field: input.field === 'PLANNED_START' ? 'PLANNED_START' : 'PLANNED_END',
      to: String(input.to ?? '').slice(0, 10),
      reason: String(input.reason ?? ''),
      decisionId: input.decisionId ? id(input.decisionId) : null,
      note: String(input.note ?? '').slice(0, 2000),
      shiftLater: input.shiftLater === true,
    }),
  );
}

export async function untickStepAction(projectId: string, stepId: string): Promise<PlanEditResult> {
  const p = id(projectId);
  return done(p, await untickStep(p, id(stepId)));
}

export async function renameStepAction(projectId: string, stepId: string, name: string): Promise<PlanEditResult> {
  const p = id(projectId);
  return done(p, await renameStep(p, id(stepId), String(name ?? '').slice(0, 400)));
}

/** `percent` as typed: "4", "0.5". */
export async function reweightStepAction(projectId: string, stepId: string, percent: string): Promise<PlanEditResult> {
  const p = id(projectId);
  const bp = parsePercent(String(percent ?? '').slice(0, 12));
  if (bp === null) return { ok: false, error: 'Type a percentage from 0 to 100, like 4 or 0.5.' };
  return done(p, await reweightStep(p, id(stepId), bp));
}

export async function scopeStepAction(projectId: string, stepId: string, inScope: boolean): Promise<PlanEditResult> {
  const p = id(projectId);
  return done(p, await scopeStep(p, id(stepId), inScope === true));
}

export async function addStepAction(projectId: string, input: { stageId: string; group: string; label: string; percent: string }): Promise<PlanEditResult> {
  const p = id(projectId);
  const bp = parsePercent(String(input.percent ?? '').slice(0, 12));
  if (bp === null) return { ok: false, error: 'Type a percentage from 0 to 100, like 4 or 0.5.' };
  return done(p, await addStep(p, { stageId: id(input.stageId), group: String(input.group ?? '').slice(0, 200), label: String(input.label ?? '').slice(0, 400), weightBp: bp }));
}

export async function removeStepAction(projectId: string, stepId: string): Promise<PlanEditResult> {
  const p = id(projectId);
  return done(p, await removeStep(p, id(stepId)));
}

export async function markStageDoneAction(projectId: string, stageId: string, isDone: boolean): Promise<PlanEditResult> {
  const p = id(projectId);
  return done(p, await markStageDone(p, id(stageId), isDone === true));
}

export async function renameStageAction(projectId: string, stageId: string, name: string): Promise<PlanEditResult> {
  const p = id(projectId);
  return done(p, await renameStage(p, id(stageId), String(name ?? '').slice(0, 200)));
}
