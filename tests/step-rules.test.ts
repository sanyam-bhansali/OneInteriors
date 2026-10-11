import { describe, expect, it } from 'vitest';
import {
  bpToPct,
  checkGroup,
  checkLabel,
  checkRemove,
  checkScope,
  checkWeight,
  doneLabel,
  effectiveWeights,
  parsePercent,
  progressOf,
  shiftStepDay,
  spreadStepDays,
  type RuleStep,
} from '@/modules/project/step-rules';
import { STEP_TEMPLATE, templateFor } from '@/modules/project/step-template';

let n = 0;
const s = (stageId: string, weightBp: number, opts: Partial<RuleStep> = {}): RuleStep => ({ id: `s${++n}`, stageId, weightBp, inScope: true, done: false, ...opts });
const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);

describe('effective weights', () => {
  it('are the stored weights when they already sum to 100%', () => {
    const steps = STEP_TEMPLATE.map((t, i) => ({ id: `t${i}`, weightBp: t.weightBp, inScope: true }));
    const w = effectiveWeights(steps);
    expect(steps.every((x) => w.get(x.id) === x.weightBp)).toBe(true);
    expect(sum(w)).toBe(10_000);
  });

  it('share a not-in-scope step’s weight across the rest, in proportion, summing to exactly 100%', () => {
    const a = s('x', 2000);
    const b = s('x', 6000);
    const out = s('x', 2000, { inScope: false });
    const w = effectiveWeights([a, b, out]);
    expect(w.get(out.id)).toBe(0);
    expect(w.get(a.id)).toBe(2500);
    expect(w.get(b.id)).toBe(7500);
  });

  it('always sum to exactly 10 000 in whole basis points, whatever was typed', () => {
    for (const weights of [[1, 1, 1], [333, 333, 334, 1], [50, 50, 50, 50, 50, 50, 1000], [7, 0, 0, 3], [9999, 1, 1, 1, 1, 1, 1]]) {
      const steps = weights.map((w) => s('x', w));
      const e = effectiveWeights(steps);
      expect(sum(e), weights.join(',')).toBe(10_000);
      expect([...e.values()].every((v) => Number.isInteger(v) && v >= 0)).toBe(true);
    }
  });

  it('keep the template’s total with any one step out of scope', () => {
    for (let i = 0; i < STEP_TEMPLATE.length; i++) {
      const steps = STEP_TEMPLATE.map((t, j) => ({ id: `t${j}`, weightBp: t.weightBp, inScope: j !== i }));
      expect(sum(effectiveWeights(steps))).toBe(10_000);
    }
  });

  it('share equally when every in-scope step weighs 0, and are empty with nothing in scope', () => {
    const steps = [s('x', 0), s('x', 0), s('x', 0), s('x', 0)];
    expect([...effectiveWeights(steps).values()]).toEqual([2500, 2500, 2500, 2500]);
    expect(sum(effectiveWeights([s('x', 500, { inScope: false })]))).toBe(0);
  });
});

describe('progress', () => {
  it('goes from 0 to exactly 100 as the in-scope steps are ticked', () => {
    const steps = STEP_TEMPLATE.map((t, i) => ({ id: `t${i}`, stageId: t.kind, weightBp: t.weightBp, inScope: true, done: false }));
    expect(progressOf(steps).pct).toBe(0);
    let last = 0;
    for (const st of steps) {
      st.done = true;
      const p = progressOf(steps).pct;
      expect(p).toBeGreaterThanOrEqual(last);
      last = p;
    }
    expect(last).toBe(100);
  });

  it('reads 2% once design is signed off, and 25% once POP and civil are done too', () => {
    const steps = STEP_TEMPLATE.map((t, i) => ({ id: `t${i}`, stageId: t.kind, weightBp: t.weightBp, inScope: true, done: t.kind === 'DESIGN' }));
    expect(progressOf(steps).pct).toBe(2);
    for (const x of steps) if (x.stageId === 'CIVIL') x.done = true;
    const p = progressOf(steps);
    expect(p.pct).toBe(25);
    expect(p.stages.get('CIVIL')).toMatchObject({ pct: 100, complete: true, done: 8, total: 8, totalBp: 2300 });
    expect(p.stages.get('CARPENTRY')).toMatchObject({ pct: 0, complete: false });
  });

  it('ignores not-in-scope steps and still reaches 100', () => {
    const a = s('x', 4000, { done: true });
    const b = s('x', 4000, { done: true });
    const c = s('y', 2000, { inScope: false });
    const p = progressOf([a, b, c]);
    expect(p.pct).toBe(100);
    expect(p.stages.get('x')!.complete).toBe(true);
    expect(p.stages.get('y')).toMatchObject({ pct: null, complete: false, total: 0 });
  });

  it('never shows 100 until the last step, rounding down', () => {
    const steps = [s('x', 9990, { done: true }), s('x', 10)];
    expect(progressOf(steps).pct).toBe(99);
    expect(progressOf(steps).stages.get('x')!.pct).toBe(99);
  });

  it('per stage, against the stage’s own weight', () => {
    const steps = [s('x', 1000, { done: true }), s('x', 3000), s('y', 6000, { done: true })];
    const p = progressOf(steps);
    expect(p.stages.get('x')!.pct).toBe(25);
    expect(p.stages.get('y')!.pct).toBe(100);
    expect(p.pct).toBe(70);
  });
});

