'use server';

import { guarded, SAVE_FAILED } from '@/lib/action-guard';

import { revalidatePath } from 'next/cache';
import { addHoliday, addHolidayList, removeHoliday, type LeaveResult } from '@/modules/studio-leave/store';

/** Settings → Holidays (owner, 13 Nov 2026). The checks are in the module (studio-leave/). */

function done(r: LeaveResult): LeaveResult {
  if (r.ok) {
    revalidatePath('/studio/settings/holidays');
    revalidatePath('/studio/calendar/leave');
  }
  return r;
}

export async function addHolidayAction(day: unknown, name: unknown): Promise<LeaveResult> {
  return guarded('addHolidayAction', { ok: false, error: SAVE_FAILED }, async () => {
  return done(await addHoliday({ day, name }));
});
}

export async function addHolidayListAction(text: unknown): Promise<LeaveResult> {
  return guarded('addHolidayListAction', { ok: false, error: SAVE_FAILED }, async () => {
  return done(await addHolidayList(typeof text === 'string' ? text.slice(0, 10_000) : ''));
});
}

export async function removeHolidayAction(day: unknown): Promise<LeaveResult> {
  return guarded('removeHolidayAction', { ok: false, error: SAVE_FAILED }, async () => {
  return done(await removeHoliday(day));
});
}
