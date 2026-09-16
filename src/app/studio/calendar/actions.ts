'use server';

import { revalidatePath } from 'next/cache';
import {
  setAppointmentStatus,
  proposeAppointment,
  type ActionResult,
  type AppointmentKindName,
} from '@/modules/studio/introduction';

/**
 * Calendar actions.
 *
 * Thin, as everywhere else: ownership and the transition rules live in the
 * module. Note what is missing — there is no `markNoShow`. A studio cannot
 * write the other party's absence into a permanent record, and the module would
 * refuse it anyway; leaving the action out means the UI never offers a button
 * that would only fail.
 */

export async function confirmAction(appointmentId: string): Promise<ActionResult> {
  const result = await setAppointmentStatus(appointmentId, 'CONFIRMED');
  if (result.ok) revalidatePath('/studio/calendar');
  return result;
}

export async function completeAction(appointmentId: string): Promise<ActionResult> {
  const result = await setAppointmentStatus(appointmentId, 'COMPLETED');
  if (result.ok) {
    revalidatePath('/studio/calendar');
    revalidatePath('/studio');
  }
  return result;
}

export async function cancelAction(appointmentId: string): Promise<ActionResult> {
  const result = await setAppointmentStatus(appointmentId, 'CANCELLED');
  if (result.ok) {
    revalidatePath('/studio/calendar');
    revalidatePath('/studio');
  }
  return result;
}

export async function proposeAction(
  introductionId: string,
  kind: AppointmentKindName,
  isoDateTime: string,
  location: string,
): Promise<ActionResult> {
  const startsAt = new Date(isoDateTime);
  const result = await proposeAppointment({ introductionId, kind, startsAt, location });
  if (result.ok) revalidatePath('/studio/calendar');
  return result.ok ? { ok: true } : result;
}
