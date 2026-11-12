import { describe, expect, it } from 'vitest';
import { customerTracker, type TrackerInputRow } from '@/modules/portal/tracker-view';
import { overallDelay, type RuleChange, type RuleStage } from '@/modules/project/project-rules';
import { projectKpis } from '@/modules/studio/app-kpis';
import { toCustomerDesign } from '@/modules/studio-design/customer-view';
import { lateTickPlanMove, lateTickShift } from '@/modules/studio-design/rules';

/*
 * A design step ticked late (owner, 12 Nov 2026): "when a task is ticked
 * after delay the next steps should automatically calculate the new
 * completion deadline and planned date both and if it is clients delay it
 * should not show as delay in our software".
 */

const steps = [
  { id: 'a', plannedOn: '2026-11-01', done: true },
  { id: 'b', plannedOn: '2026-11-05', done: false }, // ticked today, 12 Nov: 7 days late
  { id: 'c', plannedOn: '2026-11-08', done: false },
  { id: 'd', plannedOn: '2026-11-10', done: true }, // ticked early: never moves
  { id: 'e', plannedOn: '2026-11-20', done: false },
  { id: 'f', plannedOn: null, done: false },
];

describe('the later steps after a late tick (pure rule)', () => {
  it('moves every later open step by the days it was late, keeping the gaps', () => {
    const s = lateTickShift(steps, 'b', '2026-11-12');
    expect(s.days).toBe(7);
    expect(s.moves).toEqual([
      { id: 'c', from: '2026-11-08', to: '2026-11-15' },
      { id: 'e', from: '2026-11-20', to: '2026-11-27' },
    ]);
    // The gap between c and e (12 days) is kept.
  });

  it('never moves a ticked step, an earlier step or a step with no day', () => {
    const ids = lateTickShift(steps, 'b', '2026-11-12').moves.map((m) => m.id);
    expect(ids).not.toContain('a');
    expect(ids).not.toContain('b');
    expect(ids).not.toContain('d');
    expect(ids).not.toContain('f');
  });

  it('moves nothing when ticked on its day or early', () => {
    expect(lateTickShift(steps, 'b', '2026-11-05')).toEqual({ days: 0, moves: [] });
    expect(lateTickShift(steps, 'b', '2026-11-02')).toEqual({ days: 0, moves: [] });
  });

  it('moves nothing for a step with no day, an unknown step or a bad day', () => {
    expect(lateTickShift(steps, 'f', '2026-11-12').days).toBe(0);
    expect(lateTickShift(steps, 'zz', '2026-11-12').days).toBe(0);
    expect(lateTickShift(steps, 'b', 'today').days).toBe(0);
  });

  it('a late last step has nothing after it to move', () => {
    expect(lateTickShift([{ id: 'x', plannedOn: '2026-11-01', done: false }], 'x', '2026-11-04')).toEqual({ days: 3, moves: [] });
  });
});

const plan: RuleStage[] = [
  { id: 'des', kind: 'DESIGN', name: 'Design', plannedStart: '2026-10-01', plannedEnd: '2026-11-30', actualEnd: null },
  { id: 'civ', kind: 'CIVIL', name: 'Civil', plannedStart: '2026-11-30', plannedEnd: '2026-12-20', actualEnd: null },
  { id: 'han', kind: 'HANDOVER', name: 'Handover', plannedStart: '2027-02-20', plannedEnd: '2027-02-28', actualEnd: null },
];

/** The plan move's rows as the date changes it writes (all at one instant). */
const changesOf = (rows: NonNullable<ReturnType<typeof lateTickPlanMove>>['rows'], reason: RuleChange['reason'], at = new Date('2026-11-12T06:00:00Z')): RuleChange[] =>
  rows.map((r) => ({ stageId: r.stageId, field: r.field, from: r.from, to: r.to, reason, decisionId: null, at }));

describe('the completion deadline after a late tick: design end and handover', () => {
  it("moves the design's end and every later stage by the same days", () => {
    const m = lateTickPlanMove(plan, 7, 'CLIENT')!;
    expect(m.days).toBe(7);
    expect(m.stages).toEqual([
      { stageId: 'des', plannedStart: '2026-10-01', plannedEnd: '2026-12-07' },
      { stageId: 'civ', plannedStart: '2026-12-07', plannedEnd: '2026-12-27' },
      { stageId: 'han', plannedStart: '2027-02-27', plannedEnd: '2027-03-07' },
    ]);
    expect(m.rows.find((r) => r.field === 'HANDOVER')).toMatchObject({ from: '2027-02-28', to: '2027-03-07' });
  });

  it('leaves a finished stage where it is', () => {
    const done = plan.map((s) => (s.id === 'civ' ? { ...s, actualEnd: '2026-12-01' } : s));
    expect(lateTickPlanMove(done, 3, 'STUDIO')!.stages.map((s) => s.stageId)).toEqual(['des', 'han']);
  });

  it('moves nothing for no days or no design stage', () => {
    expect(lateTickPlanMove(plan, 0, 'CLIENT')).toBeNull();
    expect(lateTickPlanMove(plan.filter((s) => s.kind !== 'DESIGN'), 5, 'CLIENT')).toBeNull();
  });

  it("the client's delay is not counted against the studio", () => {
    const m = lateTickPlanMove(plan, 7, 'CLIENT')!;
    const after = plan.map((s) => ({ ...s, ...m.stages.find((x) => x.stageId === s.id) }));
    const o = overallDelay(after, changesOf(m.rows, 'CUSTOMER_CHANGE'), '2026-11-12');
    expect(o.lateDays).toBeGreaterThan(0);
    expect(o.customerDays).toBe(o.lateDays);
    expect(o.studioDays).toBe(0);
  });

  it('our delay counts against the studio, as now', () => {
    const m = lateTickPlanMove(plan, 7, 'STUDIO')!;
    const after = plan.map((s) => ({ ...s, ...m.stages.find((x) => x.stageId === s.id) }));
    const o = overallDelay(after, changesOf(m.rows, 'STUDIO'), '2026-11-12');
    expect(o.studioDays).toBe(o.lateDays);
    expect(o.studioDays).toBeGreaterThan(0);
    expect(o.customerDays).toBe(0);
  });
});

