import { describe, it, expect } from 'vitest';
import { checkHours, icsFor, istDate, istInstant, openSlots, slotLabel, type WeeklyHours } from '@/modules/consultation/slots';

// Monday 29 September 2026, 10:00 IST.
const NOW = new Date('2026-09-29T04:30:00Z');

const hours: WeeklyHours[] = [
  // Weekdays 11:00–13:00 IST for one expert; Saturday 10:00–12:00 for another.
  ...[1, 2, 3, 4, 5].map((weekday) => ({ expertUserId: 'e1', weekday, startMin: 660, endMin: 780 })),
  { expertUserId: 'e2', weekday: 6, startMin: 600, endMin: 720 },
];

describe('IST dates', () => {
  it('converts both ways', () => {
    expect(istDate(NOW)).toBe('2026-09-29');
    expect(istInstant('2026-09-29', 660).toISOString()).toBe('2026-09-29T05:30:00.000Z');
  });
});

describe('openSlots', () => {
  const empty = new Map<string, Set<string>>();

  it('offers half-hours inside the hours, after the lead time', () => {
    const slots = openSlots({ hours, blocked: empty, booked: empty, now: NOW, days: 1 });
    // 11:00 is inside the 3-hour lead from 10:00; 13:00 is the first allowed and outside the hours.
    expect(slots).toEqual([]);
    const tomorrow = openSlots({ hours, blocked: empty, booked: empty, now: NOW, days: 2 });
    expect(tomorrow.map((s) => slotLabel(s.startsAt).time)).toEqual(['11:00 am', '11:30 am', '12:00 pm', '12:30 pm']);
  });

  it('skips blocked days and booked slots', () => {
    const blocked = new Map([['e1', new Set(['2026-09-30'])]]);
    const booked = new Map([['e1', new Set([istInstant('2026-10-01', 660).toISOString()])]]);
    const slots = openSlots({ hours, blocked, booked, now: NOW, days: 3 });
    expect(slots.some((s) => istDate(new Date(s.startsAt)) === '2026-09-30')).toBe(false);
    expect(slots[0]!.startsAt).toBe(istInstant('2026-10-01', 690).toISOString());
  });

  it('lists every expert free at a time, and covers ten days by default', () => {
    const both: WeeklyHours[] = [...hours, { expertUserId: 'e0', weekday: 3, startMin: 660, endMin: 720 }];
    const slots = openSlots({ hours: both, blocked: empty, booked: empty, now: NOW });
    const wed11 = slots.find((s) => s.startsAt === istInstant('2026-09-30', 660).toISOString())!;
    expect(wed11.experts).toEqual(['e0', 'e1']);
    expect(slots.some((s) => istDate(new Date(s.startsAt)) === '2026-10-03')).toBe(true); // a Saturday
    expect(slots.every((s) => Date.parse(s.startsAt) < NOW.getTime() + 10 * 86_400_000)).toBe(true);
  });
});

describe('checkHours', () => {
  it('refuses hours no one could book', () => {
    expect(checkHours({ weekday: 1, startMin: 660, endMin: 780 })).toBeNull();
    expect(checkHours({ weekday: 7, startMin: 660, endMin: 780 })).toMatch(/day/);
    expect(checkHours({ weekday: 1, startMin: 665, endMin: 780 })).toMatch(/half-hour/);
    expect(checkHours({ weekday: 1, startMin: 360, endMin: 780 })).toMatch(/7 am/);
  });
});

describe('icsFor', () => {
  it('writes a valid invite with escaped text', () => {
    const ics = icsFor({
      uid: 'c1',
      startsAt: '2026-10-01T05:30:00.000Z',
      title: 'One Interiors — expert call',
      description: 'Akara, Sixth Wall; your 3 BHK',
      now: NOW,
    });
    expect(ics).toContain('DTSTART:20261001T053000Z');
    expect(ics).toContain('DTEND:20261001T060000Z');
    expect(ics).toContain('DESCRIPTION:Akara\\, Sixth Wall\\; your 3 BHK');
    expect(ics.split('\r\n')[0]).toBe('BEGIN:VCALENDAR');
  });
});
