import 'server-only';

/**
 * Office meetings — reads and writes (owner, 27 Oct 2026;
 * docs/studio-os/OFFICE-MEETINGS.md). The rules are `meeting-rules.ts`.
 *
 * Everyone at a studio who is not suspended may set one up and be asked to
 * one, whatever their role: a meeting is between people, not about leads or
 * money. A person sees the meetings they set up or were asked to; the owner
 * and a project manager also see everyone's on the calendar (who is busy
 * when). Every write is scoped by the member's studio, refused while viewing
 * as someone (View as is read only), and tells the other side once, in their
 * inbox (notify/service.ts): never WhatsApp, never chased.
 */

import { after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentMember, type StudioMemberRef } from '@/modules/studio/access';
import { notify } from '@/modules/notify/service';
import { checkMeeting, checkWhen, guestAnswer, isOpen, mayCancel, moveMeeting, whenLabel, type Answer, type MeetingInput } from './meeting-rules';

export type Done = { ok: true; message?: string } | { ok: false; error: string };

export interface MeetingPerson {
  id: string;
  name: string;
  role: string;
}

export interface MeetingGuestRow {
  memberId: string;
  name: string;
  answer: Answer;
  proposedAt: Date | null;
  note: string | null;
}

export interface MeetingRow {
  id: string;
  title: string;
  startsAt: Date;
  minutes: number;
  place: string | null;
  note: string | null;
  cancelledAt: Date | null;
  organiserId: string | null;
  organiserName: string;
  guests: MeetingGuestRow[];
  /** The viewer set it up. */
  mine: boolean;
  /** The viewer's own answer, when they were asked. */
  myAnswer: Answer | null;
}

const ROLE_WORD: Record<string, string> = { OWNER: 'Owner', PM: 'Project manager', SALES: 'Sales', DESIGNER: 'Designer', ACCOUNTS: 'Accounts', SUPERVISOR: 'Site supervisor' };

const nameOf = (u: { name: string | null; email: string | null; phone: string | null } | null | undefined) =>
  u ? u.name?.trim() || u.email?.split('@')[0] || u.phone || 'Someone' : 'Someone';

const PERSON = { select: { name: true, email: true, phone: true } } as const;
const SELECT = {
  id: true,
  title: true,
  startsAt: true,
  minutes: true,
  place: true,
  note: true,
  cancelledAt: true,
  organiserId: true,
  organiser: { select: { user: PERSON } },
  guests: { orderBy: { id: 'asc' as const }, select: { memberId: true, answer: true, proposedAt: true, note: true, member: { select: { user: PERSON } } } },
} as const;

type Raw = {
  id: string;
  title: string;
  startsAt: Date;
  minutes: number;
  place: string | null;
  note: string | null;
  cancelledAt: Date | null;
  organiserId: string | null;
  organiser: { user: { name: string | null; email: string | null; phone: string | null } } | null;
  guests: { memberId: string; answer: Answer; proposedAt: Date | null; note: string | null; member: { user: { name: string | null; email: string | null; phone: string | null } } }[];
};

function toRow(m: Raw, meId: string): MeetingRow {
  return {
    id: m.id,
    title: m.title,
    startsAt: m.startsAt,
    minutes: m.minutes,
    place: m.place,
    note: m.note,
    cancelledAt: m.cancelledAt,
    organiserId: m.organiserId,
    organiserName: m.organiser ? nameOf(m.organiser.user) : 'Someone who left',
    guests: m.guests.map((g) => ({ memberId: g.memberId, name: nameOf(g.member.user), answer: g.answer, proposedAt: g.proposedAt, note: g.note })),
    mine: m.organiserId === meId,
    myAnswer: m.guests.find((g) => g.memberId === meId)?.answer ?? null,
  };
}

/** Meetings this member is in: set up by them, or asked to. */
const involving = (memberId: string) => ({ OR: [{ organiserId: memberId }, { guests: { some: { memberId } } }] });

async function me(): Promise<StudioMemberRef | null> {
  const m = await currentMember();
  return m && m.status === 'ACTIVE' ? m : null;
}