describe('planned days', () => {
  it('spread a stage’s steps across its window by the sheet’s spacing', () => {
    const civil = templateFor('CIVIL').map((t) => t.sheetDay);
    const days = spreadStepDays(civil, { start: '2026-12-01', end: '2026-12-19' });
    expect(days[0]).toBe('2026-12-01');
    expect(days[days.length - 1]).toBe('2026-12-19');
    expect(days).toEqual([...days].sort());
    // Same span as the sheet (17 Jul – 4 Aug, 18 days): the sheet's own spacing.
    expect(days).toEqual(['2026-12-01', '2026-12-06', '2026-12-09', '2026-12-11', '2026-12-12', '2026-12-13', '2026-12-16', '2026-12-19']);
  });

  it('scale to a shorter window and keep the order', () => {
    const carp = templateFor('CARPENTRY').map((t) => t.sheetDay);
    const days = spreadStepDays(carp, { start: '2027-01-01', end: '2027-01-21' });
    expect(days[0]).toBe('2027-01-01');
    expect(days[days.length - 1]).toBe('2027-01-21');
    expect(days).toEqual([...days].sort());
  });

  it('put a one-step stage’s step on its end', () => {
    expect(spreadStepDays(['2026-07-17'], { start: '2026-11-01', end: '2026-11-21' })).toEqual(['2026-11-21']);
    expect(spreadStepDays([], { start: '2026-11-01', end: '2026-11-21' })).toEqual([]);
  });

  it('move with their stage by the days its end moved, inside the new window', () => {
    const before = { start: '2026-11-01', end: '2026-11-20' };
    expect(shiftStepDay('2026-11-10', before, { start: '2026-11-05', end: '2026-11-24' })).toBe('2026-11-14');
    expect(shiftStepDay('2026-11-10', before, { start: '2026-11-01', end: '2026-11-25' })).toBe('2026-11-15');
    expect(shiftStepDay('2026-11-03', before, { start: '2026-11-04', end: '2026-11-20' })).toBe('2026-11-06');
    expect(shiftStepDay('2026-11-18', before, { start: '2026-11-01', end: '2026-11-12' })).toBe('2026-11-10');
    expect(shiftStepDay('2026-11-01', before, { start: '2026-11-01', end: '2026-11-12' })).toBe('2026-11-01');
    expect(shiftStepDay(null, before, before)).toBeNull();
  });
});

describe('what the studio may change', () => {
  it('names: trimmed, 2 to 120 characters', () => {
    expect(checkLabel('  POP   framing ')).toEqual({ ok: true, label: 'POP framing' });
    expect(checkLabel('x').ok).toBe(false);
    expect(checkLabel('x'.repeat(121)).ok).toBe(false);
    expect(checkGroup('Execution stage 1')).toEqual({ ok: true, group: 'Execution stage 1' });
    expect(checkGroup(' ').ok).toBe(false);
  });

  it('weights: whole basis points from 0 to 100%', () => {
    expect(checkWeight(0).ok).toBe(true);
    expect(checkWeight(10_000).ok).toBe(true);
    expect(checkWeight(10_001).ok).toBe(false);
    expect(checkWeight(-1).ok).toBe(false);
    expect(checkWeight(1.5).ok).toBe(false);
    expect(parsePercent('4')).toBe(400);
    expect(parsePercent('0.5')).toBe(50);
    expect(parsePercent(' 2.25 %')).toBe(225);
    expect(parsePercent('100')).toBe(10_000);
    expect(parsePercent('101')).toBeNull();
    expect(parsePercent('1.234')).toBeNull();
    expect(parsePercent('abc')).toBeNull();
    expect(parsePercent('-2')).toBeNull();
    expect(bpToPct(213)).toBe(2.13);
    expect(bpToPct(50)).toBe(0.5);
  });

  it('removing: never a ticked step, never the last in-scope one', () => {
    const a = s('x', 100);
    const b = s('x', 100, { done: true });
    const c = s('x', 100, { inScope: false });
    expect(checkRemove(a, [a, b, c]).ok).toBe(true);
    expect(checkRemove(b, [a, b, c]).ok).toBe(false);
    expect(checkRemove(a, [a, c]).ok).toBe(false);
    expect(checkRemove(c, [a, c]).ok).toBe(true);
  });

  it('scope: not out while ticked, never the last in scope; back in always', () => {
    const a = s('x', 100);
    const b = s('x', 100, { done: true });
    const c = s('x', 100, { inScope: false });
    expect(checkScope(a, false, [a, b, c]).ok).toBe(true);
    expect(checkScope(b, false, [a, b, c]).ok).toBe(false);
    expect(checkScope(a, false, [a, c]).ok).toBe(false);
    expect(checkScope(c, true, [a, c]).ok).toBe(true);
    expect(checkScope(a, true, [a]).ok).toBe(true);
  });

  it('labels a step’s photo “Done: {step}”', () => {
    expect(doneLabel('POP framing')).toBe('Done: POP framing');
  });
});
