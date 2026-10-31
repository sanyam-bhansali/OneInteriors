import { describe, expect, it } from 'vitest';
import { HAUSPIRE_DESIGN } from '@/modules/studio-design/template';
import { candidates, maskPhone, nameMatch, personKey, proposeLead, readSheet, STAGE_TO_STEP, stepFor } from '@/modules/studio-bring-in/sheet-rules';

/** Hauspire's running projects, read before bringing them in (owner, 30 Oct 2026). */

// The owner's sheet as Excel saves it: two blank rows, a title, blank first column.
const SHEET = [
  ',,,,',
  ',,,,',
  ',Ongoing projects design ,,,',
  ',Client ,Designer ,Stage ,Quotation formate ',
  ',Monica Mam,Gunjan,Revised quotation,old',
  ',Santosh Morti,Akshata,FD,new',
  ',Shubham Patil,Gunjan,wd ,old',
  ',Kunal,Dhanashree,Project allocation ,New',
  ',Shubhangi ,Renuka,Design closer ,New',
  ',Piyush nema,Gunjan,Documentation ,old',
  ',Rohit sir,Dhanashree,FD,New',
  ',,,,',
].join('\r\n');

describe('the stage mapping (owner, 30 Oct 2026)', () => {
  it('names only steps that are in Hauspire’s template', () => {
    const labels = new Set(HAUSPIRE_DESIGN.map((s) => s.label));
    for (const step of Object.values(STAGE_TO_STEP)) expect(labels.has(step), step).toBe(true);
  });

  it('reads the sheet’s words however they are typed', () => {
    expect(stepFor('Furniture layout')).toBe('2D layout');
    expect(stepFor('wd ')).toBe('Working drawings');
    expect(stepFor('FD')).toBe('First draft (3D)');
    expect(stepFor('Design closer ')).toBe('Final 3D & renders');
    expect(stepFor('Revised quotation')).toBe('Post-quotation changes');
    expect(stepFor('Documentation ')).toBe('Final documentation for handover');
    expect(stepFor('Execution')).toBeNull();
  });
});

describe('reading the sheet', () => {
  it('finds the header under the title and reads every row', () => {
    const r = readSheet(SHEET);
    if (!r.ok) throw new Error(r.error);
    expect(r.problems).toEqual([]);
    expect(r.rows.map((x) => x.client)).toEqual(['Monica Mam', 'Santosh Morti', 'Shubham Patil', 'Kunal', 'Shubhangi', 'Piyush nema', 'Rohit sir']);
    expect(r.rows[0]).toEqual({ line: 5, client: 'Monica Mam', designer: 'Gunjan', stage: 'Revised quotation', format: 'EXCEL', quoteNo: null });
    expect(r.rows[3]!.format).toBe('HAUSPIRE_APP');
  });

  it('reports a stage or format it does not know, and a name twice, rather than guessing', () => {
    const r = readSheet(['Client,Designer,Stage,Quotation format', 'A one,G,Execution,old', 'B two,G,FD,maybe', 'C three,,FD,new', 'a one,G,FD,old'].join('\n'));
    if (!r.ok) throw new Error(r.error);
    expect(r.problems).toEqual([
      'line 2 (A one): stage "Execution" is not in the mapping',
      'line 3 (B two): quotation format "maybe" is neither old nor new',
      'line 4 (C three): no designer',
      'line 5 (a one): the same name as line 2',
    ]);
  });

  it('reads the quotation number when the sheet has the column', () => {
    const r = readSheet('Client,Designer,Stage,Quotation format,Quote no\nAmit,Akshata,Design changes,old,XL-AMIT\nMukesh,Gunjan,FD,new,');
    expect(r.ok && r.rows.map((x) => x.quoteNo)).toEqual(['XL-AMIT', null]);
  });

  it('a quoted cell with a comma stays one cell', () => {
    const r = readSheet('Client,Designer,Stage,Quotation format\n"Shah, Devang",Gunjan,FD,old');
    expect(r.ok && r.rows[0]!.client).toBe('Shah, Devang');
  });

  it('refuses a file without the header', () => {
    expect(readSheet('Name,Stage\nX,FD')).toEqual({ ok: false, error: 'No header row with Client, Designer, Stage and Quotation format was found.' });
  });
});

