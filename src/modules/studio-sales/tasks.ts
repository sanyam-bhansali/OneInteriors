import 'server-only';

/**
 * Calendar tasks — reads and writes (leads at scale, 12 Oct 2026). Rules in
 * `task-rules.ts`: owner and PM see and change every task in the studio; a
 * salesperson only the tasks given to them, and a task about a lead only
 * when that lead is theirs.
 */

import { prisma } from '@/lib/prisma';
import { currentMember } from '@/modules/studio/access';
import { leadInScope, mayOnLead, myLeadScope } from '@/modules/studio/lead-scope';
import { mayAssignTaskTo, mayChangeTask, mayUseTasks, readTask, tasksVisibleTo, type TaskMember } from './task-rules';

/** What a task write says back (the same shape as app/studio/sales-types.ts `Done`). */
export type Done = { ok: true; message?: string } | { ok: false; error: string };

export interface TaskRow {
  id: string;
  title: string;
  dueAt: Date;
  doneAt: Date | null;
  leadId: string | null;
  leadName: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
}

const nameOf = (u: { name: string | null; email: string | null; phone: string | null } | null | undefined) =>
  u ? u.name?.trim() || u.email?.split('@')[0] || u.phone || 'Someone' : null;

const SELECT = {
  id: true,
  title: true,
  dueAt: true,
  doneAt: true,
  leadId: true,
  lead: { select: { name: true, deletedAt: true } },
  assignedToId: true,
  assignedTo: { select: { user: { select: { name: true, email: true, phone: true } } } },
} as const;

type Raw = {
  id: string;
  title: string;
  dueAt: Date;
  doneAt: Date | null;
  leadId: string | null;
  lead: { name: string; deletedAt: Date | null } | null;
  assignedToId: string | null;
  assignedTo: { user: { name: string | null; email: string | null; phone: string | null } } | null;
};

function toRow(t: Raw): TaskRow {
  return {
    id: t.id,
    title: t.title,
    dueAt: t.dueAt,
    doneAt: t.doneAt,
    leadId: t.lead && !t.lead.deletedAt ? t.leadId : null,
    leadName: t.lead && !t.lead.deletedAt ? t.lead.name : null,
    assignedToId: t.assignedToId,
    assignedToName: nameOf(t.assignedTo?.user),
  };
}

async function me(): Promise<TaskMember | null> {
  const m = await currentMember();
  return m && mayUseTasks(m) ? m : null;
}

/** Tasks due in [start, end], optionally one person's. Capped. */
export async function tasksBetween(member: TaskMember, start: Date, end: Date, who: string | null, take = 500): Promise<TaskRow[]> {
  if (!mayUseTasks(member)) return [];
  try {
    const rows = await prisma.studioTask.findMany({
      where: { AND: [tasksVisibleTo(member), { studioId: member.studioId, dueAt: { gte: start, lte: end } }, who ? { assignedToId: who } : {}] },
      orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
      take,
      select: SELECT,
    });
    return rows.map(toRow);
  } catch (error) {
    console.error('[tasks] read failed', error instanceof Error ? error.message : 'unknown');
    return [];
  }
}

/** Open tasks due by `end` (today's and late ones), for Today. */
export async function openTasksDue(member: TaskMember, end: Date, take = 25): Promise<{ rows: TaskRow[]; total: number }> {
  if (!mayUseTasks(member)) return { rows: [], total: 0 };
  const where = { AND: [tasksVisibleTo(member), { studioId: member.studioId, doneAt: null, dueAt: { lte: end } }] };
  try {
    const [rows, total] = await Promise.all([
      prisma.studioTask.findMany({ where, orderBy: [{ dueAt: 'asc' }, { id: 'asc' }], take, select: SELECT }),
      prisma.studioTask.count({ where }),
    ]);
    return { rows: rows.map(toRow), total };
  } catch {
    return { rows: [], total: 0 };
  }
}

/** A lead's tasks, newest due last (the lead page). */
export async function tasksForLead(leadId: string): Promise<TaskRow[]> {
  const member = await me();
  const scope = await myLeadScope();
  if (!member || !scope || !(await leadInScope(scope, leadId))) return [];
  try {
    const rows = await prisma.studioTask.findMany({
      where: { AND: [tasksVisibleTo(member), { studioId: member.studioId, leadId }] },
      orderBy: [{ doneAt: { sort: 'asc', nulls: 'first' } }, { dueAt: 'asc' }],
      take: 50,
      select: SELECT,
    });
    return rows.map(toRow);
  } catch {
    return [];
  }
}

/** People a task may be given to: active owner, PM, salesperson. A salesperson sees only themselves. */
export async function taskPeople(): Promise<{ id: string; name: string }[]> {
  const member = await me();
  if (!member) return [];
  try {
    const rows = await prisma.studioMember.findMany({
      where: { studioId: member.studioId, status: 'ACTIVE', role: { in: ['OWNER', 'PM', 'SALES'] } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, user: { select: { name: true, email: true, phone: true } } },
    });
    return rows.filter((r) => mayAssignTaskTo(member, r.id)).map((r) => ({ id: r.id, name: nameOf(r.user) ?? 'Someone' }));
  } catch {
    return [];
  }
}

