import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  allowanceStart,
  checkHolidayWorkAsk,
  checkLeaveAsk,
  countLeave,
  dayWeight,
  earnedThrough,
  HOLIDAY_WORK_PAY,
  holidayWorkPaidDays,
  leaveBalance,
  typeOfLeave,
  type CountedLeave,
} from '@/modules/studio-leave/rules';
import type { StudioCalendar } from '@/modules/project/working-days';

/* Owner, 21 Nov 2026: "We provide 1 Casual leave and 1 sick leave every month"; "the leaves not taken should be accumulated each month"; more is unpaid;
   "any casual leave which is taken but not approved it will be calculated as 2 leaves". */
const CAL: StudioCalendar = { workingDays: [2, 3, 4, 5, 6, 7], holidays: new Set() }; // Monday off
const TODAY = '2026-11-21';
const leave = (p: Partial<CountedLeave> & Pick<CountedLeave, 'id' | 'fromDay'>): CountedLeave => ({
  type: 'CASUAL',
  toDay: p.fromDay,
  status: 'APPROVED',
  approvedDay: '2026-11-01',
  askedAt: 0,
  ...p,
});

describe('casual and sick leave, one of each a month', () => {
  it('the first day of each type in a month is paid, the rest unpaid', () => {
    const c = countLeave(
      [
        leave({ id: 'a', fromDay: '2026-11-03' }),
        leave({ id: 'b', fromDay: '2026-11-10', askedAt: 1 }),
        leave({ id: 's', fromDay: '2026-11-11', type: 'SICK', status: 'ASKED', approvedDay: null }),
      ],
      CAL,
      TODAY,
    );
    expect(c.get('a')).toMatchObject({ days: 1, paid: 1, unpaid: 0 });
    expect(c.get('b')).toMatchObject({ days: 1, paid: 0, unpaid: 1 });
    // Sick is its own allowance (and sick leave never counts double).
    expect(c.get('s')).toMatchObject({ days: 1, paid: 1, unpaid: 0, unapprovedDays: 0 });
  });

  it('unused leave carries over: none taken in November leaves two for December (owner: "accumulated each month")', () => {
    const c = countLeave([leave({ id: 'dec', fromDay: '2026-12-01', toDay: '2026-12-02', approvedDay: '2026-11-20' })], CAL, TODAY);
    expect(c.get('dec')).toMatchObject({ days: 2, paid: 2, unpaid: 0 });
    const b = leaveBalance([], '2027-02', CAL, TODAY);
    expect(b.CASUAL).toEqual({ earned: 4, used: 0, left: 4 });
  });

  it('leave before the allowance began (November 2026) takes nothing off it', () => {
    const c = countLeave([leave({ id: 'oct', fromDay: '2026-10-06', approvedDay: '2026-10-01' }), leave({ id: 'nov', fromDay: '2026-11-03' })], CAL, TODAY);
    expect(c.get('oct')).toMatchObject({ paid: 1, unpaid: 0 });
    expect(c.get('nov')).toMatchObject({ paid: 1, unpaid: 0 });
  });

  it('someone who joined later earns from the month they joined', () => {
    expect(allowanceStart('2027-01-15')).toBe('2027-01');
    expect(allowanceStart('2025-06-01')).toBe('2026-11');
    expect(earnedThrough('SICK', '2027-01', '2026-12')).toBe(0);
    const c = countLeave([leave({ id: 'x', fromDay: '2027-01-05', toDay: '2027-01-06', approvedDay: '2027-01-01' })], CAL, TODAY, '2027-01');
    expect(c.get('x')).toMatchObject({ paid: 1, unpaid: 1 });
  });

  it('declined and withdrawn leave count nothing', () => {
    const c = countLeave([leave({ id: 'd', fromDay: '2026-11-03', status: 'DECLINED' }), leave({ id: 'a', fromDay: '2026-11-04' })], CAL, TODAY);
    expect(c.get('d')).toMatchObject({ days: 0 });
    expect(c.get('a')).toMatchObject({ paid: 1, unpaid: 0 });
  });
});

