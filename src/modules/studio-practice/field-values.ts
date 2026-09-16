/**
 * Reading and writing the values behind a studio's custom fields.
 *
 * Pure, no `server-only` — CONTRIBUTING §9.5. The client components render
 * these values and the server validates them, so it has to be importable from
 * both sides.
 *
 * ## Why the values are JSON and not a table
 *
 * The obvious relational shape is a `studio_client_field_values` table with a
 * row per client per field. It is also four joins and a pivot every time
 * anybody opens the client list, to store what is in practice a handful of
 * short strings per row.
 *
 * The values are never aggregated across studios, never queried on their own,
 * and always read as part of the client they belong to. So: one jsonb column,
 * keyed by the field's stable `key`, validated on write against the
 * definitions. If grouping ever needs an index, jsonb takes one.
 *
 * ## The one rule
 *
 * A value is only ever written under a key that currently exists in
 * `studio_fields`. Without that, deleting a field would leave values behind
 * that reappear if a field with the same key is created later, carrying data
 * the studio believed it had removed.
 */

import type { FieldTypeName } from './vocabulary';

export interface FieldShape {
  key: string;
  label: string;
  type: FieldTypeName;
  options: string[];
}

/** What a client's `fields` column holds. Absent and empty are the same thing. */
export type FieldValues = Record<string, string>;

export function readValues(raw: unknown): FieldValues {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: FieldValues = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string' && v.length > 0) out[k] = v;
    else if (typeof v === 'number') out[k] = String(v);
  }
  return out;
}

export interface ValueProblem {
  key: string;
  label: string;
  message: string;
}

/**
 * Clean a submitted set of values against the definitions.
 *
 * Returns what should be stored and what the studio got wrong. Unknown keys are
 * dropped silently rather than reported: they arrive from a stale form after a
 * field was deleted in another tab, which is not the person's mistake and not
 * worth a sentence.
 */
export function cleanValues(
  fields: FieldShape[],
  submitted: Record<string, string>,
): { values: FieldValues; problems: ValueProblem[] } {
  const values: FieldValues = {};
  const problems: ValueProblem[] = [];

  for (const field of fields) {
    const raw = (submitted[field.key] ?? '').trim();
    if (raw.length === 0) continue;

    if (field.type === 'NUMBER') {
      // Indian typists put commas in: 1,250. Strip them before deciding.
      const cleaned = raw.replace(/,/g, '');
      if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
        problems.push({ key: field.key, label: field.label, message: 'has to be a number' });
        continue;
      }
      values[field.key] = cleaned;
      continue;
    }

    if (field.type === 'DATE') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw))) {
        problems.push({ key: field.key, label: field.label, message: 'has to be a date' });
        continue;
      }
      values[field.key] = raw;
      continue;
    }

    if (field.type === 'SELECT') {
      if (field.options.length > 0 && !field.options.includes(raw)) {
        problems.push({ key: field.key, label: field.label, message: 'is not one of the choices' });
        continue;
      }
      values[field.key] = raw;
      continue;
    }

    values[field.key] = raw.slice(0, 200);
  }

  return { values, problems };
}

/** The sentence shown when a submission has problems. */
export function problemSentence(problems: ValueProblem[]): string {
  if (problems.length === 1) {
    const p = problems[0]!;
    return `${p.label} ${p.message}.`;
  }
  return problems.map((p) => `${p.label} ${p.message}`).join('; ') + '.';
}

/**
 * Group clients by one field's value.
 *
 * Blanks go into their own bucket at the end rather than being dropped — a
 * studio grouping by society wants to see how many they never recorded one
 * for, because that number is the argument for recording it.
 */
export function groupBy<T extends { fields: FieldValues }>(
  rows: T[],
  key: string,
  blankLabel = 'Not set',
): { label: string; rows: T[] }[] {
  const buckets = new Map<string, T[]>();

  for (const row of rows) {
    const value = row.fields[key]?.trim() || '';
    const label = value.length > 0 ? value : blankLabel;
    const bucket = buckets.get(label);
    if (bucket) bucket.push(row);
    else buckets.set(label, [row]);
  }

  return [...buckets.entries()]
    .map(([label, rows]) => ({ label, rows }))
    .sort((a, b) => {
      if (a.label === blankLabel) return 1;
      if (b.label === blankLabel) return -1;
      return b.rows.length - a.rows.length || a.label.localeCompare(b.label);
    });
}
