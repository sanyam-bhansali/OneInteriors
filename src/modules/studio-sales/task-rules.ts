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
 * - Sales roles and teams (owner, 22 Oct 2026): a salesperson with a sales
 *   role sees the tasks of the people their `leads.view` reaches (team:
 *   everyone below them), changes those their `leads.edit` reaches, and
 *   gives tasks to the people their `leads.assign` reaches (else only
 *   themselves).
 * - Everyone else at the studio (owner and the design team, 27 Oct 2026:
 *   "today I am doing this"): their own tasks only, about no lead.
 */

import type { Prisma } from '@prisma/client';
import { can, hasSalesRole, type MemberRole } from '@/modules/studio/roles';
import { reachOf } from '@/modules/studio/sales-access';
import type { SalesPermissionKey } from '@/modules/studio/sales-permissions';
import { parseMeeting } from './lead-rules';

export interface TaskMember extends MemberRole {
  id: string;
  studioId: string;
}

/** May this person use tasks at all: everyone active at the studio (their own, when they work no leads). */
export function mayUseTasks(member: MemberRole): boolean {
  return member.status === 'ACTIVE';
}

/** Sees every task (owner, PM, a sales role that sees every lead), or only some (sales). */
export function seesAllTasks(member: MemberRole): boolean {
  if (!mayUseTasks(member)) return false;
  if (hasSalesRole(member)) return reachOf(member.sales, 'leads.view') === 'all';
  return can(member, 'lead.assign');
}

/** Whose tasks a permission reaches for a sales role: null = everyone; else these member ids. Null role → own only. */
function taskPeople(member: TaskMember, key: SalesPermissionKey): readonly string[] | null {
  if (!hasSalesRole(member)) return [member.id];
  const reach = reachOf(member.sales, key);
  if (reach === 'all') return null;
  if (reach === 'team') return member.sales.subtree;
  return [member.id];
}

/** The tasks this person may see, as a `where`. Always their studio. */
export function tasksVisibleTo(member: TaskMember): Prisma.StudioTaskWhereInput {
  if (!mayUseTasks(member)) return { studioId: member.studioId, id: { in: [] } };
  if (seesAllTasks(member)) return { studioId: member.studioId };
  const people = taskPeople(member, 'leads.view');
  if (people === null) return { studioId: member.studioId };
  if (people.length === 1 && people[0] === member.id) return { studioId: member.studioId, assignedToId: member.id };
  return { studioId: member.studioId, assignedToId: { in: [...people] } };
}

/** May this person change (edit, tick, reschedule, delete) this task? */
export function mayChangeTask(member: TaskMember, task: { studioId: string; assignedToId: string | null }): boolean {
  if (!mayUseTasks(member) || task.studioId !== member.studioId) return false;
  if (hasSalesRole(member)) {
    const people = taskPeople(member, 'leads.edit');
    return people === null || (task.assignedToId !== null && people.includes(task.assignedToId));
  }
  return seesAllTasks(member) || task.assignedToId === member.id;
}

/** May this person give a task to `assigneeId`? Sales: only themselves (a sales role: whoever `leads.assign` reaches). */
export function mayAssignTaskTo(member: TaskMember, assigneeId: string): boolean {
  if (!mayUseTasks(member)) return false;
  if (assigneeId === member.id) return true;
  if (hasSalesRole(member)) {
    if (!can(member, 'lead.assign')) return false;
    const people = taskPeople(member, 'leads.assign');
    return people === null || people.includes(assigneeId);
  }
  return seesAllTasks(member);
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
