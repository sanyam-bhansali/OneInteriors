import { describe, expect, it } from 'vitest';
import { parseCsv } from '@/modules/studio-practice/csv';
import { SOCIETY_TEMPLATE, guessSocietyColumns, planSocietyImport, societyTemplateCsv, tidyWing, toPayload } from '@/modules/studio-practice/society-import';

describe('Society sheet import', () => {
  it('guesses the usual headers', () => {
    expect(guessSocietyColumns(['Sr', 'Wing', 'Flat No', 'Owner Name', 'Mobile', 'Possession'])).toEqual(['skip', 'wing', 'flat', 'name', 'phone', 'possession']);
    expect(guessSocietyColumns(['Project', 'Tower', 'Unit', 'Customer', 'Contact'])).toEqual(['society', 'wing', 'flat', 'name', 'phone']);
  });

  it('matches the template’s own headings with no choosing, and reads its example rows', () => {
    const rows = parseCsv(societyTemplateCsv());
    expect(rows[0]).toEqual(SOCIETY_TEMPLATE.map((c) => c.header));
    expect(guessSocietyColumns(rows[0])).toEqual(SOCIETY_TEMPLATE.map((c) => c.column));
    const plan = planSocietyImport(rows.slice(1), guessSocietyColumns(rows[0]));
    expect(plan.societies).toHaveLength(1);
    expect(plan.societies[0].owners.map((o) => o.phone)).toEqual(['9822055310', '9876543210']);
    expect([...plan.societies[0].wings.keys()]).toEqual(['A', 'B']);
  });

  it('tidies wing names', () => {
    expect(tidyWing('b')).toBe('B');
    expect(tidyWing('B wing')).toBe('B');
    expect(tidyWing('Wing C')).toBe('C');
    expect(tidyWing('tower-3')).toBe('Tower 3');
    expect(tidyWing('')).toBe('');
  });

  const cols = ['wing', 'flat', 'name', 'phone', 'possession'] as const;

  it('groups owners into one society from the screen, with wings and possession', () => {
    const plan = planSocietyImport(
      [
        ['A', '101', 'RAHUL DESHPANDE', '98220 55310', 'Mar 2027'],
        ['A', '102', 'priya shah', '+91 98765 43210', ''],
        ['B', '201', 'Anil', '9876500000', '2027-09'],
      ],
      [...cols],
      { society: 'Life Republic R10' },
    );
    expect(plan.societies).toHaveLength(1);
    const g = plan.societies[0];
    expect(g.name).toBe('Life Republic R10');
    expect([...g.wings.keys()]).toEqual(['A', 'B']);
    expect(g.wings.get('A')?.toISOString().slice(0, 7)).toBe('2027-03');
    expect(g.wings.get('B')?.toISOString().slice(0, 7)).toBe('2027-09');
    expect(g.owners.map((o) => [o.name, o.phone, o.flat, o.wing])).toEqual([
      ['Rahul Deshpande', '9822055310', '101', 'A'],
      ['Priya Shah', '9876543210', '102', 'A'],
      ['Anil', '9876500000', '201', 'B'],
    ]);
  });

  it('splits by a society column, keyed so spellings agree', () => {
    const plan = planSocietyImport(
      [
        ['Life Republic R-10', 'A', 'X', '9000000001'],
        ['life republic r10', 'B', 'Y', '9000000002'],
        ['Mahindra Happinest', '', 'Z', '9000000003'],
      ],
      ['society', 'wing', 'name', 'phone'],
    );
    expect(plan.societies.map((g) => [g.name, g.owners.length])).toEqual([
      ['Life Republic R-10', 2],
      ['Mahindra Happinest', 1],
    ]);
    expect([...plan.societies[1].wings.keys()]).toEqual(['Main']);
  });

  it('counts what it leaves out', () => {
    const plan = planSocietyImport(
      [
        ['A', '1', '', '', ''],
        ['A', '2', 'Same', '9000000001', 'soon'],
        ['A', '3', 'Again', '9000000001', ''],
        ['', '', '', '', ''],
      ],
      [...cols],
      { society: 'X Heights' },
    );
    expect(plan.skipped).toBe(1);
    expect(plan.repeats).toBe(1);
    expect(plan.badDates).toBe(1);
    expect(plan.societies[0].owners).toHaveLength(1);
    expect(planSocietyImport([['A', '1', 'N', '9000000001', '']], [...cols]).noSociety).toBe(1);
  });

  it('names an owner with no name after their flat', () => {
    const plan = planSocietyImport([['A', '1203', '', '9000000001', '']], [...cols], { society: 'X' });
    expect(plan.societies[0].owners[0].name).toBe('Owner, flat 1203');
  });

  it('turns the plan into plain JSON for the server', () => {
    const plan = planSocietyImport([['A', '1', 'N', '9000000001', '2027-03']], [...cols], { society: 'X' });
    expect(toPayload(plan, 'sheet.xlsx', null).societies[0].wings).toEqual([{ name: 'A', possession: '2027-03-01' }]);
  });
});
