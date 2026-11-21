/**
 * Holidays and leave (owner, 13 Nov 2026). Pure: days are 'YYYY-MM-DD'.
 * Tested in tests/studio-leave-rules.test.ts.
 *
 * - Holidays: "One holiday calendar as well. I'll give you the list of
 *   holidays so that you can just directly publish. The design timeline
 *   should change." A holiday added on a working day moves every open design
 *   step on or after it one working day later (a step on the holiday lands
 *   on the next working day), with the design's end and every later stage,
 *   as a late tick does. Filed as OTHER ("Holiday: Diwali"), never anyone's
 *   delay. Taking a holiday off moves nothing back.
 * - Leave: "a calendar-based leave approval system, where people put their
 *   planned or unplanned leaves, based on approval. It should impact the
 *   projects on which they are working. Only in design; execution won't be
 *   hampered." On approval, every open design step of the member's projects
 *   planned on or after the leave's first day moves later by the studio's
 *   working days inside the leave, with the design's end and every later
 *   stage (as every design delay already moves them).
 */

import { addDays, daysBetween, isDay, isWorkingDay, shiftWorkingDays, type StudioCalendar } from '@/modules/project/working-days';
import { planMove, type MovePlan, type RuleStage } from '@/modules/project/project-rules';

// ── Holidays ──────────────────────────────────────────────────

export const HOLIDAY_NAME_MAX = 60;
/** A pasted list is a year's holidays, not a database import. */
export const HOLIDAY_LIST_MAX = 100;

export interface ParsedHoliday {
  day: string;
  name: string;
}

export interface HolidayListResult {
  rows: ParsedHoliday[];
  /** Lines that could not be read, in the owner's words. */
  errors: { line: number; text: string; error: string }[];
}

const ISO_LINE = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s*[-–,:|\t]\s*|\s+|$)(.*)$/;
const DMY_LINE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:\s*[-–,:|\t]\s*|\s+|$)(.*)$/;

const pad = (n: string) => n.padStart(2, '0');

/** A holiday's name: one line, trimmed, "Holiday" when none was given. */
export function cleanHolidayName(raw: unknown): string {
  const name = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
  return (name || 'Holiday').slice(0, HOLIDAY_NAME_MAX);
}

/**
 * One holiday per line, "2026-11-08 Diwali" or "08/11/2026 Diwali" (day
 * first, as India writes it). Blank lines are skipped; a day written twice
 * keeps its first name. Lines that cannot be read come back as errors, so
 * the owner fixes them and pastes again.
 */
export function parseHolidayList(text: unknown): HolidayListResult {
  const rows: ParsedHoliday[] = [];
  const errors: HolidayListResult['errors'] = [];
  const seen = new Set<string>();
  const lines = typeof text === 'string' ? text.replace(/\r\n?/g, '\n').split('\n') : [];
  lines.forEach((raw, k) => {
    const line = raw.trim();
    if (!line) return;
    const iso = ISO_LINE.exec(line);
    const dmy = iso ? null : DMY_LINE.exec(line);
    const day = iso ? `${iso[1]}-${pad(iso[2]!)}-${pad(iso[3]!)}` : dmy ? `${dmy[3]}-${pad(dmy[2]!)}-${pad(dmy[1]!)}` : null;
    if (!day) {
      errors.push({ line: k + 1, text: line, error: 'Start the line with the day, like 2026-11-08 or 08/11/2026.' });
      return;
    }
    if (!isDay(day)) {
      errors.push({ line: k + 1, text: line, error: 'That day is not on the calendar.' });
      return;
    }
    if (seen.has(day)) return;
    seen.add(day);
    rows.push({ day, name: cleanHolidayName((iso ?? dmy)![4]) });
  });
  if (rows.length > HOLIDAY_LIST_MAX) {
    return { rows: [], errors: [{ line: 0, text: '', error: `Paste at most ${HOLIDAY_LIST_MAX} holidays at a time.` }] };
  }
  return { rows, errors };
}

