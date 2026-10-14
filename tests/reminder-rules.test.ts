import { describe, expect, it } from 'vitest';
import {
  SITE_MODE_FROM,
  activeSinceOf,
  combineScores,
  isMissed,
  missedDays,
  needsDailyPost,
  reminderParts,
  remindersDue,
  updateScore,
  type ReminderInput,
} from '@/modules/project/reminder-rules';
import { DEFAULT_CALENDAR, calendarOf } from '@/modules/project/working-days';
import { dedupeKey } from '@/modules/project/events';

/**
 * The daily-update reminders (studio workspace Phase 2, brief §6), in IST:
 * 18:00 supervisor, 21:00 flag, second missed working day → owner, Assured →
 * ops. Mon 12 Oct 2026 … Sat 17 Oct; Sun 11 and Sun 18 are off.
 */

const IST = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00+05:30`);

const base = (over: Partial<ReminderInput> = {}): ReminderInput => ({
  now: IST('2026-10-14', '18:05'),
  calendar: DEFAULT_CALENDAR,
  postedDays: new Set(['2026-10-12', '2026-10-13']),
  activeSince: '2026-10-12',
  active: true,
  plan: 'BASIC',
  ...over,
});

const kinds = (input: ReminderInput) => remindersDue(input).map((r) => r.kind);

describe('remindersDue', () => {
  it('nothing before 18:00 IST', () => {
    expect(kinds(base({ now: IST('2026-10-14', '17:59') }))).toEqual([]);
  });

  it('18:00 on a working day with no post: the supervisor', () => {
    expect(remindersDue(base())).toEqual([{ kind: 'supervisor', day: '2026-10-14' }]);
    expect(kinds(base({ now: IST('2026-10-14', '18:00') }))).toEqual(['supervisor']);
  });

  it('21:00 still nothing: the supervisor (if the 18:00 run never came) and the flag', () => {
    expect(kinds(base({ now: IST('2026-10-14', '21:00') }))).toEqual(['supervisor', 'flag']);
    expect(kinds(base({ now: IST('2026-10-14', '23:59') }))).toEqual(['supervisor', 'flag']);
  });

  it('nothing once the day has a post — an update or nobody on site alike', () => {
    expect(kinds(base({ postedDays: new Set(['2026-10-13', '2026-10-14']), now: IST('2026-10-14', '21:30') }))).toEqual([]);
  });

  it('nothing on a day off: Sunday, a studio holiday, or a weekday the studio does not work', () => {
    expect(kinds(base({ now: IST('2026-10-18', '21:30') }))).toEqual([]);
    expect(kinds(base({ calendar: calendarOf({ workingDays: [1, 2, 3, 4, 5, 6], holidays: ['2026-10-14'] }), now: IST('2026-10-14', '21:30') }))).toEqual([]);
    expect(kinds(base({ calendar: calendarOf({ workingDays: [1, 2, 4, 5, 6] }), now: IST('2026-10-14', '21:30') }))).toEqual([]);
  });

  it('nothing for a project not under way, or before its site work started', () => {
    expect(kinds(base({ active: false, now: IST('2026-10-14', '21:30') }))).toEqual([]);
    expect(kinds(base({ activeSince: '2026-10-15', now: IST('2026-10-14', '21:30') }))).toEqual([]);
  });

  it('a second missed working day in a row: the owner too', () => {
    const r = kinds(base({ postedDays: new Set(['2026-10-12']), now: IST('2026-10-14', '21:10') }));
    expect(r).toEqual(['supervisor', 'flag', 'owner']);
  });

  it('the day before a day off counts as "in a row" across it (Saturday then Monday)', () => {
    const r = kinds(base({ postedDays: new Set(['2026-10-15', '2026-10-16']), now: IST('2026-10-19', '21:10') }));
    expect(r).toEqual(['supervisor', 'flag', 'owner']);
  });

  it('no owner reminder when the day before was the first day of site work and is still today', () => {
    expect(kinds(base({ postedDays: new Set(), activeSince: '2026-10-14', now: IST('2026-10-14', '21:10') }))).toEqual(['supervisor', 'flag']);
  });

  it('Assured: a missed day also goes to One Interiors ops', () => {
    expect(kinds(base({ plan: 'ASSURED', now: IST('2026-10-14', '21:00') }))).toEqual(['supervisor', 'flag', 'ops']);
    expect(kinds(base({ plan: 'ASSURED', now: IST('2026-10-14', '18:30') }))).toEqual(['supervisor']);
  });

  it('dedupe keys are one per project, day and kind', () => {
    const [a, b] = remindersDue(base({ now: IST('2026-10-14', '21:00') }));
    expect(dedupeKey(...reminderParts('p1', a!))).toBe('reminder|p1|2026-10-14|supervisor');
    expect(dedupeKey(...reminderParts('p1', b!))).toBe('reminder|p1|2026-10-14|flag');
  });
});

describe('missed days', () => {
  const input = { now: IST('2026-10-17', '12:00'), calendar: DEFAULT_CALENDAR, postedDays: new Set(['2026-10-12', '2026-10-15']), activeSince: '2026-10-12' };

  it('lists working days with no post, newest first; today only after 21:00', () => {
    expect(missedDays('2026-10-10', '2026-10-17', input)).toEqual(['2026-10-16', '2026-10-14', '2026-10-13']);
    expect(missedDays('2026-10-10', '2026-10-17', { ...input, now: IST('2026-10-17', '21:00') })).toEqual(['2026-10-17', '2026-10-16', '2026-10-14', '2026-10-13']);
  });

  it('never a day before site work started, a day off, or a future day', () => {
    expect(isMissed('2026-10-10', input)).toBe(false);
    expect(isMissed('2026-10-11', input)).toBe(false);
    expect(isMissed('2026-10-19', input)).toBe(false);
  });
});

describe('updateScore', () => {
  it('posted working days over due ones, the streak of misses up to today', () => {
    const s = updateScore({ now: IST('2026-10-17', '22:00'), calendar: DEFAULT_CALENDAR, postedDays: new Set(['2026-10-12', '2026-10-13', '2026-10-14']), activeSince: '2026-10-12' });
    expect(s).toEqual({ due: 6, posted: 3, pct: 50, streakMissed: 3 });
  });

  it('today counts only once 21:00 has passed, or once it is posted', () => {
    const at = (hhmm: string, posted: string[]) => updateScore({ now: IST('2026-10-13', hhmm), calendar: DEFAULT_CALENDAR, postedDays: new Set(posted), activeSince: '2026-10-12' });
    expect(at('12:00', ['2026-10-12'])).toMatchObject({ due: 1, posted: 1, pct: 100 });
    expect(at('12:00', ['2026-10-12', '2026-10-13'])).toMatchObject({ due: 2, posted: 2 });
    expect(at('21:30', ['2026-10-12'])).toMatchObject({ due: 2, posted: 1, pct: 50, streakMissed: 1 });
  });

  it('nothing due yet is no score, not zero', () => {
    expect(updateScore({ now: IST('2026-10-12', '10:00'), calendar: DEFAULT_CALENDAR, postedDays: new Set(), activeSince: '2026-10-12' }).pct).toBeNull();
  });

  it('looks back 30 days at most', () => {
    const s = updateScore({ now: IST('2026-12-31', '22:00'), calendar: DEFAULT_CALENDAR, postedDays: new Set(), activeSince: '2026-10-12' });
    expect(s.due).toBe(26); // 30 days, Monday to Saturday
  });

  it('combines projects into one studio score', () => {
    expect(
      combineScores([
        { due: 10, posted: 9, pct: 90, streakMissed: 0 },
        { due: 10, posted: 5, pct: 50, streakMissed: 2 },
      ]),
    ).toEqual({ due: 20, posted: 14, pct: 70, streakMissed: 2 });
    expect(combineScores([]).pct).toBeNull();
  });
});

describe('when a project needs a daily post', () => {
  const now = IST('2026-10-14', '10:00');
  it('not before it starts, not in design, not once handed over', () => {
    expect(needsDailyPost({ startOn: IST('2026-10-20', '00:00'), now, stages: [] })).toBe(false);
    expect(needsDailyPost({ startOn: IST('2026-10-01', '00:00'), now, stages: [{ kind: 'DESIGN', actualEnd: null }, { kind: 'CIVIL', actualEnd: null }] })).toBe(false);
    expect(needsDailyPost({ startOn: IST('2026-10-01', '00:00'), now, stages: [{ kind: 'DESIGN', actualEnd: now }, { kind: 'HANDOVER', actualEnd: now }] })).toBe(false);
    expect(needsDailyPost({ startOn: IST('2026-10-01', '00:00'), now, stages: [], doneStages: ['HANDOVER'] })).toBe(false);
  });
  it('yes on site, and for an old project with no plan', () => {
    expect(needsDailyPost({ startOn: IST('2026-10-01', '00:00'), now, stages: [{ kind: 'DESIGN', actualEnd: now }, { kind: 'CARPENTRY', actualEnd: null }] })).toBe(true);
    expect(needsDailyPost({ startOn: IST('2026-10-01', '00:00'), now, stages: [] })).toBe(true);
  });

  it('counts from the day after design was done, never before site mode existed, earlier if the site posted earlier', () => {
    const stages = [{ kind: 'DESIGN', actualEnd: IST('2026-10-20', '15:00') }];
    expect(activeSinceOf({ startOn: IST('2026-10-01', '00:00'), stages })).toBe('2026-10-21');
    expect(activeSinceOf({ startOn: IST('2026-09-01', '00:00'), stages: [] })).toBe(SITE_MODE_FROM);
    expect(activeSinceOf({ startOn: IST('2026-10-01', '00:00'), stages, firstPostDay: '2026-10-19' })).toBe('2026-10-19');
  });
});
