import { describe, expect, it } from 'vitest';
import { CSV_BOM, EXPORT_COLUMNS, csvCell, csvHead, csvLine, exportCells, exportFileName, istStamp, type ExportLead } from '@/modules/studio-sales/lead-export-rules';
import { parseCsv } from '@/modules/studio-practice/csv';
import { can, STUDIO_ROLES } from '@/modules/studio/roles';

/**
 * The leads export (improvement 8, owner 22 Oct 2026): one row's cells, the
 * escaping that keeps a lead's name from becoming an Excel formula, the BOM,
 * and that only the owner may download.
 */

const LEAD: ExportLead = {
  name: 'Priya Shah',
  phone: '9876543210',
  email: 'priya@example.com',
  stageName: 'Calling 2',
  assigneeName: 'Asha',
  source: 'FACEBOOK',
  leadSourceName: null,
  society: 'Kumar Primavera',
  locality: 'Kothrud',
  config: '3 BHK',
  budgetPaise: 1_500_000_00n,
  createdAt: new Date('2026-10-20T04:30:00Z'),
  lastContactedAt: new Date('2026-10-21T10:00:00Z'),
  nextAction: 'Call back',
  nextActionOn: new Date('2026-10-22T10:00:00Z'),
  tags: ['hot', 'site visit'],
  lostReason: null,
};

describe('cells', () => {
  it('plain text and numbers as they are', () => {
    expect(csvCell('Kothrud')).toBe('Kothrud');
    expect(csvCell(1500000)).toBe('1500000');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(Number.NaN)).toBe('');
  });

  it('commas, quotes and line breaks are quoted, quotes doubled', () => {
    expect(csvCell('Shah, Priya')).toBe('"Shah, Priya"');
    expect(csvCell('the "big" flat')).toBe('"the ""big"" flat"');
    expect(csvCell('line one\nline two')).toBe('"line one\nline two"');
  });

  it('anything Excel would run as a formula gets an apostrophe', () => {
    expect(csvCell('=HYPERLINK("http://x","click")')).toBe('"\'=HYPERLINK(""http://x"",""click"")"');
    expect(csvCell('+91 98765 43210')).toBe("'+91 98765 43210");
    expect(csvCell('-2+3')).toBe("'-2+3");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('\t=1')).toBe("'\t=1");
    expect(csvCell('\r=1')).toBe('"\'\r=1"');
  });

  it('a negative number we wrote is still a number', () => {
    expect(csvCell(-5)).toBe('-5');
  });

  it('a formula in the middle is just text', () => {
    expect(csvCell('Flat =3')).toBe('Flat =3');
  });
});

describe('rows', () => {
  it('one cell per column, in order, India times, budget in rupees', () => {
    const cells = exportCells(LEAD);
    expect(cells).toHaveLength(EXPORT_COLUMNS.length);
    expect(cells).toEqual([
      'Priya Shah',
      '9876543210',
      'priya@example.com',
      'Calling 2',
      'Asha',
      'Facebook',
      'Kumar Primavera',
      'Kothrud',
      '3 BHK',
      1500000,
      '2026-10-20 10:00',
      '2026-10-21 15:30',
      'Call back',
      '2026-10-22 15:30',
      'hot; site visit',
      null,
    ]);
  });

  it('the pool, the studio’s own source name, a lost reason, and blanks', () => {
    const cells = exportCells({
      ...LEAD,
      assigneeName: null,
      leadSourceName: 'Builder tie-up',
      budgetPaise: null,
      lastContactedAt: null,
      nextAction: null,
      nextActionOn: null,
      tags: [],
      lostReason: 'BUDGET',
    });
    expect(cells[4]).toBe('Nobody (pool)');
    expect(cells[5]).toBe('Builder tie-up');
    expect(cells[9]).toBeNull();
    expect(cells[11]).toBe('');
    expect(cells[14]).toBe('');
    expect(cells[15]).toBe('Budget');
  });

  it('a source or reason we have no words for is written as stored', () => {
    const cells = exportCells({ ...LEAD, source: 'SOMETHING_NEW', lostReason: 'ODD' });
    expect(cells[5]).toBe('SOMETHING_NEW');
    expect(cells[15]).toBe('ODD');
  });

  it('a whole file reads back with the import’s own parser', () => {
    const file = csvHead() + csvLine(exportCells({ ...LEAD, name: 'Shah, "Priya"', society: '=cmd' }));
    expect(file.startsWith(CSV_BOM)).toBe(true);
    expect(file.endsWith('\r\n')).toBe(true);
    const rows = parseCsv(file);
    expect(rows[0]).toEqual([...EXPORT_COLUMNS]);
    expect(rows[1]![0]).toBe('Shah, "Priya"');
    expect(rows[1]![6]).toBe("'=cmd");
    expect(rows[1]).toHaveLength(EXPORT_COLUMNS.length);
  });

  it('stamps and the file name are India days', () => {
    expect(istStamp(null)).toBe('');
    expect(istStamp(new Date('2026-10-22T18:45:00Z'))).toBe('2026-10-23 00:15');
    expect(exportFileName(new Date('2026-10-22T18:45:00Z'))).toBe('leads-2026-10-23.csv');
  });
});

describe('who may download', () => {
  it('the owner, and nobody else', () => {
    for (const role of STUDIO_ROLES) expect(can({ role, status: 'ACTIVE' }, 'lead.export'), role).toBe(role === 'OWNER');
  });

  it('an owner who is not active may not', () => {
    expect(can({ role: 'OWNER', status: 'SUSPENDED' }, 'lead.export')).toBe(false);
  });
});