/** What a holiday's moves are filed under: OTHER, with this note. Never anyone's delay. */
export const holidayNote = (name: string): string => `Holiday: ${cleanHolidayName(name)}`;

// ── Moving a design plan ──────────────────────────────────────

export interface ShiftStep {
  id: string;
  plannedOn: string | null;
  done: boolean;
  inScope: boolean;
}

export type StepMove = { id: string; from: string; to: string };

/**
 * Every open design step (in scope, not done) planned on or after `from`
 * moves `days` working days later. Done steps and steps before `from`
 * stay. Order and gaps are kept, counted in the studio's working days.
 */
export function shiftOpenStepsFrom(steps: readonly ShiftStep[], from: string, days: number, cal: StudioCalendar): StepMove[] {
  if (!isDay(from) || days <= 0) return [];
  return steps
    .filter((s) => !s.done && s.inScope && s.plannedOn && isDay(s.plannedOn) && daysBetween(from, s.plannedOn) >= 0)
    .map((s) => ({ id: s.id, from: s.plannedOn!, to: shiftWorkingDays(s.plannedOn!, days, cal) }));
}

/**
 * A holiday added on `day`: nothing when the studio did not work that day
 * anyway (a Monday off, a holiday already); else every open step on or after
 * it one working day later, counted in the calendar with the holiday in
 * (`withHoliday`), so a step on the holiday lands on the next working day.
 */
export function holidayStepShift(steps: readonly ShiftStep[], day: string, before: StudioCalendar, withHoliday: StudioCalendar): StepMove[] {
  if (!isDay(day) || !isWorkingDay(day, before)) return [];
  return shiftOpenStepsFrom(steps, day, 1, withHoliday);
}

/**
 * The design's end and every later stage not finished, `days` working days
 * later, when the design is not finished and either a step moved or the
 * design ends on or after `from`. Null when nothing moves. `reason` decides
 * whose days they are: OTHER for a holiday, STUDIO for leave.
 */
export function designEndShift(stages: readonly RuleStage[], from: string, days: number, stepsMoved: boolean, reason: 'OTHER' | 'STUDIO', cal: StudioCalendar): MovePlan | null {
  if (days <= 0 || !isDay(from)) return null;
  const design = stages.find((s) => s.kind === 'DESIGN');
  if (!design || design.actualEnd !== null) return null;
  if (!stepsMoved && daysBetween(from, design.plannedEnd) < 0) return null;
  const r = planMove(stages, { stageId: design.id, field: 'PLANNED_END', to: shiftWorkingDays(design.plannedEnd, days, cal), reason, shiftLater: true }, cal);
  return r.ok ? r.plan : null;
}

// ── Leave ─────────────────────────────────────────────────────

export const LEAVE_KINDS = {
  PLANNED: 'Planned',
  UNPLANNED: 'Unplanned',
} as const;
export type LeaveKind = keyof typeof LEAVE_KINDS;
export const isLeaveKind = (v: unknown): v is LeaveKind => typeof v === 'string' && v in LEAVE_KINDS;

export type LeaveStatus = 'ASKED' | 'APPROVED' | 'DECLINED' | 'WITHDRAWN';
export const LEAVE_STATUS_LABEL: Record<LeaveStatus, string> = {
  ASKED: 'Waiting',
  APPROVED: 'Approved',
  DECLINED: 'Declined',
  WITHDRAWN: 'Withdrawn',
};
export const isLeaveStatus = (v: unknown): v is LeaveStatus => typeof v === 'string' && v in LEAVE_STATUS_LABEL;

export const LEAVE_REASON_MAX = 120;
/** One leave is at most this many calendar days; longer is a conversation, not a form. */
export const LEAVE_MAX_DAYS = 60;
/** Unplanned leave is entered after the fact, up to this many days back. */
export const LEAVE_BACK_DAYS = 60;

export interface LeaveSpan {
  fromDay: string;
  toDay: string;
  status: string;
}

/** Leave that is asked or approved: it holds its days. */
export const isOpenLeave = (l: Pick<LeaveSpan, 'status'>): boolean => l.status === 'ASKED' || l.status === 'APPROVED';

