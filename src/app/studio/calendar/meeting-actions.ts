'use server';

import { guarded, SAVE_FAILED } from '@/lib/action-guard';

import { revalidatePath } from 'next/cache';
import { addBusyBlock, answerMeeting, busyOn, cancelOfficeMeeting, createMeeting, moveOfficeMeeting, removeBusyBlock, type Done } from '@/modules/studio-office/meetings';
import type { BusySpan } from '@/modules/studio-office/meeting-rules';

/**
 * Office meeting actions (owner, 27 Oct 2026). Thin: who may do what is
 * checked in studio-office/meetings.ts and meeting-rules.ts.
 */

function refresh() {
  revalidatePath('/studio/calendar');
  revalidatePath('/studio/calendar/meetings');
  revalidatePath('/studio/home');
}

export async function createMeetingAction(input: { title: string; day: string; time: string; minutes: number; place: string; note: string; guestIds: string[] }): Promise<Done> {
  return guarded('createMeetingAction', { ok: false, error: SAVE_FAILED }, async () => {
  const r = await createMeeting(input);
  if (r.ok) refresh();
  return r.ok ? { ok: true, message: r.message } : r;
});
}

export async function acceptMeetingAction(id: string): Promise<Done> {
  return guarded('acceptMeetingAction', { ok: false, error: SAVE_FAILED }, async () => {
  const r = await answerMeeting(id, 'accept', null, null, null);
  if (r.ok) refresh();
  return r;
});
}

export async function proposeMeetingTimeAction(id: string, day: string, time: string, note: string): Promise<Done> {
  return guarded('proposeMeetingTimeAction', { ok: false, error: SAVE_FAILED }, async () => {
  const r = await answerMeeting(id, 'propose', day, time, note);
  if (r.ok) refresh();
  return r;
});
}

/** The organiser takes a guest's suggested time (`fromGuest`), or moves it to a day and time. */
export async function moveMeetingAction(id: string, fromGuest: string | null, day: string | null, time: string | null): Promise<Done> {
  return guarded('moveMeetingAction', { ok: false, error: SAVE_FAILED }, async () => {
  const r = await moveOfficeMeeting(id, fromGuest, day, time);
  if (r.ok) refresh();
  return r;
});
}

export async function cancelMeetingAction(id: string): Promise<Done> {
  return guarded('cancelMeetingAction', { ok: false, error: SAVE_FAILED }, async () => {
  const r = await cancelOfficeMeeting(id);
  if (r.ok) refresh();
  return r;
});
}

/* Regular busy times and who is free (owner and the design team, 27 Oct 2026). */
export async function busyOnAction(memberIds: string[], day: string): Promise<Record<string, BusySpan[]>> {
  return busyOn(Array.isArray(memberIds) ? memberIds.map(String) : [], String(day));
}

export async function addBusyBlockAction(input: { weekday: number; from: string; to: string; label: string }): Promise<Done> {
  return guarded('addBusyBlockAction', { ok: false, error: SAVE_FAILED }, async () => {
  const r = await addBusyBlock(input);
  if (r.ok) revalidatePath('/studio/calendar/meetings');
  return r;
});
}

export async function removeBusyBlockAction(id: string): Promise<Done> {
  return guarded('removeBusyBlockAction', { ok: false, error: SAVE_FAILED }, async () => {
  const r = await removeBusyBlock(id);
  if (r.ok) revalidatePath('/studio/calendar/meetings');
  return r;
});
}
