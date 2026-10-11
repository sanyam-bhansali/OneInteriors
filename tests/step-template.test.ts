import { describe, expect, it } from 'vitest';
import { SHEET_HANDOVER, SHEET_START, STEP_TEMPLATE, templateFor } from '@/modules/project/step-template';
import { PLAN_KINDS } from '@/modules/portal/tracker';
import { daysBetween } from '@/modules/project/working-days';

/** Hauspire's steps (docs/studio-workspace/STEP-TRACKER.md): the table as the owner approved it. */

describe('STEP_TEMPLATE', () => {
  it('weighs exactly 100%', () => {
    expect(STEP_TEMPLATE.reduce((a, s) => a + s.weightBp, 0)).toBe(10_000);
    expect(STEP_TEMPLATE.every((s) => Number.isInteger(s.weightBp) && s.weightBp > 0)).toBe(true);
  });

  it('has the table’s steps per stage, in stage order', () => {
    expect(PLAN_KINDS.map((k) => templateFor(k).length)).toEqual([1, 8, 22, 6, 7]);
    const kinds = STEP_TEMPLATE.map((s) => PLAN_KINDS.indexOf(s.kind));
    expect(kinds).toEqual([...kinds].sort((a, b) => a - b));
  });

  it('weighs each stage as the table does', () => {
    const pct = (k: (typeof PLAN_KINDS)[number]) => templateFor(k).reduce((a, s) => a + s.weightBp, 0) / 100;
    expect(PLAN_KINDS.map(pct)).toEqual([2, 23, 47, 17, 11]);
  });

  it('keeps the sheet’s groups', () => {
    const groups = [...new Set(STEP_TEMPLATE.map((s) => `${s.kind}/${s.group}`))];
    expect(groups).toEqual([
      'DESIGN/Design',
      'CIVIL/Execution stage 1',
      'CARPENTRY/Execution stage 2A',
      'CARPENTRY/Execution stage 2B',
      'FINISH/Finishing',
      'HANDOVER/Handover preparation',
      'HANDOVER/Handover',
    ]);
  });

  it('names every step once, plainly', () => {
    const labels = STEP_TEMPLATE.map((s) => s.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels.every((l) => l.length >= 2 && l.length <= 120)).toBe(true);
    expect(labels).toContain('POP framing');
    expect(labels).toContain('Carcass complete with hardware');
    expect(STEP_TEMPLATE.find((s) => s.label === 'Carcass complete with hardware')!.weightBp).toBe(1000);
    expect(STEP_TEMPLATE.find((s) => s.label === 'Name plate ordered')!.weightBp).toBe(50);
  });

  it('runs the sheet’s days in order, from the start to the handover', () => {
    const days = STEP_TEMPLATE.map((s) => s.sheetDay);
    expect(days).toEqual([...days].sort());
    expect(days[0]).toBe(SHEET_START);
    expect(days[days.length - 1]).toBe(SHEET_HANDOVER);
    expect(daysBetween(SHEET_START, SHEET_HANDOVER)).toBe(110);
  });
});
