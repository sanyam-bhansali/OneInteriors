import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  checkClosureLines,
  closureTotals,
  closuresRemaining,
  effectivePhase,
  movePhase,
  PHASES,
  PROVISIONAL_HANDOVER,
  provisionalStepOf,
  readWarrantyMonths,
  remainingLine,
  warrantyEnd,
  type Phase,
} from '@/modules/project/lifecycle-rules';
import { STEP_TEMPLATE, templateFor } from '@/modules/project/step-template';

describe('the lifecycle moves', () => {
  it('goes design → execution → closure → snags → warranty, one event each', () => {
    let phase: Phase = 'DESIGN';
    const steps = [
      { kind: 'design.signed_off' },
      { kind: 'handover.provisional' },
      { kind: 'closure.fixed' },
      { kind: 'handover.signed', openSnags: 0 },
    ] as const;
    const seen: Phase[] = [phase];
    for (const e of steps) {
      const m = movePhase(phase, e);
      expect(m.ok && m.changed).toBe(true);
      if (m.ok) phase = m.phase;
      seen.push(phase);
    }
    expect(seen).toEqual(['DESIGN', 'EXECUTION', 'CLOSURE', 'SNAGS', 'WARRANTY']);
  });

  it('never moves backwards on a repeated or late event', () => {
    for (const p of ['EXECUTION', 'CLOSURE', 'SNAGS', 'WARRANTY', 'CLOSED'] as const) {
      expect(movePhase(p, { kind: 'design.signed_off' })).toEqual({ ok: true, phase: p, changed: false });
    }
    for (const p of ['SNAGS', 'WARRANTY', 'CLOSED'] as const) {
      expect(movePhase(p, { kind: 'handover.provisional' })).toEqual({ ok: true, phase: p, changed: false });
      expect(movePhase(p, { kind: 'handover.provisional_undone' })).toEqual({ ok: true, phase: p, changed: false });
    }
  });

  it('lets an older project still reading DESIGN reach closure at handover', () => {
    expect(movePhase('DESIGN', { kind: 'handover.provisional' })).toEqual({ ok: true, phase: 'CLOSURE', changed: true });
  });

  it('reopens execution when the provisional handover is unticked before the closure is fixed', () => {
    expect(movePhase('CLOSURE', { kind: 'handover.provisional_undone' })).toEqual({ ok: true, phase: 'EXECUTION', changed: true });
  });

  it('refuses to fix a closure outside the closure phase', () => {
    for (const p of PHASES.filter((x) => x !== 'CLOSURE')) expect(movePhase(p, { kind: 'closure.fixed' }).ok).toBe(false);
  });

  it('refuses the client sign-off while a snag is open, or before snags', () => {
    const open = movePhase('SNAGS', { kind: 'handover.signed', openSnags: 2 });
    expect(open.ok).toBe(false);
    expect(!open.ok && open.error).toMatch(/2 snags are still open/);
    expect(movePhase('CLOSURE', { kind: 'handover.signed', openSnags: 0 }).ok).toBe(false);
  });

  it('reads a warranty past its end as closed', () => {
    const now = new Date('2027-10-13T06:00:00Z');
    expect(effectivePhase('WARRANTY', '2027-10-12', now)).toBe('CLOSED');
    expect(effectivePhase('WARRANTY', '2027-10-13', now)).toBe('WARRANTY');
    expect(effectivePhase('SNAGS', '2020-01-01', now)).toBe('SNAGS');
  });
});

describe('the warranty', () => {
  it('runs the studio’s months from the sign-off day', () => {
    expect(warrantyEnd('2026-10-13', 12)).toBe('2027-10-12');
    expect(warrantyEnd('2026-01-31', 1)).toBe('2026-02-27');
    expect(warrantyEnd('2026-10-13', 0)).toBe('2026-10-13');
  });

  it('repairs a bad setting to 12 months', () => {
    expect(readWarrantyMonths(18)).toBe(18);
    expect(readWarrantyMonths('6')).toBe(6);
    for (const bad of [-1, 1.5, 'x', null, undefined, 500]) expect(readWarrantyMonths(bad)).toBe(12);
  });
});

