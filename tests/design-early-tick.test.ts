import { describe, expect, it } from 'vitest';
import { overallDelay, type RuleChange, type RuleStage } from '@/modules/project/project-rules';
import { earlyTickShift, lateTickPlanMove, lateTickPlanUndo, readTickUndo, untickStepMoves } from '@/modules/studio-design/rules';

/*
 * A step done before its day (owner, 12 Nov 2026: "Final design approval was
 * completed on 12 nov then why is the site visit with electrician shows 22
 * nov it should change according to the last task completed date"): the
 * later steps, the design's end and handover come forward.
 */

const steps = [
  { id: 'approval', plannedOn: '2026-11-19', done: false },
  { id: 'site-visit', plannedOn: '2026-11-22', done: false },
  { id: 'electrical', plannedOn: '2026-11-23', done: false },
  { id: 'already', plannedOn: '2026-11-25', done: true },
  { id: 'working', plannedOn: '2026-11-28', done: false },
];

describe('later steps after an early tick (pure rule)', () => {
  it('come forward by the days it was early, gaps kept', () => {
    const s = earlyTickShift(steps, 'approval', '2026-11-12', '2026-11-12');
    expect(s.days).toBe(-7);
    expect(s.moves).toEqual([
      { id: 'site-visit', from: '2026-11-22', to: '2026-11-15' },
      { id: 'electrical', from: '2026-11-23', to: '2026-11-16' },
      { id: 'working', from: '2026-11-28', to: '2026-11-21' },
    ]);
  });

  it('never into the past: the move stops at today', () => {
    // Done 1 Nov, 18 days early, but today is 20 Nov: the next step (22 Nov) can come forward only 2 days.
    const s = earlyTickShift(steps, 'approval', '2026-11-01', '2026-11-20');
    expect(s.days).toBe(-2);
    expect(s.moves[0]).toEqual({ id: 'site-visit', from: '2026-11-22', to: '2026-11-20' });
  });

  it('nothing for a step done on its day or late, or with nothing after it', () => {
    expect(earlyTickShift(steps, 'approval', '2026-11-19', '2026-11-19')).toEqual({ days: 0, moves: [] });
    expect(earlyTickShift(steps, 'approval', '2026-11-21', '2026-11-21')).toEqual({ days: 0, moves: [] });
    expect(earlyTickShift(steps, 'working', '2026-11-20', '2026-11-20')).toEqual({ days: 0, moves: [] });
  });
});

const plan: RuleStage[] = [
  { id: 'des', kind: 'DESIGN', name: 'Design', plannedStart: '2026-10-01', plannedEnd: '2026-12-15', actualEnd: null },
  { id: 'civ', kind: 'CIVIL', name: 'Civil', plannedStart: '2026-12-15', plannedEnd: '2027-01-05', actualEnd: null },
  { id: 'han', kind: 'HANDOVER', name: 'Handover', plannedStart: '2027-02-20', plannedEnd: '2027-02-28', actualEnd: null },
];

describe('the design end and handover after an early tick', () => {
  it('come earlier by the same days, filed as rescheduled (nobody’s delay)', () => {
    const m = lateTickPlanMove(plan, -7, 'EARLY')!;
    expect(m.stages).toEqual([
      { stageId: 'des', plannedStart: '2026-10-01', plannedEnd: '2026-12-08' },
      { stageId: 'civ', plannedStart: '2026-12-08', plannedEnd: '2026-12-29' },
      { stageId: 'han', plannedStart: '2027-02-13', plannedEnd: '2027-02-21' },
    ]);
    const after = plan.map((s) => {
      const x = m.stages.find((y) => y.stageId === s.id)!;
      return { ...s, plannedStart: x.plannedStart, plannedEnd: x.plannedEnd };
    });
    const changes: RuleChange[] = m.rows.map((r) => ({ stageId: r.stageId, field: r.field, from: r.from, to: r.to, reason: 'OTHER', decisionId: null, at: new Date('2026-11-12T06:00:00Z') }));
    const o = overallDelay(after, changes, '2026-11-12');
    expect(o.earlyDays).toBeGreaterThan(0);
    expect(o).toMatchObject({ lateDays: 0, studioDays: 0, customerDays: 0 });
  });

  it('a late side never moves earlier', () => {
    expect(lateTickPlanMove(plan, -7, 'STUDIO')).toBeNull();
    expect(lateTickPlanMove(plan, -7, 'CLIENT')).toBeNull();
  });
});

describe('unticking an early tick puts the dates back', () => {
  it('reads the early tick and moves the steps back later', () => {
    const undo = readTickUndo({ file: false, side: 'EARLY', shift: { days: -7, movedSteps: ['site-visit', 'working'], planMoved: true } })!;
    expect(undo).toMatchObject({ side: 'EARLY', days: -7, delayId: null });
    const back = untickStepMoves(
      [
        { id: 'site-visit', plannedOn: '2026-11-15', done: false },
        { id: 'working', plannedOn: '2026-11-21', done: false },
      ],
      undo,
    );
    expect(back).toEqual([
      { id: 'site-visit', from: '2026-11-15', to: '2026-11-22' },
      { id: 'working', from: '2026-11-21', to: '2026-11-28' },
    ]);
    const plan2 = lateTickPlanUndo(plan, -7, 'EARLY')!;
    expect(plan2.stages[0]).toMatchObject({ stageId: 'des', plannedEnd: '2026-12-22' });
  });
});
