import { describe, expect, it } from 'vitest';
import { calendarOf } from '@/modules/project/working-days';
import type { RuleStage } from '@/modules/project/project-rules';
import {
  checkLeaveAsk,
  designEndShift,
  holidayNote,
  holidayStepShift,
  leaveNote,
  leaveWorkingDays,
  monthGrid,
  parseHolidayList,
  parseMonth,
  shiftMonth,
  shiftOpenStepsFrom,
} from '@/modules/studio-leave/rules';
import { countsAsDelay, CUSTOMER_REASON, isDelayReasonKey, reasonLabel, sideOfReason } from '@/modules/studio-design/rules';

/*
 * Holidays and leave (owner, 13 Nov 2026): a holiday added moves the open
 * design steps on and after it one working day; approved leave moves a
 * designer's open design steps by the working days inside it. Monday is
 * the weekly off: 2026-11-09 and 2026-11-16 are Mondays.
 */

const cal = calendarOf({ workingDays: [2, 3, 4, 5, 6, 7] });
const withHoliday = (...days: string[]) => calendarOf({ workingDays: [2, 3, 4, 5, 6, 7], holidays: days });

describe('a pasted holiday list', () => {
  it('reads "YYYY-MM-DD Name" and "DD/MM/YYYY Name", skips blanks and repeats', () => {
    const r = parseHolidayList('2026-11-08 Diwali\r\n\n09/11/2026 Diwali (Padwa)\n2026-12-25 - Christmas\n2026-11-08 Again\n1/1/2027');
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([
      { day: '2026-11-08', name: 'Diwali' },
      { day: '2026-11-09', name: 'Diwali (Padwa)' },
      { day: '2026-12-25', name: 'Christmas' },
      { day: '2027-01-01', name: 'Holiday' },
    ]);
  });

  it('names the lines it cannot read', () => {
    const r = parseHolidayList('Diwali 2026-11-08\n2026-02-30 Not a day\n2026-11-14 Children');
    expect(r.errors.map((e) => e.line)).toEqual([1, 2]);
    expect(r.errors[1]!.error).toMatch(/not on the calendar/);
    expect(r.rows).toEqual([{ day: '2026-11-14', name: 'Children' }]);
  });

  it('files a holiday as OTHER with its name', () => {
    expect(holidayNote('  Diwali ')).toBe('Holiday: Diwali');
  });
});

const steps = [
  { id: 'before', plannedOn: '2026-11-15', done: false, inScope: true },
  { id: 'done', plannedOn: '2026-11-17', done: true, inScope: true },
  { id: 'on', plannedOn: '2026-11-17', done: false, inScope: true },
  { id: 'next', plannedOn: '2026-11-18', done: false, inScope: true },
  { id: 'skipped', plannedOn: '2026-11-20', done: false, inScope: false },
  { id: 'sunday', plannedOn: '2026-11-22', done: false, inScope: true },
];

describe('a holiday added', () => {
  it('moves open steps on and after it one working day; done, earlier and out-of-scope steps stay', () => {
    const moves = holidayStepShift(steps, '2026-11-17', cal, withHoliday('2026-11-17'));
    expect(moves).toEqual([
      { id: 'on', from: '2026-11-17', to: '2026-11-18' },
      { id: 'next', from: '2026-11-18', to: '2026-11-19' },
      // Sunday to Tuesday: Monday is the weekly off.
      { id: 'sunday', from: '2026-11-22', to: '2026-11-24' },
    ]);
  });

  it('moves nothing on a day the studio was closed anyway', () => {
    expect(holidayStepShift(steps, '2026-11-16', cal, withHoliday('2026-11-16'))).toEqual([]);
    expect(holidayStepShift(steps, '2026-11-17', withHoliday('2026-11-17'), withHoliday('2026-11-17'))).toEqual([]);
  });

  const stages: RuleStage[] = [
    { id: 'd', kind: 'DESIGN', name: 'Design', plannedStart: '2026-11-01', plannedEnd: '2026-11-20', actualEnd: null },
    { id: 'e', kind: 'CIVIL', name: 'Civil', plannedStart: '2026-11-21', plannedEnd: '2026-12-30', actualEnd: null },
  ];

  it('moves the design end and later stages one working day, filed as OTHER', () => {
    const plan = designEndShift(stages, '2026-11-17', 1, true, 'OTHER', withHoliday('2026-11-17'));
    expect(plan?.stages[0]).toEqual({ stageId: 'd', plannedStart: '2026-11-01', plannedEnd: '2026-11-21' });
    expect(plan?.stages[1]).toEqual({ stageId: 'e', plannedStart: '2026-11-22', plannedEnd: '2026-12-31' });
  });

  it('leaves a finished design, or one ending before the day with no step moved, alone', () => {
    expect(designEndShift([{ ...stages[0]!, actualEnd: '2026-11-19' }, stages[1]!], '2026-11-17', 1, true, 'OTHER', cal)).toBeNull();
    expect(designEndShift(stages, '2026-11-25', 1, false, 'OTHER', cal)).toBeNull();
    expect(designEndShift(stages, '2026-11-25', 1, true, 'OTHER', cal)).not.toBeNull();
  });
});

