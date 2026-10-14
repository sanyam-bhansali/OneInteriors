/**
 * The studio calendar — the rules (leads at scale, 12 Oct 2026). Pure,
 * tested in tests/studio-leads-scale.test.ts; the reads are `calendar.ts`.
 *
 * Four things go on it, each where it already lives:
 *
 * - **Follow-ups**: a lead's next action and its date. A date with no time
 *   (saved as a bare day) is placed at 10 am India time.
 * - **Meetings**: a lead's meeting and its note.
 * - **Tasks**: `StudioTask`.
 * - **One Interiors appointments**: owner and PM, when there are any.
 *
 * Something not done whose time has passed is marked overdue.
 */

import { addDays, istDay, istMinutesOfDay, istTime, isDay } from '@/modules/project/working-days';
import { istDayEnd, istDayStart, istMonday, monthEnd, monthStart, shortDay } from './ist-range';

export type CalendarView = 'day' | 'week' | 'month';
export const CALENDAR_VIEWS: readonly CalendarView[] = ['day', 'week', 'month'];

export type CalendarKind = 'followup' | 'meeting' | 'task' | 'appointment';

export const KIND_WORDS: Record<CalendarKind, string> = {
  followup: 'Follow-up',
  meeting: 'Meeting',
  task: 'Task',
  appointment: 'One Interiors visit',
};

export interface CalendarItem {
  key: string;
  kind: CalendarKind;
  at: Date;
  /** IST day `YYYY-MM-DD`. */
  day: string;
  /** "10:00 am". */
  time: string;
  title: string;
  detail: string | null;
  leadId: string | null;
  href: string | null;
  ownerName: string | null;
  overdue: boolean;
  done: boolean;
  /** Tasks only. */
  taskId: string | null;
  /** The follow-up date had no time and was placed at 10 am. */
  defaultTime: boolean;
}

export interface FollowupIn {
  id: string;
  name: string;
  nextAction: string | null;
  nextActionOn: Date;
  ownerName: string | null;
}
export interface MeetingIn {
  id: string;
  name: string;
  meetingAt: Date;
  meetingNote: string | null;
  ownerName: string | null;
}
export interface TaskIn {
  id: string;
  title: string;
  dueAt: Date;
  doneAt: Date | null;
  leadId: string | null;
  leadName: string | null;
  ownerName: string | null;
}
export interface AppointmentIn {
  id: string;
  startsAt: Date;
  title: string;
  detail: string | null;
}

export interface CalendarWindow {
  view: CalendarView;
  /** The day the view is about (the one the person picked). */
  day: string;
  /** First and last IST day shown. */
  from: string;
  to: string;
  start: Date;
  end: Date;
  days: string[];
}

export function parseView(raw: unknown): CalendarView {
  return typeof raw === 'string' && (CALENDAR_VIEWS as readonly string[]).includes(raw) ? (raw as CalendarView) : 'week';
}

export function parseDay(raw: unknown, now: Date): string {
  return isDay(raw) ? raw : istDay(now);
}

/** The days a view covers. A month is drawn as whole weeks, Monday to Sunday. */
export function calendarWindow(view: CalendarView, day: string): CalendarWindow {
  let from = day;
  let to = day;
  if (view === 'week') {
    from = istMonday(day);
    to = addDays(from, 6);
  } else if (view === 'month') {
    from = istMonday(monthStart(day));
    to = addDays(istMonday(monthEnd(day)), 6);
  }
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return { view, day, from, to, start: istDayStart(from), end: istDayEnd(to), days };
}

/** The day the previous / next button goes to. */
export function shiftDay(view: CalendarView, day: string, dir: -1 | 1): string {
  if (view === 'day') return addDays(day, dir);
  if (view === 'week') return addDays(day, 7 * dir);
  const [y, m] = day.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + dir, 1));
  return d.toISOString().slice(0, 10);
}

