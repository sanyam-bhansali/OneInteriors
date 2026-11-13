import 'server-only';

/**
 * Holidays and leave (owner, 13 Nov 2026; rules in ./rules.ts): the studio's
 * holiday list, the team's leave, and the design plans they move. Every read
 * and write is scoped by the signed-in member's studio. Nobody is messaged
 * outside the app.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { currentMember, type StudioMemberRef } from '@/modules/studio/access';
import { dedupeKey, recordEvent, recordEventOnce, type ProjectActor } from '@/modules/project/events';
import { shiftStepsWithStage } from '@/modules/project/stage-settle';
import type { MovePlan, RuleStage, StageKind } from '@/modules/project/project-rules';
import { calendarOf, daysBetween, dayFromDb, dayToDb, isDay, istDay, isoWeekday, isWorkingDay, type IsoWeekday, type StudioCalendar } from '@/modules/project/working-days';
import { projectCalendar } from '@/modules/studio-design/step-settle';
import { mayApproveHold } from '@/modules/studio-hold/rules';
import {
  checkLeaveAsk,
  cleanHolidayName,
  designEndShift,
  holidayNote,
  holidayStepShift,
  isLeaveStatus,
  LEAVE_KINDS,
  leaveCovers,
  leaveNote,
  leaveWorkingDays,
  monthGrid,
  parseHolidayList,
  shiftOpenStepsFrom,
  type LeaveKind,
  type LeaveStatus,
  type StepMove,
} from './rules';

export type LeaveResult = { ok: true; message: string } | { ok: false; error: string };

const NOT_ALLOWED = 'Only the owner or the design head does this.';
const writer = (m: StudioMemberRef | null): m is StudioMemberRef => m !== null && !m.viewOnly;

/** Projects whose design plan a holiday or leave moves: running, in design or pre-execution, not on hold (a hold moves its own dates when it ends). */
const RUNNING_DESIGN = { cancelledAt: null, phase: { in: ['DESIGN', 'PRE_EXECUTION'] }, holds: { none: { status: 'ON' } } } satisfies Prisma.HomeProjectWhereInput;

// ── Moving one project's design plan ──────────────────────────

/**
 * Writes a design shift inside the caller's transaction: the steps' new
 * days, the design's end and every later stage (a later stage's steps move
 * with it), one plan-move row per date with `reason` and the team's note,
 * and a `date.moved` event (design moves never reach the client). The same
 * writes a late tick makes (step-settle.ts `shiftAfterLateTick`).
 */
async function writeDesignShift(
  tx: Prisma.TransactionClient,
  input: { projectId: string; moves: StepMove[]; plan: MovePlan | null; stages: RuleStage[]; reason: 'OTHER' | 'STUDIO'; note: string; byId: string; actor: ProjectActor; now: Date; ref: Record<string, string> },
): Promise<void> {
  for (const m of input.moves) await tx.homeChecklistItem.update({ where: { id: m.id }, data: { plannedOn: dayToDb(m.to) } });
  const plan = input.plan;
  if (!plan) return;
  for (const s of plan.stages) {
    await tx.homeProjectStage.update({ where: { id: s.stageId }, data: { plannedStart: dayToDb(s.plannedStart), plannedEnd: dayToDb(s.plannedEnd) } });
    const was = input.stages.find((x) => x.id === s.stageId)!;
    // The design stage's own steps moved above; a later stage's steps move with it.
    if (was.kind !== 'DESIGN') await shiftStepsWithStage(tx, s.stageId, { start: was.plannedStart, end: was.plannedEnd }, { start: s.plannedStart, end: s.plannedEnd });
  }
  let leadId: string | null = null;
  for (const r of plan.rows) {
    const row = await tx.homeProjectDateChange.create({
      data: { projectId: input.projectId, stageId: r.stageId, field: r.field, fromDate: dayToDb(r.from), toDate: dayToDb(r.to), reason: input.reason, note: input.note, byId: input.byId, at: input.now },
      select: { id: true },
    });
    leadId ??= row.id;
  }
  await recordEvent(tx, {
    projectId: input.projectId,
    type: 'date.moved',
    actor: input.actor,
    refId: leadId,
    payload: { stageId: plan.rows[0]!.stageId, field: plan.rows[0]!.field, days: plan.days, rows: plan.rows.length, reason: input.reason, customer: false, ...input.ref },
    at: input.now,
  });
}

