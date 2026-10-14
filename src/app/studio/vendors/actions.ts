'use server';

import { revalidatePath } from 'next/cache';
import {
  addCrew,
  addExtra,
  archiveCrew,
  archiveOrder,
  buildWorkOrders,
  correctCrewPayment,
  deleteRate,
  editOrder,
  loadTemplate,
  recordCrewPayment,
  removeLine,
  removeOrder,
  saveCrewSettings,
  saveRate,
  setLineCarpentry,
  setLinePrice,
  setLineQty,
  setOrderStatus,
  swapCrew,
  updateCrew,
  uploadKycScan,
  type BuildInput,
  type CrewInput,
  type CrewResult,
} from '@/modules/studio-crews/flow';

/**
 * Studio OS Phase 3: every write about crews, work orders and payments.
 * The checks — who may, on which project, what money a PM may never send —
 * are in the module (modules/studio-crews/flow.ts); these clip input and
 * refresh the screens that show the figures.
 */

const id = (v: unknown) => String(v ?? '').slice(0, 64);

function done(r: CrewResult, projectId?: string): CrewResult {
  if (r.ok) {
    revalidatePath('/studio/vendors', 'layout');
    revalidatePath('/studio/today');
    revalidatePath('/studio/payments');
    if (projectId) revalidatePath(`/studio/projects/${projectId}`);
  }
  return r;
}

export async function addCrewAction(input: CrewInput): Promise<CrewResult> {
  return done(await addCrew(input));
}

export async function updateCrewAction(crewId: string, input: CrewInput): Promise<CrewResult> {
  return done(await updateCrew(id(crewId), input));
}

export async function archiveCrewAction(crewId: string, archived: boolean): Promise<CrewResult> {
  return done(await archiveCrew(id(crewId), archived === true));
}

export async function uploadKycAction(form: FormData): Promise<CrewResult> {
  const f = form.get('file');
  return done(await uploadKycScan(id(form.get('crewId')), form.get('doc'), f && typeof f !== 'string' ? f : null));
}

export async function saveRateAction(crewId: string, input: { id?: string; item: string; unit: string; rateRupees: string; trade?: string }): Promise<CrewResult> {
  return done(await saveRate(id(crewId), input));
}

export async function deleteRateAction(crewId: string, rateId: string): Promise<CrewResult> {
  return done(await deleteRate(id(crewId), id(rateId)));
}

export async function loadTemplateAction(crewId: string, trade: string): Promise<CrewResult> {
  return done(await loadTemplate(id(crewId), String(trade ?? '').slice(0, 40)));
}

export async function saveCrewSettingsAction(input: Parameters<typeof saveCrewSettings>[0]): Promise<CrewResult> {
  const r = await saveCrewSettings(input);
  if (r.ok) revalidatePath('/studio/settings/trades');
  return done(r);
}

export async function buildWorkOrdersAction(projectId: string, input: BuildInput): Promise<CrewResult> {
  return done(await buildWorkOrders(id(projectId), input), id(projectId));
}

export async function setLineQtyAction(projectId: string, lineId: string, input: { measured?: string; estimate?: string }): Promise<CrewResult> {
  return done(await setLineQty(id(lineId), input), id(projectId));
}

export async function setLineCarpentryAction(projectId: string, lineId: string, mode: string): Promise<CrewResult> {
  return done(await setLineCarpentry(id(lineId), mode), id(projectId));
}

export async function setLinePriceAction(projectId: string, lineId: string, input: { rateRupees?: string; agreedRupees?: string }): Promise<CrewResult> {
  return done(await setLinePrice(id(lineId), input), id(projectId));
}

export async function addExtraAction(projectId: string, woId: string, input: { what: string; room?: string; unit: string; qty?: string; rateRupees?: string; agreedRupees?: string }): Promise<CrewResult> {
  return done(await addExtra(id(woId), input), id(projectId));
}

export async function removeLineAction(projectId: string, lineId: string): Promise<CrewResult> {
  return done(await removeLine(id(lineId)), id(projectId));
}

export async function setOrderStatusAction(projectId: string, woId: string, to: string): Promise<CrewResult> {
  return done(await setOrderStatus(id(woId), to), id(projectId));
}

export async function editOrderAction(projectId: string, woId: string, input: { dueOn?: string; stepIds?: string[]; notes?: string }): Promise<CrewResult> {
  return done(await editOrder(id(woId), input), id(projectId));
}

export async function swapCrewAction(projectId: string, woId: string, crewId: string): Promise<CrewResult> {
  return done(await swapCrew(id(woId), id(crewId)), id(projectId));
}

export async function archiveOrderAction(projectId: string, woId: string, archived: boolean): Promise<CrewResult> {
  return done(await archiveOrder(id(woId), archived === true), id(projectId));
}

export async function removeOrderAction(projectId: string, woId: string): Promise<CrewResult> {
  return done(await removeOrder(id(woId)), id(projectId));
}

export async function recordCrewPaymentAction(projectId: string, woId: string, input: { amountRupees: string; kind?: string; mode: string; reference?: string; note?: string; paidOn?: string }): Promise<CrewResult> {
  return done(await recordCrewPayment(id(woId), input), id(projectId));
}

export async function correctCrewPaymentAction(projectId: string, paymentId: string, note: string): Promise<CrewResult> {
  return done(await correctCrewPayment(id(paymentId), { note }), id(projectId));
}
