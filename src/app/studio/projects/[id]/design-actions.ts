'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  addDesignStepBelow,
  addMoodBoardPieces,
  addStepTask,
  applyDesignSteps,
  assignDesigner,
  bookVisit,
  closeDesign,
  editDesignStep,
  makeDesignFinal,
  markDocumentFinal,
  moveDesignStep,
  moveDesignStepOrder,
  saveMeasurements,
  setProjectPriority,
  setStepTask,
  setVisitStatus,
  shareDrawing,
  shareMoodBoard,
  tickDesignStep,
  uploadDrawing,
  type DesignResult,
} from '@/modules/studio-design/design-flow';
import { sendRequirementForm, type FormResult } from '@/modules/project/requirement-form';

/**
 * The Design tab's writes (Studio OS Phase 2). Every check — who may, on
 * which project, what a tick needs — is in the module
 * (modules/studio-design/design-flow.ts); these only clip input and refresh
 * the page.
 */

const id = (v: unknown) => String(v ?? '').slice(0, 64);
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const fileOf = (v: FormDataEntryValue | null): File | null => (v && typeof v !== 'string' && v.size > 0 ? v : null);

function done(projectId: string, r: DesignResult): DesignResult {
  if (r.ok) revalidatePath(`/studio/projects/${projectId}`);
  return r;
}

export async function assignDesignerAction(projectId: string, memberId: string): Promise<DesignResult> {
  return done(id(projectId), await assignDesigner(id(projectId), memberId ? id(memberId) : null));
}

export async function tickDesignStepAction(form: FormData): Promise<DesignResult> {
  const projectId = id(form.get('projectId'));
  return done(
    projectId,
    await tickDesignStep(
      projectId,
      id(form.get('stepId')),
      { note: text(form.get('note'), 600), share: form.get('share'), reason: text(form.get('reason'), 40) || null, reasonNote: text(form.get('reasonNote'), 600) },
      fileOf(form.get('file')),
    ),
  );
}

export async function moveDesignStepAction(input: { projectId: string; stepId: string; to: string; reason: string; note: string }): Promise<DesignResult> {
  const projectId = id(input.projectId);
  return done(projectId, await moveDesignStep(projectId, id(input.stepId), { to: text(input.to, 10), reason: text(input.reason, 40), note: text(input.note, 600) }));
}

export async function editDesignStepAction(input: { projectId: string; stepId: string; responsible: string; needsDocument: boolean; gatePayment: string }): Promise<DesignResult> {
  const projectId = id(input.projectId);
  return done(projectId, await editDesignStep(projectId, id(input.stepId), { responsible: text(input.responsible, 20) || null, needsDocument: input.needsDocument === true, gatePayment: text(input.gatePayment, 3) }));
}

export async function applyDesignStepsAction(projectId: string): Promise<DesignResult> {
  return done(id(projectId), await applyDesignSteps(id(projectId)));
}

export async function shareMoodBoardAction(projectId: string, note: string): Promise<DesignResult> {
  return done(id(projectId), await shareMoodBoard(id(projectId), text(note, 400)));
}

export async function addMoodBoardPiecesAction(projectId: string, roomKey: string, slugs: string[]): Promise<DesignResult> {
  return done(id(projectId), await addMoodBoardPieces(id(projectId), text(roomKey, 40), Array.isArray(slugs) ? slugs.slice(0, 24).map((s) => text(s, 80)) : []));
}

export async function bookVisitAction(input: { projectId: string; day: string; time: string; purpose: string; note: string }): Promise<DesignResult> {
  const projectId = id(input.projectId);
  return done(projectId, await bookVisit(projectId, { day: text(input.day, 10), time: text(input.time, 5), purpose: text(input.purpose, 100), note: text(input.note, 600) }));
}

export async function setVisitStatusAction(projectId: string, visitId: string, status: string): Promise<DesignResult> {
  return done(id(projectId), await setVisitStatus(id(projectId), id(visitId), text(status, 12)));
}

export async function saveMeasurementsAction(projectId: string, rows: { room: string; length: string; width: string; height: string; note: string }[]): Promise<DesignResult> {
  const clean = (Array.isArray(rows) ? rows : []).slice(0, 60).map((r) => ({ room: text(r.room, 80), length: text(r.length, 20), width: text(r.width, 20), height: text(r.height, 20), note: text(r.note, 220) }));
  return done(id(projectId), await saveMeasurements(id(projectId), clean));
}

