import { describe, expect, it } from 'vitest';
import {
  chainLocks,
  checkAnswer,
  planRedateAfterPayment,
  checkDesignTick,
  checkMeasurements,
  checkVisit,
  designerLoad,
  designSteps,
  designWeights,
  drawingsOf,
  dueAndLate,
  formatLength,
  gateIndexFor,
  gateOf,
  lateDays,
  linkedDays,
  nextStep,
  parseLength,
  planStepMove,
  reminderText,
  sideOfReason,
  waitingDays,
  type DrawingDoc,
} from '@/modules/studio-design/rules';
import { DESIGN_SHARE_BP, HAUSPIRE_DESIGN } from '@/modules/studio-design/template';

/** Studio OS Phase 2 (docs/studio-os/PHASE-2-DESIGN.md): the design phase's rules. */

const HAUSPIRE_PAYMENTS = ['Booking advance', 'Design advance', 'Design closure', 'Material procurement', 'Material dispatch', 'Project handover'].map((label) => ({ label }));

describe('linked days', () => {
  it('are the previous step plus its gap, unscaled with no length', () => {
    expect(linkedDays([0, 1, 3, 2], '2026-10-01', null)).toEqual(['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-07']);
  });

  it('scale to the window so the last lands on its end, never going backwards', () => {
    const gaps = HAUSPIRE_DESIGN.map((s) => s.days);
    for (const length of [14, 24, 27, 29]) {
      const days = linkedDays(gaps, '2026-10-01', length);
      expect(days[0]).toBe('2026-10-01');
      expect(days.at(-1)).toBe(new Date(Date.UTC(2026, 9, 1 + length)).toISOString().slice(0, 10));
      expect(days).toEqual([...days].sort());
    }
  });

  it('put every step on the end when no step has a gap', () => {
    expect(linkedDays([0, 0], '2026-10-01', 5)).toEqual(['2026-10-06', '2026-10-06']);
  });
});

describe('building the design steps', () => {
  it('share the DESIGN stage’s 2% exactly, by effort; a client’s step weighs nothing', () => {
    const w = designWeights(HAUSPIRE_DESIGN.map((s) => s.effortMin));
    expect(w.reduce((a, b) => a + b, 0)).toBe(DESIGN_SHARE_BP);
    HAUSPIRE_DESIGN.forEach((s, i) => expect(w[i]! > 0, s.label).toBe(s.effortMin > 0));
    expect(designWeights([0, 0])).toEqual([DESIGN_SHARE_BP / 2, DESIGN_SHARE_BP / 2]);
    expect(designWeights([60, 0, 60])).toEqual([DESIGN_SHARE_BP / 2, 0, DESIGN_SHARE_BP / 2]);
  });

  it('match a gate to the payment stage by its name, or set none', () => {
    expect(gateIndexFor('design advance', HAUSPIRE_PAYMENTS)).toBe(1);
    expect(gateIndexFor('Design Closure', [{ label: 'Design closure 10%' }])).toBe(0);
    expect(gateIndexFor('design advance', [{ label: 'At signing' }])).toBeNull();
    expect(gateIndexFor(null, HAUSPIRE_PAYMENTS)).toBeNull();
  });

  it('carry who, file, gate, days, effort, approval and tasks into the plan, the days exact from the start', () => {
    const steps = designSteps(HAUSPIRE_DESIGN, '2026-10-01', HAUSPIRE_PAYMENTS);
    expect(steps).toHaveLength(26);
    expect(steps.find((s) => s.label === 'First draft (3D)')!.gatePayment).toBe(1);
    expect(steps.find((s) => s.label === 'Site visit with electrician & carpenter')).toMatchObject({ gatePayment: 2, responsible: 'DESIGNER' });
    expect(steps.find((s) => s.label === 'Working drawings final')).toMatchObject({ plannedOn: '2026-10-29', room: 'Design' });
    expect(steps.at(-1)).toMatchObject({ plannedOn: '2026-11-13', room: 'Pre-execution', responsible: 'PM' });
    expect(steps.find((s) => s.label === '2D approval')).toMatchObject({ approvalKind: 'LAYOUT_2D', effortMin: 0, weightBp: 0, plannedOn: '2026-10-03' });
    expect(steps[0]!.tasks).toEqual(['Send the requirement form with the mood board']);
    expect(steps.map((s) => s.sortOrder)).toEqual(steps.map((_, i) => i));
  });

  it('scale a 3 BHK’s days and effort by 20%', () => {
    const two = designSteps(HAUSPIRE_DESIGN, '2026-10-01', HAUSPIRE_PAYMENTS, 2);
    const three = designSteps(HAUSPIRE_DESIGN, '2026-10-01', HAUSPIRE_PAYMENTS, 3);
    const fd = (xs: typeof two) => xs.find((s) => s.label === 'First draft (3D)')!;
    expect(fd(two)).toMatchObject({ gapDays: 4, effortMin: 960 });
    expect(fd(three)).toMatchObject({ gapDays: 5, effortMin: 1152 });
    expect(three.at(-1)!.plannedOn > two.at(-1)!.plannedOn).toBe(true);
  });
});