/** The studio's working days inside the leave, both ends included: what the plans move by. */
export function leaveWorkingDays(fromDay: string, toDay: string, cal: StudioCalendar): number {
  if (!isDay(fromDay) || !isDay(toDay) || daysBetween(fromDay, toDay) < 0) return 0;
  let n = 0;
  for (let d = fromDay; daysBetween(d, toDay) >= 0; d = addDays(d, 1)) if (isWorkingDay(d, cal)) n++;
  return n;
}

/** Calendar days of a leave, both ends included. */
export const leaveCalendarDays = (fromDay: string, toDay: string): number => (isDay(fromDay) && isDay(toDay) ? Math.max(0, daysBetween(fromDay, toDay) + 1) : 0);

/** Whether a leave covers a day. */
export const leaveCovers = (l: Pick<LeaveSpan, 'fromDay' | 'toDay'>, day: string): boolean => daysBetween(l.fromDay, day) >= 0 && daysBetween(day, l.toDay) >= 0;

// ── Casual and sick leave (owner, 21 Nov 2026) ───────────────
/*
 * "We provide 1 Casual leave and 1 sick leave every month", and "the leaves
 * not taken should be accumulated each month": each type earns one day a
 * month, from November 2026 (when this began) or the month the person joined,
 * and what is not taken carries on, with no reset. More than the balance may
 * still be asked; the rest is unpaid ("Allow as unpaid"). "Any casual leave
 * which is taken but not approved it will be calculated as 2 leaves": a casual
 * day off that was not approved by that day (still waiting once the day has
 * passed, or approved only afterwards) counts as two days. Declined and
 * withdrawn leave counts nothing. Counted in the studio's working days. Leave
 * before the allowance began takes nothing off it.
 */

/** The first month leave is earned. */
export const ALLOWANCE_FROM = '2026-11';
const monthNo = (m: string) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;
/** Days of a type earned from `startMonth` through `month`, both included (none before the start). */
export const earnedThrough = (type: LeaveType, startMonth: string, month: string): number =>
  Math.max(0, monthNo(month) - monthNo(startMonth) + 1) * MONTHLY_ALLOWANCE[type];
/** Where a person's allowance starts: November 2026, or the month they joined when later. */
export const allowanceStart = (joinedDay: string | null): string => (joinedDay && joinedDay.slice(0, 7) > ALLOWANCE_FROM ? joinedDay.slice(0, 7) : ALLOWANCE_FROM);

export const LEAVE_TYPES = { CASUAL: 'Casual leave', SICK: 'Sick leave' } as const;
export type LeaveType = keyof typeof LEAVE_TYPES;
export const isLeaveType = (v: unknown): v is LeaveType => typeof v === 'string' && v in LEAVE_TYPES;
/** Paid days of each type every month. */
export const MONTHLY_ALLOWANCE: Readonly<Record<LeaveType, number>> = { CASUAL: 1, SICK: 1 };
/** A casual day taken without approval counts as this many. */
export const UNAPPROVED_CASUAL_WEIGHT = 2;

/** A leave's type; leave from before types (21 Nov 2026) is casual when planned, sick when not. */
export const typeOfLeave = (type: string | null | undefined, kind: string | null | undefined): LeaveType =>
  isLeaveType(type) ? type : kind === 'UNPLANNED' ? 'SICK' : 'CASUAL';

export interface CountedLeave {
  id: string;
  type: LeaveType;
  fromDay: string;
  toDay: string;
  status: string;
  /** The IST day it was approved, when it was. */
  approvedDay: string | null;
  /** Tie-break for leaves starting the same day. */
  askedAt: number;
  /** A half day (owner, 21 Nov 2026): one day, counted as half. */
  halfDay?: boolean;
}

