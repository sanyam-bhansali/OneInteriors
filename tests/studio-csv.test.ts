import { describe, it, expect } from 'vitest';
import {
  parseCsv,
  guessColumn,
  guessMapping,
  normalisePhone,
  tidyName,
  planImport,
  type ColumnKey, looksDestroyed } from '@/modules/studio-practice/csv';

/**
 * These tests are the import.
 *
 * Every row here is a shape a real Pune studio's spreadsheet actually takes,
 * and each one is a way the import can silently do the wrong thing — write a
 * client called "9876543210", drop a whole column because the header had a
 * trailing space, or create four copies of the same person because half the
 * file writes +91 and half does not.
 *
 * None of those throw. They all "succeed" and leave a mess somebody has to
 * clean up by hand, which is why the parsing lives in a pure module and why
 * this file exists.
 */

describe('parsing a file that came out of Excel', () => {
  it('reads plain rows', () => {
    expect(parseCsv('Name,Phone\nAsha,9876543210\nRavi,9123456789')).toEqual([
      ['Name', 'Phone'],
      ['Asha', '9876543210'],
      ['Ravi', '9123456789'],
    ]);
  });

  it('strips the byte-order mark Excel puts on every export', () => {
    // Without this the first header is "﻿Name", every guess against it
    // fails, and the name column silently imports as nothing.
    const rows = parseCsv('﻿Name,Phone\nAsha,9876543210');
    expect(rows[0]![0]).toBe('Name');
  });

  it('handles quoted commas, escaped quotes and newlines inside a cell', () => {
    const text = 'Name,Notes\n"Patil, Asha","Said ""call after 6"".\nWants a quote."';
    expect(parseCsv(text)).toEqual([
      ['Name', 'Notes'],
      ['Patil, Asha', 'Said "call after 6".\nWants a quote.'],
    ]);
  });

  it('survives CRLF and a trailing newline', () => {
    expect(parseCsv('Name,Phone\r\nAsha,9876543210\r\n')).toEqual([
      ['Name', 'Phone'],
      ['Asha', '9876543210'],
    ]);
  });

  it('drops blank rows rather than importing empty clients', () => {
    expect(parseCsv('Name,Phone\nAsha,9876543210\n,\n\nRavi,9123456789')).toHaveLength(3);
  });
});

describe('guessing what a column is for', () => {
  it('recognises the headers people actually use', () => {
    expect(guessColumn('Client Name')).toBe('name');
    expect(guessColumn('  Mobile No. ')).toBe('phone');
    expect(guessColumn('Contact Number')).toBe('phone');
    expect(guessColumn('WhatsApp')).toBe('phone');
    expect(guessColumn('E-Mail')).toBe('email');
    expect(guessColumn('Society')).toBe('society');
    expect(guessColumn('Building')).toBe('society');
    expect(guessColumn('Area')).toBe('locality');
    expect(guessColumn('BHK')).toBe('config');
    expect(guessColumn('Remarks')).toBe('notes');
  });

  it('skips what it does not recognise rather than guessing wildly', () => {
    expect(guessColumn('Sr. No')).toBe('skip');
    expect(guessColumn('')).toBe('skip');
  });

  it('never maps two columns to the same field', () => {
    // A sheet with both "Name" and "Client Name" would otherwise map both,
    // and the second one silently wins.
    const mapping = guessMapping(['Name', 'Client Name', 'Mobile', 'Phone']);
    expect(mapping.filter((m) => m === 'name')).toHaveLength(1);
    expect(mapping.filter((m) => m === 'phone')).toHaveLength(1);
    expect(mapping).toEqual(['name', 'skip', 'phone', 'skip']);
  });
});

describe('normalising a phone number', () => {
  it('accepts the forms a real list contains', () => {
    expect(normalisePhone('9876543210')).toBe('9876543210');
    expect(normalisePhone('+91 98765 43210')).toBe('9876543210');
    expect(normalisePhone('091-98765-43210')).toBe('9876543210');
    expect(normalisePhone('098765 43210')).toBe('9876543210');
    expect(normalisePhone('  9876543210  ')).toBe('9876543210');
  });

  it('handles Excel storing the number as a number', () => {
    expect(normalisePhone('9876543210.0')).toBe('9876543210');
  });

  it('takes the first when a cell holds two', () => {
    expect(normalisePhone('9876543210 / 9123456789')).toBe('9876543210');
    expect(normalisePhone('9876543210, 9123456789')).toBe('9876543210');
  });

  it('returns null rather than a wrong number', () => {
    expect(normalisePhone('')).toBeNull();
    expect(normalisePhone('n/a')).toBeNull();
    expect(normalisePhone('12345')).toBeNull();
  });

  it('refuses a landline', () => {
    // This one bit. `020 4000 0000` is eleven digits; strip the trunk zero and
    // it is a perfectly well-formed ten, so it imported as the mobile number
    // 2040000000 — uncallable, and invisible in the list because it looks
    // right. Indian mobiles start 6–9; landline STD codes do not.
    expect(normalisePhone('020 4000 0000')).toBeNull();
    expect(normalisePhone('2040000000')).toBeNull();
    expect(normalisePhone('+91 20 4000 0000')).toBeNull();
  });

  it('peels a trunk zero and a country code together', () => {
    // Wrong, and common: somebody typed the STD habit in front of the
    // international one. Thirteen digits, and matching on fixed lengths
    // missed it entirely.
    expect(normalisePhone('091-98765-43210')).toBe('9876543210');
    expect(normalisePhone('0919876543210')).toBe('9876543210');
  });

  it('does not peel a prefix off a number that is already ten digits', () => {
    // 91… is a real mobile prefix as well as the country code. Peeling by
    // pattern rather than by length would turn this into a 8-digit nothing.
    expect(normalisePhone('9198765432')).toBe('9198765432');
  });

  it('strips the country code so duplicates can actually be found', () => {
    // This is the whole point. A list where half the rows carry +91 has no
    // duplicates at all as far as `WHERE phone =` is concerned.
    expect(normalisePhone('+919876543210')).toBe(normalisePhone('9876543210'));
  });
});

