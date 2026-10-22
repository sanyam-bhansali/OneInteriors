import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CALL_MENU } from '@/modules/studio-practice/call-log';
import { CALL_OUTCOMES } from '@/modules/studio-practice/event-copy';
import {
  NOT_PICKED_UP,
  allowedCallMoves,
  callSteps,
  giveUpStage,
  isNotPickedUp,
  junkStage,
  suggestCallMove,
  type CallStage,
} from '@/modules/studio-practice/call-step-rules';
import { HAUSPIRE_PIPELINE, planPreset, presetSummary, type ExistingStage } from '@/modules/studio-practice/pipeline-preset';
import { CALL_HOURS, inTwoHoursClamped, retryChoices, tomorrowMorning } from '@/modules/studio-sales/call-schedule';
import { followupDue } from '@/modules/studio-practice/event-copy';
import { buildToday } from '@/modules/studio-sales/today-rules';

/** Calling steps (owner, 21 Oct 2026): the suggested move after a call, pre-ticked, never silent. */

/** Hauspire's pipeline as it stands after the preset: New, Calling 1–4, Junk, …, Lost. */
const HAUSPIRE: CallStage[] = HAUSPIRE_PIPELINE.map((p, i) => ({ id: p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: p.name, kind: p.kind, sortOrder: i, isIntake: !!p.isIntake, isCallStep: !!p.isCallStep }));
const id = (name: string) => HAUSPIRE.find((s) => s.name === name)!.id;
const MISSED = ['no_answer', 'line_busy', 'switched_off', 'voicemail'] as const;
const PICKED = ['spoke', 'busy', 'not_interested'] as const;

describe('which calls count as not picked up', () => {
  it('no answer, busy, switched off and voicemail — the four the Log call menu lists besides Picked up and Wrong number', () => {
    expect([...NOT_PICKED_UP].sort()).toEqual([...MISSED].sort());
    const menu = CALL_MENU.map((m) => m.id).filter((m) => m !== 'picked_up' && m !== 'wrong_number');
    expect(menu.every((m) => isNotPickedUp(m))).toBe(true);
    for (const o of CALL_OUTCOMES.map((c) => c.id)) expect(isNotPickedUp(o)).toBe((MISSED as readonly string[]).includes(o));
    expect(isNotPickedUp('picked_up')).toBe(false);
    expect(isNotPickedUp('')).toBe(false);
  });
});

describe('the calling steps and the junk column', () => {
  it('are Calling 1–4 in board order, never the intake, only open columns', () => {
    expect(callSteps(HAUSPIRE).map((s) => s.name)).toEqual(['Calling 1', 'Calling 2', 'Calling 3', 'Calling 4']);
    const shuffled = [...HAUSPIRE].reverse();
    expect(callSteps(shuffled).map((s) => s.name)).toEqual(['Calling 1', 'Calling 2', 'Calling 3', 'Calling 4']);
    const odd: CallStage[] = [
      { id: 'n', name: 'New', kind: 'OPEN', sortOrder: 0, isIntake: true, isCallStep: true },
      { id: 'w', name: 'Won', kind: 'WON', sortOrder: 1, isCallStep: true },
      { id: 'c', name: 'Ring', kind: 'OPEN', sortOrder: 2, isCallStep: true },
    ];
    expect(callSteps(odd).map((s) => s.id)).toEqual(['c']);
  });

  it('without sort orders, the array order is the board order', () => {
    const plain: CallStage[] = [
      { id: 'a', name: 'New', kind: 'OPEN', isIntake: true },
      { id: 'b', name: 'Ring 1', kind: 'OPEN', isCallStep: true },
      { id: 'c', name: 'Ring 2', kind: 'OPEN', isCallStep: true },
    ];
    expect(callSteps(plain).map((s) => s.id)).toEqual(['b', 'c']);
  });

  it('junk is a lost column other than the one "Mark lost" uses; none when there is only one', () => {
    expect(junkStage(HAUSPIRE)?.name).toBe('Junk');
    expect(junkStage(HAUSPIRE.filter((s) => s.name !== 'Junk'))).toBeNull();
    expect(junkStage(HAUSPIRE.filter((s) => s.kind !== 'LOST'))).toBeNull();
  });
});