/** Who may mark a half day (owner, 21 Nov 2026: "for sales head and design head"): the owner, the design head, a sales head or admin. */
export function mayMarkHalfDay(m: { role: string; designHead?: boolean | null }, salesSystem: string | null | undefined): boolean {
  return m.role === 'OWNER' || (m.role === 'DESIGNER' && m.designHead === true) || (m.role === 'SALES' && (salesSystem === 'HEAD' || salesSystem === 'ADMIN'));
}

/** What one leave counts for. `days` is what it takes off the allowance; `unapprovedDays` the casual days counted twice. */
export interface LeaveCount {
  workingDays: number;
  days: number;
  paid: number;
  unpaid: number;
  unapprovedDays: number;
}

/** How much one working day of this leave counts: two for a casual day taken without approval, else one. */
export function dayWeight(l: Pick<CountedLeave, 'type' | 'status' | 'approvedDay' | 'halfDay'>, day: string, today: string): number {
  const base = l.halfDay ? 0.5 : 1;
  if (l.type !== 'CASUAL') return base;
  if (l.status === 'APPROVED') return l.approvedDay !== null && daysBetween(day, l.approvedDay) > 0 ? base * UNAPPROVED_CASUAL_WEIGHT : base;
  // Still waiting: a day already gone was taken without approval; today and later are not taken yet.
  return daysBetween(day, today) > 0 ? base * UNAPPROVED_CASUAL_WEIGHT : base;
}

/**
 * Paid and unpaid days for one member's leave, type by type, in the order the
 * leave falls (then the order asked): each day is paid while the days earned
 * up to its month are not used up, and unpaid after. Asked and approved leave
 * count; declined and withdrawn count nothing.
 */
export function countLeave(leaves: readonly CountedLeave[], cal: StudioCalendar, today: string, startMonth: string = ALLOWANCE_FROM): Map<string, LeaveCount> {
  const out = new Map<string, LeaveCount>();
  const used = new Map<LeaveType, number>();
  const order = [...leaves].sort((a, b) => a.fromDay.localeCompare(b.fromDay) || a.askedAt - b.askedAt);
  for (const l of order) {
    const c: LeaveCount = { workingDays: 0, days: 0, paid: 0, unpaid: 0, unapprovedDays: 0 };
    if (isOpenLeave(l) && isDay(l.fromDay) && isDay(l.toDay)) {
      for (let d = l.fromDay; daysBetween(d, l.toDay) >= 0; d = addDays(d, 1)) {
        if (!isWorkingDay(d, cal)) continue;
        const w = dayWeight(l, d, today);
        c.workingDays++;
        c.days += w;
        if (w > (l.halfDay ? 0.5 : 1)) c.unapprovedDays++;
        // Before the allowance began: nothing earned and nothing used.
        if (d.slice(0, 7) < startMonth) {
          c.paid += w;
          continue;
        }
        const before = used.get(l.type) ?? 0;
        const paid = Math.max(0, Math.min(w, earnedThrough(l.type, startMonth, d.slice(0, 7)) - before));
        used.set(l.type, before + w);
        c.paid += paid;
        c.unpaid += w - paid;
      }
    }
    out.set(l.id, c);
  }
  return out;
}

/**
 * The balance per type in `month`: days earned so far (carried over from
 * earlier months), used up to the month's end (as counted, unapproved casual
 * days twice), and left.
 */
export function leaveBalance(
  leaves: readonly CountedLeave[],
  month: string,
  cal: StudioCalendar,
  today: string,
  startMonth: string = ALLOWANCE_FROM,
): Record<LeaveType, { earned: number; used: number; left: number }> {
  const out = {} as Record<LeaveType, { earned: number; used: number; left: number }>;
  for (const type of Object.keys(LEAVE_TYPES) as LeaveType[]) {
    let usedDays = 0;
    for (const l of leaves) {
      if (l.type !== type || !isOpenLeave(l) || !isDay(l.fromDay) || !isDay(l.toDay)) continue;
      for (let d = l.fromDay; daysBetween(d, l.toDay) >= 0; d = addDays(d, 1)) {
        const m = d.slice(0, 7);
        if (m >= startMonth && m <= month && isWorkingDay(d, cal)) usedDays += dayWeight(l, d, today);
      }
    }
    const earned = earnedThrough(type, startMonth, month);
    out[type] = { earned, used: usedDays, left: Math.max(0, earned - usedDays) };
  }
  return out;
}

