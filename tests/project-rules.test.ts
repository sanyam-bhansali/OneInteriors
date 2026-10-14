import { describe, expect, it } from 'vitest';
import {
  canMarkStageDone,
  currentStatus,
  dayWords,
  finalPaymentGate,
  gateWords,
  handoverStage,
  isCustomerDelay,
  moveSentence,
  originalEnd,
  overallDelay,
  overrunDays,
  planMove,
  reasonWords,
  settleStage,
  stageCompletion,
  stageStatuses,
  DELAY_REASONS,
  type RuleChange,
  type RuleStage,
} from '@/modules/project/project-rules';
import { calendarOf } from '@/modules/project/working-days';

/**
 * The tracker's rules (studio workspace Phase 3): completion from ticks,
 * the photo gate, whose delay a move is, overall planned vs forecast
 * handover, and the final payment gate. Calendar: Monday–Saturday unless
 * said. October 2026: Thu 1, Mon 5, Sun 11; November: Mon 30.
 */

const t = (done: boolean) => ({ done });
const at = (iso: string) => new Date(iso);

function plan(over: Partial<Record<string, Partial<RuleStage>>> = {}): RuleStage[] {
  const base: RuleStage[] = [
    { id: 'design', kind: 'DESIGN', name: 'Design', plannedStart: '2026-09-01', plannedEnd: '2026-09-15', actualEnd: '2026-09-15' },
    { id: 'civil', kind: 'CIVIL', name: 'Civil', plannedStart: '2026-09-15', plannedEnd: '2026-10-05', actualEnd: '2026-10-05' },
    { id: 'carp', kind: 'CARPENTRY', name: 'Carpentry', plannedStart: '2026-10-05', plannedEnd: '2026-10-31', actualEnd: null },
    { id: 'finish', kind: 'FINISH', name: 'Painting', plannedStart: '2026-11-01', plannedEnd: '2026-11-20', actualEnd: null },
    { id: 'hand', kind: 'HANDOVER', name: 'Handover', plannedStart: '2026-11-20', plannedEnd: '2026-11-25', actualEnd: null },
  ];
  return base.map((s) => ({ ...s, ...(over[s.id] ?? {}) }));
}

function move(p: Partial<RuleChange> & Pick<RuleChange, 'from' | 'to'>): RuleChange {
  return { stageId: 'hand', field: 'HANDOVER', reason: 'SUPPLIER', decisionId: null, at: at('2026-10-02T06:00:00Z'), ...p };
}

describe('stage completion from ticks', () => {
  it('counts done and open; complete only when every item is ticked', () => {
    expect(stageCompletion([t(true), t(false), t(true)])).toEqual({ done: 2, total: 3, open: 1, complete: false });
    expect(stageCompletion([t(true), t(true)])).toEqual({ done: 2, total: 2, open: 0, complete: true });
  });

  it('a stage with no checklist is never complete by ticks', () => {
    expect(stageCompletion([])).toEqual({ done: 0, total: 0, open: 0, complete: false });
  });
});

describe('the photo gate: can mark stage done', () => {
  it('needs at least one photo posted during the stage', () => {
    expect(canMarkStageDone({ items: [t(true)], photos: 0 })).toEqual({ ok: false, why: 'no-photo', open: 0 });
    expect(canMarkStageDone({ items: [t(true)], photos: 1 })).toEqual({ ok: true });
    expect(canMarkStageDone({ items: [], photos: 3 })).toEqual({ ok: true });
    expect(canMarkStageDone({ items: [], photos: 0 }).ok).toBe(false);
  });

  it('needs nothing left open on the checklist, and says how many', () => {
    expect(canMarkStageDone({ items: [t(true), t(false), t(false)], photos: 5 })).toEqual({ ok: false, why: 'items-open', open: 2 });
  });

  it('says why in plain words', () => {
    expect(gateWords({ ok: false, why: 'items-open', open: 1 })).toMatch(/1 step is still open/);
    expect(gateWords({ ok: false, why: 'items-open', open: 3 })).toMatch(/3 steps are still open/);
    expect(gateWords({ ok: false, why: 'no-photo', open: 0 })).toMatch(/site photo/);
  });

  it('settles a stage after ticks: the last tick finishes it only with a photo; an untick reopens it', () => {
    expect(settleStage({ items: [t(true), t(true)], photos: 1, done: false })).toBe('mark-done');
    expect(settleStage({ items: [t(true), t(true)], photos: 0, done: false })).toBe('keep');
    expect(settleStage({ items: [t(true), t(false)], photos: 4, done: false })).toBe('keep');
    expect(settleStage({ items: [t(true), t(false)], photos: 4, done: true })).toBe('reopen');
    expect(settleStage({ items: [t(true)], photos: 1, done: true })).toBe('keep');
    // No checklist: only the hand-marked button decides.
    expect(settleStage({ items: [], photos: 9, done: false })).toBe('keep');
    expect(settleStage({ items: [], photos: 0, done: true })).toBe('keep');
  });
});