describe('the provisional handover step', () => {
  it('is the last step of the template, with the old Handover weight', () => {
    const last = STEP_TEMPLATE.at(-1)!;
    expect(last.kind).toBe('HANDOVER');
    expect(last.label).toBe(PROVISIONAL_HANDOVER);
    expect(last.weightBp).toBe(200);
    expect(STEP_TEMPLATE.reduce((a, s) => a + s.weightBp, 0)).toBe(10_000);
  });

  it('is found by name, else as the stage’s last in-scope step', () => {
    const items = templateFor('HANDOVER').map((s, i) => ({ id: `i${i}`, label: s.label, inScope: true, sortOrder: i, doneAt: null }));
    expect(provisionalStepOf(items)?.label).toBe(PROVISIONAL_HANDOVER);
    const renamed = items.map((it) => (it.label === PROVISIONAL_HANDOVER ? { ...it, label: 'Keys handed over' } : it));
    expect(provisionalStepOf(renamed)?.label).toBe('Keys handed over');
    const outOfScope = renamed.map((it) => (it.label === 'Keys handed over' ? { ...it, inScope: false } : it));
    expect(provisionalStepOf(outOfScope)?.label).toBe('Final snags closed');
    expect(provisionalStepOf([])).toBeNull();
  });

  it('is renamed in the migration without touching weights', () => {
    const sql = readFileSync(join(__dirname, '..', 'prisma/migrations/20261013120000_project_lifecycle/migration.sql'), 'utf8');
    expect(sql).toContain(`SET "label" = 'Provisional handover'`);
    expect(sql.replace(/--.*$/gm, '')).not.toMatch(/weightBp|DROP|RENAME/i);
  });
});

describe('the project closure', () => {
  it('adds extra work, takes deductions off, charges GST on the net and subtracts what is paid', () => {
    const t = closureTotals({
      contractPaise: 10_00_000_00,
      changesPaise: 5_000_00,
      gstBps: 1800,
      paidPaise: 9_50_000_00,
      lines: [
        { kind: 'EXTRA', description: 'Extra wardrobe loft', qtyMilli: 2000, ratePaise: 10_000_00, amountPaise: 20_000_00, note: null },
        { kind: 'DEDUCTION', description: 'Mirror not fitted', qtyMilli: null, ratePaise: null, amountPaise: 5_000_00, note: 'client buys own' },
      ],
    });
    expect(t.extrasPaise).toBe(20_000_00);
    expect(t.deductionsPaise).toBe(5_000_00);
    expect(t.netPaise).toBe(15_000_00);
    expect(t.gstPaise).toBe(2_700_00);
    expect(t.totalPaise).toBe(10_00_000_00 + 5_000_00 + 15_000_00 + 2_700_00);
    expect(t.finalDuePaise).toBe(t.totalPaise - 9_50_000_00);
  });

  it('carries GST back on a net credit and can come out as a refund', () => {
    const t = closureTotals({
      contractPaise: 100_00,
      changesPaise: 0,
      gstBps: 1800,
      paidPaise: 100_00,
      lines: [{ kind: 'DEDUCTION', description: 'Credit', qtyMilli: null, ratePaise: null, amountPaise: 10_00, note: null }],
    });
    expect(t.gstPaise).toBe(-1_80);
    expect(t.finalDuePaise).toBe(-11_80);
  });

  it('reads typed lines: quantity × rate, or an amount, blank rows dropped', () => {
    const c = checkClosureLines([
      { kind: 'EXTRA', description: 'Loft', qty: '1.5', rate: '12,000', note: 'master bedroom' },
      { kind: 'DEDUCTION', description: 'Credit for delay', amount: '2500' },
      { kind: 'EXTRA', description: '', qty: '', rate: '', amount: '' },
    ]);
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.lines).toHaveLength(2);
    expect(c.lines[0]).toMatchObject({ kind: 'EXTRA', qtyMilli: 1500, ratePaise: 12_000_00, amountPaise: 18_000_00, note: 'master bedroom' });
    expect(c.lines[1]).toMatchObject({ kind: 'DEDUCTION', qtyMilli: null, amountPaise: 2_500_00 });
  });

  it('says the first problem in plain words', () => {
    expect(checkClosureLines([{ description: 'x', amount: '10' }])).toEqual({ ok: false, error: 'Line 1: say what it is for.' });
    expect(checkClosureLines([{ description: 'Loft', qty: '2' }])).toEqual({ ok: false, error: 'Line 1: give a quantity and a rate, or an amount.' });
    expect(checkClosureLines([{ description: 'Loft', amount: '-5' }]).ok).toBe(false);
    expect(checkClosureLines([{ description: 'Loft', qty: 'two', rate: '5' }]).ok).toBe(false);
  });

  it('counts closures remaining and says so', () => {
    expect(closuresRemaining([{ phase: 'CLOSURE' }, { phase: 'CLOSURE' }, { phase: 'SNAGS' }, { phase: 'EXECUTION' }])).toBe(2);
    expect(remainingLine(2)).toBe('You have 2 project closures remaining');
    expect(remainingLine(1)).toBe('You have 1 project closure remaining');
  });
});
