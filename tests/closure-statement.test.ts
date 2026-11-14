import { describe, expect, it } from 'vitest';
import { ledger, type LedgerRowInput } from '@/modules/project/payment-ledger';
import { closureStepPlacement, dueAtClosure } from '@/modules/project/closure-due';
import { buildStatement, isElectrical, moneyDue } from '@/modules/project/statement-rules';
import { isProjectClosureStep, PROJECT_CLOSURE_STEP, STEP_TEMPLATE, templateFor } from '@/modules/project/step-template';
import { stepsFor } from '@/modules/portal/quote-to-plan';
import { projectSources, type Me, type ProjectFacts } from '@/modules/studio/my-work-rules';
import { mayOpen } from '@/modules/studio/surfaces';

/** Project closure and the statement (owner, 13 Nov 2026). */

const row = (id: string, stageIndex: number, amountPaise: number, o: Partial<LedgerRowInput> = {}): LedgerRowInput => ({
  id,
  stageIndex,
  amountPaise,
  receivedOn: '2026-11-01',
  mode: 'UPI',
  receiptDocumentId: null,
  correctsId: null,
  recordedAt: `2026-11-01T10:00:0${id.length}Z`,
  customerConfirmedAt: '2026-11-02T10:00:00Z',
  disputedAt: null,
  backfilled: false,
  ...o,
});

// 10 lakh signed: 50 / 45 / 5 (the 5% at handover); an approved extra of 20,000 lands on the last stage.
const stages = [
  { label: 'At booking', pct: 50, amountPaise: 50_000_000 },
  { label: 'Carcass', pct: 45, amountPaise: 45_000_000 },
  { label: 'Handover', pct: 5, amountPaise: 5_000_000 },
];
const changes = [{ deltaPaise: 2_000_000, stageIndex: null }];

describe('the project closure step', () => {
  it('is the last carpentry step, after the shutters, and the template still weighs 100%', () => {
    const carpentry = templateFor('CARPENTRY');
    expect(carpentry[carpentry.length - 1]!.label).toBe(PROJECT_CLOSURE_STEP);
    const labels = carpentry.map((s) => s.label);
    expect(labels.indexOf(PROJECT_CLOSURE_STEP)).toBeGreaterThan(labels.indexOf('Shutters delivered'));
    expect(STEP_TEMPLATE.reduce((a, s) => a + s.weightBp, 0)).toBe(10_000);
    expect(carpentry.reduce((a, s) => a + s.weightBp, 0)).toBe(4_700);
    expect(isProjectClosureStep(' project closure ')).toBe(true);
    expect(isProjectClosureStep('Provisional handover')).toBe(false);
  });

  it('is in every new plan, inside the carpentry window', () => {
    const items = stepsFor('CARPENTRY', new Date('2026-12-01T00:00:00Z'), new Date('2027-01-30T00:00:00Z'));
    const closure = items.find((i) => i.label === PROJECT_CLOSURE_STEP)!;
    expect(closure).toBeTruthy();
    expect(closure.plannedOn!.toISOString().slice(0, 10)).toBe('2027-01-30');
    expect(closure.weightBp).toBe(100);
  });

  it('is placed after the last step of a running plan', () => {
    const at = closureStepPlacement(
      [
        { room: 'Execution stage 2B', sortOrder: 21, plannedOn: new Date('2026-11-20T00:00:00Z') },
        { room: 'Execution stage 2A', sortOrder: 3, plannedOn: null },
      ],
      new Date('2026-11-25T00:00:00Z'),
    );
    expect(at).toEqual({ group: 'Execution stage 2B', sortOrder: 22, plannedOn: new Date('2026-11-20T00:00:00Z') });
    expect(closureStepPlacement([], new Date('2026-11-25T00:00:00Z')).sortOrder).toBe(0);
  });

  it('shows in the designer’s tasks with what it is for', () => {
    const me: Me = { role: 'DESIGNER', memberId: 'd1', recordsPayments: false };
    const p: ProjectFacts = {
      id: 'p1',
      place: 'Mehta · Primrose',
      client: 'Mehta',
      designerId: 'd1',
      phase: 'EXECUTION',
      provisionalOn: null,
      designSteps: [],
      execSteps: [{ id: 's1', label: PROJECT_CLOSURE_STEP, plannedOn: '2026-11-20', stage: 'Carpentry' }],
      decisions: [],
      snags: [],
      payments: [],
      site: null,
    };
    const items = projectSources(p, me, '2026-11-13');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'step', title: PROJECT_CLOSURE_STEP });
    expect(items[0]!.detail).toContain('handover payment');
  });

  it('ticking it shows what is still due, the handover payment last', () => {
    const l = ledger(stages, changes, [row('a', 0, 50_000_000), row('b', 1, 40_000_000), row('c', 1, 5_000_000, { customerConfirmedAt: null })]);
    const due = dueAtClosure(l, [{ number: 'CO-1', title: 'Extra painting', openPaise: 2_000_000 }])!;
    expect(due.stages).toEqual([
      { label: 'Carcass', openPaise: 0, waitingPaise: 5_000_000, last: false },
      { label: 'Handover', openPaise: 7_000_000, waitingPaise: 0, last: true },
    ]);
    expect(due.openPaise).toBe(7_000_000);
    expect(due.waitingPaise).toBe(5_000_000);
    expect(due.extras).toHaveLength(1);
    expect(dueAtClosure(null)).toBeNull();
  });
});