describe('delay attribution by reason', () => {
  it('a customer change and any late decision are the customer’s; everything else is the studio’s', () => {
    const who = Object.fromEntries(DELAY_REASONS.map((r) => [r, isCustomerDelay({ reason: r, decisionId: null })]));
    expect(who).toEqual({ SUPPLIER: false, CUSTOMER_CHANGE: true, SITE_CONDITION: false, STUDIO: false, OTHER: false });
    for (const r of DELAY_REASONS) expect(isCustomerDelay({ reason: r, decisionId: 'd1' }), r).toBe(true);
  });

  it('the customer reads the reason in plain words, a decision named as theirs', () => {
    expect(reasonWords({ reason: 'SUPPLIER', decisionId: null })).toBe('a supplier delivered late');
    expect(reasonWords({ reason: 'CUSTOMER_CHANGE', decisionId: null })).toBe('a change you asked for');
    expect(reasonWords({ reason: 'SITE_CONDITION', decisionId: null })).toBe('something on site needed extra work');
    expect(reasonWords({ reason: 'STUDIO', decisionId: null })).toBe("the studio's own delay");
    expect(reasonWords({ reason: 'OTHER', decisionId: null })).toBe('the studio rescheduled the work');
    expect(reasonWords({ reason: 'CUSTOMER_CHANGE', decisionId: 'd1' })).toBe('waiting on your decision');
  });

  it('one sentence per move: old date, new date, reason, and handover when it moved too', () => {
    expect(dayWords('2026-12-18')).toBe('18 Dec');
    expect(moveSentence({ stageName: 'Handover', field: 'HANDOVER', from: '2026-12-14', to: '2026-12-18', reason: 'SUPPLIER', decisionId: null })).toBe(
      'Handover is now 18 Dec (was 14 Dec): a supplier delivered late.',
    );
    expect(
      moveSentence({ stageName: 'Carpentry', field: 'PLANNED_END', from: '2026-10-31', to: '2026-11-05', reason: 'CUSTOMER_CHANGE', decisionId: 'd1', handoverTo: '2026-11-30' }),
    ).toBe('Carpentry now ends 5 Nov (was 31 Oct): waiting on your decision. Handover moves to 30 Nov.');
    expect(moveSentence({ stageName: 'Painting', field: 'PLANNED_START', from: '2026-11-01', to: '2026-11-03', reason: 'STUDIO', decisionId: null })).toBe(
      "Painting now starts 3 Nov (was 1 Nov): the studio's own delay.",
    );
  });
});