/** One project's design stage and stages, read for a shift. */
async function readPlan(tx: Prisma.TransactionClient, projectId: string) {
  const rows = await tx.homeProjectStage.findMany({
    where: { projectId },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      kind: true,
      name: true,
      plannedStart: true,
      plannedEnd: true,
      actualEnd: true,
      items: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], select: { id: true, plannedOn: true, doneAt: true, inScope: true } },
    },
  });
  const stages: RuleStage[] = rows.map((s) => ({ id: s.id, kind: s.kind as StageKind, name: s.name, plannedStart: istDay(s.plannedStart), plannedEnd: istDay(s.plannedEnd), actualEnd: s.actualEnd ? istDay(s.actualEnd) : null }));
  const design = rows.find((s) => s.kind === 'DESIGN');
  const steps = (design?.items ?? []).map((i) => ({ id: i.id, plannedOn: i.plannedOn ? dayFromDb(i.plannedOn) : null, done: i.doneAt !== null, inScope: i.inScope }));
  return { stages, steps };
}

// ── Holidays ──────────────────────────────────────────────────

export interface HolidaysView {
  holidays: { day: string; name: string; past: boolean }[];
  canEdit: boolean;
  today: string;
  /** The studio's weekly days off, in words ("Monday"). */
  daysOff: string[];
}

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export async function holidaysView(now = new Date()): Promise<HolidaysView | null> {
  const member = await currentMember();
  if (!member) return null;
  const studio = await prisma.studio.findUnique({ where: { id: member.studioId }, select: { workingDays: true, holidays: { orderBy: { day: 'asc' }, select: { day: true, name: true } } } });
  if (!studio) return null;
  const today = istDay(now);
  const cal = calendarOf({ workingDays: studio.workingDays });
  return {
    holidays: studio.holidays.map((h) => ({ day: dayFromDb(h.day), name: h.name?.trim() || 'Holiday', past: daysBetween(dayFromDb(h.day), today) > 0 })),
    canEdit: writer(member) && mayApproveHold(member),
    today,
    daysOff: [1, 2, 3, 4, 5, 6, 7].filter((d) => !cal.workingDays.includes(d as IsoWeekday)).map((d) => WEEKDAY_NAMES[d - 1]!),
  };
}

/**
 * A holiday's day added: the open design steps of every running project on
 * or after it move one working day later, with the design's end and later
 * stages, filed as OTHER ("Holiday: Diwali"), never anyone's delay. Once per
 * project per day (a dedupe key), so adding the same day again, or again
 * after taking it off, never moves a plan twice. A holiday before today
 * moves nothing. The number of projects moved.
 */
async function applyHoliday(studioId: string, day: string, name: string, byId: string, now: Date): Promise<number> {
  if (daysBetween(istDay(now), day) < 0) return 0;
  const projects = await prisma.homeProject.findMany({ where: { introduction: { studioId }, ...RUNNING_DESIGN }, select: { id: true } });
  const actor: ProjectActor = { type: 'STUDIO', id: byId };
  let moved = 0;
  for (const p of projects) {
    const didMove = await prisma.$transaction(async (tx) => {
      const first = await recordEventOnce(tx, { projectId: p.id, type: 'design.holiday_moved', actor, refId: null, payload: { day, name }, dedupeKey: dedupeKey('holiday', p.id, day), at: now });
      if (!first) return false;
      const withHoliday = await projectCalendar(tx, p.id);
      const before: StudioCalendar = { workingDays: withHoliday.workingDays, holidays: new Set([...withHoliday.holidays].filter((d) => d !== day)) };
      if (!isWorkingDay(day, before)) return false;
      const { stages, steps } = await readPlan(tx, p.id);
      const moves = holidayStepShift(steps, day, before, withHoliday);
      const plan = designEndShift(stages, day, 1, moves.length > 0, 'OTHER', withHoliday);
      if (moves.length === 0 && !plan) return false;
      await writeDesignShift(tx, { projectId: p.id, moves, plan, stages, reason: 'OTHER', note: holidayNote(name), byId, actor, now, ref: { holiday: day } });
      return true;
    });
    if (didMove) moved++;
  }
  return moved;
}

