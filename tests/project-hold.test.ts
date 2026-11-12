import { describe, expect, it } from 'vitest';
import { overallDelay, type RuleChange, type RuleStage } from '@/modules/project/project-rules';
import { checkHoldAsk, holdDays, holdEndShift, mayApproveHold, mayEndHold, openHold, toCustomerHold, totalHoldDays } from '@/modules/studio-hold/rules';

/*
 * A project on hold (owner, 12 Nov 2026): a designer asks, the design head or
 * the owner approves; while on, nothing is late; taken off, the plan moves by
 * the hold's days on the client's side.
 */

describe('who may', () => {
  it('the owner and the design head approve; a designer, PM or sales does not', () => {
    expect(mayApproveHold({ role: 'OWNER' })).toBe(true);
    expect(mayApproveHold({ role: 'DESIGNER', designHead: true })).toBe(true);
    expect(mayApproveHold({ role: 'DESIGNER' })).toBe(false);
    expect(mayApproveHold({ role: 'PM' })).toBe(false);
    expect(mayApproveHold({ role: 'SALES', designHead: true })).toBe(false);
  });

  it('the one who asked, or an approver, takes it off', () => {
    const hold = { askedById: 'u-meera' };
    expect(mayEndHold({ role: 'DESIGNER', userId: 'u-meera' }, hold)).toBe(true);
    expect(mayEndHold({ role: 'DESIGNER', userId: 'u-other' }, hold)).toBe(false);
    expect(mayEndHold({ role: 'DESIGNER', designHead: true, userId: 'u-head' }, hold)).toBe(true);
    expect(mayEndHold({ role: 'OWNER', userId: 'u-owner' }, hold)).toBe(true);
  });
});

describe('asking', () => {
  it('needs a reason, and one open hold at a time', () => {
    expect(checkHoldAsk({ reason: 'POSSESSION_LATE', note: '  keys in Jan ' }, [])).toEqual({ ok: true, reason: 'POSSESSION_LATE', note: 'keys in Jan' });
    expect(checkHoldAsk({ reason: 'nope', note: '' }, []).ok).toBe(false);
    expect(checkHoldAsk({ reason: 'OTHER', note: '' }, [{ status: 'ASKED' }])).toMatchObject({ ok: false, error: 'A hold is waiting for approval already.' });
    expect(checkHoldAsk({ reason: 'OTHER', note: '' }, [{ status: 'ON' }])).toMatchObject({ ok: false, error: 'This project is on hold already.' });
    expect(checkHoldAsk({ reason: 'OTHER', note: '' }, [{ status: 'ENDED' }, { status: 'DECLINED' }]).ok).toBe(true);
    expect(checkHoldAsk({ reason: 'OTHER', note: 'x'.repeat(501) }, []).ok).toBe(false);
  });

  it('the open hold is the asked or on one', () => {
    expect(openHold([{ status: 'ENDED' }, { status: 'ASKED' }])).toEqual({ status: 'ASKED' });
    expect(openHold([{ status: 'ENDED' }, { status: 'WITHDRAWN' }])).toBeNull();
  });
});

describe('days on hold', () => {
  it('counts from the first day to the day it ends (or today)', () => {
    expect(holdDays('2026-11-01', '2026-11-11', '2026-11-20')).toBe(10);
    expect(holdDays('2026-11-01', null, '2026-11-12')).toBe(11);
    expect(holdDays(null, null, '2026-11-12')).toBe(0);
    expect(holdDays('2026-11-12', null, '2026-11-12')).toBe(0);
  });

  it("adds up every hold that ran, never one declined", () => {
    const holds = [
      { status: 'ENDED', startedOn: '2026-10-01', endedOn: '2026-10-06' },
      { status: 'ON', startedOn: '2026-11-10', endedOn: null },
      { status: 'DECLINED', startedOn: null, endedOn: null },
    ];
    expect(totalHoldDays(holds, '2026-11-12')).toBe(5 + 2);
  });
});