describe('where each stage stands', () => {
  it('done by actualEnd only; the first open stage is now, the next is next', () => {
    const s = stageStatuses(plan(), [], '2026-10-10');
    expect(s.map((x) => [x.id, x.state, x.status])).toEqual([
      ['design', 'done', 'done'],
      ['civil', 'done', 'done'],
      ['carp', 'now', 'on-track'],
      ['finish', 'next', 'upcoming'],
      ['hand', 'later', 'upcoming'],
    ]);
    expect(currentStatus(s)).toEqual({ id: 'carp', kind: 'CARPENTRY', name: 'Carpentry', status: 'on-track', lateDays: 0 });
  });

  it('the stage under way is late by working days past its own end, and pushes the forecasts after it', () => {
    // Carpentry ends Sat 31 Oct; on Thu 5 Nov it has overrun Mon–Thu = 4 working days (Sunday not counted).
    const s = stageStatuses(plan(), [], '2026-11-05');
    expect(s[2]).toMatchObject({ status: 'late', lateDays: 4, forecastEnd: '2026-11-05' });
    expect(s[3]!.forecastEnd).toBe('2026-11-25'); // 20 Nov + 4 working days
    expect(currentStatus(s)).toMatchObject({ status: 'late', lateDays: 4 });
    expect(overrunDays(plan(), '2026-11-05')).toBe(4);
    expect(overrunDays(plan(), '2026-10-31')).toBe(0);
  });

  it('a finished stage is late or early against its end as first planned', () => {
    const changes = [move({ stageId: 'civil', field: 'PLANNED_END', from: '2026-09-28', to: '2026-10-05' })];
    const s = stageStatuses(plan(), changes, '2026-10-10');
    expect(s[1]).toMatchObject({ originalEnd: '2026-09-28', lateDays: 6, earlyDays: 0, lastMove: changes[0] });
    const early = stageStatuses(plan({ design: { actualEnd: '2026-09-12' } }), [], '2026-10-10');
    expect(early[0]).toMatchObject({ lateDays: 0, earlyDays: 2 }); // Sat 12 → Tue 15: Mon and Tue (Sunday off)
  });

  it('the original end is the earliest recorded move, whatever order the rows come in', () => {
    const changes = [
      move({ from: '2026-11-28', to: '2026-11-30', at: at('2026-10-05T00:00:00Z') }),
      move({ from: '2026-11-25', to: '2026-11-28', at: at('2026-10-01T00:00:00Z') }),
    ];
    expect(originalEnd(plan({ hand: { plannedEnd: '2026-11-30' } })[4]!, changes, true)).toBe('2026-11-25');
    expect(originalEnd(plan()[4]!, [], true)).toBe('2026-11-25');
  });

  it('everything done: no current stage (handed over)', () => {
    const done = plan({ carp: { actualEnd: '2026-10-30' }, finish: { actualEnd: '2026-11-19' }, hand: { actualEnd: '2026-11-25' } });
    expect(currentStatus(stageStatuses(done, [], '2026-12-01'))).toBeNull();
  });

  it('finds the handover stage by kind, else the last', () => {
    expect(handoverStage(plan())!.id).toBe('hand');
    expect(handoverStage(plan().slice(0, 3))!.id).toBe('carp');
    expect(handoverStage([])).toBeNull();
  });
});