describe('casual leave taken without approval counts as two', () => {
  it('approved before (or on) the day: one; approved after the day: two', () => {
    expect(dayWeight({ type: 'CASUAL', status: 'APPROVED', approvedDay: '2026-11-03' }, '2026-11-03', TODAY)).toBe(1);
    expect(dayWeight({ type: 'CASUAL', status: 'APPROVED', approvedDay: '2026-11-05' }, '2026-11-03', TODAY)).toBe(2);
  });

  it('still waiting once the day has passed: two; today or later: one', () => {
    expect(dayWeight({ type: 'CASUAL', status: 'ASKED', approvedDay: null }, '2026-11-20', TODAY)).toBe(2);
    expect(dayWeight({ type: 'CASUAL', status: 'ASKED', approvedDay: null }, TODAY, TODAY)).toBe(1);
    expect(dayWeight({ type: 'SICK', status: 'ASKED', approvedDay: null }, '2026-11-20', TODAY)).toBe(1);
  });

  it('one unapproved casual day uses the allowance and one more unpaid', () => {
    const c = countLeave([leave({ id: 'u', fromDay: '2026-11-17', status: 'ASKED', approvedDay: null })], CAL, TODAY);
    expect(c.get('u')).toMatchObject({ workingDays: 1, days: 2, paid: 1, unpaid: 1, unapprovedDays: 1 });
  });

  it('the balance counts it twice', () => {
    const b = leaveBalance([leave({ id: 'u', fromDay: '2026-11-17', status: 'ASKED', approvedDay: null })], '2026-11', CAL, TODAY);
    expect(b.CASUAL).toEqual({ earned: 1, used: 2, left: 0 });
    expect(b.SICK).toEqual({ earned: 1, used: 0, left: 1 });
  });
});

/* Owner, 21 Nov 2026: "If anyone is working on a holiday 2 day salary will be paid but it needs to be pre approved". */
describe('working on a holiday', () => {
  const HOLI: StudioCalendar = { workingDays: [2, 3, 4, 5, 6, 7], holidays: new Set(['2026-11-27']) };

  it('is asked ahead, for a holiday or the weekly off only', () => {
    const ask = (from: string, to = from) => checkHolidayWorkAsk({ fromDay: from, toDay: to, reason: 'Site handover' }, TODAY, HOLI);
    expect(ask('2026-11-23')).toMatchObject({ ok: true }); // Monday, the weekly off
    expect(ask('2026-11-27')).toMatchObject({ ok: true }); // a holiday
    expect(ask('2026-11-24')).toMatchObject({ ok: false }); // a working day
    expect(ask('2026-11-16')).toMatchObject({ ok: false }); // already gone: not pre-approved
    expect(ask('2026-11-23', '2026-11-24')).toMatchObject({ ok: false }); // includes a working day
  });

  it('a day approved on or before it is paid as two days; approved late or not approved, not', () => {
    expect(holidayWorkPaidDays({ fromDay: '2026-11-23', toDay: '2026-11-23', status: 'APPROVED', approvedDay: '2026-11-21' }, HOLI)).toEqual({ days: 1, doublePaid: 1 });
    expect(holidayWorkPaidDays({ fromDay: '2026-11-23', toDay: '2026-11-23', status: 'APPROVED', approvedDay: '2026-11-23' }, HOLI)).toEqual({ days: 1, doublePaid: 1 });
    expect(holidayWorkPaidDays({ fromDay: '2026-11-23', toDay: '2026-11-23', status: 'APPROVED', approvedDay: '2026-11-24' }, HOLI)).toEqual({ days: 1, doublePaid: 0 });
    expect(holidayWorkPaidDays({ fromDay: '2026-11-23', toDay: '2026-11-23', status: 'ASKED', approvedDay: null }, HOLI)).toEqual({ days: 1, doublePaid: 0 });
    expect(HOLIDAY_WORK_PAY).toBe(2);
  });

  it('is never counted as leave, and approving it moves no plan', () => {
    const store = readFileSync('src/modules/studio-leave/store.ts', 'utf8');
    expect(store).toMatch(/const leaves = allRows\.filter\(\(l\) => l\.type !== HOLIDAY_WORK\);/);
    expect(store).toMatch(/if \(leave\.type === HOLIDAY_WORK\) return 'work' as const;/);
    expect(store.match(/\.\.\.NOT_WORK/g)?.length).toBe(2);
  });
});

describe('asking', () => {
  it('casual or sick; sick and leave already taken are unplanned', () => {
    const ask = (type: string, day: string) => checkLeaveAsk({ fromDay: day, toDay: day, type, reason: 'Fever' }, TODAY, []);
    expect(ask('SICK', '2026-11-24')).toMatchObject({ ok: true, type: 'SICK', kind: 'UNPLANNED' });
    expect(ask('CASUAL', '2026-11-24')).toMatchObject({ ok: true, type: 'CASUAL', kind: 'PLANNED' });
    expect(ask('CASUAL', '2026-11-18')).toMatchObject({ ok: true, type: 'CASUAL', kind: 'UNPLANNED' });
    expect(ask('HOLIDAY', '2026-11-24')).toMatchObject({ ok: false });
  });

  it('leave from before types reads as casual when planned, sick when not', () => {
    expect(typeOfLeave(null, 'PLANNED')).toBe('CASUAL');
    expect(typeOfLeave(null, 'UNPLANNED')).toBe('SICK');
    expect(typeOfLeave('SICK', 'PLANNED')).toBe('SICK');
  });
});