// ── Working on a holiday (owner, 21 Nov 2026) ────────────────
/*
 * "If anyone is working on a holiday 2 day salary will be paid but it needs
 * to be pre approved." Asked like leave, for days the studio is closed (a
 * holiday on its list or the weekly off), from today on; approved by the owner
 * or the design head. A day approved on or before it is paid double; approved
 * later is not. Kept in the leave table with this type: it never counts as
 * leave and never moves a plan.
 */
export const HOLIDAY_WORK = 'HOLIDAY_WORK';
/** A day of approved holiday work is paid as this many days. */
export const HOLIDAY_WORK_PAY = 2;

/** The days in the range the studio is closed (its holidays and weekly off). */
export function closedDays(fromDay: string, toDay: string, cal: StudioCalendar): string[] {
  const out: string[] = [];
  if (!isDay(fromDay) || !isDay(toDay)) return out;
  for (let d = fromDay; daysBetween(d, toDay) >= 0; d = addDays(d, 1)) if (!isWorkingDay(d, cal)) out.push(d);
  return out;
}

export function checkHolidayWorkAsk(
  input: { fromDay: unknown; toDay: unknown; reason: unknown },
  today: string,
  cal: StudioCalendar,
): { ok: true; fromDay: string; toDay: string; reason: string } | { ok: false; error: string } {
  const fromDay = typeof input.fromDay === 'string' ? input.fromDay : '';
  const toDay = typeof input.toDay === 'string' && input.toDay ? input.toDay : fromDay;
  if (!isDay(fromDay) || !isDay(toDay)) return { ok: false, error: 'Pick the holiday you will work on.' };
  if (daysBetween(fromDay, toDay) < 0) return { ok: false, error: 'The last day is before the first day.' };
  if (daysBetween(today, fromDay) < 0) return { ok: false, error: 'Holiday work is approved beforehand: ask for today or a day ahead.' };
  if (leaveCalendarDays(fromDay, toDay) > 14) return { ok: false, error: 'Ask for up to two weeks at a time.' };
  const closed = closedDays(fromDay, toDay, cal);
  if (closed.length === 0) return { ok: false, error: 'Those are working days. Holiday work is for a holiday or the weekly off.' };
  if (closed.length !== leaveCalendarDays(fromDay, toDay)) return { ok: false, error: 'Pick only holidays or weekly offs: some of those days are working days.' };
  const reason = typeof input.reason === 'string' ? input.reason.replace(/\s+/g, ' ').trim() : '';
  if (reason.length < 3) return { ok: false, error: 'Say what the work is, like "Site handover" or "Factory visit".' };
  if (reason.length > LEAVE_REASON_MAX) return { ok: false, error: `Keep it under ${LEAVE_REASON_MAX} characters.` };
  return { ok: true, fromDay, toDay, reason };
}

/** Days of holiday work paid double: closed days approved on or before the day. Waiting, declined or approved late: none. */
export function holidayWorkPaidDays(l: { fromDay: string; toDay: string; status: string; approvedDay: string | null }, cal: StudioCalendar): { days: number; doublePaid: number } {
  const days = closedDays(l.fromDay, l.toDay, cal);
  if (l.status !== 'APPROVED' || !l.approvedDay) return { days: days.length, doublePaid: 0 };
  return { days: days.length, doublePaid: days.filter((d) => daysBetween(l.approvedDay!, d) >= 0).length };
}

