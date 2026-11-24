'use server';

import { guarded, SAVE_FAILED } from '@/lib/action-guard';

import { revalidatePath } from 'next/cache';
import { addDevice, addIncentive, addSalary, markIncentivePaid, removeDoc, returnDevice, saveProfile, uploadDoc, type StaffResult } from '@/modules/staff/store';

/** Employee records (owner, 21 Nov 2026). The checks are in the module (staff/). */

function done(r: StaffResult): StaffResult {
  if (r.ok) revalidatePath('/studio/people', 'layout');
  return r;
}

export async function saveProfileAction(input: { memberId: string; designation: string; joinedOn: string; address: string }) {
  return guarded('saveProfileAction', { ok: false, error: SAVE_FAILED }, async () => {
  return done(await saveProfile(input));
});
}
export async function uploadDocAction(form: FormData) {
  return guarded('uploadDocAction', { ok: false, error: SAVE_FAILED }, async () => {
  return done(await uploadDoc(form));
});
}
export async function removeDocAction(id: string) {
  return guarded('removeDocAction', { ok: false, error: SAVE_FAILED }, async () => {
  return done(await removeDoc(id));
});
}
export async function addSalaryAction(input: { memberId: string; amount: string; fromDay: string; note: string }) {
  return guarded('addSalaryAction', { ok: false, error: SAVE_FAILED }, async () => {
  return done(await addSalary(input));
});
}
export async function addIncentiveAction(input: { memberId: string; month: string; amount: string; reason: string }) {
  return guarded('addIncentiveAction', { ok: false, error: SAVE_FAILED }, async () => {
  return done(await addIncentive(input));
});
}
export async function markIncentivePaidAction(id: string, paidOn: string) {
  return guarded('markIncentivePaidAction', { ok: false, error: SAVE_FAILED }, async () => {
  return done(await markIncentivePaid(id, paidOn));
});
}
export async function addDeviceAction(input: { memberId: string; kind: string; model: string; serial: string; givenOn: string; note: string }) {
  return guarded('addDeviceAction', { ok: false, error: SAVE_FAILED }, async () => {
  return done(await addDevice(input));
});
}
export async function returnDeviceAction(id: string, returnedOn: string) {
  return guarded('returnDeviceAction', { ok: false, error: SAVE_FAILED }, async () => {
  return done(await returnDevice(id, returnedOn));
});
}
