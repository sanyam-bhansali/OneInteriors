'use server';

import { revalidatePath } from 'next/cache';
import { askLeave, decideLeave, withdrawLeave, type LeaveResult } from '@/modules/studio-leave/store';

/** The team's leave (owner, 13 Nov 2026). The checks are in the module (studio-leave/). */

function done(r: LeaveResult): LeaveResult {
  if (r.ok) revalidatePath('/studio/calendar/leave');
  return r;
}

export async function askLeaveAction(input: { memberId?: string; fromDay: string; toDay: string; kind: string; reason: string }): Promise<LeaveResult> {
  return done(await askLeave(input));
}

export async function decideLeaveAction(leaveId: string, approve: boolean): Promise<LeaveResult> {
  return done(await decideLeave(leaveId, approve === true));
}

export async function withdrawLeaveAction(leaveId: string): Promise<LeaveResult> {
  return done(await withdrawLeave(leaveId));
}
