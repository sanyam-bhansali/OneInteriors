import { describe, expect, it } from 'vitest';
import { toCsv, type JourneyRow } from '@/modules/quotation/journey-csv';

/**
 * The failure these guard against is silent and it corrupts a decision.
 *
 * A field holding a comma shifts the row one column left in Excel, and every
 * number after it lands under the wrong heading. Nobody notices — the file
 * opens, the pivot builds, and the average quote total is quietly the carpet
 * area. For a file whose only purpose is deciding things, that is the worst
 * possible bug, and it is one line of code away at all times.
 */

function row(over: Partial<JourneyRow> = {}): JourneyRow {
  return {
    briefId: 'b1',
    briefCreated: '2026-09-01',
    briefCompleted: '2026-09-01',
    locality: 'baner',
    propertyType: 'BHK_2',
    carpetAreaSqft: '850',
    tier: 'PREMIUM',
    budgetMin: '1400000',
    budgetMax: '2000000',
    studio: 'Teakline Studio',
    quoteTotal: '1180000',
    quoteLow: '1060000',
    quoteHigh: '1300000',
    modular: '769000',
    nonModular: '348000',
    variancePct: '0.10',
    kitchenRunMm: '3410',
    runSource: 'FLOOR_PLAN',
    linesQuoted: '23',
    notPriced: '',
    ratesVersion: 'archive-median@1',
    builtAt: '2026-09-01',
    studiosCompared: 'teakline chitra',
    starredCodes: 'KIT-BASE WDR-M',
    outcome: 'won',
    outcomeSource: 'OPS_RECORDED',
    decidedAt: '2026-09-20',
    ...over,
  };
}

describe('toCsv', () => {
  it('writes a header and one line per row', () => {
    const csv = toCsv([row(), row({ briefId: 'b2' })]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('briefId');
    expect(lines[0]).toContain('outcome');
  });

  it('survives a comma in a studio name', () => {
    // "Chitra & Co., Pune" is an entirely ordinary trade name.
    const csv = toCsv([row({ studio: 'Chitra & Co., Pune' })]);
    const body = csv.split('\n')[1]!;
    expect(body).toContain('"Chitra & Co., Pune"');
    // Every field wrapped means the column count cannot shift.
    const quoted = body.match(/"/g)?.length ?? 0;
    expect(quoted % 2).toBe(0);
  });

  it('escapes an embedded quote rather than ending the field', () => {
    const csv = toCsv([row({ studio: 'The "Good" Studio' })]);
    expect(csv.split('\n')[1]).toContain('"The ""Good"" Studio"');
  });

  it('keeps every column even when fields are blank', () => {
    const csv = toCsv([row({ outcome: '', outcomeSource: '', decidedAt: '' })]);
    const [header, body] = csv.split('\n');
    expect(body!.split('","').length).toBe(header!.split(',').length);
  });

  it('writes a header even with no rows, so an empty export is readable', () => {
    // An empty file looks like a broken export. A header alone says "nothing
    // yet", which is a different and true thing.
    const csv = toCsv([]);
    expect(csv.split('\n')).toHaveLength(1);
    expect(csv).toContain('briefId');
  });

  it('never writes the word lost', () => {
    /**
     * Absence is not a loss. Most briefs never reach a decision at all, and a
     * blank that reads as "lost" would make every win-rate ever calculated
     * from this file wrong in the same direction.
     */
    const csv = toCsv([row({ outcome: '', outcomeSource: '' }), row()]);
    expect(csv.toLowerCase()).not.toContain('lost');
  });

  it('carries no name, phone or email column', () => {
    // This file exists to be opened in a spreadsheet on somebody's laptop. The
    // moment it holds contact details it becomes a thing that must not be,
    // which means it stops being used for what it is for.
    const header = toCsv([]).toLowerCase();
    for (const forbidden of ['name', 'phone', 'email']) {
      // "studio" and "locality" are fine; a contact column is not.
      expect(header.includes(`"${forbidden}"`), forbidden).toBe(false);
    }
    expect(header).not.toContain('customer');
  });
});