describe('leave', () => {
  it('counts the studio working days inside the leave, both ends', () => {
    // Sunday, Monday (off), Tuesday.
    expect(leaveWorkingDays('2026-11-08', '2026-11-10', cal)).toBe(2);
    expect(leaveWorkingDays('2026-11-08', '2026-11-10', withHoliday('2026-11-10'))).toBe(1);
    expect(leaveWorkingDays('2026-11-09', '2026-11-09', cal)).toBe(0);
    expect(leaveWorkingDays('2026-11-10', '2026-11-08', cal)).toBe(0);
  });

  it('moves every open step on or after the first day by those working days', () => {
    const moves = shiftOpenStepsFrom(steps, '2026-11-17', 2, cal);
    expect(moves).toEqual([
      { id: 'on', from: '2026-11-17', to: '2026-11-19' },
      { id: 'next', from: '2026-11-18', to: '2026-11-20' },
      { id: 'sunday', from: '2026-11-22', to: '2026-11-25' },
    ]);
    expect(shiftOpenStepsFrom(steps, '2026-11-17', 0, cal)).toEqual([]);
  });

  const today = '2026-11-13';
  const ok = { fromDay: '2026-11-17', toDay: '2026-11-19', kind: 'PLANNED', reason: "Sister's wedding" };

  it('takes a planned leave from today on', () => {
    expect(checkLeaveAsk(ok, today, [])).toEqual({ ok: true, fromDay: '2026-11-17', toDay: '2026-11-19', kind: 'PLANNED', reason: "Sister's wedding" });
    expect(checkLeaveAsk({ ...ok, toDay: '' }, today, [])).toMatchObject({ ok: true, toDay: '2026-11-17' });
  });

  it('takes unplanned leave after the fact, but not a planned one', () => {
    expect(checkLeaveAsk({ ...ok, fromDay: '2026-11-10', toDay: '2026-11-11' }, today, [])).toMatchObject({ ok: false });
    expect(checkLeaveAsk({ ...ok, fromDay: '2026-11-10', toDay: '2026-11-11', kind: 'UNPLANNED' }, today, [])).toMatchObject({ ok: true });
    expect(checkLeaveAsk({ ...ok, fromDay: '2026-08-01', toDay: '2026-08-02', kind: 'UNPLANNED' }, today, [])).toMatchObject({ ok: false });
  });

  it('refuses a bad span, a missing reason, a wrong kind and an overlap', () => {
    expect(checkLeaveAsk({ ...ok, toDay: '2026-11-16' }, today, [])).toMatchObject({ ok: false });
    expect(checkLeaveAsk({ ...ok, toDay: '2027-02-01' }, today, [])).toMatchObject({ ok: false });
    expect(checkLeaveAsk({ ...ok, reason: ' x ' }, today, [])).toMatchObject({ ok: false });
    expect(checkLeaveAsk({ ...ok, kind: 'HOLIDAY' }, today, [])).toMatchObject({ ok: false });
    expect(checkLeaveAsk(ok, today, [{ fromDay: '2026-11-19', toDay: '2026-11-21', status: 'APPROVED' }])).toMatchObject({ ok: false });
    expect(checkLeaveAsk(ok, today, [{ fromDay: '2026-11-19', toDay: '2026-11-21', status: 'DECLINED' }])).toMatchObject({ ok: true });
  });

  it('says what moved, for the team', () => {
    expect(leaveNote('2026-11-17', '2026-11-19', 3)).toBe('Designer on leave 2026-11-17 to 2026-11-19 (3 working days).');
  });
});

describe('the month view', () => {
  it('lays a month out Monday first', () => {
    const weeks = monthGrid('2026-11');
    expect(weeks).toHaveLength(6);
    expect(weeks[0]).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(weeks[5]![0]).toBe('2026-11-30');
  });

  it('reads and moves the month', () => {
    expect(parseMonth('2026-12', '2026-11-13')).toBe('2026-12');
    expect(parseMonth('2026-13', '2026-11-13')).toBe('2026-11');
    expect(parseMonth(undefined, '2026-11-13')).toBe('2026-11');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });
});

describe('Holiday on the Move form (owner, 13 Nov 2026: "Holidays na, leaves kyun?")', () => {
  it('is a studio-side reason that counts as nobody’s delay', () => {
    expect(isDelayReasonKey('HOLIDAY')).toBe(true);
    expect(sideOfReason('HOLIDAY')).toBe('STUDIO');
    expect(countsAsDelay('HOLIDAY')).toBe(false);
    expect(countsAsDelay('STUDIO_DELAY')).toBe(true);
    expect(reasonLabel('HOLIDAY')).toBe('Holiday');
    expect(CUSTOMER_REASON.HOLIDAY).toBe('Holidays.');
  });
});
