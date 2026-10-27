import { describe, expect, it } from 'vitest';
import { checkMeeting, checkWhen, guestAnswer, isOpen, lengthLabel, mayCancel, moveMeeting, standing, whenLabel, type MeetingState } from '@/modules/studio-office/meeting-rules';
import { buildCalendarItems } from '@/modules/studio-sales/calendar-rules';
import { appsFor } from '@/modules/studio/apps';
import { mayOpen } from '@/modules/studio/surfaces';
import type { StudioRoleName } from '@/modules/studio/roles';

/** Office meetings (owner, 27 Oct 2026): docs/studio-os/OFFICE-MEETINGS.md. */

// 10:00 IST on Tue 27 Oct 2026.
const NOW = new Date('2026-10-27T04:30:00Z');
const at = (iso: string) => new Date(iso);
const OTHERS = new Set(['renuka', 'gunjan', 'khushi']);

const meeting = (over: Partial<MeetingState> = {}): MeetingState => ({
  startsAt: at('2026-10-28T09:30:00Z'), // Wed 3:00 pm IST
  cancelledAt: null,
  organiserId: 'yogesh',
  guests: [
    { memberId: 'renuka', answer: 'PENDING', proposedAt: null },
    { memberId: 'gunjan', answer: 'ACCEPTED', proposedAt: null },
  ],
  ...over,
});

describe('setting up a meeting', () => {
  const base = { title: 'Kitchen design review', day: '2026-10-28', time: '15:00', minutes: 30, guestIds: ['renuka'] };

  it('takes a title, a future India time, a length and people at the studio', () => {
    const r = checkMeeting({ ...base, place: '  Conference   room ', note: '' }, 'yogesh', OTHERS, NOW);
    expect(r).toEqual({ ok: true, value: { title: 'Kitchen design review', startsAt: at('2026-10-28T09:30:00Z'), minutes: 30, place: 'Conference room', note: null, guestIds: ['renuka'] } });
  });

  it('refuses a past time, a missing title, nobody, or someone from another studio', () => {
    expect(checkMeeting({ ...base, day: '2026-10-27', time: '09:00' }, 'yogesh', OTHERS, NOW).ok).toBe(false);
    expect(checkMeeting({ ...base, title: ' ' }, 'yogesh', OTHERS, NOW).ok).toBe(false);
    expect(checkMeeting({ ...base, guestIds: [] }, 'yogesh', OTHERS, NOW).ok).toBe(false);
    expect(checkMeeting({ ...base, guestIds: ['stranger'] }, 'yogesh', OTHERS, NOW)).toEqual({ ok: false, error: 'Someone picked is not on your studio’s team.' });
    expect(checkMeeting({ ...base, minutes: 5 }, 'yogesh', OTHERS, NOW).ok).toBe(false);
    expect(checkMeeting({ ...base, minutes: 600 }, 'yogesh', OTHERS, NOW).ok).toBe(false);
  });

  it('drops the organiser and repeats from the people, and needs someone left', () => {
    const r = checkMeeting({ ...base, guestIds: ['renuka', 'renuka', 'yogesh', 'gunjan'] }, 'yogesh', OTHERS, NOW);
    expect(r.ok && r.value.guestIds).toEqual(['renuka', 'gunjan']);
    expect(checkMeeting({ ...base, guestIds: ['yogesh'] }, 'yogesh', OTHERS, NOW)).toEqual({ ok: false, error: 'Pick who to meet.' });
  });

  it('reads day and time as India time', () => {
    expect(checkWhen('2026-10-27', '10:30', NOW)).toEqual({ ok: true, value: at('2026-10-27T05:00:00Z') });
    expect(checkWhen('27-10-2026', '10:30', NOW).ok).toBe(false);
    expect(checkWhen('2026-10-27', '25:00', NOW).ok).toBe(false);
  });
});

describe('a guest answers', () => {
  it('accepts', () => {
    expect(guestAnswer(meeting(), 'renuka', 'accept', null, NOW)).toEqual({ ok: true, value: { answer: 'ACCEPTED', proposedAt: null } });
  });

  it('suggests another future time, not the same one', () => {
    const t = at('2026-10-29T09:30:00Z');
    expect(guestAnswer(meeting(), 'renuka', 'propose', t, NOW)).toEqual({ ok: true, value: { answer: 'PROPOSED', proposedAt: t } });
    expect(guestAnswer(meeting(), 'renuka', 'propose', at('2026-10-28T09:30:00Z'), NOW).ok).toBe(false);
    expect(guestAnswer(meeting(), 'renuka', 'propose', at('2026-10-26T09:30:00Z'), NOW).ok).toBe(false);
    expect(guestAnswer(meeting(), 'renuka', 'propose', null, NOW).ok).toBe(false);
  });

  it('only someone asked, and only before it starts and while it stands', () => {
    expect(guestAnswer(meeting(), 'khushi', 'accept', null, NOW)).toEqual({ ok: false, error: 'You were not asked to that meeting.' });
    expect(guestAnswer(meeting(), 'renuka', 'accept', null, at('2026-10-28T10:00:00Z')).ok).toBe(false);
    expect(guestAnswer(meeting({ cancelledAt: NOW }), 'renuka', 'accept', null, NOW)).toEqual({ ok: false, error: 'That meeting was cancelled.' });
  });
});

