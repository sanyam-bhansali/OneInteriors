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

export function checkLeaveAsk(
  input: { fromDay: unknown; toDay: unknown; kind: unknown; reason: unknown },
  today: string,
  /** The member's other leave. */
  existing: readonly LeaveSpan[],
): { ok: true; fromDay: string; toDay: string; kind: LeaveKind; reason: string } | { ok: false; error: string } {
  if (!isLeaveKind(input.kind)) return { ok: false, error: 'Say if the leave is planned or unplanned.' };
  const fromDay = typeof input.fromDay === 'string' ? input.fromDay : '';
  const toDay = typeof input.toDay === 'string' && input.toDay ? input.toDay : fromDay;
  if (!isDay(fromDay) || !isDay(toDay)) return { ok: false, error: 'Pick the first and last day of the leave.' };
  if (daysBetween(fromDay, toDay) < 0) return { ok: false, error: 'The last day is before the first day.' };
  if (leaveCalendarDays(fromDay, toDay) > LEAVE_MAX_DAYS) return { ok: false, error: `One leave is at most ${LEAVE_MAX_DAYS} days. Talk to the owner about a longer one.` };
  if (input.kind === 'PLANNED' && daysBetween(today, fromDay) < 0) return { ok: false, error: 'Planned leave starts today or later. Leave already taken is unplanned.' };
  if (daysBetween(addDays(today, -LEAVE_BACK_DAYS), fromDay) < 0) return { ok: false, error: `Leave can be entered up to ${LEAVE_BACK_DAYS} days back.` };
  const reason = typeof input.reason === 'string' ? input.reason.replace(/\s+/g, ' ').trim() : '';
  if (reason.length < 3) return { ok: false, error: 'Say why in a few words, like "Sister\'s wedding" or "Fever".' };
  if (reason.length > LEAVE_REASON_MAX) return { ok: false, error: `Keep the reason under ${LEAVE_REASON_MAX} characters.` };
  const clash = existing.find((l) => isOpenLeave(l) && daysBetween(l.fromDay, toDay) >= 0 && daysBetween(fromDay, l.toDay) >= 0);
  if (clash) return { ok: false, error: `This overlaps leave already ${clash.status === 'APPROVED' ? 'approved' : 'asked for'} (${clash.fromDay} to ${clash.toDay}).` };
  return { ok: true, fromDay, toDay, kind: input.kind, reason };
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
