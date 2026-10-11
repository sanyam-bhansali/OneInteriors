'use server';

import { revalidatePath } from 'next/cache';
import { markStageDone, moveDate, renameStage, tickItem, type PlanEditResult } from '@/modules/project/plan-edit';

/**
 * The Plan tab's writes (studio workspace Phase 3). Every check — who may,
 * on which project, with what reason — is in the module
 * (modules/project/plan-edit.ts); these only clip input and refresh the page.
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

export async function tickItemAction(projectId: string, itemId: string, isDone: boolean): Promise<PlanEditResult> {
  const p = id(projectId);
  return done(p, await tickItem(p, id(itemId), isDone === true));
}

export async function markStageDoneAction(projectId: string, stageId: string, isDone: boolean): Promise<PlanEditResult> {
  const p = id(projectId);
  return done(p, await markStageDone(p, id(stageId), isDone === true));
}

export async function renameStageAction(projectId: string, stageId: string, name: string): Promise<PlanEditResult> {
  const p = id(projectId);
  return done(p, await renameStage(p, id(stageId), String(name ?? '').slice(0, 200)));
}