describe('the organiser', () => {
  it('takes a suggested time: the meeting moves, that guest is coming, the others are asked again', () => {
    const t = at('2026-10-29T09:30:00Z');
    const m = meeting({ guests: [{ memberId: 'renuka', answer: 'PROPOSED', proposedAt: t }, { memberId: 'gunjan', answer: 'ACCEPTED', proposedAt: null }] });
    const r = moveMeeting(m, 'yogesh', null, 'renuka', NOW);
    expect(r).toEqual({
      ok: true,
      value: {
        startsAt: t,
        guests: [
          { memberId: 'renuka', answer: 'ACCEPTED', proposedAt: null },
          { memberId: 'gunjan', answer: 'PENDING', proposedAt: null },
        ],
      },
    });
  });

  it('moves it to a time of their own: everyone is asked again', () => {
    const r = moveMeeting(meeting(), 'yogesh', at('2026-10-30T05:30:00Z'), null, NOW);
    expect(r.ok && r.value.guests.map((g) => g.answer)).toEqual(['PENDING', 'PENDING']);
    expect(moveMeeting(meeting(), 'yogesh', at('2026-10-28T09:30:00Z'), null, NOW).ok).toBe(false);
  });

  it('is the only one who moves or cancels it', () => {
    expect(moveMeeting(meeting(), 'renuka', at('2026-10-30T05:30:00Z'), null, NOW).ok).toBe(false);
    expect(mayCancel(meeting(), 'renuka').ok).toBe(false);
    expect(mayCancel(meeting(), 'yogesh').ok).toBe(true);
    expect(mayCancel(meeting({ cancelledAt: NOW }), 'yogesh').ok).toBe(false);
  });

  it('cannot take a suggestion nobody made', () => {
    expect(moveMeeting(meeting(), 'yogesh', null, 'gunjan', NOW)).toEqual({ ok: false, error: 'They have not suggested a time.' });
  });
});

describe('where a meeting stands', () => {
  const named = (m: MeetingState) => ({ ...m, guests: m.guests.map((g) => ({ ...g, name: g.memberId === 'renuka' ? 'Renuka' : 'Gunjan' })) });

  it('waiting, suggested, confirmed, cancelled, done', () => {
    expect(standing(named(meeting()), NOW)).toEqual({ word: 'Waiting for Renuka', tone: 'warn' });
    const t = at('2026-10-29T09:30:00Z');
    expect(standing(named(meeting({ guests: [{ memberId: 'renuka', answer: 'PROPOSED', proposedAt: t }] })), NOW).word).toBe('Renuka suggests Thu 29 Oct, 3:00 pm');
    expect(standing(named(meeting({ guests: [{ memberId: 'renuka', answer: 'ACCEPTED', proposedAt: null }] })), NOW)).toEqual({ word: 'Confirmed', tone: 'good' });
    expect(standing(named(meeting({ cancelledAt: NOW })), NOW).word).toBe('Cancelled');
    expect(standing(named(meeting()), at('2026-10-29T00:00:00Z')).word).toBe('Done');
    expect(isOpen(meeting(), NOW)).toBe(true);
  });

  it('words', () => {
    expect(whenLabel(at('2026-10-28T09:30:00Z'))).toBe('Wed 28 Oct, 3:00 pm');
    expect(lengthLabel(30)).toBe('30 min');
    expect(lengthLabel(60)).toBe('1 hr');
    expect(lengthLabel(90)).toBe('1 hr 30 min');
  });
});

describe('on the calendar, for everyone', () => {
  it('an office meeting is an item that opens the Meetings page and is never moved in place', () => {
    const [item] = buildCalendarItems({ office: [{ id: 'm1', title: 'Design review', startsAt: at('2026-10-28T09:30:00Z'), detail: 'With Renuka', ownerName: 'Yogesh', unsettled: true, involved: true }] }, NOW);
    const [other] = buildCalendarItems({ office: [{ id: 'm2', title: 'Sales sync', startsAt: at('2026-10-28T09:30:00Z'), detail: null, ownerName: 'Khushi', unsettled: false, involved: false }] }, NOW);
    expect(other!.href).toBe('/studio/calendar?view=day&day=2026-10-28');
    expect(item).toMatchObject({ kind: 'office', day: '2026-10-28', time: '3:00 pm', title: 'Design review (not settled)', href: '/studio/calendar/meetings#m-m1', done: false });
  });

  const member = (role: StudioRoleName) => ({ role, status: 'ACTIVE' as const, fullSoftware: true });

  it('every role opens the calendar and its meetings; One Interiors visits stay the owner’s and PM’s', () => {
    for (const role of ['OWNER', 'PM', 'SALES', 'DESIGNER', 'ACCOUNTS', 'SUPERVISOR'] as const) {
      expect(mayOpen(member(role), '/studio/calendar'), role).toBe(true);
      expect(mayOpen(member(role), '/studio/calendar/meetings'), role).toBe(true);
    }
    for (const role of ['SALES', 'DESIGNER', 'ACCOUNTS', 'SUPERVISOR'] as const) expect(mayOpen(member(role), '/studio/calendar/appointments'), role).toBe(false);
    expect(mayOpen(member('OWNER'), '/studio/calendar/appointments')).toBe(true);
  });

  it('the Calendar tile is on every office role’s home, with a Meetings tab', () => {
    for (const role of ['OWNER', 'PM', 'SALES', 'DESIGNER', 'ACCOUNTS'] as const) {
      const cal = appsFor(member(role)).find((a) => a.key === 'calendar');
      expect(cal, role).toBeTruthy();
      expect(cal!.tabs.map((t) => t.label), role).toContain('Meetings');
    }
    expect(appsFor(member('DESIGNER')).find((a) => a.key === 'calendar')!.tabs.map((t) => t.label)).toEqual(['Calendar', 'Meetings']);
  });
});