export interface TaskWrite {
  title: unknown;
  day: unknown;
  time: unknown;
  leadId?: unknown;
  assignedToId?: unknown;
}

/** Write a task. Given to the writer unless (owner, PM) they pick someone. */
export async function createTask(input: TaskWrite): Promise<Done> {
  const member = await me();
  if (!member) return { ok: false, error: 'Tasks are for the people who work leads.' };
  const t = readTask(input);
  if (!t.ok) return t;
  const assignee = typeof input.assignedToId === 'string' && input.assignedToId ? input.assignedToId : member.id;
  if (!mayAssignTaskTo(member, assignee)) return { ok: false, error: 'You can only write tasks for yourself.' };
  try {
    const person = await prisma.studioMember.findFirst({ where: { id: assignee, studioId: member.studioId, status: 'ACTIVE' }, select: { id: true } });
    if (!person) return { ok: false, error: 'That person is not on your team.' };
    let leadId: string | null = null;
    if (typeof input.leadId === 'string' && input.leadId) {
      const scope = await myLeadScope();
      const lead = scope ? await leadInScope(scope, input.leadId) : null;
      if (!lead) return { ok: false, error: 'That lead is not yours.' };
      /* A task on a lead is working it: `lead.edit` on that lead (sales roles, owner 22 Oct 2026). */
      if (!scope || !mayOnLead(scope, 'lead.edit', lead)) return { ok: false, error: 'Your role does not include working that lead.' };
      leadId = lead.id;
    }
    await prisma.studioTask.create({
      data: { studioId: member.studioId, title: t.title, dueAt: t.dueAt, leadId, assignedToId: person.id, createdById: member.id },
    });
    return { ok: true, message: 'Task added.' };
  } catch (error) {
    console.error('[tasks] create failed', error instanceof Error ? error.message : 'unknown');
    return { ok: false, error: 'That did not save. Try again.' };
  }
}

async function ownTask(member: TaskMember, id: unknown) {
  if (typeof id !== 'string' || id.length === 0 || id.length > 64) return null;
  const task = await prisma.studioTask.findFirst({ where: { id, studioId: member.studioId }, select: { id: true, studioId: true, assignedToId: true } });
  return task && mayChangeTask(member, task) ? task : null;
}

/** Change the title, the day/time, or (owner, PM) who has it. */
export async function updateTask(id: unknown, input: TaskWrite): Promise<Done> {
  const member = await me();
  if (!member) return { ok: false, error: 'Tasks are for the people who work leads.' };
  try {
    const task = await ownTask(member, id);
    if (!task) return { ok: false, error: 'That task is not yours to change.' };
    const t = readTask(input);
    if (!t.ok) return t;
    let assignedToId = task.assignedToId;
    if (typeof input.assignedToId === 'string' && input.assignedToId && input.assignedToId !== task.assignedToId) {
      if (!mayAssignTaskTo(member, input.assignedToId)) return { ok: false, error: 'You can only give tasks to yourself.' };
      const person = await prisma.studioMember.findFirst({ where: { id: input.assignedToId, studioId: member.studioId, status: 'ACTIVE' }, select: { id: true } });
      if (!person) return { ok: false, error: 'That person is not on your team.' };
      assignedToId = person.id;
    }
    await prisma.studioTask.updateMany({ where: { id: task.id, studioId: member.studioId }, data: { title: t.title, dueAt: t.dueAt, assignedToId } });
    return { ok: true, message: 'Saved.' };
  } catch {
    return { ok: false, error: 'That did not save. Try again.' };
  }
}

/** Tick done, or untick. */
export async function setTaskDone(id: unknown, done: boolean): Promise<Done> {
  const member = await me();
  if (!member) return { ok: false, error: 'Tasks are for the people who work leads.' };
  try {
    const task = await ownTask(member, id);
    if (!task) return { ok: false, error: 'That task is not yours to change.' };
    await prisma.studioTask.updateMany({ where: { id: task.id, studioId: member.studioId }, data: { doneAt: done ? new Date() : null } });
    return { ok: true, message: done ? 'Done.' : 'Opened again.' };
  } catch {
    return { ok: false, error: 'That did not save. Try again.' };
  }
}

export async function deleteTask(id: unknown): Promise<Done> {
  const member = await me();
  if (!member) return { ok: false, error: 'Tasks are for the people who work leads.' };
  try {
    const task = await ownTask(member, id);
    if (!task) return { ok: false, error: 'That task is not yours to change.' };
    await prisma.studioTask.deleteMany({ where: { id: task.id, studioId: member.studioId } });
    return { ok: true, message: 'Task deleted.' };
  } catch {
    return { ok: false, error: 'That did not save. Try again.' };
  }
}