describe('the suggested move after a call', () => {
  it('a missed call from New suggests Calling 1', () => {
    for (const o of MISSED) expect(suggestCallMove(HAUSPIRE, id('New'), o)).toEqual({ kind: 'move', to: { id: id('Calling 1'), name: 'Calling 1' } });
  });

  it('a missed call from Calling N suggests Calling N+1', () => {
    for (const o of MISSED) {
      expect(suggestCallMove(HAUSPIRE, id('Calling 1'), o)).toEqual({ kind: 'move', to: { id: id('Calling 2'), name: 'Calling 2' } });
      expect(suggestCallMove(HAUSPIRE, id('Calling 2'), o)).toEqual({ kind: 'move', to: { id: id('Calling 3'), name: 'Calling 3' } });
      expect(suggestCallMove(HAUSPIRE, id('Calling 3'), o)).toEqual({ kind: 'move', to: { id: id('Calling 4'), name: 'Calling 4' } });
    }
  });

  it('a missed call from the last step offers to close it — Junk or Lost — and keeps it by default', () => {
    for (const o of MISSED) {
      expect(suggestCallMove(HAUSPIRE, id('Calling 4'), o)).toEqual({
        kind: 'close',
        keep: { id: id('Calling 4'), name: 'Calling 4' },
        junk: { id: id('Junk'), name: 'Junk' },
        lost: { id: id('Lost'), name: 'Lost' },
      });
    }
  });

  it('with no Junk column the close is Lost only; with no lost column at all, nothing', () => {
    const noJunk = HAUSPIRE.filter((s) => s.name !== 'Junk');
    expect(suggestCallMove(noJunk, id('Calling 4'), 'no_answer')).toMatchObject({ kind: 'close', junk: null, lost: { name: 'Lost' } });
    const noLost = HAUSPIRE.filter((s) => s.kind !== 'LOST');
    expect(suggestCallMove(noLost, id('Calling 4'), 'no_answer')).toEqual({ kind: 'none' });
  });

  it('picked up and wrong number suggest nothing here (the Picked up sheet and the wrong-number question do)', () => {
    for (const stage of ['New', 'Calling 1', 'Calling 4']) {
      for (const o of [...PICKED, 'wrong_number', 'picked_up', 'met', 'site_visit', 'messaged']) expect(suggestCallMove(HAUSPIRE, id(stage), o)).toEqual({ kind: 'none' });
    }
  });

  it('never moves a lead out of an open column that is neither the intake nor a calling step', () => {
    for (const stage of ['Effective Lead', 'Quotation Shared', 'Visit Planned', 'Finalisation', 'Future Requirement']) {
      for (const o of MISSED) expect(suggestCallMove(HAUSPIRE, id(stage), o)).toEqual({ kind: 'none' });
    }
  });

  it('won, finished and lost leads get nothing', () => {
    for (const stage of ['Converted', 'Junk', 'Lost']) for (const o of MISSED) expect(suggestCallMove(HAUSPIRE, id(stage), o)).toEqual({ kind: 'none' });
    const done: CallStage[] = [...HAUSPIRE, { id: 'handed', name: 'Handed over', kind: 'DONE', sortOrder: 99, isCallStep: true }];
    expect(suggestCallMove(done, 'handed', 'no_answer')).toEqual({ kind: 'none' });
  });

  it('a studio with no calling steps gets nothing, even from the intake', () => {
    const plain = HAUSPIRE.map((s) => ({ ...s, isCallStep: false }));
    for (const o of MISSED) expect(suggestCallMove(plain, id('New'), o)).toEqual({ kind: 'none' });
  });

  it('an unknown column, no column or no outcome gets nothing', () => {
    expect(suggestCallMove(HAUSPIRE, 'nope', 'no_answer')).toEqual({ kind: 'none' });
    expect(suggestCallMove(HAUSPIRE, null, 'no_answer')).toEqual({ kind: 'none' });
    expect(suggestCallMove(HAUSPIRE, id('New'), null)).toEqual({ kind: 'none' });
    expect(suggestCallMove(HAUSPIRE, id('New'), undefined)).toEqual({ kind: 'none' });
  });

  it('a single calling step: from the intake to it, then straight to the close', () => {
    const one: CallStage[] = [
      { id: 'in', name: 'Enquiry', kind: 'OPEN', sortOrder: 0, isIntake: true },
      { id: 'c1', name: 'Rang once', kind: 'OPEN', sortOrder: 1, isCallStep: true },
      { id: 'q', name: 'Quoted', kind: 'OPEN', sortOrder: 2 },
      { id: 'l', name: 'Lost', kind: 'LOST', sortOrder: 3 },
    ];
    expect(suggestCallMove(one, 'in', 'voicemail')).toEqual({ kind: 'move', to: { id: 'c1', name: 'Rang once' } });
    expect(suggestCallMove(one, 'c1', 'voicemail')).toEqual({ kind: 'close', keep: { id: 'c1', name: 'Rang once' }, junk: null, lost: { id: 'l', name: 'Lost' } });
  });

  it('an intake that is (wrongly) marked a calling step still starts the steps', () => {
    const marked = HAUSPIRE.map((s) => (s.isIntake ? { ...s, isCallStep: true } : s));
    expect(suggestCallMove(marked, id('New'), 'no_answer')).toMatchObject({ kind: 'move', to: { name: 'Calling 1' } });
  });

  it('calling steps out of board order are walked in board order', () => {
    const gap: CallStage[] = [
      { id: 'n', name: 'New', kind: 'OPEN', sortOrder: 0, isIntake: true },
      { id: 'c2', name: 'Calling 2', kind: 'OPEN', sortOrder: 30, isCallStep: true },
      { id: 'e', name: 'Effective', kind: 'OPEN', sortOrder: 20 },
      { id: 'c1', name: 'Calling 1', kind: 'OPEN', sortOrder: 10, isCallStep: true },
      { id: 'l', name: 'Lost', kind: 'LOST', sortOrder: 40 },
    ];
    expect(suggestCallMove(gap, 'n', 'no_answer')).toMatchObject({ to: { id: 'c1' } });
    expect(suggestCallMove(gap, 'c1', 'no_answer')).toMatchObject({ to: { id: 'c2' } });
    expect(suggestCallMove(gap, 'c2', 'no_answer')).toMatchObject({ kind: 'close' });
  });
});