async function saveHolidays(rows: { day: string; name: string }[], now: Date): Promise<LeaveResult> {
  const member = await currentMember();
  if (!writer(member) || !mayApproveHold(member)) return { ok: false, error: NOT_ALLOWED };
  if (rows.length === 0) return { ok: false, error: 'Add at least one holiday.' };
  const existing = new Set((await prisma.studioHoliday.findMany({ where: { studioId: member.studioId }, select: { day: true } })).map((h) => dayFromDb(h.day)));
  for (const r of rows) {
    await prisma.studioHoliday.upsert({
      where: { studioId_day: { studioId: member.studioId, day: dayToDb(r.day) } },
      create: { studioId: member.studioId, day: dayToDb(r.day), name: r.name },
      update: { name: r.name },
    });
  }
  // Only days new to the list move plans (a day already there was planned around). Latest first: a step between two new holidays then moves once, for the earlier one only.
  let projects = 0;
  for (const r of rows.filter((x) => !existing.has(x.day)).sort((a, b) => daysBetween(a.day, b.day))) projects = Math.max(projects, await applyHoliday(member.studioId, r.day, r.name, member.userId, now));
  const added = rows.filter((r) => !existing.has(r.day)).length;
  const renamed = rows.length - added;
  const parts = [`${added} holiday${added === 1 ? '' : 's'} added`];
  if (renamed) parts.push(`${renamed} already on the list (name kept up to date)`);
  const moved = projects ? ` Design dates moved on ${projects} running project${projects === 1 ? '' : 's'}.` : ' No running design plan had a step on or after them.';
  return { ok: true, message: `${parts.join(', ')}.${moved}` };
}

/** One holiday, from the form. */
export async function addHoliday(input: { day: unknown; name: unknown }, now = new Date()): Promise<LeaveResult> {
  if (!isDay(input.day)) return { ok: false, error: 'Pick the day.' };
  return saveHolidays([{ day: input.day, name: cleanHolidayName(input.name) }], now);
}

/** A pasted list, one per line. Nothing is saved when a line cannot be read. */
export async function addHolidayList(text: unknown, now = new Date()): Promise<LeaveResult> {
  const parsed = parseHolidayList(text);
  if (parsed.errors.length) {
    const e = parsed.errors[0]!;
    return { ok: false, error: e.line ? `Line ${e.line} (“${e.text}”): ${e.error}${parsed.errors.length > 1 ? ` And ${parsed.errors.length - 1} more line${parsed.errors.length === 2 ? '' : 's'}.` : ''} Nothing was saved.` : e.error };
  }
  return saveHolidays(parsed.rows, now);
}

/** Takes a holiday off the list. Nothing moves back (owner's rule, 13 Nov 2026): the dates it moved stay. */
export async function removeHoliday(day: unknown): Promise<LeaveResult> {
  const member = await currentMember();
  if (!writer(member) || !mayApproveHold(member)) return { ok: false, error: NOT_ALLOWED };
  if (!isDay(day)) return { ok: false, error: 'That holiday is not on the list. Reload the page.' };
  const { count } = await prisma.studioHoliday.deleteMany({ where: { studioId: member.studioId, day: dayToDb(day) } });
  if (count === 0) return { ok: false, error: 'That holiday is not on the list any more. Reload the page.' };
  return { ok: true, message: 'Taken off the list. Design dates it moved stay where they are; move a step by hand if needed.' };
}

// ── Leave ─────────────────────────────────────────────────────

export interface LeaveRowView {
  id: string;
  memberId: string;
  who: string;
  fromDay: string;
  toDay: string;
  kind: LeaveKind;
  kindLabel: string;
  /** Only the member and the approvers see the reason. */
  reason: string | null;
  status: LeaveStatus;
  workingDays: number;
  mine: boolean;
  shiftedProjects: number | null;
}

