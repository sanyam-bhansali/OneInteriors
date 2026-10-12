/**
 * Calendar tasks — the rules (leads at scale, 12 Oct 2026). Pure, tested in
 * tests/studio-leads-scale.test.ts; the reads and writes are in `tasks.ts`.
 *
 * A task is a to-do somebody writes for themselves or (owner, PM) for a
 * colleague. Nothing writes one by itself.
 *
 * - Owner and PM: see every task in the studio, write one for anyone who
 *   works leads, change or delete any.
 * - Salesperson: sees and changes only tasks given to them, writes tasks
 *   only for themselves, and only about a lead that is theirs (the lead
 *   check is the caller's, through `leadInScope`).
 */

import type { Prisma } from '@prisma/client';
import { can, type MemberRole } from '@/modules/studio/roles';
import { parseMeeting } from './lead-rules';

export interface TaskMember extends MemberRole {
  id: string;
  studioId: string;
}

/** May this person use tasks at all: anyone who works leads. */
export function mayUseTasks(member: MemberRole): boolean {
  return can(member, 'lead.read', { assigned: true });
}

/** Sees every task (owner, PM), or only their own (sales). */
export function seesAllTasks(member: MemberRole): boolean {
  return mayUseTasks(member) && can(member, 'lead.assign');
}

/** The tasks this person may see, as a `where`. Always their studio. */
export function tasksVisibleTo(member: TaskMember): Prisma.StudioTaskWhereInput {
  if (!mayUseTasks(member)) return { studioId: member.studioId, id: { in: [] } };
  if (seesAllTasks(member)) return { studioId: member.studioId };
  return { studioId: member.studioId, assignedToId: member.id };
}

/** May this person change (edit, tick, reschedule, delete) this task? */
export function mayChangeTask(member: TaskMember, task: { studioId: string; assignedToId: string | null }): boolean {
  if (!mayUseTasks(member) || task.studioId !== member.studioId) return false;
  return seesAllTasks(member) || task.assignedToId === member.id;
}

/** May this person give a task to `assigneeId`? Sales: only themselves. */
export function mayAssignTaskTo(member: TaskMember, assigneeId: string): boolean {
  if (!mayUseTasks(member)) return false;
  return seesAllTasks(member) || assigneeId === member.id;
}

export interface TaskInput {
  title: unknown;
  /** IST day `YYYY-MM-DD`. */
  day: unknown;
  /** IST `HH:MM`; empty means 10 am. */
  time: unknown;
}

export const DEFAULT_TASK_TIME = '10:00';

/** A checked title and due instant, or what is wrong in plain words. */
export function readTask(input: TaskInput): { ok: true; title: string; dueAt: Date } | { ok: false; error: string } {
  const title = typeof input.title === 'string' ? input.title.trim().replace(/\s+/g, ' ') : '';
  if (title.length < 2) return { ok: false, error: 'What is the task? A few words is enough.' };
  if (title.length > 140) return { ok: false, error: 'Shorter than 140 characters, please.' };
  const time = typeof input.time === 'string' && input.time.trim() ? input.time.trim() : DEFAULT_TASK_TIME;
  const dueAt = parseMeeting(input.day, time);
  if (!dueAt) return { ok: false, error: 'Pick the day it is due (and a time, if it matters).' };
  return { ok: true, title, dueAt };
}