describe('the moves the server will accept with a call', () => {
  it('the suggested step, plus "Don\'t retry" into Lost — each lost one "stopped replying"', () => {
    expect(allowedCallMoves(HAUSPIRE, id('Calling 1'), 'no_answer')).toEqual([
      { id: id('Calling 2'), lostReason: null },
      { id: id('Lost'), lostReason: 'NO_RESPONSE' },
    ]);
  });

  it('after the last step: Junk and Lost, no duplicate', () => {
    expect(allowedCallMoves(HAUSPIRE, id('Calling 4'), 'switched_off')).toEqual([
      { id: id('Junk'), lostReason: 'NO_RESPONSE' },
      { id: id('Lost'), lostReason: 'NO_RESPONSE' },
    ]);
  });

  it('from any other open column, only "Don\'t retry"', () => {
    expect(allowedCallMoves(HAUSPIRE, id('Quotation Shared'), 'line_busy')).toEqual([{ id: id('Lost'), lostReason: 'NO_RESPONSE' }]);
  });

  it('nothing for a picked-up or wrong-number call, or a lead already closed', () => {
    for (const o of [...PICKED, 'wrong_number']) expect(allowedCallMoves(HAUSPIRE, id('Calling 1'), o)).toEqual([]);
    for (const stage of ['Converted', 'Junk', 'Lost']) expect(allowedCallMoves(HAUSPIRE, id(stage), 'no_answer')).toEqual([]);
    expect(allowedCallMoves(HAUSPIRE, 'nope', 'no_answer')).toEqual([]);
  });

  it('never a column the rule did not offer — a request to jump to Converted moves nothing', () => {
    for (const stage of HAUSPIRE) for (const o of MISSED) expect(allowedCallMoves(HAUSPIRE, stage.id, o).map((m) => m.id)).not.toContain(id('Converted'));
  });

  it('"Don\'t retry" is the main lost column, for a missed call on an open lead only', () => {
    expect(giveUpStage(HAUSPIRE, id('Calling 2'), 'voicemail')).toEqual({ id: id('Lost'), name: 'Lost' });
    expect(giveUpStage(HAUSPIRE, id('Effective Lead'), 'no_answer')).toEqual({ id: id('Lost'), name: 'Lost' });
    expect(giveUpStage(HAUSPIRE, id('Calling 2'), 'spoke')).toBeNull();
    expect(giveUpStage(HAUSPIRE, id('Lost'), 'no_answer')).toBeNull();
    expect(giveUpStage(HAUSPIRE.filter((s) => s.kind !== 'LOST'), id('Calling 2'), 'no_answer')).toBeNull();
  });
});