export interface LeaveView {
  month: string;
  today: string;
  weeks: (string | null)[][];
  /** Per day of the month: holiday name, the studio's day off, who is on leave. */
  days: Record<string, { holiday: string | null; off: boolean; leave: { who: string; status: LeaveStatus }[] }>;
  /** Waiting for approval (approvers: everyone's; others: their own). */
  waiting: LeaveRowView[];
  /** Mine, newest first. */
  mine: LeaveRowView[];
  /** Approved leave from today on, everyone's. */
  upcoming: LeaveRowView[];
  canApprove: boolean;
  canAsk: boolean;
  meId: string;
  /** For an approver entering leave for someone. */
  team: { id: string; name: string }[];
  kinds: { key: LeaveKind; label: string }[];
}

export async function leaveView(month: string, now = new Date()): Promise<LeaveView | null> {
  const member = await currentMember();
  if (!member) return null;
  const today = istDay(now);
  const weeks = monthGrid(month);
  const monthDays = weeks.flat().filter((d): d is string => d !== null);
  if (monthDays.length === 0) return null;
  const first = monthDays[0]!;
  const last = monthDays[monthDays.length - 1]!;
  const approver = mayApproveHold(member);
  const [studio, members, leaves] = await Promise.all([
    prisma.studio.findUnique({ where: { id: member.studioId }, select: { workingDays: true, holidays: { select: { day: true, name: true } } } }),
    prisma.studioMember.findMany({ where: { studioId: member.studioId, status: 'ACTIVE' }, select: { id: true, user: { select: { name: true } } } }),
    prisma.studioLeave.findMany({
      where: {
        studioId: member.studioId,
        OR: [
          { fromDay: { lte: dayToDb(last) }, toDay: { gte: dayToDb(first) } },
          { status: 'ASKED' },
          { memberId: member.id },
          { status: 'APPROVED', toDay: { gte: dayToDb(today) } },
        ],
      },
      orderBy: { fromDay: 'asc' },
      take: 500,
      select: { id: true, memberId: true, fromDay: true, toDay: true, kind: true, reason: true, status: true, shiftedProjects: true, askedAt: true, member: { select: { user: { select: { name: true } } } } },
    }),
  ]);
  if (!studio) return null;
  const cal = calendarOf({ workingDays: studio.workingDays, holidays: studio.holidays });
  const holidayName = new Map(studio.holidays.map((h) => [dayFromDb(h.day), h.name?.trim() || 'Holiday']));
  const rows: (LeaveRowView & { askedAt: Date })[] = leaves.map((l) => {
    const fromDay = dayFromDb(l.fromDay);
    const toDay = dayFromDb(l.toDay);
    const mine = l.memberId === member.id;
    const kind = (l.kind === 'UNPLANNED' ? 'UNPLANNED' : 'PLANNED') as LeaveKind;
    return {
      id: l.id,
      memberId: l.memberId,
      who: l.member.user.name?.trim() || 'Someone',
      fromDay,
      toDay,
      kind,
      kindLabel: LEAVE_KINDS[kind],
      reason: mine || approver ? l.reason : null,
      status: isLeaveStatus(l.status) ? l.status : 'ASKED',
      workingDays: leaveWorkingDays(fromDay, toDay, cal),
      mine,
      shiftedProjects: l.shiftedProjects,
      askedAt: l.askedAt,
    };
  });
  const days: LeaveView['days'] = {};
  for (const d of monthDays) {
    days[d] = {
      holiday: holidayName.get(d) ?? null,
      off: !cal.workingDays.includes(isoWeekday(d)),
      leave: rows.filter((r) => (r.status === 'APPROVED' || r.status === 'ASKED') && leaveCovers(r, d)).map((r) => ({ who: r.who, status: r.status })),
    };
  }
  const strip = ({ askedAt: _a, ...r }: LeaveRowView & { askedAt: Date }): LeaveRowView => r;
  return {
    month,
    today,
    weeks,
    days,
    waiting: rows.filter((r) => r.status === 'ASKED' && (approver || r.mine)).map(strip),
    mine: rows.filter((r) => r.mine).sort((a, b) => b.askedAt.getTime() - a.askedAt.getTime()).slice(0, 20).map(strip),
    upcoming: rows.filter((r) => r.status === 'APPROVED' && daysBetween(today, r.toDay) >= 0).map(strip),
    canApprove: writer(member) && approver,
    canAsk: writer(member),
    meId: member.id,
    team: approver ? members.map((m) => ({ id: m.id, name: m.user.name?.trim() || 'Someone' })).sort((a, b) => a.name.localeCompare(b.name)) : [],
    kinds: (Object.keys(LEAVE_KINDS) as LeaveKind[]).map((key) => ({ key, label: LEAVE_KINDS[key] })),
  };
}