const stages: RuleStage[] = [
  { id: 'des', kind: 'DESIGN', name: 'Design', plannedStart: '2026-10-01', plannedEnd: '2026-11-10', actualEnd: '2026-11-08' },
  { id: 'civ', kind: 'CIVIL', name: 'Civil', plannedStart: '2026-11-10', plannedEnd: '2026-12-01', actualEnd: null },
  { id: 'car', kind: 'CARPENTRY', name: 'Carpentry', plannedStart: '2026-12-01', plannedEnd: '2027-01-15', actualEnd: null },
  { id: 'han', kind: 'HANDOVER', name: 'Handover', plannedStart: '2027-01-15', plannedEnd: '2027-01-20', actualEnd: null },
];
const steps = [
  { id: 'd1', stageId: 'des', plannedOn: '2026-11-01', done: true },
  { id: 'c1', stageId: 'civ', plannedOn: '2026-11-12', done: true },
  { id: 'c2', stageId: 'civ', plannedOn: '2026-11-20', done: false },
  { id: 'c3', stageId: 'civ', plannedOn: null, done: false },
  { id: 'k1', stageId: 'car', plannedOn: '2026-12-10', done: false },
];

describe('taking it off hold resets the timeline (pure rule)', () => {
  it("moves the stage under way's open steps by exactly the days, its end, and every later stage", () => {
    const s = holdEndShift(stages, steps, 14);
    expect(s.days).toBe(14);
    expect(s.steps).toEqual([{ id: 'c2', from: '2026-11-20', to: '2026-12-04' }]);
    expect(s.plan!.stages).toEqual([
      { stageId: 'civ', plannedStart: '2026-11-10', plannedEnd: '2026-12-15' },
      { stageId: 'car', plannedStart: '2026-12-15', plannedEnd: '2027-01-29' },
      { stageId: 'han', plannedStart: '2027-01-29', plannedEnd: '2027-02-03' },
    ]);
  });

  it('never moves a finished stage or a ticked step', () => {
    const s = holdEndShift(stages, steps, 14);
    expect(s.plan!.stages.map((x) => x.stageId)).not.toContain('des');
    expect(s.steps.map((x) => x.id)).not.toContain('c1');
  });

  it('moves nothing for a hold of no days, and only the steps when every stage is done', () => {
    expect(holdEndShift(stages, steps, 0)).toEqual({ days: 0, steps: [], plan: null });
    const allDone = stages.map((s) => ({ ...s, actualEnd: '2027-01-20' }));
    expect(holdEndShift(allDone, steps, 5).plan).toBeNull();
  });

  it('the hold days are the client’s: handover moves, nothing counts against the studio', () => {
    const s = holdEndShift(stages, steps, 14);
    const after = stages.map((x) => ({ ...x, ...s.plan!.stages.find((m) => m.stageId === x.id) }));
    const at = new Date('2026-11-24T06:00:00Z');
    const changes: RuleChange[] = s.plan!.rows.map((r) => ({ stageId: r.stageId, field: r.field, from: r.from, to: r.to, reason: 'CUSTOMER_CHANGE', decisionId: null, at }));
    const o = overallDelay(after, changes, '2026-11-24');
    expect(o.lateDays).toBeGreaterThan(0);
    expect(o.studioDays).toBe(0);
    expect(o.customerDays).toBe(o.lateDays);
  });
});

describe('what the client sees', () => {
  it('on hold since when and why, in plain words; never the note', () => {
    const out = toCustomerHold([{ status: 'ON', reason: 'POSSESSION_LATE', startedOn: '2026-11-10', endedOn: null }], '2026-11-12');
    expect(out.now).toEqual({ since: '2026-11-10', days: 2, reason: 'POSSESSION_LATE', words: 'waiting for possession of your flat' });
    expect(JSON.stringify(out)).not.toContain('note');
  });

  it('nothing on hold now; ended holds still count as days waited', () => {
    const out = toCustomerHold([{ status: 'ENDED', reason: 'CLIENT_NOT_RESPONDING', startedOn: '2026-10-01', endedOn: '2026-10-08' }], '2026-11-12');
    expect(out).toEqual({ now: null, totalDays: 7 });
  });

  it('an unknown reason reads as the client side, politely', () => {
    expect(toCustomerHold([{ status: 'ON', reason: 'weird', startedOn: '2026-11-11', endedOn: null }], '2026-11-12').now).toMatchObject({ reason: 'OTHER', words: 'paused on your side' });
  });
});