describe('payment gates', () => {
  const stages = [
    { index: 0, label: 'Booking advance', state: 'paid' as const },
    { index: 1, label: 'Design advance', state: 'due' as const },
    { index: 2, label: 'Design closure', state: 'waiting' as const },
  ];

  it('lock a step until its payment is recorded; recorded and waiting for the customer counts', () => {
    expect(gateOf(1, stages)).toEqual({ open: false, payment: 'Design advance' });
    expect(gateOf(2, stages)).toEqual({ open: true });
    expect(gateOf(0, stages)).toEqual({ open: true });
  });

  it('are open with no gate, no payment stages, or a stage the project does not have', () => {
    expect(gateOf(null, stages)).toEqual({ open: true });
    expect(gateOf(1, null)).toEqual({ open: true });
    expect(gateOf(9, stages)).toEqual({ open: true });
  });
});

describe('steps waiting on a payment (DESIGN-PROCESS-PLAN.md Decision 5)', () => {
  const stages = [
    { index: 0, label: 'Booking advance', state: 'paid' as const },
    { index: 1, label: 'Design advance', state: 'due' as const },
    { index: 2, label: 'Design closure', state: 'later' as const },
  ];
  const st = (gatePayment: number | null, done = false) => ({ gatePayment, done });

  it('the first unpaid gate and every open step after it wait on that payment; done steps never wait', () => {
    expect(chainLocks([st(null, true), st(null), st(1), st(null), st(2), st(null)], stages)).toEqual([null, null, 'Design advance', 'Design advance', 'Design advance', 'Design advance']);
  });

  it('once the design advance is recorded, the steps wait only on the design closure', () => {
    const paid = stages.map((x) => (x.index === 1 ? { ...x, state: 'paid' as const } : x));
    expect(chainLocks([st(1), st(null), st(2), st(null)], paid)).toEqual([null, null, 'Design closure', 'Design closure']);
  });

  it('a step out of scope never waits, and nothing waits without payment stages', () => {
    expect(chainLocks([{ gatePayment: 1, done: false, inScope: false }, st(null)], stages)).toEqual([null, null]);
    expect(chainLocks([st(1), st(null)], null)).toEqual([null, null]);
  });

  it('are neither due nor late', () => {
    expect(dueAndLate([{ plannedOn: '2026-10-01', done: false, inScope: true, lockedBy: 'Design advance' }, { plannedOn: '2026-10-01', done: false, inScope: true }], '2026-10-05')).toEqual({ due: 0, late: 1 });
  });
});

