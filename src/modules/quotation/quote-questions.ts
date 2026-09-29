/**
 * "Ask your quote" (build queue item 24): a homeowner's own question about
 * their quotes — "Why is Akara's kitchen ₹60,000 more?" — answered only from
 * their numbers. These are the facts the answer may use, line by line, and
 * the figures it may state; anything else sends it back (compare-summary.ts).
 *
 * Pure, and tested.
 */

import { formatINRCompact } from '@/lib/money';
import { allowedFigures, compareFacts, type Entry } from './compare-insights';

export const QUESTION_MAX = 300;

/** A question as asked: trimmed, one line, capped. Null when there is nothing to ask. */
export function cleanQuestion(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const q = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, QUESTION_MAX);
  return q.length >= 5 ? q : null;
}

export interface LineRow {
  room: string;
  label: string;
  code: string;
  cells: { name: string; amountPaise: number | null; size: string | null; spec: string | null }[];
}

/** Every line on any of the quotes, each with what every studio quoted for it. */
export function lineRows(entries: Entry[]): LineRow[] {
  const rows = new Map<string, LineRow>();
  for (const e of entries) {
    for (const room of e.quote.rooms) {
      for (const l of room.lines) {
        if (!rows.has(l.code)) rows.set(l.code, { room: room.label, label: l.label, code: l.code, cells: [] });
      }
    }
  }
  for (const row of rows.values()) {
    row.cells = entries.map((e) => {
      const l = e.quote.lines.find((x) => x.code === row.code);
      return { name: e.name, amountPaise: l?.amountPaise ?? null, size: l?.size ?? null, spec: l?.spec ?? null };
    });
  }
  return [...rows.values()];
}

/** The facts for a question: the comparison, then every line. Never a per-square-foot rate. */
export function askFacts(entries: Entry[], question: string): string {
  const lines = lineRows(entries).map(
    (r) =>
      `- ${r.room} · ${r.label}: ` +
      r.cells
        .map((c) => (c.amountPaise === null ? `${c.name} not quoted` : `${c.name} ${formatINRCompact(c.amountPaise)} (${c.size ?? ''}; ${c.spec ?? 'no spec'})`))
        .join('; '),
  );
  return [compareFacts(entries), '', 'Every line, each studio (same sizes for all):', ...lines, '', `The homeowner asks: ${question}`].join('\n');
}

/** Figures an answer may state: the comparison's, every line's, and the gaps between the same line. */
export function askAllowed(entries: Entry[]): { paise: number[]; percents: number[] } {
  const base = allowedFigures(entries);
  const paise = [...base.paise];
  for (const r of lineRows(entries)) {
    const vals = r.cells.map((c) => c.amountPaise).filter((v): v is number => v !== null);
    paise.push(...vals);
    for (const a of vals) for (const b of vals) if (a > b) paise.push(a - b);
  }
  return { paise, percents: base.percents };
}
