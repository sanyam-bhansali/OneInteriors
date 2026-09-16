import { describe, it, expect } from 'vitest';
import { wouldStrand, nextSortOrder, type StageShape } from '@/modules/studio-practice/pipeline-rules';
import {
  cleanValues,
  problemSentence,
  readValues,
  groupBy,
  type FieldShape,
  type FieldValues,
} from '@/modules/studio-practice/field-values';
import { fieldKeyFrom, DEFAULT_STAGES } from '@/modules/studio-practice/vocabulary';

/**
 * The pipeline belongs to the studio; the four meanings belong to us. These
 * tests are about the seam between those two facts, which is the only place
 * a settings change can break a screen three clicks away.
 */

const DEFAULT: StageShape[] = [
  { id: 'a', kind: 'OPEN' },
  { id: 'b', kind: 'OPEN' },
  { id: 'c', kind: 'WON' },
  { id: 'd', kind: 'WON' },
  { id: 'e', kind: 'DONE' },
  { id: 'f', kind: 'LOST' },
];

describe('the pipeline cannot be edited into a broken state', () => {
  it('allows deleting a column when another of its kind remains', () => {
    expect(wouldStrand(DEFAULT, 'c', null)).toBeNull();
    expect(wouldStrand(DEFAULT, 'a', null)).toBeNull();
  });

  it('refuses to delete the last won column', () => {
    // This is the one that matters. Without it a studio can delete two columns
    // in Settings and then find, days later, that the New Project button on a
    // completely different screen offers an empty list and always will.
    const oneWon = DEFAULT.filter((s) => s.id !== 'd');
    const message = wouldStrand(oneWon, 'c', null);
    expect(message).toContain('won');
    expect(message).toContain('projects can only be started');
  });

  it('refuses to delete the last open, done or lost column', () => {
    expect(wouldStrand(DEFAULT.filter((s) => s.id !== 'b'), 'a', null)).toContain('in play');
    expect(wouldStrand(DEFAULT, 'e', null)).toContain('finished');
    expect(wouldStrand(DEFAULT, 'f', null)).toContain('the ones that go');
  });

  it('applies the same rule to changing what a column means', () => {
    // Re-kinding the last WON column to OPEN strands WON just as deleting it
    // would, and for the same reason.
    const oneWon = DEFAULT.filter((s) => s.id !== 'd');
    expect(wouldStrand(oneWon, 'c', 'OPEN')).toContain('won');
    // Two won columns, so turning one into an open one is fine.
    expect(wouldStrand(DEFAULT, 'c', 'OPEN')).toBeNull();
  });

  it('counts the replacement, not just the removal', () => {
    // Changing the only DONE column into another LOST column strands DONE.
    expect(wouldStrand(DEFAULT, 'e', 'LOST')).toContain('finished');
    // But changing an OPEN column into a DONE one while another OPEN remains
    // is harmless.
    expect(wouldStrand(DEFAULT, 'b', 'DONE')).toBeNull();
  });

  it('ships defaults that satisfy its own rules', () => {
    const shaped: StageShape[] = DEFAULT_STAGES.map((s, i) => ({ id: String(i), kind: s.kind }));
    for (const kind of ['OPEN', 'WON', 'DONE', 'LOST'] as const) {
      expect(shaped.some((s) => s.kind === kind)).toBe(true);
    }
    expect(DEFAULT_STAGES.filter((s) => s.isIntake)).toHaveLength(1);
    expect(DEFAULT_STAGES.find((s) => s.isIntake)?.kind).toBe('OPEN');
  });

  it('leaves gaps in the sort order so a column can be dropped between two', () => {
    expect(nextSortOrder([{ sortOrder: 10 }, { sortOrder: 20 }])).toBe(30);
    expect(nextSortOrder([])).toBe(10);
    // Out of order input still appends to the end rather than colliding.
    expect(nextSortOrder([{ sortOrder: 50 }, { sortOrder: 20 }])).toBe(60);
  });
});

