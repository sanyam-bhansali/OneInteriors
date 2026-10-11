import { describe, expect, it } from 'vitest';
import {
  HAUSPIRE_TEMPLATE,
  checkStages,
  cleanStages,
  readStages,
  refundDaysOf,
  scheduleAmounts,
  templateOrDefault,
  type PaymentStage,
} from '@/modules/studio-sales/payment-template';
import { paymentSchedule } from '@/modules/portal/quote-to-plan';

/**
 * Studio OS Phase 1: the payment stages template (docs/studio-os/
 * PHASE-1-SALES.md §4). Hauspire's six, the checks, and the maths: the
 * booking advance first, the percentages of what is left, adding up to the
 * contract to the paisa — and still exactly the contract once the project's
 * `paymentSchedule` re-splits them at booking.
 */

const sum = (xs: { amountPaise: number }[]) => xs.reduce((n, x) => n + x.amountPaise, 0);

describe('Hauspire’s default', () => {
  it('is the booking advance then 5 / 10 / 40 / 40 / 5', () => {
    expect(HAUSPIRE_TEMPLATE.map((s) => s.label)).toEqual([
      'Booking advance',
      'Design advance',
      'Design closure',
      'Material procurement',
      'Material dispatch',
      'Project handover',
    ]);
    expect(HAUSPIRE_TEMPLATE[0]).toMatchObject({ kind: 'FIXED', amountPaise: 2_500_000, refundDays: 3 });
    expect(HAUSPIRE_TEMPLATE.slice(1).map((s) => s.pct)).toEqual([5, 10, 40, 40, 5]);
    expect(checkStages(HAUSPIRE_TEMPLATE)).toBeNull();
  });

  it('says what the client gets in every stage', () => {
    for (const s of HAUSPIRE_TEMPLATE) expect(s.note.length).toBeGreaterThan(10);
  });

  it('is what a studio with no template (or a broken one) reads', () => {
    expect(templateOrDefault(null)).toEqual(HAUSPIRE_TEMPLATE);
    expect(templateOrDefault([{ label: 'x', kind: 'PCT', pct: 50 }])).toEqual(HAUSPIRE_TEMPLATE);
    expect(refundDaysOf(templateOrDefault(undefined))).toBe(3);
  });
});

describe('the checks', () => {
  const pct = (label: string, p: number): PaymentStage => ({ label, note: '', kind: 'PCT', pct: p });

  it('wants the percentages to total exactly 100', () => {
    expect(checkStages([pct('A', 50), pct('B', 40)])).toMatch(/90%, not 100%/);
    expect(checkStages([pct('A', 12.5), pct('B', 87.5)])).toBeNull();
    expect(checkStages([pct('A', 33.33), pct('B', 33.33), pct('C', 33.34)])).toBeNull();
  });

  it('needs at least one percent stage, so the stages always reach the contract', () => {
    expect(checkStages([{ label: 'Fixed', note: '', kind: 'FIXED', amountPaise: 100 }])).toMatch(/percent/);
  });

  it('refuses a nameless stage, a bad amount, three decimals, a silly refund window', () => {
    expect(checkStages([pct('', 100)])).toMatch(/name/);
    expect(checkStages([{ label: 'Adv', note: '', kind: 'FIXED', amountPaise: 0 }, pct('B', 100)])).toMatch(/amount/);
    expect(checkStages([pct('A', 33.333), pct('B', 66.667)])).toMatch(/two decimals/);
    expect(checkStages([{ ...pct('A', 100), refundDays: 45 }])).toMatch(/0 to 30 days/);
    expect(checkStages([])).toMatch(/at least one/);
  });

  it('cleans and reads back the same stages', () => {
    const c = cleanStages([{ label: '  Booking ', note: ' x ', kind: 'FIXED', amountPaise: 2_500_000, pct: 9, refundDays: 3 }, pct('Rest', 100)]);
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.stages[0]).toEqual({ label: 'Booking', note: 'x', kind: 'FIXED', amountPaise: 2_500_000, refundDays: 3 });
    expect(readStages(JSON.parse(JSON.stringify(c.stages)))).toEqual(c.stages);
  });
});

describe('the maths: booking advance, then percentages of what is left', () => {
  it('splits a ₹10,00,000 contract as Hauspire would', () => {
    const r = scheduleAmounts(HAUSPIRE_TEMPLATE, 100_000_000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const rest = 100_000_000 - 2_500_000;
    expect(r.stages.map((s) => s.amountPaise)).toEqual([2_500_000, rest * 0.05, rest * 0.1, rest * 0.4, rest * 0.4, rest * 0.05]);
    expect(sum(r.stages)).toBe(100_000_000);
  });

  it('adds up to the contract exactly, whatever the figure', () => {
    for (const total of [2_500_001, 7_36_123_47, 99_99_999_99, 12_345_678, 2_600_000]) {
      const r = scheduleAmounts(HAUSPIRE_TEMPLATE, total);
      expect(r.ok, String(total)).toBe(true);
      if (r.ok) expect(sum(r.stages), String(total)).toBe(total);
    }
  });

  it('keeps the stages in their order, fixed ones wherever they are', () => {
    const stages: PaymentStage[] = [
      { label: 'Design', note: '', kind: 'PCT', pct: 50 },
      { label: 'Site visit fee', note: '', kind: 'FIXED', amountPaise: 500_000 },
      { label: 'Handover', note: '', kind: 'PCT', pct: 50 },
    ];
    const r = scheduleAmounts(stages, 10_500_000);
    expect(r.ok && r.stages.map((s) => s.amountPaise)).toEqual([5_000_000, 500_000, 5_000_000]);
  });

  it('refuses fixed amounts larger than the contract, and no contract at all', () => {
    expect(scheduleAmounts(HAUSPIRE_TEMPLATE, 2_000_000)).toEqual({ ok: false, error: 'The fixed amounts are more than the whole contract.' });
    expect(scheduleAmounts(HAUSPIRE_TEMPLATE, 0).ok).toBe(false);
  });

  it('a contract of exactly the advance leaves nothing for the rest, still exact', () => {
    const r = scheduleAmounts(HAUSPIRE_TEMPLATE, 2_500_000);
    expect(r.ok && sum(r.stages)).toBe(2_500_000);
  });

  it('survives the project’s paymentSchedule at booking unchanged, to the paisa', () => {
    for (const total of [100_000_000, 7_36_123_47, 12_345_679]) {
      const r = scheduleAmounts(HAUSPIRE_TEMPLATE, total);
      if (!r.ok) throw new Error(r.error);
      const plan = paymentSchedule(
        total,
        r.stages.map((s) => ({ label: s.label, pct: null, amountPaise: s.amountPaise })),
      );
      expect(plan.map((p) => p.amountPaise)).toEqual(r.stages.map((s) => s.amountPaise));
      expect(sum(plan)).toBe(total);
    }
  });
});
