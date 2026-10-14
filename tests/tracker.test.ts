import { describe, it, expect } from 'vitest';
import { durationFor, KIND_KEY, kindForKey, PLAN_KINDS, plannedStages, planStageView, projectStages, trackerView } from '@/modules/portal/tracker';

const START = new Date('2026-11-01T00:00:00Z');

describe('the project tracker', () => {
  it('splits the duration across the stages, ending on handover', () => {
    const p = plannedStages(START, 100);
    expect(p.map((s) => s.key)).toEqual(['DESIGN', 'PRODUCTION', 'SITE', 'INSTALL', 'FINISH', 'HANDOVER']);
    expect(p[0]!.targetOn.toISOString().slice(0, 10)).toBe('2026-11-21');
    expect(p[5]!.targetOn.toISOString().slice(0, 10)).toBe('2027-02-09');
  });

  it('ticks only what was marked done, and says what is now and next', () => {
    const v = trackerView(plannedStages(START, 100), ['DESIGN'], new Date('2026-11-10T00:00:00Z'));
    expect(v.map((s) => s.state)).toEqual(['done', 'now', 'next', 'later', 'later', 'later']);
  });

  it('says a stage is late rather than ticking it because a date passed', () => {
    const v = trackerView(plannedStages(START, 100), [], new Date('2026-12-01T00:00:00Z'));
    expect(v[0]).toMatchObject({ state: 'now', late: true });
  });

  it('uses the studio’s own duration for the work when it has one', () => {
    expect(durationFor('FULL_HOME', { FULL_HOME: 120 })).toBe(120);
    expect(durationFor('KITCHEN_WARDROBE', {})).toBe(45);
  });
});

describe('the tracker from the plan built at signing', () => {
  it('maps each kind to a key the app already translates', () => {
    expect(PLAN_KINDS.map((k) => KIND_KEY[k])).toEqual(['DESIGN', 'SITE', 'INSTALL', 'FINISH', 'HANDOVER']);
    expect(kindForKey('PRODUCTION')).toBe('CARPENTRY');
    expect(kindForKey('INSTALL')).toBe('CARPENTRY');
    expect(kindForKey('SITE')).toBe('CIVIL');
    expect(kindForKey('NOPE')).toBeNull();
  });

  it('counts a stage done only when the studio finished it', () => {
    const rows = PLAN_KINDS.map((kind, i) => ({ kind, name: kind, plannedEnd: new Date(START.getTime() + (i + 1) * 10 * 86_400_000), actualEnd: null as Date | null }));
    rows[0]!.actualEnd = new Date('2026-11-09T00:00:00Z');
    const v = planStageView(rows, new Date('2026-12-01T00:00:00Z'));
    expect(v.map((s) => s.state)).toEqual(['done', 'now', 'next', 'later', 'later']);
    expect(v.map((s) => s.late)).toEqual([false, true, false, false, false]);
  });

  it('uses the plan when there is one, the fixed stages otherwise', () => {
    const base = { startOn: START, totalDays: 100, doneStages: ['DESIGN'] };
    expect(projectStages(base, START).length).toBe(6);
    expect(projectStages({ ...base, stages: [] }, START).length).toBe(6);
    const one = [{ kind: 'DESIGN' as const, name: 'Design', plannedEnd: START, actualEnd: null }];
    expect(projectStages({ ...base, stages: one }, START).map((s) => s.key)).toEqual(['DESIGN']);
  });
});