/**
 * Applies an approved leave inside the caller's transaction: for each running
 * project the member is the designer on, every open design step planned on
 * or after the leave's first day moves later by the studio's working days
 * inside the leave, with the design's end and every later stage. The next
 * open step carries a step delay, Designer on leave (the studio's side);
 * the plan moves are filed as STUDIO. Execution steps move only as the
 * design's end moves later stages, as every design delay does. Once per
 * leave and project (a dedupe key). The number of projects moved.
 */
async function applyLeave(tx: Prisma.TransactionClient, leave: { id: string; studioId: string; memberId: string; fromDay: string; toDay: string }, byId: string, now: Date): Promise<{ days: number; projects: number }> {
  const studio = await tx.studio.findUnique({ where: { id: leave.studioId }, select: { workingDays: true, holidays: { select: { day: true } } } });
  const studioCal = calendarOf({ workingDays: studio?.workingDays, holidays: studio?.holidays });
  const days = leaveWorkingDays(leave.fromDay, leave.toDay, studioCal);
  if (days === 0) return { days: 0, projects: 0 };
  const projects = await tx.homeProject.findMany({ where: { introduction: { studioId: leave.studioId }, designerId: leave.memberId, ...RUNNING_DESIGN }, select: { id: true } });
  const actor: ProjectActor = { type: 'STUDIO', id: byId };
  const note = leaveNote(leave.fromDay, leave.toDay, days);
  let moved = 0;
  for (const p of projects) {
    if (!(await recordEventOnce(tx, { projectId: p.id, type: 'design.leave_moved', actor, refId: leave.id, payload: { fromDay: leave.fromDay, toDay: leave.toDay, days }, dedupeKey: dedupeKey('leave', leave.id, p.id), at: now }))) continue;
    const cal = await projectCalendar(tx, p.id);
    const { stages, steps } = await readPlan(tx, p.id);
    const moves = shiftOpenStepsFrom(steps, leave.fromDay, days, cal);
    const plan = designEndShift(stages, leave.fromDay, days, moves.length > 0, 'STUDIO', cal);
    if (moves.length === 0 && !plan) continue;
    const next = moves[0];
    if (next) {
      await tx.homeStepDelay.create({ data: { projectId: p.id, stepId: next.id, fromDate: dayToDb(next.from), toDate: dayToDb(next.to), side: 'STUDIO', reason: 'DESIGNER_LEAVE', note, byId, at: now } });
    }
    await writeDesignShift(tx, { projectId: p.id, moves, plan, stages, reason: 'STUDIO', note, byId, actor, now, ref: { leaveId: leave.id } });
    moved++;
  }
  return { days, projects: moved };
}

const TX = { timeout: 60_000, maxWait: 10_000 } as const;

async function approveInside(tx: Prisma.TransactionClient, leave: { id: string; studioId: string; memberId: string; fromDay: Date; toDay: Date }, byId: string, now: Date) {
  const r = await applyLeave(tx, { id: leave.id, studioId: leave.studioId, memberId: leave.memberId, fromDay: dayFromDb(leave.fromDay), toDay: dayFromDb(leave.toDay) }, byId, now);
  await tx.studioLeave.update({ where: { id: leave.id }, data: { shiftedDays: r.days, shiftedProjects: r.projects } });
  return r;
}

const approvedWords = (r: { days: number; projects: number }) =>
  r.projects
    ? ` The open design steps on ${r.projects} project${r.projects === 1 ? '' : 's'} moved ${r.days} working day${r.days === 1 ? '' : 's'} later, as our delay (designer on leave).`
    : ' No running design plan of theirs had a step to move.';

/**
 * Asks for leave. Anyone asks for their own; the owner or the design head
 * may enter it for anyone (unplanned leave after the fact, say), and theirs
 * is approved at once, as a hold asked by an approver is.
 */