describe('the statement', () => {
  const l = ledger(stages, [...changes, { deltaPaise: 300_000, stageIndex: null }, { deltaPaise: 150_000, stageIndex: null }], [
    row('a', 0, 50_000_000),
    row('b', 1, 45_000_000),
    row('xp', 2, 1_000_000, { customerConfirmedAt: null }),
  ]);
  const s = buildStatement({
    quoteNumber: '101-D',
    ledger: l,
    orders: [
      { id: 'o1', number: 'CO-1', title: 'Extra painting', status: 'APPROVED', totalPaise: 2_000_000, lines: [{ room: 'Hall', product: 'Painting', amountPaise: 2_000_000 }] },
      { id: 'o2', number: '101-A1', title: 'Extra electrical points', status: 'PAID', totalPaise: 300_000, lines: [] },
      { id: 'o3', number: 'CO-3', title: 'Extra plank', status: 'SENT_TO_CLIENT', totalPaise: 90_000, lines: [] },
    ],
    changes: [
      { label: 'Extra painting', deltaPaise: 2_000_000, changeOrderId: 'o1' },
      { label: 'Extra electrical points', deltaPaise: 300_000, changeOrderId: 'o2' },
      { label: 'Shutter finish: Gloss', deltaPaise: 150_000, changeOrderId: null },
    ],
    payments: [
      { changeOrderId: null, amountPaise: 50_000_000, status: 'confirmed' },
      { changeOrderId: 'o1', amountPaise: 1_000_000, status: 'waiting' },
    ],
  });

  it('goes quotation, electrical, additional items, other changes, then the ledger’s total, paid and remaining', () => {
    expect(s.quotation.number).toBe('101-D');
    expect(s.quotation.signedPaise).toBe(100_000_000);
    expect(s.quotation.stages.map((x) => x.owedPaise)).toEqual([50_000_000, 45_000_000, 7_450_000]);
    expect(s.electrical.map((o) => o.number)).toEqual(['101-A1']);
    expect(s.additional.map((o) => o.number)).toEqual(['CO-1']);
    expect(s.additional[0]).toMatchObject({ amountPaise: 2_000_000, paidPaise: 0, waitingPaise: 1_000_000, remainingPaise: 2_000_000, paidLabel: 'Part paid' });
    expect(s.pending.map((o) => o.number)).toEqual(['CO-3']);
    expect(s.otherChanges).toEqual([{ label: 'Shutter finish: Gloss', deltaPaise: 150_000 }]);
    // The Payments tab's figures, exactly.
    expect(s.totals).toEqual({ totalPaise: l.totalPaise, paidPaise: l.paidPaise, waitingPaise: l.waitingPaise, remainingPaise: l.balancePaise });
    expect(s.totals.totalPaise).toBe(102_450_000);
    expect(s.totals.remainingPaise).toBe(7_450_000);
    // The stages' remaining add up to the remaining.
    expect(s.quotation.stages.reduce((n, x) => n + x.remainingPaise, 0)).toBe(s.totals.remainingPaise);
  });

  it('reads electrical work by its title', () => {
    expect(['Extra electrical points', 'Wiring for the study', '3 extra points', 'Switch board change'].every(isElectrical)).toBe(true);
    expect(['Extra plank', 'Extra painting', 'Loft shutters'].some(isElectrical)).toBe(false);
  });
});

describe('money due', () => {
  it('lists who owes how much, the most first, with the sums', () => {
    const a = ledger(stages, [], [row('a', 0, 50_000_000)]);
    const b = ledger(stages, [], [row('a', 0, 50_000_000), row('b', 1, 45_000_000)]);
    const out = moneyDue([
      { id: 'b', label: 'B', customer: 'Bhat', ledger: b },
      { id: 'x', label: 'X', customer: 'No plan', ledger: null },
      { id: 'a', label: 'A', customer: 'Apte', ledger: a },
    ]);
    expect(out.rows.map((r) => [r.customer, r.remainingPaise, r.nextStage])).toEqual([
      ['Apte', 50_000_000, 'Carcass'],
      ['Bhat', 5_000_000, 'Handover'],
    ]);
    expect(out.totals).toEqual({ totalPaise: 200_000_000, paidPaise: 145_000_000, waitingPaise: 0, remainingPaise: 55_000_000 });
  });
});

describe('who opens the statement and money due', () => {
  const m = (role: 'OWNER' | 'ACCOUNTS' | 'DESIGNER' | 'SUPERVISOR', designHead = false) => ({ role, status: 'ACTIVE' as const, designHead });
  it('the statement: owner, accounts, designer; money due: owner, accounts, the design head', () => {
    expect(mayOpen(m('OWNER'), '/studio/projects/p1/statement')).toBe(true);
    expect(mayOpen(m('ACCOUNTS'), '/studio/projects/p1/statement')).toBe(true);
    expect(mayOpen(m('DESIGNER'), '/studio/projects/p1/statement')).toBe(true);
    expect(mayOpen(m('SUPERVISOR'), '/studio/projects/p1/statement')).toBe(false);
    expect(mayOpen(m('ACCOUNTS'), '/studio/payments/due')).toBe(true);
    expect(mayOpen(m('DESIGNER', true), '/studio/payments/due')).toBe(true);
    expect(mayOpen(m('DESIGNER'), '/studio/payments/due')).toBe(false);
  });
});
