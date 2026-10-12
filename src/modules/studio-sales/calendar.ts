import 'server-only';

/**
 * The studio calendar — the reads (leads at scale, 12 Oct 2026). Rules in
 * `calendar-rules.ts`. Follow-ups and meetings come from the leads the
 * person may see (studio/lead-scope.ts), tasks from `tasks.ts`
 * (task-rules.ts), and for owner and PM the One Interiors appointments.
 * Owner and PM pick everyone or one person; a salesperson sees only their
 * own. Each kind is capped, and the page says so when a cap is hit.
 */

import { prisma } from '@/lib/prisma';
import { LIVE } from '@/modules/studio-practice/demo-lead';
import { myLeadScope } from '@/modules/studio/lead-scope';
import { myAppointments, KIND_LABELS } from '@/modules/studio/introduction';
import { isLive } from '@/modules/studio/features';
import { scopedLeadWhere } from './lead-where';
import { buildCalendarItems, calendarWindow, type CalendarItem, type CalendarView, type CalendarWindow } from './calendar-rules';
import { tasksBetween, taskPeople } from './tasks';

export const CALENDAR_CAP = 500;
/** Above this many follow-ups in a week or month, they are counted per day instead of listed. */
export const FOLD_FOLLOWUPS_ABOVE = 150;

/** Start of an India day, as an instant. */
const istStart = (day: string) => new Date(`${day}T00:00:00+05:30`);

export interface CalendarData {
  window: CalendarWindow;
  items: CalendarItem[];
  /** Owner and PM: everyone or one person. */
  seesAll: boolean;
  people: { id: string; name: string }[];
  /** The person picked (owner, PM), or null for everyone. */
  who: string | null;
  meId: string;
  /** Some kind hit the cap; narrow to one person or a shorter view. */
  capped: boolean;
  /** Follow-ups missed before this window (open leads), for the "late" link. */
  missedBefore: number;
  /**
   * Week or month with more follow-ups than can be listed: how many fall on
   * each day (counted in the database), and no follow-up items. Null when
   * the follow-ups are listed one by one.
   */
  followupCounts: Record<string, number> | null;
}

const nameOf = (u: { name: string | null; email: string | null; phone?: string | null } | null | undefined) =>
  u ? u.name?.trim() || u.email?.split('@')[0] || u.phone || 'Someone' : null;

export async function myCalendar(view: CalendarView, day: string, whoRaw: string | null, now = new Date()): Promise<CalendarData | null> {
  const scope = await myLeadScope();
  if (!scope) return null;
  const w = calendarWindow(view, day);
  const people = await taskPeople();
  const who = scope.seesAll ? (whoRaw && people.some((p) => p.id === whoRaw) ? whoRaw : null) : scope.member.id;
  const owner = scope.seesAll && who ? { owner: who } : {};
  const leads = scopedLeadWhere(scope, owner, now, LIVE);
  const ownerSelect = { assignedTo: { select: { user: { select: { name: true, email: true, phone: true } } } } } as const;
  const followupWhere = (from: Date, to: Date, toInclusive = true) => ({
    ...LIVE,
    studioId: scope.studioId,
    AND: [leads, { stage: { kind: { in: ['OPEN' as const, 'WON' as const] } }, nextActionOn: toInclusive ? { gte: from, lte: to } : { gte: from, lt: to } }],
  });
  try {
    /* A busy studio has hundreds of calls a day. A week or month then shows
       a count per day, from the database, rather than the first few hundred
       names, which would all fall on the first day. */
    let followupCounts: Record<string, number> | null = null;
    if (view !== 'day' && (await prisma.studioClient.count({ where: { ...LIVE, ...followupWhere(w.start, w.end) } })) > FOLD_FOLLOWUPS_ABOVE) {
      const counts = await Promise.all(
        w.days.map((d, i) => prisma.studioClient.count({ where: { ...LIVE, ...followupWhere(istStart(d), w.days[i + 1] ? istStart(w.days[i + 1]!) : new Date(istStart(d).getTime() + 86_400_000), false) } })),
      );
      followupCounts = Object.fromEntries(w.days.map((d, i) => [d, counts[i]!]));
    }
    const [followups, meetings, tasks, appointments, missedBefore] = await Promise.all([
      followupCounts
        ? Promise.resolve([])
        : prisma.studioClient.findMany({
        where: followupWhere(w.start, w.end),
        orderBy: [{ nextActionOn: 'asc' }, { id: 'asc' }],
        take: CALENDAR_CAP,
        select: { id: true, name: true, nextAction: true, nextActionOn: true, ...ownerSelect },
      }),
      prisma.studioClient.findMany({
        where: { studioId: scope.studioId, AND: [leads, { meetingAt: { gte: w.start, lte: w.end } }] },
        orderBy: [{ meetingAt: 'asc' }, { id: 'asc' }],
        take: CALENDAR_CAP,
        select: { id: true, name: true, meetingAt: true, meetingNote: true, ...ownerSelect },
      }),
      tasksBetween(scope.member, w.start, w.end, who, CALENDAR_CAP),
      scope.seesAll && !who && isLive('calendar') ? myAppointments({ from: w.start, to: w.end }).catch(() => []) : Promise.resolve([]),
      prisma.studioClient.count({ where: { ...LIVE, studioId: scope.studioId, AND: [scopedLeadWhere(scope, { ...owner, due: ['missed'] }, now, LIVE), { nextActionOn: { lt: w.start } }] } }),
    ]);
    const items = buildCalendarItems(
      {
        followups: followups.map((f) => ({ id: f.id, name: f.name, nextAction: f.nextAction, nextActionOn: f.nextActionOn!, ownerName: nameOf(f.assignedTo?.user) })),
        meetings: meetings.map((m) => ({ id: m.id, name: m.name, meetingAt: m.meetingAt!, meetingNote: m.meetingNote, ownerName: nameOf(m.assignedTo?.user) })),
        tasks: tasks.map((t) => ({ id: t.id, title: t.title, dueAt: t.dueAt, doneAt: t.doneAt, leadId: t.leadId, leadName: t.leadName, ownerName: t.assignedToName })),
        appointments: appointments
          .filter((a) => a.status !== 'CANCELLED')
          .map((a) => ({ id: a.id, startsAt: a.startsAt, title: KIND_LABELS[a.kind] ?? 'Appointment', detail: [a.customerName, a.locality].filter(Boolean).join(' · ') || null })),
      },
      now,
      w,
    );
    return {
      window: w,
      items,
      seesAll: scope.seesAll,
      people,
      who,
      meId: scope.member.id,
      capped: followups.length >= CALENDAR_CAP || meetings.length >= CALENDAR_CAP || tasks.length >= CALENDAR_CAP,
      missedBefore,
      followupCounts,
    };
  } catch (error) {
    console.error('[calendar] read failed', error instanceof Error ? error.message : 'unknown');
    return { window: w, items: [], seesAll: scope.seesAll, people, who, meId: scope.member.id, capped: false, missedBefore: 0, followupCounts: null };
  }
}
