import { describe, expect, it } from 'vitest';
import { changesSoFar, moneyView, paymentNeedsReminder, setMark } from '@/modules/portal/payments';

const stages = [
  { label: 'At signing', pct: 40, amountPaise: 400 },
  { label: 'When finishing starts', pct: 40, amountPaise: 400 },
  { label: 'At handover', pct: 20, amountPaise: 200 },
];

describe('payments, in rupees (trust fix 5)', () => {
  it('splits paid, next and later', () => {
    const m = moneyView(1000, stages, [{ index: 0, paidOn: '2026-10-01' }, { index: 1, dueOn: '2026-11-01' }])!;
    expect(m.paidPaise).toBe(400);
    expect(m.next?.label).toBe('When finishing starts');
    expect(m.next?.dueOn).toBe('2026-11-01');
    expect(m.laterPaise).toBe(200);
    expect(m.stages.map((s) => s.state)).toEqual(['paid', 'next', 'later']);
  });

  it('shows nothing for a project started before signing in the app', () => {
    expect(moneyView(null, stages, null)).toBeNull();
    expect(moneyView(1000, null, null)).toBeNull();
  });

  it('ignores marks it cannot read', () => {
    const m = moneyView(1000, stages, [{ index: 0, paidOn: 'yesterday' }, 'junk'])!;
    expect(m.paidPaise).toBe(0);
  });

  it('re-arms the reminder when the due date moves', () => {
    const marks = setMark([{ index: 1, dueOn: '2026-11-01', remindedAt: '2026-10-30T04:00:00Z' }], 1, { dueOn: '2026-11-08' });
    expect(marks[0]).toMatchObject({ dueOn: '2026-11-08', remindedAt: null });
  });

  it('reminds two days before, once, and never for a paid stage', () => {
    const now = new Date('2026-10-30T04:00:00Z');
    expect(paymentNeedsReminder({ index: 1, dueOn: '2026-11-01' }, now)).toBe(true);
    expect(paymentNeedsReminder({ index: 1, dueOn: '2026-11-10' }, now)).toBe(false);
    expect(paymentNeedsReminder({ index: 1, dueOn: '2026-11-01', remindedAt: 'x' }, now)).toBe(false);
    expect(paymentNeedsReminder({ index: 1, dueOn: '2026-11-01', paidOn: '2026-10-29' }, now)).toBe(false);
  });
});

describe('changes so far (trust fix 7)', () => {
  it('totals what the chosen options add, in the order chosen', () => {
    const opt = (name: string, extraPaise: number) => ({ name, note: '', extraPaise, swatch: null });
    const c = changesSoFar([
      { id: 'b', title: 'Handles', options: [opt('Steel', 0), opt('Brass', 620)], chosenIndex: 1, chosenAt: '2026-10-06' },
      { id: 'a', title: 'Shutters', options: [opt('Sage', 0), opt('Walnut', 1450)], chosenIndex: 0, chosenAt: '2026-10-03' },
      { id: 'c', title: 'Tiles', options: [opt('Matt', 0)], chosenIndex: null, chosenAt: null },
    ]);
    expect(c.totalPaise).toBe(620);
    expect(c.items.map((i) => i.title)).toEqual(['Shutters', 'Handles']);
  });
});
