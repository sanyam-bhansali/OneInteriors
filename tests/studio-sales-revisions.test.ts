import { describe, expect, it } from 'vitest';
import {
  comparable,
  contentKey,
  needsNewRevision,
  nextRevisionNumber,
  readRevisionLines,
  readRevisionTerms,
  revisionLabel,
  salesFinalRefusal,
  salesFinalSummary,
  sameLinesAs,
  SALES_FINAL_ERRORS,
  type RevisionLine,
  type RevisionTerms,
} from '@/modules/studio-sales/revision-rules';
import { compareToIssued } from '@/modules/studio-quote/revision';

/**
 * Studio OS Phase 1: quotation revisions and the sales final
 * (docs/studio-os/PHASE-1-SALES.md §3).
 */

const line = (room: string, product: string, amountPaise: number): RevisionLine => ({
  room,
  product,
  code: 'MODULAR',
  unit: 'UNIT',
  details: null,
  widthMm: null,
  heightMm: null,
  qtyMilli: 1000,
  ratePaise: amountPaise,
  amountPaise,
});
const terms: RevisionTerms = { feeBps: 0, discountBps: 1000, onSpotPaise: 0, onSpotLabel: null, bookingAdvancePaise: 2_500_000, gstBps: 0, phases: null };

describe('numbering', () => {
  it('R1, R2, R3, one after the highest', () => {
    expect(nextRevisionNumber([])).toBe(1);
    expect(nextRevisionNumber([1, 2])).toBe(3);
    expect(nextRevisionNumber([3, 1])).toBe(4);
    expect(revisionLabel(3)).toBe('R3');
  });
});

describe('when a send makes a new revision', () => {
  const v1 = { lines: [line('Kitchen', 'Base units', 300_000)], terms };

  it('the first send always does', () => {
    expect(needsNewRevision(null, v1)).toBe(true);
  });

  it('sending exactly the same again does not (Reopen, or pressing twice)', () => {
    expect(needsNewRevision(v1, { lines: [line('Kitchen', 'Base units', 300_000)], terms: { ...terms } })).toBe(false);
  });

  it('a changed line, a new line or changed terms do', () => {
    expect(needsNewRevision(v1, { lines: [line('Kitchen', 'Base units', 310_000)], terms })).toBe(true);
    expect(needsNewRevision(v1, { lines: [...v1.lines, line('Bed 1', 'Wardrobe', 500_000)], terms })).toBe(true);
    expect(needsNewRevision(v1, { lines: v1.lines, terms: { ...terms, discountBps: 1500 } })).toBe(true);
  });

  it('the order of lines is part of the document', () => {
    const a = [line('A', 'x', 1), line('B', 'y', 2)];
    expect(contentKey(a, terms)).not.toBe(contentKey([...a].reverse(), terms));
  });
});

describe('reading a stored revision back', () => {
  it('keeps good rows and drops ones that do not parse', () => {
    const stored = [line('Kitchen', 'Base', 100), { room: 'x' }, null, { room: 'B', product: 'Y', amountPaise: 'lots' }];
    expect(readRevisionLines(JSON.parse(JSON.stringify(stored)))).toEqual([line('Kitchen', 'Base', 100)]);
    expect(readRevisionLines('nope')).toEqual([]);
  });

  it('reads terms with safe defaults', () => {
    expect(readRevisionTerms(null)).toMatchObject({ feeBps: 0, phases: null });
    expect(readRevisionTerms(terms)).toEqual(terms);
  });

  it('compares any two revisions with the existing comparison', () => {
    const r1 = [line('Kitchen', 'Base', 300_000), line('Bed 1', 'Wardrobe', 400_000)];
    const r3 = [line('Kitchen', 'Base', 320_000), line('Living', 'TV unit', 90_000)];
    const s = compareToIssued(comparable(r1), comparable(r3));
    expect(s.repricedCount).toBe(1);
    expect(s.addedCount).toBe(1);
    expect(s.removedCount).toBe(1);
    expect(s.deltaPaise).toBe(20_000 + 90_000 - 400_000);
  });
});

describe('marking the sales final', () => {
  const ok = { revisionFound: true, quoteStage: 'SALES' as const, fromOneInteriors: false, booked: false, alreadyMarked: false };

  it('marks a sent revision on a Sales quotation', () => {
    expect(salesFinalRefusal(ok)).toBeNull();
    // Re-marking the same revision (to change its payment stages) is allowed too.
    expect(salesFinalRefusal({ ...ok, alreadyMarked: true })).toBeNull();
  });

  it('refuses a revision that was never sent, a Design Final, and once booked', () => {
    expect(salesFinalRefusal({ ...ok, revisionFound: false })).toBe(SALES_FINAL_ERRORS.notFound);
    expect(salesFinalRefusal({ ...ok, quoteStage: 'DESIGN' })).toBe(SALES_FINAL_ERRORS.design);
    expect(salesFinalRefusal({ ...ok, booked: true })).toBe(SALES_FINAL_ERRORS.booked);
  });

  it('says on the timeline when the mark moves', () => {
    expect(salesFinalSummary('2026-004', 3, null)).toBe('Marked R3 of quotation 2026-004 as the sales final');
    expect(salesFinalSummary('2026-004', 3, 2)).toBe('Sales final moved from R2 to R3 of quotation 2026-004');
  });

  it('knows when the quotation changed after its sales final', () => {
    const r3 = [line('Kitchen', 'Base', 320_000)];
    expect(sameLinesAs(r3, [line('Kitchen', 'Base', 320_000)])).toBe(true);
    expect(sameLinesAs(r3, [line('Kitchen', 'Base', 330_000)])).toBe(false);
  });
});
