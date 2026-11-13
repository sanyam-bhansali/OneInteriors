/**
 * Design dates (owner, 13 Nov 2026): Monday off in every plan, the tick's
 * done date, and design days by category. Pure rules only.
 */
import { describe, expect, it } from 'vitest';
import { calendarOf, EVERY_DAY, onWorkingDay, shiftWorkingDays, workingDaysBetween } from '@/modules/project/working-days';
import { checkDoneOn, earlyTickShift, lateTickCheck, lateTickShift, linkedDays, planStepMove } from '@/modules/studio-design/rules';
import { categoryFactor, designLengthFor, HAUSPIRE_DESIGN, scaledGaps } from '@/modules/studio-design/template';
import { planMove, type RuleStage } from '@/modules/project/project-rules';
import { stageDates } from '@/modules/portal/quote-to-plan';

// Tuesday to Sunday; 16 and 23 Nov 2026 are Mondays.
const TUE_SUN = calendarOf({ workingDays: [2, 3, 4, 5, 6, 7], holidays: [] });

describe('working days with Monday off', () => {
  it('skips Mondays forwards and backwards', () => {
    expect(shiftWorkingDays('2026-11-15', 1, TUE_SUN)).toBe('2026-11-17');
    expect(shiftWorkingDays('2026-11-17', -1, TUE_SUN)).toBe('2026-11-15');
    expect(shiftWorkingDays('2026-11-13', 0, TUE_SUN)).toBe('2026-11-13');
    expect(workingDaysBetween('2026-11-15', '2026-11-17', TUE_SUN)).toBe(1);
    expect(onWorkingDay('2026-11-16', TUE_SUN)).toBe('2026-11-17');
  });

  it('without a calendar every day counts, as before', () => {
    expect(shiftWorkingDays('2026-11-15', 1, EVERY_DAY)).toBe('2026-11-16');
    expect(linkedDays([1, 1], '2026-11-15', null)).toEqual(['2026-11-16', '2026-11-17']);
  });

  it('design steps never land on a Monday', () => {
    const days = linkedDays([1, 1, 2, 0], '2026-11-14', null, TUE_SUN);
    expect(days).toEqual(['2026-11-15', '2026-11-17', '2026-11-19', '2026-11-19']);
  });

  it('a late tick moves the later steps by working days late', () => {
    const steps = [
      { id: 'a', plannedOn: '2026-11-14', done: false },
      { id: 'b', plannedOn: '2026-11-15', done: false },
      { id: 'c', plannedOn: '2026-11-18', done: true },
    ];
    // Planned Sat 14, done Tue 17: Sun and Tue are working, Mon is not → 2 days late.
    const r = lateTickShift(steps, 'a', '2026-11-17', TUE_SUN);
    expect(r.days).toBe(2);
    expect(r.moves).toEqual([{ id: 'b', from: '2026-11-15', to: '2026-11-18' }]);
    expect(lateTickCheck({ plannedOn: '2026-11-14', responsible: 'DESIGNER' }, '2026-11-17', 'STUDIO_DELAY', TUE_SUN)).toMatchObject({ ok: true, delay: { days: 2 } });
  });

  it('an early tick brings them forward by working days, never before today', () => {
    const steps = [
      { id: 'a', plannedOn: '2026-11-18', done: false },
      { id: 'b', plannedOn: '2026-11-20', done: false },
    ];
    const r = earlyTickShift(steps, 'a', '2026-11-15', '2026-11-15', TUE_SUN);
    expect(r.days).toBe(-2);
    expect(r.moves).toEqual([{ id: 'b', from: '2026-11-20', to: '2026-11-18' }]);
  });

  it('a moved step goes to the day picked; the ones after it by the same working days', () => {
    const steps = [
      { id: 'a', plannedOn: '2026-11-14', done: false },
      { id: 'b', plannedOn: '2026-11-17', done: false },
    ];
    const r = planStepMove(steps, 'a', '2026-11-17', TUE_SUN);
    expect(r).toMatchObject({ ok: true, days: 2 });
    if (r.ok) expect(r.moves).toEqual([{ id: 'a', from: '2026-11-14', to: '2026-11-17' }, { id: 'b', from: '2026-11-17', to: '2026-11-19' }]);
  });

  it('later stages move by working days too', () => {
    const stages: RuleStage[] = [
      { id: 'd', kind: 'DESIGN', name: 'Design', plannedStart: '2026-11-01', plannedEnd: '2026-11-14', actualEnd: null },
      { id: 'c', kind: 'CIVIL', name: 'Civil', plannedStart: '2026-11-14', plannedEnd: '2026-11-20', actualEnd: null },
    ];
    const r = planMove(stages, { stageId: 'd', field: 'PLANNED_END', to: '2026-11-17', reason: 'OTHER', shiftLater: true }, TUE_SUN);
    expect(r.ok && r.plan.stages[1]).toEqual({ stageId: 'c', plannedStart: '2026-11-17', plannedEnd: '2026-11-22' });
  });

  it('a new plan counts its days in working days', () => {
    const d = stageDates(new Date('2026-11-14T00:00:00Z'), 50, 10, TUE_SUN);
    const day = (x: Date) => x.toISOString().slice(0, 10);
    expect(day(d[0]!.plannedStart)).toBe('2026-11-14');
    // 10 working days from Sat 14 Nov skips Mondays 16 and 23.
    expect(day(d[0]!.plannedEnd)).toBe('2026-11-26');
    for (const s of d) expect(new Date(s.plannedEnd).getUTCDay()).not.toBe(1);
  });
});

describe('the day a step was done', () => {
  it('today when empty; never ahead; up to 60 days back', () => {
    expect(checkDoneOn('', '2026-11-13')).toEqual({ ok: true, day: '2026-11-13' });
    expect(checkDoneOn('2026-11-05', '2026-11-13')).toEqual({ ok: true, day: '2026-11-05' });
    expect(checkDoneOn('2026-11-14', '2026-11-13')).toMatchObject({ ok: false });
    expect(checkDoneOn('2026-08-01', '2026-11-13')).toMatchObject({ ok: false });
    expect(checkDoneOn('5 Nov', '2026-11-13')).toMatchObject({ ok: false });
  });
});

describe('design days by category', () => {
  it('Premium is the base, Essential half, Luxe 30% more', () => {
    expect(categoryFactor('PREMIUM')).toBe(1);
    expect(categoryFactor('ESSENTIAL')).toBe(0.5);
    expect(categoryFactor('LUXURY')).toBe(1.3);
    expect(categoryFactor(null)).toBe(1);
    const premium = designLengthFor(HAUSPIRE_DESIGN, 2, null, 'PREMIUM');
    expect(designLengthFor(HAUSPIRE_DESIGN, 2, null, 'ESSENTIAL')).toBe(Math.round(premium * 0.5));
    expect(designLengthFor(HAUSPIRE_DESIGN, 2, null, 'LUXURY')).toBe(Math.round(premium * 1.3));
  });

  it('a length asked for wins over the category', () => {
    expect(scaledGaps([5, 5], 2, 20, 'ESSENTIAL').reduce((a, b) => a + b, 0)).toBe(20);
  });
});
