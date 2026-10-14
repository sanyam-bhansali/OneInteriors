'use server';

/**
 * Calendar tasks, as server actions (leads at scale, 12 Oct 2026). The
 * module checks who is asking (studio-sales/task-rules.ts) before anything
 * is read or written. Only async functions here.
 */

import { revalidatePath } from 'next/cache';
import { createTask, deleteTask, setTaskDone, updateTask } from '@/modules/studio-sales/tasks';
import type { Done } from './sales-types';

function refresh(leadId?: string | null) {
  revalidatePath('/studio/calendar');
  revalidatePath('/studio/today');
  if (leadId) revalidatePath(`/studio/clients/${leadId}`);
}

export async function createTaskAction(input: { title: string; day: string; time: string; leadId?: string | null; assignedToId?: string | null }): Promise<Done> {
  const r = await createTask(input ?? {});
  if (r.ok) refresh(typeof input?.leadId === 'string' ? input.leadId : null);
  return r;
}

export async function updateTaskAction(id: string, input: { title: string; day: string; time: string; assignedToId?: string | null }, leadId?: string | null): Promise<Done> {
  const r = await updateTask(id, input ?? {});
  if (r.ok) refresh(leadId);
  return r;
}

export async function setTaskDoneAction(id: string, done: boolean, leadId?: string | null): Promise<Done> {
  const r = await setTaskDone(id, done === true);
  if (r.ok) refresh(leadId);
  return r;
}

export async function deleteTaskAction(id: string, leadId?: string | null): Promise<Done> {
  const r = await deleteTask(id);
  if (r.ok) refresh(leadId);
  return r;
}