/** A write's member: active, and not someone viewing as them. */
async function writer(): Promise<StudioMemberRef | { error: string }> {
  const m = await me();
  if (!m) return { error: 'Sign in to your studio first.' };
  if (m.viewOnly) return { error: 'Viewing as someone is read only.' };
  return m;
}

/** Everyone at the studio who may be asked to a meeting: not suspended, not the person asking. */
export async function meetingPeople(): Promise<MeetingPerson[]> {
  const m = await me();
  if (!m) return [];
  try {
    const rows = await prisma.studioMember.findMany({
      where: { studioId: m.studioId, status: { in: ['ACTIVE', 'INVITED'] }, id: { not: m.id } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, user: PERSON },
    });
    return rows.map((r) => ({ id: r.id, name: nameOf(r.user), role: ROLE_WORD[r.role] ?? r.role })).sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

/**
 * Meetings between two instants for the calendar: this member's own, or (owner
 * and PM) everyone's, or one person's (`who`: the caller has checked the
 * member may see that person's calendar, as calendar.ts does). Cancelled ones
 * are left off.
 */
export async function meetingsBetween(member: StudioMemberRef, start: Date, end: Date, who: string | null, take = 500): Promise<MeetingRow[]> {
  const everyone = member.role === 'OWNER' || member.role === 'PM';
  const whose = who ? involving(who) : everyone ? {} : involving(member.id);
  try {
    const rows = await prisma.studioMeeting.findMany({
      where: { AND: [{ studioId: member.studioId, cancelledAt: null, startsAt: { gte: start, lte: end } }, whose] },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      take,
      select: SELECT,
    });
    return rows.map((r) => toRow(r as Raw, member.id));
  } catch (error) {
    console.error('[meetings] read failed', error instanceof Error ? error.message : 'unknown');
    return [];
  }
}

export interface MyMeetings {
  /** Asked of me and not answered, or the time changed: answer these. */
  toAnswer: MeetingRow[];
  /** Mine, with a suggested time waiting on me. */
  suggestions: MeetingRow[];
  /** Everything coming up I am in (set up, accepted, or still waiting on others). */
  upcoming: MeetingRow[];
  /** The last two weeks, and ones cancelled lately. */
  past: MeetingRow[];
  meId: string;
  /** A site supervisor came from site mode: the page offers the way back. */
  fromSite: boolean;
}

/** The Meetings page: what needs an answer from me first, then what is coming up. */
export async function myMeetings(now = new Date()): Promise<MyMeetings | null> {
  const m = await me();
  if (!m) return null;
  const since = new Date(now.getTime() - 14 * 86_400_000);
  try {
    const rows = (
      await prisma.studioMeeting.findMany({
        where: { AND: [{ studioId: m.studioId }, involving(m.id), { OR: [{ startsAt: { gte: since } }, { cancelledAt: { gte: since } }] }] },
        orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
        take: 300,
        select: SELECT,
      })
    ).map((r) => toRow(r as Raw, m.id));
    const open = rows.filter((r) => isOpen(r, now));
    const toAnswer = open.filter((r) => r.myAnswer === 'PENDING');
    const suggestions = open.filter((r) => r.mine && r.guests.some((g) => g.answer === 'PROPOSED'));
    const shown = new Set([...toAnswer, ...suggestions].map((r) => r.id));
    return {
      toAnswer,
      suggestions,
      upcoming: open.filter((r) => !shown.has(r.id)),
      past: rows.filter((r) => !isOpen(r, now)).reverse(),
      meId: m.id,
      fromSite: m.role === 'SUPERVISOR',
    };
  } catch (error) {
    console.error('[meetings] read failed', error instanceof Error ? error.message : 'unknown');
    return { toAnswer: [], suggestions: [], upcoming: [], past: [], meId: m.id, fromSite: m.role === 'SUPERVISOR' };
  }
}

/** How many meetings wait on this member: to answer, and suggestions on theirs. For the home and the calendar. */
export async function meetingsWaiting(member: StudioMemberRef, now = new Date()): Promise<number> {
  try {
    const open = { studioId: member.studioId, cancelledAt: null, startsAt: { gt: now } };
    const [asked, suggested] = await Promise.all([
      prisma.studioMeetingGuest.count({ where: { memberId: member.id, answer: 'PENDING', meeting: open } }),
      prisma.studioMeeting.count({ where: { ...open, organiserId: member.id, guests: { some: { answer: 'PROPOSED' } } } }),
    ]);
    return asked + suggested;
  } catch {
    return 0;
  }
}

/**
 * Tell people about a change, once each, after the response is sent (a push
 * or an email per person must not hold up the button). Never throws.
 */
function tell(memberIds: string[], what: 'asked' | 'accepted' | 'proposed' | 'moved' | 'cancelled', by: StudioMemberRef, meetingId: string, title: string, at: Date): void {
  if (memberIds.length === 0) return;
  after(() => sendNotices(memberIds, what, by, meetingId, title, at));
}

async function sendNotices(memberIds: string[], what: 'asked' | 'accepted' | 'proposed' | 'moved' | 'cancelled', by: StudioMemberRef, meetingId: string, title: string, at: Date): Promise<void> {
  try {
    const [byUser, people] = await Promise.all([
      prisma.user.findUnique({ where: { id: by.userId }, select: PERSON.select }),
      prisma.studioMember.findMany({ where: { id: { in: memberIds }, studioId: by.studioId }, select: { userId: true } }),
    ]);
    const event = { kind: 'office-meeting' as const, what, by: nameOf(byUser), meetingId, title, when: whenLabel(at) };
    await Promise.all(people.map((p) => notify(p.userId, event)));
  } catch (error) {
    console.error('[meetings] notice failed', error instanceof Error ? error.name : 'unknown');
  }
}

export async function createMeeting(input: MeetingInput, now = new Date()): Promise<Done & { id?: string }> {
  const m = await writer();
  if ('error' in m) return { ok: false, error: m.error };
  const others = await prisma.studioMember.findMany({ where: { studioId: m.studioId, status: { in: ['ACTIVE', 'INVITED'] }, id: { not: m.id } }, select: { id: true } });
  const checked = checkMeeting(input, m.id, new Set(others.map((o) => o.id)), now);
  if (!checked.ok) return checked;
  const v = checked.value;
  try {
    const created = await prisma.studioMeeting.create({
      data: {
        studioId: m.studioId,
        title: v.title,
        startsAt: v.startsAt,
        minutes: v.minutes,
        place: v.place,
        note: v.note,
        organiserId: m.id,
        guests: { create: v.guestIds.map((memberId) => ({ memberId })) },
      },
      select: { id: true },
    });
    tell(v.guestIds, 'asked', m, created.id, v.title, v.startsAt);
    return { ok: true, id: created.id, message: `Asked. ${v.guestIds.length === 1 ? 'They accept it' : 'Each of them accepts it'} or suggest another time; you will see it here.` };
  } catch (error) {
    console.error('[meetings] create failed', error instanceof Error ? error.message : 'unknown');
    return { ok: false, error: 'That did not save. Try again.' };
  }
}

async function load(id: unknown, studioId: string) {
  if (typeof id !== 'string' || id.length > 40) return null;
  return prisma.studioMeeting.findFirst({
    where: { id, studioId },
    select: { id: true, title: true, startsAt: true, cancelledAt: true, organiserId: true, guests: { select: { id: true, memberId: true, answer: true, proposedAt: true } } },
  });
}

/** A guest accepts, or suggests another time (`day` + `time`, India), with an optional note. */
export async function answerMeeting(id: unknown, kind: 'accept' | 'propose', day: unknown, time: unknown, note: unknown, now = new Date()): Promise<Done> {
  const m = await writer();
  if ('error' in m) return { ok: false, error: m.error };
  const meeting = await load(id, m.studioId);
  if (!meeting) return { ok: false, error: 'That meeting is not in your studio.' };
  let at: Date | null = null;
  if (kind === 'propose') {
    const when = checkWhen(day, time, now);
    if (!when.ok) return when;
    at = when.value;
  }
  const next = guestAnswer(meeting, m.id, kind, at, now);
  if (!next.ok) return next;
  const words = typeof note === 'string' ? note.trim().slice(0, 300) || null : null;
  try {
    await prisma.studioMeetingGuest.update({
      where: { meetingId_memberId: { meetingId: meeting.id, memberId: m.id } },
      data: { answer: next.value.answer, proposedAt: next.value.proposedAt, note: words, answeredAt: now },
    });
    if (meeting.organiserId) tell([meeting.organiserId], kind === 'accept' ? 'accepted' : 'proposed', m, meeting.id, meeting.title, at ?? meeting.startsAt);
    return { ok: true, message: kind === 'accept' ? 'Accepted. It is on your calendar.' : 'Suggested. The person who set it up takes your time or keeps theirs.' };
  } catch (error) {
    console.error('[meetings] answer failed', error instanceof Error ? error.message : 'unknown');
    return { ok: false, error: 'That did not save. Try again.' };
  }
}

/**
 * The organiser moves the meeting: to a guest's suggested time
 * (`fromGuest`), or to a day and time they pick. The others are asked again.
 */
export async function moveOfficeMeeting(id: unknown, fromGuest: unknown, day: unknown, time: unknown, now = new Date()): Promise<Done> {
  const m = await writer();
  if ('error' in m) return { ok: false, error: m.error };
  const meeting = await load(id, m.studioId);
  if (!meeting) return { ok: false, error: 'That meeting is not in your studio.' };
  let to: Date | null = null;
  const guest = typeof fromGuest === 'string' && fromGuest ? fromGuest : null;
  if (!guest) {
    const when = checkWhen(day, time, now);
    if (!when.ok) return when;
    to = when.value;
  }
  const next = moveMeeting(meeting, m.id, to, guest, now);
  if (!next.ok) return next;
  const taken = guest ? meeting.guests.find((g) => g.memberId === guest) : null;
  try {
    await prisma.$transaction([
      /* Taking a suggestion: only while it is still the one shown (they may have changed it since); otherwise this throws and nothing is written. */
      ...(taken ? [prisma.studioMeetingGuest.update({ where: { meetingId_memberId: { meetingId: meeting.id, memberId: taken.memberId }, answer: 'PROPOSED', proposedAt: taken.proposedAt }, data: { answeredAt: now } })] : []),
      prisma.studioMeeting.update({ where: { id: meeting.id }, data: { startsAt: next.value.startsAt } }),
      ...next.value.guests.map((g) =>
        prisma.studioMeetingGuest.update({
          where: { meetingId_memberId: { meetingId: meeting.id, memberId: g.memberId } },
          data: { answer: g.answer, proposedAt: g.proposedAt, ...(g.memberId === guest ? { answeredAt: now } : { note: null }) },
        }),
      ),
    ]);
    /* The guest whose time it was hears it was taken; the others that it moved. */
    if (guest) tell([guest], 'accepted', m, meeting.id, meeting.title, next.value.startsAt);
    tell(meeting.guests.map((g) => g.memberId).filter((id) => id !== guest), 'moved', m, meeting.id, meeting.title, next.value.startsAt);
    return { ok: true, message: guest ? 'Moved to their time. The others are asked again.' : 'Moved. Everyone is asked again.' };
  } catch (error) {
    if ((error as { code?: string }).code === 'P2025') return { ok: false, error: 'Their suggestion changed just now. Look at it again.' };
    console.error('[meetings] move failed', error instanceof Error ? error.message : 'unknown');
    return { ok: false, error: 'That did not save. Try again.' };
  }
}

export async function cancelOfficeMeeting(id: unknown, now = new Date()): Promise<Done> {
  const m = await writer();
  if ('error' in m) return { ok: false, error: m.error };
  const meeting = await load(id, m.studioId);
  if (!meeting) return { ok: false, error: 'That meeting is not in your studio.' };
  const ok = mayCancel(meeting, m.id);
  if (!ok.ok) return ok;
  try {
    await prisma.studioMeeting.update({ where: { id: meeting.id }, data: { cancelledAt: now } });
    if (isOpen(meeting, now)) tell(meeting.guests.map((g) => g.memberId), 'cancelled', m, meeting.id, meeting.title, meeting.startsAt);
    return { ok: true, message: 'Cancelled. Everyone asked has a notice.' };
  } catch (error) {
    console.error('[meetings] cancel failed', error instanceof Error ? error.message : 'unknown');
    return { ok: false, error: 'That did not save. Try again.' };
  }
}