const ist = (day: string, hm: string) => new Date(Date.parse(`${day}T${hm}:00Z`) - 330 * 60_000);

describe('the retry picker', () => {
  /* 2026-10-21 is a Wednesday; 2026-10-24 a Saturday; 2026-10-25 a Sunday. */
  it('calls from 10 am to 8 pm', () => {
    expect(CALL_HOURS).toEqual({ start: '10:00', end: '20:00' });
  });

  it('tomorrow morning is the next working day at 10 am (Saturday → Monday)', () => {
    expect(tomorrowMorning(ist('2026-10-21', '11:00'))).toEqual(ist('2026-10-22', '10:00'));
    expect(tomorrowMorning(ist('2026-10-24', '11:00'))).toEqual(ist('2026-10-26', '10:00'));
    expect(tomorrowMorning(ist('2026-10-21', '23:50'))).toEqual(ist('2026-10-22', '10:00'));
  });

  it('later today is two hours on, inside calling hours', () => {
    expect(inTwoHoursClamped(ist('2026-10-21', '11:00'))).toEqual(ist('2026-10-21', '13:00'));
    expect(inTwoHoursClamped(ist('2026-10-21', '18:00'))).toEqual(ist('2026-10-21', '20:00'));
    expect(inTwoHoursClamped(ist('2026-10-21', '18:01'))).toEqual(ist('2026-10-22', '10:00'));
    expect(inTwoHoursClamped(ist('2026-10-21', '07:00'))).toEqual(ist('2026-10-21', '10:00'));
    expect(inTwoHoursClamped(ist('2026-10-21', '08:30'))).toEqual(ist('2026-10-21', '10:30'));
    expect(inTwoHoursClamped(ist('2026-10-21', '23:00'))).toEqual(ist('2026-10-22', '10:00'));
    expect(inTwoHoursClamped(ist('2026-10-25', '11:00'))).toEqual(ist('2026-10-26', '10:00'));
  });

  it('starts on the usual time for the outcome, so one tap still logs it', () => {
    const now = ist('2026-10-21', '11:00');
    const busy = retryChoices(followupDue('line_busy', now), now);
    // Busy is two hours from now: the same instant as Later today, so Later today is the default.
    expect(busy.preset).toBe('later');
    expect(busy.choices.map((c) => c.id)).toEqual(['later', 'morning', 'pick', 'none']);
    const off = retryChoices(followupDue('switched_off', now), now);
    // Switched off is tomorrow 3:30 pm: its own "As usual" choice, first and chosen.
    expect(off.preset).toBe('auto');
    expect(off.choices.map((c) => c.id)).toEqual(['auto', 'later', 'morning', 'pick', 'none']);
    expect(off.choices[0]!.at).toEqual(ist('2026-10-22', '15:30'));
  });

  it('late in the evening Later today is tomorrow morning: one choice, not two', () => {
    const now = ist('2026-10-21', '19:00');
    const r = retryChoices(ist('2026-10-22', '15:30'), now);
    expect(r.choices.map((c) => c.id)).toEqual(['auto', 'morning', 'pick', 'none']);
    const same = retryChoices(ist('2026-10-22', '10:00'), now);
    expect(same.preset).toBe('morning');
    expect(same.choices.map((c) => c.id)).toEqual(['morning', 'pick', 'none']);
  });

  it('with no usual time, tomorrow morning', () => {
    const now = ist('2026-10-21', '11:00');
    expect(retryChoices(null, now).preset).toBe('morning');
  });
});