export async function uploadDrawingAction(form: FormData): Promise<DesignResult> {
  const projectId = id(form.get('projectId'));
  return done(
    projectId,
    await uploadDrawing(
      projectId,
      { kind: text(form.get('kind'), 20), room: text(form.get('room'), 80), title: text(form.get('title'), 120), supersedesId: text(form.get('supersedesId'), 64), share: form.get('share') },
      fileOf(form.get('file')),
    ),
  );
}

export async function shareDrawingAction(projectId: string, documentId: string): Promise<DesignResult> {
  return done(id(projectId), await shareDrawing(id(projectId), id(documentId)));
}

/** Sends the client their requirement form (owner, 1 Nov 2026; project/requirement-form.ts). */
export async function sendRequirementFormAction(projectId: string): Promise<FormResult> {
  const r = await sendRequirementForm(id(projectId));
  if (r.ok) revalidatePath(`/studio/projects/${id(projectId)}`);
  return r;
}

/** "Mark as final" on a version, or take the mark off (owner, 1 Nov 2026). */
export async function markFinalAction(projectId: string, documentId: string, final: boolean): Promise<DesignResult> {
  const r = await markDocumentFinal(id(projectId), id(documentId), final === true);
  if (r.ok) revalidatePath(`/studio/projects/${id(projectId)}/documents`, 'layout');
  return done(id(projectId), r);
}

/** Makes (or finds) the Design Final, then opens it in the quotation builder. */
export async function makeDesignFinalAction(projectId: string): Promise<DesignResult> {
  const r = await makeDesignFinal(id(projectId));
  if (r.ok && r.id) redirect(`/studio/quotations/${r.id}`);
  return r;
}

export async function closeDesignAction(projectId: string): Promise<DesignResult> {
  return done(id(projectId), await closeDesign(id(projectId)));
}

/* The design process (DESIGN-PROCESS-PLAN.md Decisions 7–8): tasks inside a step, a step's order, a step added below another. */

export async function setStepTaskAction(projectId: string, taskId: string, isDone: boolean): Promise<DesignResult> {
  return done(id(projectId), await setStepTask(id(projectId), id(taskId), isDone === true));
}

export async function addStepTaskAction(projectId: string, stepId: string, label: string): Promise<DesignResult> {
  return done(id(projectId), await addStepTask(id(projectId), id(stepId), text(label, 200)));
}

export async function moveDesignStepOrderAction(projectId: string, stepId: string, dir: 'up' | 'down'): Promise<DesignResult> {
  return done(id(projectId), await moveDesignStepOrder(id(projectId), id(stepId), dir));
}

export async function addDesignStepBelowAction(input: { projectId: string; afterId: string; label: string; responsible: string; days: string; hours: string }): Promise<DesignResult> {
  const projectId = id(input.projectId);
  return done(
    projectId,
    await addDesignStepBelow(projectId, id(input.afterId), { label: text(input.label, 200), responsible: text(input.responsible, 20), days: text(input.days, 4), hours: text(input.hours, 6) }),
  );
}

/** Records a project document the browser put straight into storage (DESIGN-PROCESS-PLAN.md §3.6); its version follows the type and room. */
export async function uploadDocumentAction(input: { projectId: string; kind: string; room: string; share: boolean; path: string; name: string; bytes: number }): Promise<DesignResult> {
  const projectId = id(input.projectId);
  return done(
    projectId,
    await uploadDrawing(projectId, { kind: text(input.kind, 30), room: text(input.room, 80), share: input.share === true }, null, new Date(), {
      path: text(input.path, 200),
      name: text(input.name, 200),
      bytes: Number(input.bytes),
    }),
  );
}

export async function setProjectPriorityAction(projectId: string, stars: number | null): Promise<DesignResult> {
  const pid = id(projectId);
  const r = await setProjectPriority(pid, stars);
  if (r.ok) {
    revalidatePath('/studio/projects');
    revalidatePath('/studio/design');
  }
  return done(pid, r);
}