describe('dates after a payment (DESIGN-PROCESS-PLAN.md Decision 5)', () => {
  const paid = [
    { index: 0, label: 'Booking advance', state: 'paid' as const },
    { index: 1, label: 'Design advance', state: 'paid' as const },
    { index: 2, label: 'Design closure', state: 'later' as const },
  ];
  const steps = [
    { id: 'fin2d', plannedOn: '2026-10-03', done: true, inScope: true, gatePayment: null, gapDays: 0 },
    { id: 'fd', plannedOn: '2026-10-07', done: false, inScope: true, gatePayment: 1, gapDays: 4 },
    { id: 'chg', plannedOn: '2026-10-08', done: false, inScope: true, gatePayment: null, gapDays: 1 },
    { id: 'wd', plannedOn: '2026-10-20', done: false, inScope: true, gatePayment: 2, gapDays: 3 },
  ];

  it('a late payment moves the step it opens, and every open step after, to count from the payment', () => {
    expect(planRedateAfterPayment(steps, paid, '2026-10-12')).toEqual({
      stepId: 'fd',
      days: 9,
      moves: [
        { id: 'fd', from: '2026-10-07', to: '2026-10-16' },
        { id: 'chg', from: '2026-10-08', to: '2026-10-17' },
        { id: 'wd', from: '2026-10-20', to: '2026-10-29' },
      ],
    });
  });

  it('an early payment leaves the plan, and a second run moves nothing', () => {
    expect(planRedateAfterPayment(steps, paid, '2026-10-01')).toBeNull();
    const moved = steps.map((x) => (x.id === 'fd' ? { ...x, plannedOn: '2026-10-16' } : x));
    expect(planRedateAfterPayment(moved, paid, '2026-10-12')).toBeNull();
  });

  it('nothing moves while the payment is still not recorded', () => {
    const due = paid.map((x) => (x.index === 1 ? { ...x, state: 'due' as const } : x));
    expect(planRedateAfterPayment(steps, due, '2026-10-12')).toBeNull();
  });
});

describe('ticking a design step', () => {
  const step = { done: false, inScope: true, needsDocument: false, label: 'First draft (FD) meeting' };

  it('is refused while its payment is not recorded, saying which', () => {
    expect(checkDesignTick(step, { open: false, payment: 'Design advance' }, false)).toEqual({
      ok: false,
      error: 'First draft (FD) meeting opens when the Design advance is recorded. Ask accounts to record it.',
    });
  });

  it('needs the file when the step requires one', () => {
    const boq = { ...step, label: 'BOQ', needsDocument: true };
    expect(checkDesignTick(boq, { open: true }, false)).toEqual({ ok: false, error: 'BOQ needs its file. Attach it, then tick.' });
    expect(checkDesignTick(boq, { open: true }, true)).toEqual({ ok: true });
  });

  it('is refused when already ticked or not in scope, and takes an optional sentence', () => {
    expect(checkDesignTick({ ...step, done: true }, { open: true }, false)).toMatchObject({ ok: false });
    expect(checkDesignTick({ ...step, inScope: false }, { open: true }, false)).toMatchObject({ ok: false });
    expect(checkDesignTick(step, { open: true }, false, 'Met at site, client liked option B')).toEqual({ ok: true });
    expect(checkDesignTick(step, { open: true }, false, 'x'.repeat(501))).toMatchObject({ ok: false });
  });

  it('the next step is the first open one in scope', () => {
    expect(nextStep([{ done: true, inScope: true }, { done: false, inScope: false }, { done: false, inScope: true }])).toEqual({ done: false, inScope: true });
    expect(nextStep([{ done: true, inScope: true }])).toBeNull();
  });
});

