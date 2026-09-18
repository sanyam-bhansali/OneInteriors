/**
 * Reading a studio's existing lead list.
 *
 * Pure, and deliberately with NO `server-only` — CONTRIBUTING §9.5. Everything
 * that can go wrong with an import goes wrong in here, so this is the half
 * that has to be testable.
 *
 * ## Why not a CSV library
 *
 * Because the hard part of this is not the parsing. It is that the file came
 * out of somebody's Excel, in India, maintained by three people over two
 * years. It has a merged title row, phone numbers stored as numbers so the
 * leading zero is gone, ₹ signs in the budget column, "9876543210 / 9123456789"
 * in one cell, and a column called "Client Name " with a trailing space.
 *
 * A library parses that file perfectly and hands you the same mess. The work
 * is in the normalising below, which no library does for you.
 *
 * The parser here handles quoted fields, escaped quotes and newlines inside
 * quotes — which is the whole of RFC 4180 that real files use.
 */

import type { ClientSourceName } from './vocabulary';

// ── Parsing ────────────────────────────────────────────────────

/**
 * Split CSV text into rows of cells.
 *
 * Handles `"` quoting, `""` escapes, and commas and newlines inside quotes.
 * Strips a UTF-8 BOM, which Excel writes on every export and which otherwise
 * turns the first header into `﻿Name` and quietly fails to match.
 */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];

    if (quoted) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') {
      cell += ch;
    }
  }

  // Whatever is in hand at the end is a row, unless the file ended on a
  // newline and left nothing behind.
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

// ── Column mapping ─────────────────────────────────────────────

export type ColumnKey =
  | 'name' | 'phone' | 'email' | 'society' | 'locality' | 'config' | 'notes' | 'skip';

export const COLUMN_LABELS: Record<ColumnKey, string> = {
  name: 'Name',
  phone: 'Phone',
  email: 'Email',
  society: 'Society or area',
  locality: 'Locality',
  config: 'Config',
  notes: 'Notes',
  skip: 'Do not import',
};

/**
 * What a header is probably for.
 *
 * A guess, always shown to the person before anything is written, and always
 * changeable. Guessing wrong is fine; guessing silently is not, which is why
 * the mapping screen shows every column and the first three rows under it.
 */
const HINTS: [ColumnKey, RegExp][] = [
  ['name', /^(client\s*)?(full\s*)?name$|^customer|^lead\s*name|^party/i],
  ['phone', /phone|mobile|contact\s*(no|number)|whats\s*app|^no\.?$/i],
  ['email', /e-?mail/i],
  ['society', /society|building|project|apartment|complex|tower/i],
  ['locality', /locality|area|location|region|city|sector/i],
  ['config', /bhk|config|type|flat\s*type|property/i],
  ['notes', /note|remark|comment|description|detail/i],
];

export function guessColumn(header: string): ColumnKey {
  const h = header.trim();
  if (h.length === 0) return 'skip';
  for (const [key, pattern] of HINTS) {
    if (pattern.test(h)) return key;
  }
  return 'skip';
}

export function guessMapping(headers: string[]): ColumnKey[] {
  const guesses = headers.map(guessColumn);

  // One column per field. A sheet with "Name" and "Client Name" would
  // otherwise map both, and the second silently wins.
  const seen = new Set<ColumnKey>();
  return guesses.map((g) => {
    if (g === 'skip') return g;
    if (seen.has(g)) return 'skip';
    seen.add(g);
    return g;
  });
}

// ── Normalising ────────────────────────────────────────────────

/**
 * An Indian mobile number, or null.
 *
 * The cases this actually meets, in order of how often:
 *
 *   9876543210            plain
 *   +91 98765 43210       with country code and spaces
 *   098765 43210          with the trunk zero
 *   9876543210.0          Excel stored it as a number
 *   9876543210 / 9123…    two numbers in one cell — first one wins
 *   91-9876543210         dashes
 *   091-98765-43210       trunk zero AND country code, which is wrong but common
 *
 * Returns ten digits with no prefix, because that is what is comparable. A
 * list where half the numbers carry +91 and half do not has no duplicates in
 * it as far as any `WHERE phone =` is concerned.
 *
 * ## Why the leading digit is checked
 *
 * Indian mobile numbers start 6, 7, 8 or 9. Landlines do not: a Pune landline
 * is `020` plus eight digits, which is eleven with the trunk zero and a
 * perfectly good ten once you strip it. Without this check `020 4000 0000`
 * imports as the mobile number 2040000000 — a number that can never be
 * called, never receives the WhatsApp the whole follow-up depends on, and
 * looks entirely valid in the list. Better to leave the phone blank and let
 * somebody type it.
 */
