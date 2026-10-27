/**
 * Office meetings — the rules (owner, 27 Oct 2026;
 * docs/studio-os/OFFICE-MEETINGS.md). Pure, tested in
 * tests/studio-office-meetings.test.ts; the reads and writes are
 * `meetings.ts`.
 *
 * Anyone at a studio sets up a meeting with anyone else there. Each person
 * asked answers: Accept, or Suggest another time. The organiser takes a
 * suggested time (the meeting moves there; that person is coming and the
 * others are asked again, since the time they said yes to is gone), moves
 * it themselves (everyone is asked again), or cancels it. Nothing moves by
 * itself and nobody is chased: one notice per change.
 */

import { istDay, istTime, isDay } from '@/modules/project/working-days';
import { timeLabel } from '@/modules/studio-sales/calendar-rules';
import { shortDay } from '@/modules/studio-sales/ist-range';

export type Answer = 'PENDING' | 'ACCEPTED' | 'PROPOSED';

export const MIN_MINUTES = 15;
export const MAX_MINUTES = 480;
export const MAX_GUESTS = 20;
/** The lengths offered; any whole number of minutes in range is taken. */
export const LENGTHS = [15, 30, 45, 60, 90, 120] as const;

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

/** A day and an "HH:MM" India time, as an instant, in the future. */
export function checkWhen(day: unknown, time: unknown, now: Date): Checked<Date> {
  if (!isDay(day)) return { ok: false, error: 'Pick a day.' };
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return { ok: false, error: 'Pick a time.' };
  const at = istTime(day, time);
  if (at.getTime() < now.getTime() - 60_000) return { ok: false, error: 'That time has passed. Pick a later one.' };
  return { ok: true, value: at };
}

export interface MeetingInput {
  title: unknown;
  day: unknown;
  time: unknown;
  minutes: unknown;
  place?: unknown;
  note?: unknown;
  guestIds: unknown;
}