describe('a late design step', () => {
  const steps = [
    { id: 'a', plannedOn: '2026-10-01', done: true },
    { id: 'b', plannedOn: '2026-10-03', done: false },
    { id: 'c', plannedOn: '2026-10-05', done: true },
    { id: 'd', plannedOn: '2026-10-08', done: false },
  ];

  it('moves with every open step after it by the same days; done steps stay', () => {
    expect(planStepMove(steps, 'b', '2026-10-06')).toEqual({
      ok: true,
      days: 3,
      moves: [
        { id: 'b', from: '2026-10-03', to: '2026-10-06' },
        { id: 'd', from: '2026-10-08', to: '2026-10-11' },
      ],
    });
  });

  it('is refused for a ticked step, the same day or not a day', () => {
    expect(planStepMove(steps, 'a', '2026-10-09')).toMatchObject({ ok: false });
    expect(planStepMove(steps, 'b', '2026-10-03')).toMatchObject({ ok: false });
    expect(planStepMove(steps, 'b', 'soon')).toMatchObject({ ok: false });
    expect(planStepMove(steps, 'zz', '2026-10-09')).toMatchObject({ ok: false });
  });

  it('says whose side the reason is on, and how late an open step is', () => {
    expect(sideOfReason('POSSESSION_LATE')).toBe('CLIENT');
    expect(sideOfReason('DESIGNER_LEAVE')).toBe('STUDIO');
    expect(lateDays({ plannedOn: '2026-10-03', done: false }, '2026-10-07')).toBe(4);
    expect(lateDays({ plannedOn: '2026-10-03', done: true }, '2026-10-07')).toBe(0);
    expect(dueAndLate([{ plannedOn: '2026-10-03', done: false, inScope: true }, { plannedOn: '2026-10-09', done: false, inScope: true }, { plannedOn: '2026-10-30', done: false, inScope: true }], '2026-10-07')).toEqual({ due: 1, late: 1 });
  });
});

describe('drawings and the client’s answers', () => {
  const D = (s: string) => new Date(s);
  const doc = (id: string, more: Partial<DrawingDoc> = {}): DrawingDoc => ({
    id,
    title: '2D layout, Living',
    designKind: 'LAYOUT_2D',
    room: 'Living',
    version: 1,
    supersedesId: null,
    sharedAt: D('2026-10-04T00:00:00Z'),
    deletedAt: null,
    createdAt: D('2026-10-04T00:00:00Z'),
    ...more,
  });

  it('show each drawing once, at its newest version, with the revision count and what was asked for', () => {
    const docs = [doc('r1'), doc('r2', { version: 2, supersedesId: 'r1', sharedAt: D('2026-10-06T00:00:00Z') })];
    const answers = [{ documentId: 'r1', verdict: 'CHANGES' as const, comment: 'Move the TV wall', at: D('2026-10-05T00:00:00Z') }];
    const [d] = drawingsOf(docs, answers);
    expect(d).toMatchObject({ id: 'r2', version: 2, revisions: 1, state: 'waiting', askedFor: 'Move the TV wall', answer: null });
    expect(waitingDays(d!, D('2026-10-10T00:00:00Z'))).toBe(4);
  });

  it('read the latest answer; a draft is a draft; a working drawing is just shared', () => {
    const answers = [
      { documentId: 'a', verdict: 'CHANGES' as const, comment: 'Darker', at: D('2026-10-05T00:00:00Z') },
      { documentId: 'a', verdict: 'APPROVED' as const, comment: null, at: D('2026-10-06T00:00:00Z') },
    ];
    const out = drawingsOf([doc('a'), doc('b', { sharedAt: null, room: 'Kitchen' }), doc('c', { designKind: 'WORKING', room: 'Bedroom' }), doc('x', { designKind: null })], answers);
    expect(out.map((d) => [d.id, d.state])).toEqual([
      ['c', 'shared'],
      ['b', 'draft'],
      ['a', 'approved'],
    ]);
  });

  it('may be answered only on the newest shared version asking approval, with words when asking for changes', () => {
    const shared = { id: 'a', designKind: 'RENDER_3D', sharedAt: D('2026-10-04T00:00:00Z'), deletedAt: null };
    expect(checkAnswer(shared, false, 'APPROVED', '')).toEqual({ ok: true, verdict: 'APPROVED', comment: null });
    expect(checkAnswer(shared, false, 'CHANGES', ' ')).toEqual({ ok: false, error: 'Say what you would like changed.' });
    expect(checkAnswer(shared, false, 'CHANGES', 'Warmer lights')).toEqual({ ok: true, verdict: 'CHANGES', comment: 'Warmer lights' });
    expect(checkAnswer(shared, true, 'APPROVED', '')).toMatchObject({ ok: false });
    expect(checkAnswer({ ...shared, sharedAt: null }, false, 'APPROVED', '')).toMatchObject({ ok: false });
    expect(checkAnswer({ ...shared, designKind: 'WORKING' }, false, 'APPROVED', '')).toMatchObject({ ok: false });
    expect(checkAnswer(shared, false, 'MAYBE', '')).toMatchObject({ ok: false });
  });

  it('give the designer a reminder line for their own WhatsApp; we send nothing', () => {
    expect(reminderText('Asha', { title: '3D render', room: 'Kitchen' }, 'Hauspire')).toBe(
      'Hi Asha, a gentle reminder: the 3D render for the Kitchen is waiting for your approval in the One Interiors app. Tell us if you would like any changes. — Hauspire',
    );
  });
});