export function normalisePhone(raw: string): string | null {
  const first = raw.split(/[/,;|]/)[0] ?? '';
  const all = first.replace(/\D/g, '');
  if (all.length === 0) return null;

  // Excel's ".0" leaves a trailing zero on an 11-digit string.
  let digits = all.length === 11 && first.includes('.') ? all.slice(0, 10) : all;

  // Peel prefixes rather than matching fixed lengths, because they combine:
  // `091-98765-43210` carries both a trunk zero and a country code. Only ever
  // peel while there is something left over — a plain `9876543210` starts
  // with 9 and must not lose one.
  while (digits.length > 10) {
    if (digits.startsWith('0')) digits = digits.slice(1);
    else if (digits.startsWith('91')) digits = digits.slice(2);
    else break;
  }

  if (digits.length !== 10) return null;
  if (!/^[6-9]/.test(digits)) return null;

  return digits;
}

/** Title Case, for lists typed entirely in capitals — which is most of them. */
export function tidyName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length === 0) return '';
  if (name !== name.toUpperCase() && name !== name.toLowerCase()) return name;

  return name
    .toLowerCase()
    .replace(/(^|[\s.'-])([a-z])/g, (_, before: string, ch: string) => before + ch.toUpperCase());
}

// ── Turning rows into clients ──────────────────────────────────

export interface ImportRow {
  name: string;
  phone: string | null;
  email: string | null;
  society: string | null;
  locality: string | null;
  config: string | null;
  notes: string | null;
}

export interface ImportPlan {
  /** Rows that will be written. */
  rows: ImportRow[];
  /** Rows with no usable name — skipped, and counted so nobody is surprised. */
  skippedNoName: number;
  /** Rows whose phone matched another row in the same file. */
  duplicatesInFile: number;
  /** Total data rows read, excluding the header. */
  read: number;
}

/**
 * Build what will be written, without writing it.
 *
 * Separate from the write on purpose: the screen shows this plan, the person
 * agrees with it, and only then does anything touch the database. An import
 * that reports what it did afterwards is an import nobody trusts the second
 * time.
 */
export function planImport(rows: string[][], mapping: ColumnKey[]): ImportPlan {
  const [, ...body] = rows;
  const plan: ImportPlan = { rows: [], skippedNoName: 0, duplicatesInFile: 0, read: body.length };

  const seenPhones = new Set<string>();

  for (const row of body) {
    const pick = (key: ColumnKey): string => {
      const i = mapping.indexOf(key);
      return i >= 0 ? (row[i] ?? '').trim() : '';
    };

    const name = tidyName(pick('name'));
    if (name.length < 2) {
      plan.skippedNoName += 1;
      continue;
    }

    const phone = normalisePhone(pick('phone'));

    // Within the file only. Matching against what is already in the database
    // happens at write time, where the rows to compare against actually are.
    if (phone && seenPhones.has(phone)) {
      plan.duplicatesInFile += 1;
      continue;
    }
    if (phone) seenPhones.add(phone);

    const value = (key: ColumnKey) => {
      const v = pick(key);
      return v.length > 0 ? v.slice(0, 200) : null;
    };

    plan.rows.push({
      name: name.slice(0, 120),
      phone,
      email: value('email'),
      society: value('society'),
      locality: value('locality'),
      config: value('config'),
      notes: value('notes'),
    });
  }

  return plan;
}

/** Every imported row carries this, so an import can always be told apart later. */
export const IMPORT_SOURCE: ClientSourceName = 'OTHER';
export const IMPORT_NOTE = 'Imported from a spreadsheet';