describe('overall: planned handover vs forecast handover', () => {
  it('on time when nothing moved and nothing overran', () => {
    expect(overallDelay(plan(), [], '2026-10-10')).toEqual({
      plannedHandover: '2026-11-25',
      forecastHandover: '2026-11-25',
      handedOver: false,
      lateDays: 0,
      earlyDays: 0,
      customerDays: 0,
      studioDays: 0,
      overrunDays: 0,
    });
  });

  it('a studio-caused move counts against the studio', () => {
    const o = overallDelay(plan({ hand: { plannedEnd: '2026-11-30' } }), [move({ from: '2026-11-25', to: '2026-11-30', reason: 'SUPPLIER' })], '2026-10-10');
    expect(o).toMatchObject({ plannedHandover: '2026-11-25', forecastHandover: '2026-11-30', lateDays: 4, customerDays: 0, studioDays: 4 });
  });

  it('a customer-caused move is shown in the total but not counted against the studio', () => {
    const o = overallDelay(plan({ hand: { plannedEnd: '2026-11-30' } }), [move({ from: '2026-11-25', to: '2026-11-30', reason: 'CUSTOMER_CHANGE' })], '2026-10-10');
    expect(o).toMatchObject({ lateDays: 4, customerDays: 4, studioDays: 0 });
  });

  it('a late decision’s delay is the customer’s, whatever reason was picked', () => {
    const o = overallDelay(plan({ hand: { plannedEnd: '2026-11-30' } }), [move({ from: '2026-11-25', to: '2026-11-30', reason: 'OTHER', decisionId: 'd1' })], '2026-10-10');
    expect(o).toMatchObject({ lateDays: 4, customerDays: 4, studioDays: 0 });
  });

  it('splits mixed moves, and adds an overrun nobody explained to the studio', () => {
    const changes = [
      move({ from: '2026-11-25', to: '2026-11-28', reason: 'CUSTOMER_CHANGE', at: at('2026-10-01T00:00:00Z') }), // 3 working days
      move({ from: '2026-11-28', to: '2026-12-01', reason: 'SUPPLIER', at: at('2026-10-02T00:00:00Z') }), // 2 working days
    ];
    const stages = plan({ hand: { plannedEnd: '2026-12-01' } });
    expect(overallDelay(stages, changes, '2026-10-10')).toMatchObject({ lateDays: 5, customerDays: 3, studioDays: 2, overrunDays: 0 });
    // Carpentry overran 4 working days by 5 Nov: forecast 1 Dec + 4 = 5 Dec.
    expect(overallDelay(stages, changes, '2026-11-05')).toMatchObject({ forecastHandover: '2026-12-05', lateDays: 9, customerDays: 3, studioDays: 6, overrunDays: 4 });
  });

  it('customer days never exceed the delay there is', () => {
    // Moved 4 days for the customer, then the studio pulled it back 2 days: 2 late, both the customer's.
    const changes = [
      move({ from: '2026-11-25', to: '2026-11-30', reason: 'CUSTOMER_CHANGE', at: at('2026-10-01T00:00:00Z') }),
      move({ from: '2026-11-30', to: '2026-11-27', reason: 'STUDIO', at: at('2026-10-02T00:00:00Z') }),
    ];
    expect(overallDelay(plan({ hand: { plannedEnd: '2026-11-27' } }), changes, '2026-10-10')).toMatchObject({ lateDays: 2, customerDays: 2, studioDays: 0 });
  });

  it('handover moved earlier is early, not late', () => {
    const o = overallDelay(plan({ hand: { plannedEnd: '2026-11-23' } }), [move({ from: '2026-11-25', to: '2026-11-23', reason: 'STUDIO' })], '2026-10-10');
    expect(o).toMatchObject({ lateDays: 0, earlyDays: 2, customerDays: 0, studioDays: 0 });
  });

  it('once handed over, the forecast is the day it happened', () => {
    const done = plan({ carp: { actualEnd: '2026-10-30' }, finish: { actualEnd: '2026-11-21' }, hand: { actualEnd: '2026-11-27' } });
    expect(overallDelay(done, [], '2026-12-20')).toMatchObject({ handedOver: true, forecastHandover: '2026-11-27', lateDays: 2, studioDays: 2, overrunDays: 0 });
  });

  it('counts working days on the studio’s own calendar', () => {
    const fiveDay = calendarOf({ workingDays: [1, 2, 3, 4, 5], holidays: ['2026-11-26'] });
    // Wed 25 Nov → Mon 30 Nov: Thu is a holiday, Sat and Sun are off: only Fri and Mon count.
    const o = overallDelay(plan({ hand: { plannedEnd: '2026-11-30' } }), [move({ from: '2026-11-25', to: '2026-11-30' })], '2026-10-10', fiveDay);
    expect(o.lateDays).toBe(2);
  });

  it('no plan: nothing to say', () => {
    expect(overallDelay([], [], '2026-10-10')).toMatchObject({ plannedHandover: null, lateDays: 0 });
  });
});

