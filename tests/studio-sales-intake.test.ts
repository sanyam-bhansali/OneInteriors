import { describe, expect, it } from 'vitest';
import { formAgainSummary, formLanding, isPurgeable, purgeCutoff, isCustomColumn, customKeyOf } from '@/modules/studio-sales/intake-rules';
import { planImport } from '@/modules/studio-practice/csv';
import { BIN_DAYS } from '@/modules/studio-practice/vocabulary';

/**
 * Studio OS Phase 1: getting leads in (docs/studio-os/PHASE-1-SALES.md §6)
 * and the bin that really empties (§8).
 */

describe('the website form: one person, one lead', () => {
  it('a phone already on the board adds to that lead instead of a second card', () => {
    expect(formLanding([{ id: 'c1', deletedAt: null, isDemo: false }])).toEqual({ kind: 'attach', id: 'c1' });
  });

  it('a lead in the bin, or the sample, does not count: a fresh lead in the pool', () => {
    expect(formLanding([{ id: 'c1', deletedAt: new Date(), isDemo: false }])).toEqual({ kind: 'create' });
    expect(formLanding([{ id: 'demo', deletedAt: null, isDemo: true }])).toEqual({ kind: 'create' });
    expect(formLanding([])).toEqual({ kind: 'create' });
  });

  it('picks the live one when the bin also holds the number', () => {
    expect(
      formLanding([
        { id: 'old', deletedAt: new Date(), isDemo: false },
        { id: 'live', deletedAt: null, isDemo: false },
      ]),
    ).toEqual({ kind: 'attach', id: 'live' });
  });

  it('says what they wrote, on their timeline', () => {
    expect(formAgainSummary('Want a quote for the kitchen')).toBe('Filled in your enquiry form again: “Want a quote for the kitchen”');
    expect(formAgainSummary(null)).toBe('Filled in your enquiry form again');
  });
});

describe('the bin erases after thirty days', () => {
  const now = new Date('2026-10-12T00:00:00Z');

  it('purges what was deleted thirty days ago or more, nothing newer, nothing live', () => {
    expect(BIN_DAYS).toBe(30);
    expect(purgeCutoff(now).toISOString()).toBe('2026-09-12T00:00:00.000Z');
    expect(isPurgeable(new Date('2026-09-12T00:00:00Z'), now)).toBe(true);
    expect(isPurgeable(new Date('2026-08-01T00:00:00Z'), now)).toBe(true);
    expect(isPurgeable(new Date('2026-09-12T00:00:01Z'), now)).toBe(false);
    expect(isPurgeable(null, now)).toBe(false);
  });
});

describe('import maps the studio’s own fields', () => {
  it('recognises a custom column', () => {
    expect(isCustomColumn('custom:possession')).toBe(true);
    expect(isCustomColumn('custom:')).toBe(false);
    expect(isCustomColumn('phone')).toBe(false);
    expect(customKeyOf('custom:possession')).toBe('possession');
  });

  it('carries custom columns into each row, by field key', () => {
    const rows = [
      ['Name', 'Mobile', 'Possession', 'Ignore'],
      ['Priya Shah', '98765 43210', 'Mar 2027', 'x'],
      ['Rahul Mehta', '9123456789', '', 'y'],
    ];
    const plan = planImport(rows, ['name', 'phone', 'custom:possession', 'skip']);
    expect(plan.rows[0]).toMatchObject({ name: 'Priya Shah', phone: '9876543210', custom: { possession: 'Mar 2027' } });
    expect(plan.rows[1]!.custom).toBeUndefined();
  });
});