describe('site visits and measurements', () => {
  it('book a visit with a day, a time and what it is for', () => {
    expect(checkVisit({ day: '2026-10-14', time: '11:00', purpose: ' Measurement ' }, '2026-10-12')).toEqual({ ok: true, day: '2026-10-14', time: '11:00', purpose: 'Measurement' });
    expect(checkVisit({ day: '2026-10-14', time: '25:00', purpose: 'x y' }, '2026-10-12')).toMatchObject({ ok: false });
    expect(checkVisit({ day: '2026-02-30', time: '11:00', purpose: 'Visit' }, '2026-10-12')).toMatchObject({ ok: false });
    expect(checkVisit({ day: '2026-10-14', time: '11:00', purpose: '' }, '2026-10-12')).toMatchObject({ ok: false });
  });

  it('read lengths the way site people type them, and say them back in feet and inches', () => {
    expect(parseLength('10.5')).toBe(3200);
    expect(parseLength("10'6")).toBe(3200);
    expect(parseLength('10\' 6"')).toBe(3200);
    expect(parseLength('10 ft 6 in')).toBe(3200);
    expect(parseLength('3200mm')).toBe(3200);
    expect(parseLength('3.2m')).toBe(3200);
    expect(parseLength('')).toBeNull();
    expect(Number.isNaN(parseLength('ten'))).toBe(true);
    expect(Number.isNaN(parseLength("10'13"))).toBe(true);
    expect(formatLength(3200)).toBe('10\' 6"');
    expect(formatLength(3658)).toBe("12'");
    expect(formatLength(null)).toBe('—');
  });

  it('keep a per-room list, skipping empty rows and saying which row is wrong', () => {
    expect(checkMeasurements([{ room: 'Living', length: '15', width: '12', height: '' }, { room: '', length: '', width: '', height: '' }])).toEqual({
      ok: true,
      rows: [{ room: 'Living', lengthMm: 4572, widthMm: 3658, heightMm: null, note: null }],
    });
    expect(checkMeasurements([{ room: 'Living', length: 'big', width: '', height: '' }])).toEqual({ ok: false, error: 'Row 1: type sizes in feet, like 10.5 or 10\'6".' });
    expect(checkMeasurements([{ room: '', length: '10', width: '', height: '' }])).toEqual({ ok: false, error: 'Name the room on row 1.' });
  });
});

describe('a designer’s load', () => {
  it('is the designer-days still needed against a 25-day month', () => {
    expect(designerLoad([{ bhk: 2, designPct: 0 }, { bhk: 3, designPct: 50 }, { bhk: null, designPct: 100 }])).toEqual({ open: 3, loadDays: 34, capacityDays: 25, pct: 136 });
    expect(designerLoad([])).toEqual({ open: 0, loadDays: 0, capacityDays: 25, pct: 0 });
  });
});
