import { describe, expect, it } from 'vitest';
import {
  addDays,
  addWorkingDays,
  calendarOf,
  DEFAULT_WORKING_DAYS,
  dayFromDb,
  dayToDb,
  daysBetween,
  isDay,
  isoWeekday,
  istDay,
  istMinutesOfDay,
  istTime,
  isWorkingDay,
  nextWorkingDay,
  previousWorkingDay,
  readWorkingDays,
  workingDaysBetween,
} from '@/modules/project/working-days';

// 2026-10-12 is a Monday; 2026-10-18 a Sunday.

describe('IST days', () => {
  it('puts an instant on its IST day, not its UTC day', () => {
    expect(istDay(new Date('2026-10-11T18:29:59Z'))).toBe('2026-10-11'); // 23:59:59 IST
    expect(istDay(new Date('2026-10-11T18:30:00Z'))).toBe('2026-10-12'); // 00:00 IST
    expect(istDay(new Date('2026-12-31T20:00:00Z'))).toBe('2027-01-01');
  });

  it('round-trips a @db.Date column value', () => {
    expect(dayToDb('2026-10-12').toISOString()).toBe('2026-10-12T00:00:00.000Z');
    expect(dayFromDb(dayToDb('2026-02-28'))).toBe('2026-02-28');
  });

  it('knows a real day from a plausible string', () => {
    expect(isDay('2026-10-12')).toBe(true);
    expect(isDay('2028-02-29')).toBe(true);
    expect(isDay('2026-02-29')).toBe(false);
    expect(isDay('2026-13-01')).toBe(false);
    expect(isDay('12-10-2026')).toBe(false);
    expect(isDay(20261012)).toBe(false);
    expect(() => addDays('nope', 1)).toThrow();
  });

  it('adds days across months and years, and counts between', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(daysBetween('2026-10-12', '2026-10-19')).toBe(7);
    expect(daysBetween('2026-10-19', '2026-10-12')).toBe(-7);
  });

  it('gives ISO weekdays', () => {
    expect(isoWeekday('2026-10-12')).toBe(1);
    expect(isoWeekday('2026-10-17')).toBe(6);
    expect(isoWeekday('2026-10-18')).toBe(7);
  });

  it('turns an IST wall-clock time into an instant, and back', () => {
    expect(istTime('2026-10-12', '18:00').toISOString()).toBe('2026-10-12T12:30:00.000Z');
    expect(istTime('2026-10-12', '00:00').toISOString()).toBe('2026-10-11T18:30:00.000Z');
    expect(istMinutesOfDay(istTime('2026-10-12', '21:00'))).toBe(21 * 60);
    expect(istMinutesOfDay(new Date('2026-10-11T18:30:00Z'))).toBe(0);
    expect(() => istTime('2026-10-12', '24:00')).toThrow();
  });
});

describe('a studio calendar', () => {
  it('defaults to Monday to Saturday', () => {
    expect(DEFAULT_WORKING_DAYS).toEqual([1, 2, 3, 4, 5, 6]);
    expect(isWorkingDay('2026-10-17')).toBe(true);
    expect(isWorkingDay('2026-10-18')).toBe(false);
  });

  it('repairs a bad workingDays column instead of trusting it', () => {
    expect(readWorkingDays([6, 1, 1, 8, 0, 2.5, '3'])).toEqual([1, 6]);
    expect(readWorkingDays([])).toEqual([1, 2, 3, 4, 5, 6]);
    expect(readWorkingDays(null)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('reads holidays from Prisma rows, Dates or days, and skips junk', () => {
    const cal = calendarOf({
      workingDays: [1, 2, 3, 4, 5],
      holidays: [{ day: dayToDb('2026-11-09') }, dayToDb('2026-11-10'), '2026-11-11', 'diwali', new Date('nope')],
    });
    expect([...cal.holidays].sort()).toEqual(['2026-11-09', '2026-11-10', '2026-11-11']);
    expect(isWorkingDay('2026-11-09', cal)).toBe(false); // Monday, holiday
    expect(isWorkingDay('2026-11-12', cal)).toBe(true);
    expect(isWorkingDay('2026-11-14', cal)).toBe(false); // Saturday, five-day week
  });

  it('finds the next and previous working day past weekends and holidays', () => {
    const cal = calendarOf({ workingDays: [1, 2, 3, 4, 5, 6], holidays: ['2026-10-19'] });
    expect(nextWorkingDay('2026-10-17', cal)).toBe('2026-10-20'); // Sat → (Sun, holiday Mon) → Tue
    expect(nextWorkingDay('2026-10-17', cal, { inclusive: true })).toBe('2026-10-17');
    expect(previousWorkingDay('2026-10-20', cal)).toBe('2026-10-17');
    expect(previousWorkingDay('2026-10-18', cal, { inclusive: true })).toBe('2026-10-17');
  });

  it('counts working days between two days, signed', () => {
    const cal = calendarOf({ holidays: ['2026-10-14'] });
    expect(workingDaysBetween('2026-10-12', '2026-10-12', cal)).toBe(0);
    // Tue 13, (Wed 14 holiday), Thu 15, Fri 16, Sat 17, (Sun 18), Mon 19
    expect(workingDaysBetween('2026-10-12', '2026-10-19', cal)).toBe(5);
    expect(workingDaysBetween('2026-10-19', '2026-10-12', cal)).toBe(-5);
  });

  it('adds working days', () => {
    expect(addWorkingDays('2026-10-16', 0)).toBe('2026-10-16');
    expect(addWorkingDays('2026-10-16', 2)).toBe('2026-10-19'); // Fri → Sat → Mon
  });

  it('never loops forever on a calendar with no free day', () => {
    const allHolidays = Array.from({ length: 500 }, (_, i) => addDays('2026-10-12', i));
    const cal = calendarOf({ holidays: allHolidays });
    expect(nextWorkingDay('2026-10-11', cal)).toBeNull();
    expect(() => addWorkingDays('2026-10-11', 1, cal)).toThrow();
  });
});
