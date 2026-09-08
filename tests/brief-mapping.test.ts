import { describe, it, expect } from 'vitest';
import { rowToBrief, briefToRow, type BriefRow } from '@/modules/brief/mapping';
import { EMPTY_BRIEF, type Brief } from '@/modules/brief/types';
import {
  checkProps,
  sanitiseProps,
  stepFunnel,
  worstStep,
  EVENTS,
} from '@/modules/analytics/events';

const FULL: Brief = {
  ...EMPTY_BRIEF,
  propertyType: 'BHK_3',
  carpetAreaSqft: 1150,
  locality: 'kharadi',
  possessionOn: '2026-12-01',
  scope: 'FULL_HOME',
  budgetMinPaise: 60_000_000,
  budgetMaxPaise: 120_000_000,
  styleLikes: ['warm-modern', 'japandi'],
  styleDislikes: ['luxe-glam'],
  household: { adults: 2, children: 1, elderly: 0, pets: true, worksFromHome: true },
  priorityRanking: ['BUDGET', 'SPEED', 'MATERIAL_QUALITY'],
  involvement: 'COLLABORATE',
  moveInBy: '2027-03-01',
  lastStep: 9,
  completedAt: '2026-09-08T10:00:00.000Z',
};

function rowFrom(brief: Brief): BriefRow {
  const r = briefToRow(brief);
  return {
    ...r,
    propertyType: r.propertyType,
    scope: r.scope,
    involvement: r.involvement,
    priorityRanking: r.priorityRanking,
    styleLikes: r.styleLikes,
    styleDislikes: r.styleDislikes,
  } as BriefRow;
}

describe('brief round trip', () => {
  it('survives a full trip through the database shape', () => {
    const back = rowToBrief(rowFrom(FULL));
    expect(back.propertyType).toBe(FULL.propertyType);
    expect(back.locality).toBe(FULL.locality);
    expect(back.styleLikes).toEqual(FULL.styleLikes);
    expect(back.priorityRanking).toEqual(FULL.priorityRanking);
    expect(back.involvement).toBe(FULL.involvement);
    expect(back.lastStep).toBe(9);
  });

  /**
   * Money is the one that would fail silently. Budgets are integer paise as a
   * number in the app and BigInt in Postgres; a missed conversion produces a
   * budget a hundred times too large, which then quietly fails every hard
   * filter in the matching engine rather than throwing anywhere useful.
   */
  it('keeps budgets exact across the BigInt boundary', () => {
    const row = rowFrom(FULL);
    expect(row.budgetMinPaise).toBe(60_000_000n);
    expect(typeof row.budgetMinPaise).toBe('bigint');

    const back = rowToBrief(row);
    expect(back.budgetMinPaise).toBe(60_000_000);
    expect(typeof back.budgetMinPaise).toBe('number');
    expect(back.budgetMaxPaise).toBe(120_000_000);
  });

  it('keeps a null budget null rather than turning it into zero', () => {
    const row = rowFrom({ ...FULL, budgetMinPaise: null, budgetMaxPaise: null });
    expect(row.budgetMinPaise).toBeNull();
    expect(rowToBrief(row).budgetMinPaise).toBeNull();
  });

  /**
   * "Not answered" and "nobody lives here" are different facts, and collapsing
   * them would tell the matching engine a home has no occupants.
   */
  it('distinguishes an unanswered household from an empty one', () => {
    const unanswered = rowToBrief(rowFrom({ ...FULL, household: null }));
    expect(unanswered.household).toBeNull();

    const empty = rowToBrief(
      rowFrom({
        ...FULL,
        household: { adults: 0, children: 0, elderly: 0, pets: false, worksFromHome: false },
      }),
    );
    expect(empty.household).not.toBeNull();
    expect(empty.household?.adults).toBe(0);
  });

  it('preserves the household booleans', () => {
    const back = rowToBrief(rowFrom(FULL));
    expect(back.household?.pets).toBe(true);
    expect(back.household?.worksFromHome).toBe(true);
    expect(back.household?.children).toBe(1);
  });

  it('normalises dates to ISO days and drops rubbish', () => {
    expect(rowFrom(FULL).possessionOn).toBeInstanceOf(Date);
    expect(rowFrom({ ...FULL, possessionOn: 'not a date' }).possessionOn).toBeNull();
    expect(rowToBrief(rowFrom(FULL)).possessionOn).toBe('2026-12-01');
  });

  it('fills missing fields from EMPTY_BRIEF rather than leaving them undefined', () => {
    const sparse = rowToBrief({
      ...rowFrom(EMPTY_BRIEF),
      propertyType: null,
      styleLikes: [],
      styleDislikes: [],
      priorityRanking: [],
    });
    expect(sparse.styleLikes).toEqual([]);
    expect(sparse.lastStep).toBe(0);
  });
});