describe('tidying a name', () => {
  it('title-cases a list typed entirely in capitals', () => {
    expect(tidyName('ASHA PATIL')).toBe('Asha Patil');
    expect(tidyName('mr. ravi kumar')).toBe('Mr. Ravi Kumar');
  });

  it('leaves a name that was typed properly alone', () => {
    expect(tidyName('Asha Patil')).toBe('Asha Patil');
    expect(tidyName('Shruti D’Souza')).toBe('Shruti D’Souza');
  });

  it('collapses the whitespace of a copy-paste', () => {
    expect(tidyName('  Asha   Patil ')).toBe('Asha Patil');
  });
});

describe('the import plan', () => {
  const MAPPING: ColumnKey[] = ['name', 'phone', 'society', 'skip'];
  const rows = [
    ['Name', 'Mobile', 'Society', 'Sr'],
    ['ASHA PATIL', '+91 98765 43210', 'Lodha Panache', '1'],
    ['RAVI KUMAR', '9123456789', 'Ganga Legend', '2'],
    ['', '9000000000', 'Nowhere', '3'],
    ['ASHA P', '98765 43210', 'Lodha Panache', '4'],
  ];

  it('reports what it will do before it does anything', () => {
    const plan = planImport(rows, MAPPING);

    expect(plan.read).toBe(4);
    expect(plan.rows).toHaveLength(2);
    expect(plan.skippedNoName).toBe(1);
    expect(plan.duplicatesInFile).toBe(1);
  });

  it('normalises as it goes', () => {
    const plan = planImport(rows, MAPPING);
    expect(plan.rows[0]).toEqual({
      name: 'Asha Patil',
      phone: '9876543210',
      email: null,
      society: 'Lodha Panache',
      locality: null,
      config: null,
      notes: null,
    });
  });

  it('catches the duplicate written a different way', () => {
    // Row 4 is the same number as row 1 with a space in it. Without
    // normalising first, this is two clients.
    const plan = planImport(rows, MAPPING);
    expect(plan.rows.map((r) => r.name)).toEqual(['Asha Patil', 'Ravi Kumar']);
  });

  it('keeps a row with no phone at all', () => {
    // A walk-in with a name and a society and no number is still a lead. It
    // just cannot be deduplicated.
    const plan = planImport(
      [['Name', 'Mobile'], ['Asha', ''], ['Ravi', '']],
      ['name', 'phone'],
    );
    expect(plan.rows).toHaveLength(2);
    expect(plan.rows.every((r) => r.phone === null)).toBe(true);
  });

  it('ignores a column mapped to skip', () => {
    const plan = planImport(rows, MAPPING);
    expect(Object.values(plan.rows[0]!)).not.toContain('1');
  });
});

describe('looksDestroyed', () => {
  /**
   * Excel stores a phone column as numbers, so 9876543210 becomes
   * 9.87654E+09 — six significant digits, and the rest are gone from the
   * FILE. There is nothing to recover.
   *
   * Without this, normalisePhone correctly returns null and the row counts as
   * "no phone", which reads as an incomplete record rather than a broken one.
   * A studio told two hundred rows imported, eighty of them silently
   * phoneless, has a list they cannot ring and no reason why.
   */
  it('recognises what Excel did', () => {
    expect(looksDestroyed('9.87654E+09')).toBe(true);
    expect(looksDestroyed('9.88e+9')).toBe(true);
    expect(looksDestroyed('9.88E09')).toBe(true);
  });

  it('leaves the recoverable case alone', () => {
    /* `9876543210.0` still HAS its digits, and normalisePhone handles it.
       Flagging it would send somebody back to a file that is fine. */
    expect(looksDestroyed('9876543210.0')).toBe(false);
    expect(normalisePhone('9876543210.0')).toBe('9876543210');
  });

  it('is not tripped by ordinary cells', () => {
    expect(looksDestroyed('9876543210')).toBe(false);
    expect(looksDestroyed('')).toBe(false);
    expect(looksDestroyed('call his office')).toBe(false);
  });
});

describe('planImport counts the damage separately', () => {
  it('tells a destroyed number apart from a missing one', () => {
    const plan = planImport(
      [
        ['Name', 'Phone'],
        ['Anita', '9.87654E+09'],
        ['Ravi', '9876543210'],
        ['Meera', ''],
      ],
      ['name', 'phone'],
    );

    expect(plan.mangledPhones).toBe(1);
    /* Meera is not damage — she is a row somebody left blank. */
    expect(plan.read).toBe(3);
    /* The row still imports. A studio would rather have the name and ring
       round for the number than lose the lead entirely. */
    expect(plan.rows).toHaveLength(3);
    expect(plan.rows[0]?.phone).toBeNull();
    expect(plan.rows[1]?.phone).toBe('9876543210');
  });
});
