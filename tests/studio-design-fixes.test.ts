import { describe, expect, it } from 'vitest';
import { shiftDesignStepDay, shiftStepDay } from '@/modules/project/step-rules';
import { applyRefusal, planStepMove } from '@/modules/studio-design/rules';
import { toCustomerDesign } from '@/modules/studio-design/customer-view';
import { MONEY_DOC } from '@/modules/project/locker-rules';
import { entriesShown } from '@/app/app/project/PaymentEntries';

/** Review fixes to Studio OS Phase 2 (12 Oct 2026). */

describe('design steps when the plan moves the design stage', () => {
  const before = { start: '2026-10-01', end: '2026-10-24' };

  it('stretching design to catch up with a late step does not move the steps again', () => {
    // Running late moved step 10 and the open ones after it 5 days, past the end (29 Oct).
    const steps = [{ id: 'a', plannedOn: '2026-10-15', done: false }, { id: 'b', plannedOn: '2026-10-24', done: false }];
    const late = planStepMove(steps, 'a', '2026-10-20');
    expect(late.ok && late.moves.map((m) => m.to)).toEqual(['2026-10-20', '2026-10-29']);
    // The PM then moves the design end to 29 Oct: nothing moves, nothing piles on the end.
    const after = { start: '2026-10-01', end: '2026-10-29' };
    expect(shiftDesignStepDay('2026-10-20', before, after)).toBe('2026-10-20');
    expect(shiftDesignStepDay('2026-10-29', before, after)).toBe('2026-10-29');
    // The execution rule would have shifted and clamped them (the bug).
    expect(shiftStepDay('2026-10-29', before, after)).toBe('2026-10-29');
    expect(shiftStepDay('2026-10-20', before, after)).toBe('2026-10-25');
  });

  it('moving the design start moves the open steps as one block, spacing kept and never clamped', () => {
    const after = { start: '2026-10-04', end: '2026-10-24' };
    expect(shiftDesignStepDay('2026-10-02', before, after)).toBe('2026-10-05');
    expect(shiftDesignStepDay('2026-10-23', before, after)).toBe('2026-10-26');
    expect(shiftDesignStepDay(null, before, after)).toBeNull();
  });
});

describe('Use our design steps', () => {
  it('only on the legacy single step with nothing ticked', () => {
    expect(applyRefusal([{ doneAt: null, responsible: null }])).toBeNull();
    expect(applyRefusal([{ doneAt: new Date(), responsible: null }])).toMatch(/ticked/);
    expect(applyRefusal([{ doneAt: null, responsible: 'DESIGNER' }, { doneAt: null, responsible: null }])).toMatch(/already/);
  });
});

describe('the customer design card dates', () => {
  it('reads a moment as its day in India; a design step carries no day at all (27 Oct 2026)', () => {
    const d = toCustomerDesign(
      {
        actualEnd: null,
        items: [{ label: 'Mood board shared', doneAt: new Date('2026-10-12T19:45:00Z'), plannedOn: new Date('2026-10-13T00:00:00Z'), weightBp: 100, inScope: true, customerMilestone: true }],
      },
      { designClosedAt: new Date('2026-10-20T20:00:00Z'), moodBoardSharedAt: new Date('2026-10-12T19:00:00Z') },
      [],
      null,
    )!;
    expect(d.steps[0]!.doneOn).toBeNull();
    expect(d.steps[0]!.plannedOn).toBeNull();
    expect(d.closedOn).toBe('2026-10-21');
    expect(d.moodBoard.sharedOn).toBe('2026-10-13');
  });
});

describe('the client’s design card with the new steps (DESIGN-PROCESS-PLAN.md Decision 11)', () => {
  const day = (d: string) => new Date(`${d}T00:00:00Z`);
  const item = (label: string, o: Record<string, unknown> = {}) => ({ label, doneAt: null, plannedOn: day('2026-10-20'), weightBp: 10, inScope: true, effortMin: 60, customerMilestone: false, ...o });
  const stages = [
    { index: 0, label: 'Booking advance', state: 'paid' as const },
    { index: 1, label: 'Design advance', state: 'due' as const },
  ];

  it('shows every step, starred or not, with no dates and no delay words', () => {
    const d = toCustomerDesign(
      { actualEnd: null, items: [item('2D layout', { doneAt: new Date('2026-10-12T10:00:00Z') }), item('2D approval', { responsible: 'CLIENT', effortMin: 0 }), item('First draft (3D)', { gatePayment: 1 }), item('Design changes')] },
      { designClosedAt: null, moodBoardSharedAt: null, stepDelays: [] },
      [],
      stages,
    )!;
    expect(d.steps.map((x) => x.label)).toEqual(['2D layout', '2D approval', 'First draft (3D)', 'Design changes']);
    expect(d.steps.every((x) => x.plannedOn === null && x.doneOn === null && x.moved === null)).toBe(true);
    // From the first draft on, the steps wait on the design advance.
    expect(d.steps.map((x) => x.waitingFor)).toEqual([null, null, 'Design advance', 'Design advance']);
    expect(d.yourStep).toBe('2D approval');
  });

  it('an older plan (no efforts) shows every step too, with no dates (owner, 27 Oct 2026)', () => {
    const d = toCustomerDesign({ actualEnd: null, items: [item('A', { effortMin: null, customerMilestone: true }), item('B', { effortMin: null })] }, { designClosedAt: null, moodBoardSharedAt: null }, [], null)!;
    expect(d.steps.map((x) => [x.label, x.plannedOn])).toEqual([['A', null], ['B', null]]);
  });
});

describe('money documents in the locker', () => {
  it('the signed quote, agreement, receipts and decision outcomes are money; drawings are not', () => {
    expect(MONEY_DOC({ kind: 'RECEIPT', contentType: 'application/pdf', storageKey: 'p/r.pdf' })).toBe(true);
    expect(MONEY_DOC({ kind: 'QUOTATION', contentType: 'x', storageKey: 'signed-quote:q1' })).toBe(true);
    expect(MONEY_DOC({ kind: 'AGREEMENT', contentType: 'x', storageKey: 'signed-quote:q1#agreement' })).toBe(true);
    expect(MONEY_DOC({ kind: 'DRAWINGS', contentType: 'application/pdf', storageKey: 'p/d.pdf' })).toBe(false);
    expect(MONEY_DOC({ kind: 'OTHER', contentType: 'image/jpeg', storageKey: 'p/s.jpg' })).toBe(false);
  });
});

describe('the website payments card', () => {
  const e = (id: string, status: 'confirmed' | 'waiting' | 'disputed' | 'earlier') => ({
    id,
    stageIndex: 0,
    stage: 'Booking advance',
    amountPaise: 2_500_000,
    receivedOn: '2026-10-12',
    mode: 'UPI' as const,
    status,
    receiptDocumentId: null,
    canAnswer: true,
  });
  it('shows what waits on the customer first, then the latest two confirmed', () => {
    const shown = entriesShown([e('c1', 'confirmed'), e('w1', 'waiting'), e('c2', 'confirmed'), e('c3', 'confirmed'), e('d1', 'disputed')]);
    expect(shown.map((x) => x.id)).toEqual(['w1', 'd1', 'c1', 'c2']);
  });
});