/** "Mon 12 Oct", "12 – 18 Oct", "October 2026". */
export function windowTitle(w: CalendarWindow): string {
  if (w.view === 'day') {
    const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(`${w.day}T00:00:00Z`).getUTCDay()];
    return `${wd} ${shortDay(w.day)}`;
  }
  if (w.view === 'week') return `${shortDay(w.from)} – ${shortDay(w.to)}`;
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[Number(w.day.slice(5, 7)) - 1]} ${w.day.slice(0, 4)}`;
}

/** "10:00 am" in India. */
export function timeLabel(at: Date): string {
  const mins = istMinutesOfDay(at);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

/**
 * Where a follow-up sits. A bare day (saved at UTC or IST midnight, which is
 * how a date picker's value is stored) goes at 10 am India time on that day.
 */
export function followupAt(on: Date): { at: Date; defaultTime: boolean } {
  const utcMidnight = on.getUTCHours() === 0 && on.getUTCMinutes() === 0 && on.getUTCSeconds() === 0 && on.getUTCMilliseconds() === 0;
  if (utcMidnight) return { at: istTime(on.toISOString().slice(0, 10), '10:00'), defaultTime: true };
  if (istMinutesOfDay(on) === 0 && on.getUTCSeconds() === 0 && on.getUTCMilliseconds() === 0) return { at: istTime(istDay(on), '10:00'), defaultTime: true };
  return { at: on, defaultTime: false };
}

const leadHref = (id: string) => `/studio/clients/${id}`;

export function buildCalendarItems(
  input: { followups?: readonly FollowupIn[]; meetings?: readonly MeetingIn[]; tasks?: readonly TaskIn[]; appointments?: readonly AppointmentIn[] },
  now: Date,
  w?: Pick<CalendarWindow, 'start' | 'end'>,
): CalendarItem[] {
  const items: CalendarItem[] = [];
  const base = (at: Date) => ({ at, day: istDay(at), time: timeLabel(at) });

  for (const f of input.followups ?? []) {
    const { at, defaultTime } = followupAt(f.nextActionOn);
    items.push({
      key: `followup:${f.id}`,
      kind: 'followup',
      ...base(at),
      title: f.name,
      detail: f.nextAction ?? 'Follow up',
      leadId: f.id,
      href: leadHref(f.id),
      ownerName: f.ownerName,
      overdue: at.getTime() < now.getTime(),
      done: false,
      taskId: null,
      defaultTime,
    });
  }
  for (const m of input.meetings ?? []) {
    items.push({
      key: `meeting:${m.id}`,
      kind: 'meeting',
      ...base(m.meetingAt),
      title: m.name,
      detail: m.meetingNote ?? 'Meeting',
      leadId: m.id,
      href: leadHref(m.id),
      ownerName: m.ownerName,
      overdue: false,
      done: m.meetingAt.getTime() < now.getTime(),
      taskId: null,
      defaultTime: false,
    });
  }
  for (const t of input.tasks ?? []) {
    items.push({
      key: `task:${t.id}`,
      kind: 'task',
      ...base(t.dueAt),
      title: t.title,
      detail: t.leadName,
      leadId: t.leadId,
      href: t.leadId ? leadHref(t.leadId) : null,
      ownerName: t.ownerName,
      overdue: t.doneAt === null && t.dueAt.getTime() < now.getTime(),
      done: t.doneAt !== null,
      taskId: t.id,
      defaultTime: false,
    });
  }
  for (const a of input.appointments ?? []) {
    items.push({
      key: `appointment:${a.id}`,
      kind: 'appointment',
      ...base(a.startsAt),
      title: a.title,
      detail: a.detail,
      leadId: null,
      href: '/studio/calendar/appointments',
      ownerName: null,
      overdue: false,
      done: a.startsAt.getTime() < now.getTime(),
      taskId: null,
      defaultTime: false,
    });
  }

  const inWindow = w ? items.filter((i) => i.at >= w.start && i.at <= w.end) : items;
  return inWindow.sort((a, b) => a.at.getTime() - b.at.getTime() || a.key.localeCompare(b.key));
}

/** Items by IST day, every day of the window present (empty days included). */
export function itemsByDay(items: readonly CalendarItem[], days: readonly string[]): Map<string, CalendarItem[]> {
  const out = new Map<string, CalendarItem[]>(days.map((d) => [d, []]));
  for (const i of items) out.get(i.day)?.push(i);
  return out;
}
