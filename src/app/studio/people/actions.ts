'use server';

import { revalidatePath } from 'next/cache';
import { addDevice, addIncentive, addSalary, markIncentivePaid, removeDoc, returnDevice, saveProfile, uploadDoc, type StaffResult } from '@/modules/staff/store';

/** Employee records (owner, 21 Nov 2026). The checks are in the module (staff/). */

function done(r: StaffResult): StaffResult {
  if (r.ok) revalidatePath('/studio/people', 'layout');
  return r;
}

export async function saveProfileAction(input: { memberId: string; designation: string; joinedOn: string; address: string }) {
  return done(await saveProfile(input));
}
export async function uploadDocAction(form: FormData) {
  return done(await uploadDoc(form));
}
export async function removeDocAction(id: string) {
  return done(await removeDoc(id));
}
export async function addSalaryAction(input: { memberId: string; amount: string; fromDay: string; note: string }) {
  return done(await addSalary(input));
}
export async function addIncentiveAction(input: { memberId: string; month: string; amount: string; reason: string }) {
  return done(await addIncentive(input));
}
export async function markIncentivePaidAction(id: string, paidOn: string) {
  return done(await markIncentivePaid(id, paidOn));
}
export async function addDeviceAction(input: { memberId: string; kind: string; model: string; serial: string; givenOn: string; note: string }) {
  return done(await addDevice(input));
}
export async function returnDeviceAction(id: string, returnedOn: string) {
  return done(await returnDevice(id, returnedOn));
}