export interface MeetingValue {
  title: string;
  startsAt: Date;
  minutes: number;
  place: string | null;
  note: string | null;
  guestIds: string[];
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');

/**
 * A new meeting: a title, a future time, a length, and one to twenty other
 * people at the studio (`others`: the ids of members who may be asked; never
 * the organiser).
 */
export function checkMeeting(input: MeetingInput, organiserId: string, others: ReadonlySet<string>, now: Date): Checked<MeetingValue> {
  const title = clean(input.title, 120);
  if (title.length < 2) return { ok: false, error: 'Say what the meeting is about.' };
  const when = checkWhen(input.day, input.time, now);
  if (!when.ok) return when;
  const minutes = Number(input.minutes ?? 30);
  if (!Number.isInteger(minutes) || minutes < MIN_MINUTES || minutes > MAX_MINUTES) return { ok: false, error: 'A meeting runs 15 minutes to 8 hours.' };
  const ids = Array.isArray(input.guestIds) ? [...new Set(input.guestIds.filter((x): x is string => typeof x === 'string'))] : [];
  const guestIds = ids.filter((id) => id !== organiserId);
  if (guestIds.length === 0) return { ok: false, error: 'Pick who to meet.' };
  if (guestIds.length > MAX_GUESTS) return { ok: false, error: `Up to ${MAX_GUESTS} people in one meeting.` };
  if (guestIds.some((id) => !others.has(id))) return { ok: false, error: 'Someone picked is not on your studio’s team.' };
  const place = clean(input.place, 120) || null;
  const note = typeof input.note === 'string' ? input.note.trim().slice(0, 1000) || null : null;
  return { ok: true, value: { title, startsAt: when.value, minutes, place, note, guestIds } };
}

export interface GuestState {
  memberId: string;
  answer: Answer;
  proposedAt: Date | null;
}

export interface MeetingState {
  startsAt: Date;
  cancelledAt: Date | null;
  organiserId: string | null;
  guests: GuestState[];
}

/** Whether a meeting may still be answered or changed: not cancelled, not started. */
export function isOpen(m: Pick<MeetingState, 'startsAt' | 'cancelledAt'>, now: Date): boolean {
  return m.cancelledAt === null && m.startsAt.getTime() > now.getTime();
}

/** What a guest's answer writes, or why not. `at` only for a suggestion. */
export function guestAnswer(
  m: MeetingState,
  memberId: string,
  kind: 'accept' | 'propose',
  at: Date | null,
  now: Date,
): Checked<{ answer: Answer; proposedAt: Date | null }> {
  if (m.cancelledAt) return { ok: false, error: 'That meeting was cancelled.' };
  if (!isOpen(m, now)) return { ok: false, error: 'That meeting has started or is over.' };
  if (!m.guests.some((g) => g.memberId === memberId)) return { ok: false, error: 'You were not asked to that meeting.' };
  if (kind === 'accept') return { ok: true, value: { answer: 'ACCEPTED', proposedAt: null } };
  if (!at) return { ok: false, error: 'Pick the time that suits you.' };
  if (at.getTime() <= now.getTime()) return { ok: false, error: 'That time has passed. Pick a later one.' };
  if (at.getTime() === m.startsAt.getTime()) return { ok: false, error: 'That is the meeting’s time already. Accept it instead.' };
  return { ok: true, value: { answer: 'PROPOSED', proposedAt: at } };
}

/**
 * The organiser moves the meeting: to a time they pick, or to one a guest
 * suggested (`fromGuest`). Everyone is asked again, except the guest whose
 * time it was, who is coming.
 */
export function moveMeeting(
  m: MeetingState,
  organiserId: string,
  to: Date | null,
  fromGuest: string | null,
  now: Date,
): Checked<{ startsAt: Date; guests: GuestState[] }> {
  if (m.organiserId !== organiserId) return { ok: false, error: 'Only the person who set it up can move it.' };
  if (m.cancelledAt) return { ok: false, error: 'That meeting was cancelled.' };
  let at = to;
  if (fromGuest) {
    const g = m.guests.find((x) => x.memberId === fromGuest);
    if (!g || g.answer !== 'PROPOSED' || !g.proposedAt) return { ok: false, error: 'They have not suggested a time.' };
    at = g.proposedAt;
  }
  if (!at) return { ok: false, error: 'Pick the new time.' };
  if (at.getTime() <= now.getTime()) return { ok: false, error: 'That time has passed. Pick a later one.' };
  if (at.getTime() === m.startsAt.getTime() && !fromGuest) return { ok: false, error: 'That is its time already.' };
  return {
    ok: true,
    value: {
      startsAt: at,
      guests: m.guests.map((g) => (g.memberId === fromGuest ? { ...g, answer: 'ACCEPTED' as const, proposedAt: null } : { ...g, answer: 'PENDING' as const, proposedAt: null })),
    },
  };
}

export function mayCancel(m: MeetingState, memberId: string): Checked<true> {
  if (m.organiserId !== memberId) return { ok: false, error: 'Only the person who set it up can cancel it.' };
  if (m.cancelledAt) return { ok: false, error: 'It is cancelled already.' };
  return { ok: true, value: true };
}

/** "Tue 27 Oct, 3:00 pm". */
export function whenLabel(at: Date): string {
  const day = istDay(at);
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(`${day}T00:00:00Z`).getUTCDay()];
  return `${wd} ${shortDay(day)}, ${timeLabel(at)}`;
}

/** "30 min", "1 hr", "1 hr 30 min". */
export function lengthLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

/**
 * One line for where a meeting stands, as one person sees it: "Confirmed",
 * "Waiting for Renuka", "Renuka suggests Thu 29 Oct, 3:00 pm", "Cancelled".
 */
export function standing(m: Omit<MeetingState, 'guests'> & { guests: (GuestState & { name: string })[] }, now: Date): { word: string; tone: 'good' | 'warn' | 'muted' | 'bad' } {
  if (m.cancelledAt) return { word: 'Cancelled', tone: 'bad' };
  const proposed = m.guests.filter((g) => g.answer === 'PROPOSED' && g.proposedAt);
  if (!isOpen(m, now)) return { word: 'Done', tone: 'muted' };
  if (proposed.length > 0) {
    const g = proposed[0]!;
    return { word: `${g.name} suggests ${whenLabel(g.proposedAt!)}${proposed.length > 1 ? ` (+${proposed.length - 1} more)` : ''}`, tone: 'warn' };
  }
  const waiting = m.guests.filter((g) => g.answer === 'PENDING');
  if (waiting.length === 0) return { word: 'Confirmed', tone: 'good' };
  const names = waiting.map((g) => g.name);
  return { word: `Waiting for ${names.length <= 2 ? names.join(' and ') : `${names[0]} and ${names.length - 1} others`}`, tone: 'warn' };
}
