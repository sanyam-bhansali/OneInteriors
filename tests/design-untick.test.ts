import { describe, expect, it } from 'vitest';
import { overallDelay, type RuleChange, type RuleStage } from '@/modules/project/project-rules';
import { toCustomerDesign } from '@/modules/studio-design/customer-view';
import { checkUntickReason, lateTickPlanMove, lateTickPlanUndo, lateTickShift, readTickUndo, untickStepMoves } from '@/modules/studio-design/rules';

/*
 * Unticking a design step (owner, 12 Nov 2026: "add an option to untick
 * ticked steps in design"): it undoes the tick — dates back, delay voided,
 * not done for the client — and asks why.
 */

describe('the reason', () => {
  it('is required, short and tidy', () => {
    expect(checkUntickReason('  Ticked   by mistake ')).toEqual({ ok: true, reason: 'Ticked by mistake' });
    expect(checkUntickReason('').ok).toBe(false);
    expect(checkUntickReason('ok').ok).toBe(false);
    expect(checkUntickReason('x'.repeat(301)).ok).toBe(false);
  });
});

describe("reading what the tick moved", () => {
  it('reads the late tick', () => {
    expect(readTickUndo({ file: false, lateDays: 7, side: 'CLIENT', delayId: 'd1', shift: { days: 7, movedSteps: ['c', 'e'], planMoved: true } })).toEqual({
      days: 7,
      side: 'CLIENT',
      delayId: 'd1',
      movedSteps: ['c', 'e'],
      planMoved: true,
    });
  });

  it('nothing for an on-time tick or a broken payload', () => {
    expect(readTickUndo({ file: true })).toBeNull();
    expect(readTickUndo(null)).toBeNull();
    expect(readTickUndo({ side: 'STUDIO', shift: 'x' })).toEqual({ days: 0, side: 'STUDIO', delayId: null, movedSteps: [], planMoved: false });
  });
});

const steps = [
  { id: 'a', plannedOn: '2026-11-01', done: true },
  { id: 'b', plannedOn: '2026-11-05', done: false },
  { id: 'c', plannedOn: '2026-11-08', done: false },
  { id: 'd', plannedOn: '2026-11-10', done: true },
  { id: 'e', plannedOn: '2026-11-20', done: false },
];

describe('the later steps go back', () => {
  it('a tick and its untick leave the open steps where they were', () => {
    const tick = lateTickShift(steps, 'b', '2026-11-12');
    const after = steps.map((s) => ({ ...s, plannedOn: tick.moves.find((m) => m.id === s.id)?.to ?? s.plannedOn, done: s.id === 'b' ? true : s.done }));
    const back = untickStepMoves(after, { days: tick.days, movedSteps: tick.moves.map((m) => m.id) });
    expect(back).toEqual([
      { id: 'c', from: '2026-11-15', to: '2026-11-08' },
      { id: 'e', from: '2026-11-27', to: '2026-11-20' },
    ]);
  });

  it('a moved step ticked since stays where it is', () => {
    const after = [{ id: 'c', plannedOn: '2026-11-15', done: true }, { id: 'e', plannedOn: '2026-11-27', done: false }];
    expect(untickStepMoves(after, { days: 7, movedSteps: ['c', 'e'] }).map((m) => m.id)).toEqual(['e']);
  });

  it('nothing for a tick that moved nothing', () => {
    expect(untickStepMoves(steps, { days: 0, movedSteps: ['c'] })).toEqual([]);
  });
});

const plan: RuleStage[] = [
  { id: 'des', kind: 'DESIGN', name: 'Design', plannedStart: '2026-10-01', plannedEnd: '2026-11-30', actualEnd: null },
  { id: 'civ', kind: 'CIVIL', name: 'Civil', plannedStart: '2026-11-30', plannedEnd: '2026-12-20', actualEnd: null },
  { id: 'han', kind: 'HANDOVER', name: 'Handover', plannedStart: '2027-02-20', plannedEnd: '2027-02-28', actualEnd: null },
];
const apply = (stages: RuleStage[], m: { stages: { stageId: string; plannedStart: string; plannedEnd: string }[] }) =>
  stages.map((s) => {
    const x = m.stages.find((y) => y.stageId === s.id);
    return x ? { ...s, plannedStart: x.plannedStart, plannedEnd: x.plannedEnd } : s;
  });
const rowsOf = (m: { rows: { stageId: string; field: RuleChange['field']; from: string; to: string }[] }, reason: RuleChange['reason'], at: string): RuleChange[] =>
  m.rows.map((r) => ({ stageId: r.stageId, field: r.field, from: r.from, to: r.to, reason, decisionId: null, at: new Date(at) }));

describe("the design's end and handover go back", () => {
  for (const side of ['CLIENT', 'STUDIO'] as const) {
    it(`a ${side === 'CLIENT' ? "client's" : 'studio'} late tick and its untick cancel out: the plan as before, nobody late`, () => {
      const reason = side === 'CLIENT' ? 'CUSTOMER_CHANGE' : 'STUDIO';
      const tick = lateTickPlanMove(plan, 7, side)!;
      const mid = apply(plan, tick);
      const undo = lateTickPlanUndo(mid, 7, side)!;
      const end = apply(mid, undo);
      expect(end).toEqual(plan);
      const o = overallDelay(end, [...rowsOf(tick, reason, '2026-11-12T06:00:00Z'), ...rowsOf(undo, reason, '2026-11-13T06:00:00Z')], '2026-11-13');
      expect(o).toMatchObject({ lateDays: 0, customerDays: 0, studioDays: 0 });
    });
  }

  it('nothing to put back for no days', () => {
    expect(lateTickPlanUndo(plan, 0, 'CLIENT')).toBeNull();
  });
});

describe('what the client sees after an untick', () => {
  it("a voided delay no longer counts in 'Waited on you so far'", () => {
    const stage = { actualEnd: null, items: [{ id: 'b', label: '2D approval', doneAt: null, plannedOn: new Date('2026-11-05T00:00:00Z'), weightBp: 0, inScope: true, responsible: 'CLIENT' }] };
    const row = {
      stepDelays: [
        { id: 'd1', stepId: 'b', fromDate: new Date('2026-11-05T00:00:00Z'), toDate: new Date('2026-11-12T00:00:00Z'), reason: 'CLIENT_DELAY', side: 'CLIENT' },
        { id: 'd2', stepId: 'c', fromDate: new Date('2026-11-01T00:00:00Z'), toDate: new Date('2026-11-04T00:00:00Z'), reason: 'CLIENT_DELAY', side: 'CLIENT' },
      ],
    };
    expect(toCustomerDesign(stage, row, [], null)!.clientDelayDays).toBe(10);
    const after = toCustomerDesign(stage, { ...row, events: [{ refId: 'd1' }] }, [], null)!;
    expect(after.clientDelayDays).toBe(3);
    expect(after.steps[0]!.done).toBe(false);
  });
});