export function checkLeaveAsk(
  input: { fromDay: unknown; toDay: unknown; kind?: unknown; type?: unknown; reason: unknown; halfDay?: unknown },
  today: string,
  /** The member's other leave. */
  existing: readonly LeaveSpan[],
): { ok: true; fromDay: string; toDay: string; kind: LeaveKind; type: LeaveType; reason: string; halfDay: boolean } | { ok: false; error: string } {
  const fromDay = typeof input.fromDay === 'string' ? input.fromDay : '';
  const halfDay = input.halfDay === true;
  const toDay = halfDay ? fromDay : typeof input.toDay === 'string' && input.toDay ? input.toDay : fromDay;
  if (!isDay(fromDay) || !isDay(toDay)) return { ok: false, error: 'Pick the first and last day of the leave.' };
  /* Casual or sick (owner, 21 Nov 2026); planned or not follows: sick leave and leave already taken are unplanned. */
  let kind: LeaveKind;
  let type: LeaveType;
  if (input.type !== undefined && input.type !== null && input.type !== '') {
    if (!isLeaveType(input.type)) return { ok: false, error: 'Say if it is casual leave or sick leave.' };
    type = input.type;
    kind = type === 'SICK' || daysBetween(today, fromDay) < 0 ? 'UNPLANNED' : 'PLANNED';
  } else {
    if (!isLeaveKind(input.kind)) return { ok: false, error: 'Say if it is casual leave or sick leave.' };
    kind = input.kind;
    type = typeOfLeave(null, kind);
  }
  if (daysBetween(fromDay, toDay) < 0) return { ok: false, error: 'The last day is before the first day.' };
  if (leaveCalendarDays(fromDay, toDay) > LEAVE_MAX_DAYS) return { ok: false, error: `One leave is at most ${LEAVE_MAX_DAYS} days. Talk to the owner about a longer one.` };
  if (kind === 'PLANNED' && daysBetween(today, fromDay) < 0) return { ok: false, error: 'Planned leave starts today or later. Leave already taken is unplanned.' };
  if (daysBetween(addDays(today, -LEAVE_BACK_DAYS), fromDay) < 0) return { ok: false, error: `Leave can be entered up to ${LEAVE_BACK_DAYS} days back.` };
  const reason = typeof input.reason === 'string' ? input.reason.replace(/\s+/g, ' ').trim() : '';
  if (reason.length < 3) return { ok: false, error: 'Say why in a few words, like "Sister\'s wedding" or "Fever".' };
  if (reason.length > LEAVE_REASON_MAX) return { ok: false, error: `Keep the reason under ${LEAVE_REASON_MAX} characters.` };
  const clash = existing.find((l) => isOpenLeave(l) && daysBetween(l.fromDay, toDay) >= 0 && daysBetween(fromDay, l.toDay) >= 0);
  if (clash) return { ok: false, error: `This overlaps leave already ${clash.status === 'APPROVED' ? 'approved' : 'asked for'} (${clash.fromDay} to ${clash.toDay}).` };
  return { ok: true, fromDay, toDay, kind, type, reason, halfDay };
}

/** What a leave's plan moves say, team only: "On leave 10 Nov to 12 Nov (3 working days)." */
export function leaveNote(fromDay: string, toDay: string, days: number): string {
  const span = fromDay === toDay ? fromDay : `${fromDay} to ${toDay}`;
  return `Designer on leave ${span} (${days} working day${days === 1 ? '' : 's'}).`;
}

// ── The month view ────────────────────────────────────────────

const MONTH_RE = /^(\d{4})-(\d{2})$/;

/** `?month=2026-11`, else this month. */
export function parseMonth(raw: unknown, today: string): string {
  if (typeof raw === 'string') {
    const m = MONTH_RE.exec(raw);
    if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12 && isDay(`${raw}-01`)) return raw;
  }
  return today.slice(0, 7);
}

/** The month before or after. */
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const k = y * 12 + (m - 1) + n;
  return `${Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, '0')}`;
}

/** The month's weeks, Monday first; days outside the month are null. */
export function monthGrid(month: string): (string | null)[][] {
  const first = `${month}-01`;
  if (!isDay(first)) return [];
  const js = new Date(`${first}T00:00:00Z`).getUTCDay();
  const lead = (js + 6) % 7; // Monday = 0
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = first; d.startsWith(month); d = addDays(d, 1)) cells.push(d);
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