describe('studio counts: the client’s days are not our delay', () => {
  it('"Running late" counts projects late on us only', () => {
    const rows = [
      { lateDays: 5, customerLateDays: 5, waiting: [], nextPayment: null }, // all the client's
      { lateDays: 4, customerLateDays: 1, waiting: [], nextPayment: null }, // 3 days ours
    ];
    expect(projectKpis({ board: null, rows, money: false })[0]).toMatchObject({ label: 'Running late', value: 1, tone: 'bad' });
    expect(projectKpis({ board: null, rows: [rows[0]!], money: false })[0]).toMatchObject({ value: 0, tone: 'good', note: 'nothing on us · 1 project waiting on clients' });
  });
});

describe('what the client sees', () => {
  const D = (s: string) => new Date(s);
  const at = D('2026-11-12T06:00:00Z');
  const row = (reason: 'CUSTOMER_CHANGE' | 'STUDIO'): TrackerInputRow => ({
    stages: [
      { id: 'des', kind: 'DESIGN', name: 'Design', plannedStart: D('2026-10-01T00:00:00Z'), plannedEnd: D('2026-12-07T00:00:00Z'), actualEnd: null, items: [] },
      { id: 'han', kind: 'HANDOVER', name: 'Handover', plannedStart: D('2027-02-27T00:00:00Z'), plannedEnd: D('2027-03-07T00:00:00Z'), actualEnd: null, items: [] },
    ],
    dateChanges: [
      { stageId: 'des', field: 'PLANNED_END', fromDate: D('2026-11-30T00:00:00Z'), toDate: D('2026-12-07T00:00:00Z'), reason, decisionId: null, at },
      { stageId: 'han', field: 'PLANNED_START', fromDate: D('2027-02-20T00:00:00Z'), toDate: D('2027-02-27T00:00:00Z'), reason, decisionId: null, at },
      { stageId: 'han', field: 'HANDOVER', fromDate: D('2027-02-28T00:00:00Z'), toDate: D('2027-03-07T00:00:00Z'), reason, decisionId: null, at },
    ],
  });

  it('no design date: a move that starts on the design is not listed for them', () => {
    for (const reason of ['CUSTOMER_CHANGE', 'STUDIO'] as const) {
      const t = customerTracker(row(reason), [], D('2026-11-12T08:00:00Z')).tracker!;
      expect(t.moves).toEqual([]);
      expect(t.stages.every((s) => s.moved === null)).toBe(true);
    }
  });

  it("their own days still count as theirs; the studio's never show", () => {
    const client = customerTracker(row('CUSTOMER_CHANGE'), [], D('2026-11-12T08:00:00Z')).tracker!;
    expect(client.overall.customerDays).toBeGreaterThan(0);
    expect(client.overall.studioDays).toBe(0);
    const ours = customerTracker(row('STUDIO'), [], D('2026-11-12T08:00:00Z')).tracker!;
    expect(ours.overall.customerDays).toBe(0);
    expect(ours.overall.lateDays).toBe(0);
  });

  it('the design card adds up the days it waited on them, never ours', () => {
    const stage = { actualEnd: null, items: [{ id: 'b', label: '2D layout approval', doneAt: at, plannedOn: D('2026-11-05T00:00:00Z'), weightBp: 0, inScope: true, responsible: 'CLIENT' }] };
    const design = toCustomerDesign(
      stage,
      {
        stepDelays: [
          { stepId: 'b', fromDate: D('2026-11-05T00:00:00Z'), toDate: D('2026-11-12T00:00:00Z'), reason: 'CLIENT_DELAY', side: 'CLIENT' },
          { stepId: 'c', fromDate: D('2026-11-01T00:00:00Z'), toDate: D('2026-11-04T00:00:00Z'), reason: 'STUDIO_DELAY', side: 'STUDIO' },
        ],
      },
      [],
      null,
    )!;
    expect(design.clientDelayDays).toBe(7);
    expect(design.steps[0]).toMatchObject({ plannedOn: null, doneOn: null, moved: null });
  });
});