describe('matching a name on the board', () => {
  it('drops the titles the sheet adds', () => {
    expect(personKey('Monica Mam')).toBe('monica');
    expect(personKey('Yogesh kasar sir')).toBe('yogesh kasar');
    expect(personKey('Mr. Abhinn')).toBe('abhinn');
    expect(personKey('Sir')).toBe('sir');
  });

  it('exact, contains, or nothing', () => {
    expect(nameMatch('Devang shah', 'Devang Shah')).toBe('exact');
    expect(nameMatch('Rohit sir', 'Mr Rohit')).toBe('exact');
    expect(nameMatch('Monica Mam', 'Monica Sharma')).toBe('contains');
    expect(nameMatch('Sominath', 'Sominath Kale')).toBe('contains');
    expect(nameMatch('Ravindra pawar', 'Ravindra')).toBeNull();
    expect(nameMatch('Rahul Pawar', 'Rahul Patil')).toBeNull();
    expect(nameMatch('Kunal', 'Kunalkumar')).toBeNull();
    expect(nameMatch('', 'Anyone')).toBeNull();
  });

  it('lists exact matches first and says how many there were', () => {
    const board = [{ n: 'Rohit Shinde' }, { n: 'Rohit' }, { n: 'Rohan' }, { n: 'Rohit Kale' }];
    const r = candidates('Rohit sir', board, (x) => x.n, 2);
    expect(r.total).toBe(3);
    expect(r.shown.map((c) => [c.item.n, c.how])).toEqual([
      ['Rohit', 'exact'],
      ['Rohit Shinde', 'contains'],
    ]);
  });

  it('ranks before the name: a converted lead first', () => {
    const board = [{ n: 'Ankita', won: false }, { n: 'Ankita Sharma', won: true }];
    expect(candidates('Ankita', board, (x) => x.n, 5, (x) => (x.won ? 0 : 1)).shown.map((c) => c.item.n)).toEqual(['Ankita Sharma', 'Ankita']);
  });

  it('a mobile shows only its last four digits', () => {
    expect(maskPhone('+91 98220 12345')).toBe('…2345');
    expect(maskPhone(null)).toBe('no mobile');
  });
});

describe('proposing the one lead', () => {
  const lead = (id: string, over: Partial<{ how: 'exact' | 'contains'; won: boolean; usable: boolean }> = {}) => ({ id, how: 'exact' as const, won: false, usable: true, ...over });

  it('the lead its quotations are on comes first', () => {
    expect(proposeLead([lead('a', { won: true }), lead('b')], ['b', 'b', null])).toEqual({ id: 'b', why: 'quotation' });
  });

  it('quotations on two leads say nothing; a single converted lead does', () => {
    expect(proposeLead([lead('a', { won: true }), lead('b'), lead('c')], ['b', 'c'])).toEqual({ id: 'a', why: 'converted' });
  });

  it('a quotation on a lead that cannot be used is ignored', () => {
    expect(proposeLead([lead('a', { usable: false }), lead('b')], ['a'])).toEqual({ id: null, why: 'pick', among: 2 });
  });

  it('two converted leads, or none: a person picks', () => {
    expect(proposeLead([lead('a', { won: true }), lead('b', { won: true })], [])).toEqual({ id: null, why: 'pick', among: 2 });
    expect(proposeLead([lead('a'), lead('b')], [])).toEqual({ id: null, why: 'pick', among: 2 });
  });

  it('a binned converted lead is not proposed', () => {
    expect(proposeLead([lead('a', { won: true, usable: false }), lead('b')], [])).toEqual({ id: null, why: 'pick', among: 2 });
  });

  it('the only lead is proposed when it is the exact name, not a partial one', () => {
    expect(proposeLead([lead('a')], [])).toEqual({ id: 'a', why: 'only' });
    expect(proposeLead([lead('a', { how: 'contains' })], [])).toEqual({ id: null, why: 'pick', among: 1 });
    expect(proposeLead([lead('a', { how: 'contains', won: true })], [])).toEqual({ id: 'a', why: 'converted' });
  });

  it('no lead: a new one', () => {
    expect(proposeLead([], [])).toEqual({ id: null, why: 'none', among: 0 });
  });
});