describe('analytics props', () => {
  it('accepts counts, slugs and enums', () => {
    expect(checkProps({ step: 4, locality: 'kharadi', completed: true })).toEqual([]);
  });

  // Analytics props are exactly where personal data leaks into a table nobody
  // thinks of as holding personal data.
  it('rejects keys that look like personal data', () => {
    expect(checkProps({ email: 'x' }).length).toBe(1);
    expect(checkProps({ contactName: 'Rhea' }).length).toBe(1);
    expect(checkProps({ phone: '9876543210' }).length).toBe(1);
  });

  it('rejects an email or phone hiding under an innocent key', () => {
    expect(checkProps({ ref: 'someone@example.com' }).length).toBe(1);
    expect(checkProps({ ref: '9876543210' }).length).toBe(1);
    expect(checkProps({ ref: '+91 98765 43210' }).length).toBe(1);
  });

  it('rejects long strings, because free text is where people write themselves', () => {
    expect(checkProps({ note: 'x'.repeat(65) }).length).toBeGreaterThan(0);
  });

  it('drops the bad field rather than losing the whole event', () => {
    const clean = sanitiseProps({ step: 3, email: 'a@b.com' });
    expect(clean.step).toBe(3);
    expect(clean.email).toBeUndefined();
    expect(clean.droppedProps).toBe(1);
  });

  it('leaves clean props untouched', () => {
    const props = { step: 3, locality: 'baner' };
    expect(sanitiseProps(props)).toBe(props);
  });

  it('keeps event names unique', () => {
    expect(new Set(EVENTS).size).toBe(EVENTS.length);
  });
});

describe('stepFunnel', () => {
  it('reports drop-off per step, not cumulative', () => {
    const funnel = stepFunnel({ 1: 100, 2: 80 }, { 1: 80, 2: 76 }, 2);
    expect(funnel[0].dropOff).toBeCloseTo(0.2);
    // 4 of 80 lost here — not 24 of 100.
    expect(funnel[1].dropOff).toBeCloseTo(0.05);
  });

  /**
   * Null, not zero. "0% drop-off" on a step nobody reached reads as a triumph;
   * it is an absence of data, and a dashboard that cries wolf gets ignored on
   * the day it is right.
   */
  it('returns null drop-off for a step nobody has seen', () => {
    expect(stepFunnel({}, {}, 1)[0].dropOff).toBeNull();
  });

  it('never reports negative drop-off when completions exceed views', () => {
    expect(stepFunnel({ 1: 5 }, { 1: 9 }, 1)[0].dropOff).toBe(0);
  });

  it('finds the worst step, ignoring ones with too little traffic', () => {
    const funnel = stepFunnel({ 1: 100, 2: 100, 3: 3 }, { 1: 90, 2: 60, 3: 0 }, 3);
    expect(worstStep(funnel)?.step).toBe(2);
  });

  it('returns null when nothing has enough traffic to judge', () => {
    expect(worstStep(stepFunnel({ 1: 2 }, { 1: 0 }, 1))).toBeNull();
  });
});
