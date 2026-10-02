import { describe, it, expect } from 'vitest';
import { durationFor, plannedStages, trackerView } from '@/modules/portal/tracker';

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