export async function askLeave(input: { memberId?: unknown; fromDay: unknown; toDay: unknown; kind: unknown; reason: unknown }, now = new Date()): Promise<LeaveResult> {
  const member = await currentMember();
  if (!writer(member)) return { ok: false, error: 'Sign in to your studio to ask for leave.' };
  const approver = mayApproveHold(member);
  const forId = typeof input.memberId === 'string' && input.memberId ? input.memberId : member.id;
  if (forId !== member.id && !approver) return { ok: false, error: 'You ask for your own leave. The owner or the design head may enter it for someone else.' };
  const target = await prisma.studioMember.findFirst({ where: { id: forId, studioId: member.studioId }, select: { id: true } });
  if (!target) return { ok: false, error: 'That person is not on your team. Reload the page.' };
  const existing = await prisma.studioLeave.findMany({ where: { memberId: forId, status: { in: ['ASKED', 'APPROVED'] } }, select: { fromDay: true, toDay: true, status: true } });
  const ok = checkLeaveAsk(input, istDay(now), existing.map((l) => ({ fromDay: dayFromDb(l.fromDay), toDay: dayFromDb(l.toDay), status: l.status })));
  if (!ok.ok) return ok;
  const result = await prisma.$transaction(async (tx) => {
    const row = await tx.studioLeave.create({
      data: {
        studioId: member.studioId,
        memberId: forId,
        fromDay: dayToDb(ok.fromDay),
        toDay: dayToDb(ok.toDay),
        kind: ok.kind,
        reason: ok.reason,
        askedById: member.userId,
        askedAt: now,
        ...(approver ? { status: 'APPROVED', decidedById: member.userId, decidedAt: now } : {}),
      },
      select: { id: true, studioId: true, memberId: true, fromDay: true, toDay: true },
    });
    return approver ? approveInside(tx, row, member.userId, now) : null;
  }, TX);
  if (!result) return { ok: true, message: 'Asked. The owner or the design head approves it; design dates move only when it is approved.' };
  return { ok: true, message: `Leave entered and approved.${approvedWords(result)}` };
}

/** The owner or the design head approves (the plans move now) or declines. */
export async function decideLeave(leaveId: unknown, approve: boolean, now = new Date()): Promise<LeaveResult> {
  const member = await currentMember();
  if (!writer(member) || !mayApproveHold(member)) return { ok: false, error: NOT_ALLOWED };
  const id = typeof leaveId === 'string' ? leaveId : '';
  const result = await prisma.$transaction(async (tx) => {
    const { count } = await tx.studioLeave.updateMany({
      where: { id, studioId: member.studioId, status: 'ASKED' },
      data: { status: approve ? 'APPROVED' : 'DECLINED', decidedById: member.userId, decidedAt: now },
    });
    if (count !== 1) return 'gone' as const;
    if (!approve) return null;
    const leave = await tx.studioLeave.findUniqueOrThrow({ where: { id }, select: { id: true, studioId: true, memberId: true, fromDay: true, toDay: true } });
    return approveInside(tx, leave, member.userId, now);
  }, TX);
  if (result === 'gone') return { ok: false, error: 'That leave is not waiting for approval any more. Reload the page.' };
  if (!result) return { ok: true, message: 'Declined.' };
  return { ok: true, message: `Approved.${approvedWords(result)}` };
}

/** The member withdraws leave not approved yet. Approved leave stays: its dates have moved. */
export async function withdrawLeave(leaveId: unknown, now = new Date()): Promise<LeaveResult> {
  const member = await currentMember();
  if (!writer(member)) return { ok: false, error: 'Sign in to your studio.' };
  const id = typeof leaveId === 'string' ? leaveId : '';
  const { count } = await prisma.studioLeave.updateMany({
    where: { id, studioId: member.studioId, status: 'ASKED', ...(mayApproveHold(member) ? {} : { memberId: member.id }) },
    data: { status: 'WITHDRAWN', decidedById: member.userId, decidedAt: now },
  });
  if (count !== 1) return { ok: false, error: 'That leave is not waiting any more. Reload the page.' };
  return { ok: true, message: 'Withdrawn.' };
}