describe('a field key is derived once and frozen', () => {
  it('turns a label into a stable snake_case key', () => {
    expect(fieldKeyFrom('Carpet area (sqft)')).toBe('carpet_area_sqft');
    expect(fieldKeyFrom('BHK / Property type')).toBe('bhk_property_type');
    expect(fieldKeyFrom('  Society  ')).toBe('society');
  });

  it('gives the same key for labels that differ only in punctuation', () => {
    // This is what makes deleting a field and recreating it recover the
    // values: same label, same key, values still filed under it.
    expect(fieldKeyFrom('Possession month')).toBe(fieldKeyFrom('Possession Month!'));
  });
});

const FIELDS: FieldShape[] = [
  { key: 'society', label: 'Society', type: 'TEXT', options: [] },
  { key: 'carpet', label: 'Carpet area', type: 'NUMBER', options: [] },
  { key: 'possession', label: 'Possession month', type: 'DATE', options: [] },
  { key: 'bhk', label: 'BHK', type: 'SELECT', options: ['1BHK', '2BHK', '3BHK'] },
];

describe('custom field values', () => {
  it('keeps what is valid and drops what is blank', () => {
    const { values, problems } = cleanValues(FIELDS, {
      society: ' Lodha Panache ',
      carpet: '1250',
      possession: '2027-03-01',
      bhk: '2BHK',
    });
    expect(problems).toEqual([]);
    expect(values).toEqual({
      society: 'Lodha Panache',
      carpet: '1250',
      possession: '2027-03-01',
      bhk: '2BHK',
    });

    expect(cleanValues(FIELDS, { society: '   ' }).values).toEqual({});
  });

  it('accepts the commas an Indian typist puts in a number', () => {
    expect(cleanValues(FIELDS, { carpet: '1,250' }).values.carpet).toBe('1250');
  });

  it('reports what was wrong in the studio’s own words', () => {
    const { problems } = cleanValues(FIELDS, { carpet: 'about 1200', bhk: '5BHK' });
    expect(problems).toHaveLength(2);
    expect(problemSentence(problems)).toBe(
      'Carpet area has to be a number; BHK is not one of the choices.',
    );
    expect(problemSentence([problems[0]!])).toBe('Carpet area has to be a number.');
  });

  it('drops a value for a field that no longer exists, without complaining', () => {
    // It arrives from a form left open in another tab after the field was
    // deleted. Not the person's mistake, so not their sentence to read.
    const { values, problems } = cleanValues(FIELDS, { society: 'Kiona', deleted_field: 'x' });
    expect(values).toEqual({ society: 'Kiona' });
    expect(problems).toEqual([]);
  });

  it('never trusts what comes back out of the jsonb column', () => {
    expect(readValues(null)).toEqual({});
    expect(readValues('not an object')).toEqual({});
    expect(readValues(['an', 'array'])).toEqual({});
    expect(readValues({ a: 'x', b: 7, c: null, d: { nested: true } })).toEqual({ a: 'x', b: '7' });
  });
});

describe('grouping the client list', () => {
  const rows: { id: number; fields: FieldValues }[] = [
    { id: 1, fields: { society: 'Lodha Panache' } },
    { id: 2, fields: { society: 'Lodha Panache' } },
    { id: 3, fields: { society: 'Ganga Legend' } },
    { id: 4, fields: {} },
    { id: 5, fields: { society: '  ' } },
  ];

  it('sorts the biggest bucket first and keeps the blanks last', () => {
    const groups = groupBy(rows, 'society');
    expect(groups.map((g) => [g.label, g.rows.length])).toEqual([
      ['Lodha Panache', 2],
      ['Ganga Legend', 1],
      ['Not set', 2],
    ]);
  });

  it('keeps the blanks rather than dropping them', () => {
    // The count of clients with no society recorded is the argument for
    // recording it. Hiding them hides the argument.
    const total = groupBy(rows, 'society').reduce((n, g) => n + g.rows.length, 0);
    expect(total).toBe(rows.length);
  });
});