describe('moving a date', () => {
  const stages = plan();

  it('requires a reason', () => {
    for (const reason of [undefined, '', 'LATE', null]) {
      const r = planMove(stages, { stageId: 'carp', field: 'PLANNED_END', to: '2026-11-05', reason, shiftLater: true });
      expect(r).toEqual({ ok: false, error: expect.stringMatching(/Pick why/) });
    }
  });

  it('refuses a bad day, an unknown stage, the same date, and an end before the start', () => {
    expect(planMove(stages, { stageId: 'carp', field: 'PLANNED_END', to: '2026-02-30', reason: 'STUDIO', shiftLater: false }).ok).toBe(false);
    expect(planMove(stages, { stageId: 'nope', field: 'PLANNED_END', to: '2026-11-05', reason: 'STUDIO', shiftLater: false }).ok).toBe(false);
    expect(planMove(stages, { stageId: 'carp', field: 'PLANNED_END', to: '2026-10-31', reason: 'STUDIO', shiftLater: false })).toEqual({ ok: false, error: 'That is already its end date.' });
    expect(planMove(stages, { stageId: 'carp', field: 'PLANNED_END', to: '2026-10-01', reason: 'STUDIO', shiftLater: false }).ok).toBe(false);
    expect(planMove(stages, { stageId: 'carp', field: 'PLANNED_START', to: '2026-11-02', reason: 'STUDIO', shiftLater: false }).ok).toBe(false);
  });

  it('an end move alone writes one row', () => {
    const r = planMove(stages, { stageId: 'carp', field: 'PLANNED_END', to: '2026-11-05', reason: 'SUPPLIER', shiftLater: false });
    expect(r).toEqual({
      ok: true,
      plan: {
        rows: [{ stageId: 'carp', field: 'PLANNED_END', from: '2026-10-31', to: '2026-11-05' }],
        stages: [{ stageId: 'carp', plannedStart: '2026-10-05', plannedEnd: '2026-11-05' }],
        days: 5,
      },
    });
  });

  it('with later stages, moves each by the same days, the handover end recorded as HANDOVER', () => {
    const r = planMove(stages, { stageId: 'carp', field: 'PLANNED_END', to: '2026-11-05', reason: 'SUPPLIER', shiftLater: true });
    if (!r.ok) throw new Error(r.error);
    expect(r.plan.rows).toEqual([
      { stageId: 'carp', field: 'PLANNED_END', from: '2026-10-31', to: '2026-11-05' },
      { stageId: 'finish', field: 'PLANNED_START', from: '2026-11-01', to: '2026-11-06' },
      { stageId: 'finish', field: 'PLANNED_END', from: '2026-11-20', to: '2026-11-25' },
      { stageId: 'hand', field: 'PLANNED_START', from: '2026-11-20', to: '2026-11-25' },
      { stageId: 'hand', field: 'HANDOVER', from: '2026-11-25', to: '2026-11-30' },
    ]);
    // And the attribution then follows the reason through to handover.
    const after = plan({ carp: { plannedEnd: '2026-11-05' }, hand: { plannedEnd: '2026-11-30' } });
    const changes = r.plan.rows.map((x) => ({ ...x, reason: 'CUSTOMER_CHANGE' as const, decisionId: null, at: at('2026-10-02T00:00:00Z') }));
    expect(overallDelay(after, changes, '2026-10-10')).toMatchObject({ lateDays: 4, customerDays: 4, studioDays: 0 });
  });

  it('moving the handover stage’s end is a HANDOVER row', () => {
    const r = planMove(stages, { stageId: 'hand', field: 'PLANNED_END', to: '2026-12-02', reason: 'STUDIO', shiftLater: true });
    expect(r.ok && r.plan.rows).toEqual([{ stageId: 'hand', field: 'HANDOVER', from: '2026-11-25', to: '2026-12-02' }]);
  });

  it('a start move changes only that stage’s start', () => {
    const r = planMove(stages, { stageId: 'finish', field: 'PLANNED_START', to: '2026-11-03', reason: 'STUDIO', shiftLater: true });
    expect(r.ok && r.plan).toEqual({
      rows: [{ stageId: 'finish', field: 'PLANNED_START', from: '2026-11-01', to: '2026-11-03' }],
      stages: [{ stageId: 'finish', plannedStart: '2026-11-03', plannedEnd: '2026-11-20' }],
      days: 2,
    });
  });

  it('a finished later stage keeps its dates', () => {
    const r = planMove(plan({ finish: { actualEnd: '2026-11-19' } }), { stageId: 'carp', field: 'PLANNED_END', to: '2026-11-02', reason: 'STUDIO', shiftLater: true });
    expect(r.ok && r.plan.stages.map((s) => s.stageId)).toEqual(['carp', 'hand']);
  });
});

describe('the final payment gate', () => {
  it('can fall due only with no open snag', () => {
    expect(finalPaymentGate(0)).toEqual({ canBeDue: true });
    expect(finalPaymentGate(1)).toEqual({ canBeDue: false, openSnags: 1, words: 'Locked until the open snag is closed.' });
    expect(finalPaymentGate(2)).toEqual({ canBeDue: false, openSnags: 2, words: 'Locked until all 2 open snags are closed.' });
  });
});