describe('the Hauspire preset marks Calling 1–4', () => {
  it('Calling 1–4 are the calling steps; nothing else is', () => {
    expect(HAUSPIRE_PIPELINE.filter((p) => p.isCallStep).map((p) => p.name)).toEqual(['Calling 1', 'Calling 2', 'Calling 3', 'Calling 4']);
  });

  it('a fresh pipeline: the four are created marked', () => {
    const existing: ExistingStage[] = [
      { id: 'a', name: 'Enquiry', kind: 'OPEN', isIntake: true, sortOrder: 0 },
      { id: 'e', name: 'Lost', kind: 'LOST', isIntake: false, sortOrder: 4 },
      { id: 'c', name: 'Booked', kind: 'WON', isIntake: false, sortOrder: 2 },
    ];
    const plan = planPreset(existing);
    expect(plan.callSteps).toEqual(['new:Calling 1', 'new:Calling 2', 'new:Calling 3', 'new:Calling 4']);
    expect(plan.creates.filter((c) => c.isCallStep).map((c) => c.name)).toEqual(['Calling 1', 'Calling 2', 'Calling 3', 'Calling 4']);
    expect(plan.callStepMarks).toEqual([]);
  });

  it('your own Calling columns are marked, and the summary says so only when they were not', () => {
    const named: ExistingStage[] = HAUSPIRE_PIPELINE.map((p, i) => ({ id: `s${i}`, name: p.name, kind: p.kind, isIntake: !!p.isIntake, sortOrder: i, isCallStep: false }));
    const plan = planPreset(named);
    expect(plan.callSteps).toEqual(['s1', 's2', 's3', 's4']);
    expect(plan.callStepMarks).toEqual(['Calling 1', 'Calling 2', 'Calling 3', 'Calling 4']);
    expect(presetSummary(plan)).toMatch(/marks Calling 1, Calling 2, Calling 3, Calling 4 as calling steps/i);
    const already = planPreset(HAUSPIRE_PIPELINE.map((p, i) => ({ id: `s${i}`, name: p.name, kind: p.kind, isIntake: !!p.isIntake, sortOrder: i, isCallStep: !!p.isCallStep })));
    expect(already.callStepMarks).toEqual([]);
    expect(presetSummary(already)).not.toMatch(/calling steps/);
  });
});

describe('the migration flags existing calling columns', () => {
  const sql = readFileSync('prisma/migrations/20261021130000_call_steps/migration.sql', 'utf8');
  it('adds the column with default false and flags open "Calling <n>" columns', () => {
    expect(sql).toMatch(/ALTER TABLE "studio_stages" ADD COLUMN "isCallStep" BOOLEAN NOT NULL DEFAULT false;/);
    expect(sql).toMatch(/UPDATE "studio_stages" SET "isCallStep" = true WHERE "kind" = 'OPEN' AND "name" ~\* '\^calling\\s\*\\d\+\$';/);
    expect(sql).not.toMatch(/DROP|DELETE/i);
  });

  it('the pattern it uses matches the preset names and nothing else', () => {
    const re = /^calling\s*\d+$/i;
    expect(HAUSPIRE_PIPELINE.filter((p) => re.test(p.name)).map((p) => p.name)).toEqual(['Calling 1', 'Calling 2', 'Calling 3', 'Calling 4']);
    expect(['calling1', 'CALLING  12', 'Calling 3'].every((n) => re.test(n))).toBe(true);
    expect(['Calling back', 'Re-calling 1', 'Calling 1 later'].some((n) => re.test(n))).toBe(false);
  });
});

describe('Today: Log call on the calling lines only', () => {
  const NOW = new Date('2026-10-12T04:30:00Z');
  const base = { phone: '9876543210', assignedToName: 'Asha', stageKind: 'OPEN' as const, nextAction: null, meetingAt: null, meetingNote: null, hasFloorPlan: true, quoteCount: 1, isDemo: false, booked: false };
  it('calls due and leads nobody has called carry the lead for Log call; the pool never does', () => {
    const s = buildToday({
      leads: [
        { ...base, id: 'due', name: 'Due', assignedToId: 'm1', stageId: 'st-1', nextActionOn: NOW, lastContactedAt: NOW },
        { ...base, id: 'nc', name: 'Never', assignedToId: 'm1', stageId: 'st-0', nextActionOn: null, lastContactedAt: null },
        { ...base, id: 'pool', name: 'Pool', assignedToId: null, stageId: 'st-0', nextActionOn: null, lastContactedAt: null },
        { ...base, id: 'old', name: 'No column', assignedToId: 'm1', nextActionOn: NOW, lastContactedAt: NOW },
      ],
      quotes: [],
      bookings: [],
      now: NOW,
      seesAll: true,
    });
    const rows = (sid: string) => s.find((x) => x.id === sid)!.rows;
    expect(rows('calls').find((r) => r.leadId === 'due')!.call).toEqual({ leadId: 'due', name: 'Due', phone: '9876543210', stageId: 'st-1' });
    expect(rows('calls').find((r) => r.leadId === 'old')!.call).toBeUndefined();
    expect(rows('never-called').find((r) => r.leadId === 'nc')!.call).toMatchObject({ stageId: 'st-0' });
    expect(rows('pool').every((r) => r.call === undefined)).toBe(true);
  });
});
