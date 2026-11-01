/**
 * Hauspire's list of running design projects (owner, 30 Oct 2026: "Project
 * list for new app.xlsx", 32 rows: client, designer, stage, quotation
 * format), read before anything is brought in. Pure;
 * tests/bring-in-sheet.test.ts.
 *
 * None of the 32 is on the software yet, and the sheet holds names only: no
 * mobile, no flat, no quotation number. So the first pass only LOOKS: which
 * lead on the board each name could be (from the AxLeads move), which of
 * our quotations (imported from the Hauspire quotation app or built here)
 * carries the name, and which team member the designer is. The team then
 * fills only what is missing, and nothing is written until they have.
 *
 * ## The stage, in the new design steps
 *
 * The sheet's stages are the old tracker's words. The owner approved this
 * mapping on 30 Oct 2026 — each names the new step the project is AT now
 * (the step being worked on), so every step before it is done:
 *
 * | Sheet                | New step (studio-design/template.ts)      |
 * |----------------------|-------------------------------------------|
 * | Project allocation   | Project allocation + mood board           |
 * | Furniture layout     | 2D layout (folded into 2D, 24 Oct)        |
 * | FD                   | First draft (3D)                          |
 * | Design changes       | Design changes                            |
 * | Material selection   | Material selection                        |
 * | Design closer        | Final 3D & renders (old tracker: before the final quotation) |
 * | Revised quotation    | Post-quotation changes                    |
 * | wd                   | Working drawings                          |
 * | Documentation        | Final documentation for handover          |
 *
 * ## Quotation format
 *
 * "old" = the quotation was made in Excel, so there is nothing to read it
 * from; "new" = it was made in the Hauspire quotation app (owner, 30 Oct).
 */

import { textKey } from './hauspire-import-plan';

export type QuoteFormat = 'EXCEL' | 'HAUSPIRE_APP';

export interface SheetRow {
  /** The row's line in the sheet (1-based, the header is line 1), for the report. */
  line: number;
  client: string;
  designer: string;
  stage: string;
  format: QuoteFormat;
  /** The quotation it runs on, from an optional "Quote no" column ("2475", "XL-AMIT"); null when blank or no such column. */
  quoteNo: string | null;
  /** The project's start, as the sheet writes it ("28-Dec"), from an optional "Date" column (owner, 1 Nov 2026); read by start-dates.ts. */
  date?: string | null;
}

/** The sheet's stage (as `stageKey` reads it) → the new step the project is at. */
export const STAGE_TO_STEP: Readonly<Record<string, string>> = {
  'project allocation': 'Project allocation + mood board',
  'furniture layout': '2D layout',
  fd: 'First draft (3D)',
  'first draft': 'First draft (3D)',
  'design changes': 'Design changes',
  'material selection': 'Material selection',
  'design closer': 'Final 3D & renders',
  'design closure': 'Final 3D & renders',
  'revised quotation': 'Post-quotation changes',
  wd: 'Working drawings',
  'working drawings': 'Working drawings',
  documentation: 'Final documentation for handover',
};

export const stageKey = (raw: string): string => textKey(raw);

/** The new step for a sheet stage, or null when the sheet uses a word the mapping does not know. */
export const stepFor = (stage: string): string | null => STAGE_TO_STEP[stageKey(stage)] ?? null;

/** Honorifics the sheet puts after a name ("Rohit sir", "Monica Mam"). */
const TRAILING_TITLES = new Set(['sir', 'mam', 'maam', 'madam', 'ji', 'saheb', 'sahab']);

/** A client's name compared without case, punctuation or a title before or after it. */
export function personKey(raw: string | null | undefined): string {
  const words = textKey(raw).split(' ').filter(Boolean);
  while (words.length > 1 && TRAILING_TITLES.has(words.at(-1)!)) words.pop();
  return words.join(' ');
}

// ── Reading the sheet ──────────────────────────────────────────

/** One CSV line into cells: commas, double quotes around a cell, "" inside one. */
function cells(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

export type SheetRead = { ok: true; rows: SheetRow[]; problems: string[] } | { ok: false; error: string };

/**
 * The sheet saved as CSV. The header row is found by its words (Client,
 * Designer, Stage, Quotation format), wherever it is, so blank rows and a
 * title above it, and blank columns before it, are fine — that is how the
 * owner's sheet is laid out. A row with a client but a stage or format the
 * rules do not know is a problem to report, not a row to guess at.
 */
export function readSheet(csv: string): SheetRead {
  const lines = csv.replace(/^﻿/, '').split(/\r?\n/);
  let header = -1;
  let col = { client: -1, designer: -1, stage: -1, format: -1, quote: -1, date: -1 };
  for (let i = 0; i < lines.length && header < 0; i++) {
    const keys = cells(lines[i]!).map((c) => textKey(c));
    const at = (pred: (k: string) => boolean) => keys.findIndex(pred);
    const c = { client: at((k) => k === 'client'), designer: at((k) => k === 'designer'), stage: at((k) => k === 'stage'), format: at((k) => k.startsWith('quotation')), quote: at((k) => k === 'quote no' || k === 'app quote no'), date: at((k) => k === 'date' || k === 'start date') };
    if (c.client >= 0 && c.designer >= 0 && c.stage >= 0 && c.format >= 0) {
      header = i;
      col = c;
    }
  }
  if (header < 0) return { ok: false, error: 'No header row with Client, Designer, Stage and Quotation format was found.' };

  const rows: SheetRow[] = [];
  const problems: string[] = [];
  for (let i = header + 1; i < lines.length; i++) {
    const c = cells(lines[i]!);
    const client = (c[col.client] ?? '').replace(/\s+/g, ' ');
    if (!client) continue;
    const designer = (c[col.designer] ?? '').replace(/\s+/g, ' ');
    const stage = (c[col.stage] ?? '').replace(/\s+/g, ' ');
    const fmt = textKey(c[col.format]);
    const line = i + 1;
    if (!stepFor(stage)) problems.push(`line ${line} (${client}): stage "${stage}" is not in the mapping`);
    const format: QuoteFormat | null = fmt === 'old' ? 'EXCEL' : fmt === 'new' ? 'HAUSPIRE_APP' : null;
    if (!format) problems.push(`line ${line} (${client}): quotation format "${c[col.format] ?? ''}" is neither old nor new`);
    if (!designer) problems.push(`line ${line} (${client}): no designer`);
    const quoteNo = col.quote >= 0 ? (c[col.quote] ?? '').trim() || null : null;
    rows.push({ line, client, designer, stage, format: format ?? 'EXCEL', quoteNo, ...(col.date >= 0 ? { date: (c[col.date] ?? '').trim() || null } : {}) });
  }
  const seen = new Map<string, number>();
  for (const r of rows) {
    const k = personKey(r.client);
    const first = seen.get(k);
    if (first !== undefined) problems.push(`line ${r.line} (${r.client}): the same name as line ${first}`);
    else seen.set(k, r.line);
  }
  return { ok: true, rows, problems };
}

// ── Matching a name ────────────────────────────────────────────

export type NameMatch = 'exact' | 'contains';

/**
 * How well a name on the board answers a name on the sheet: `exact` when
 * they are the same name; `contains` when every word of the sheet's name is
 * a word of the board's ("Monica" → "Monica Sharma", "Sominath" → "Sominath
 * Kale"); null otherwise. The sheet often gives a first name only, so
 * `contains` is expected — and why a person confirms every match.
 */
export function nameMatch(sheet: string, board: string | null | undefined): NameMatch | null {
  const a = personKey(sheet);
  const b = personKey(board);
  if (!a || !b) return null;
  if (a === b) return 'exact';
  const words = new Set(b.split(' '));
  return a.split(' ').every((w) => words.has(w)) ? 'contains' : null;
}

export interface Candidate<T> {
  item: T;
  how: NameMatch;
}

/**
 * The board's rows that could be this name; at most `max`, and how many
 * there were in all. Ordered by `rank` (lower first; e.g. a lead in a WON
 * column before the rest), then exact names before partial ones.
 */
export function candidates<T>(
  sheetName: string,
  items: readonly T[],
  nameOf: (t: T) => string | null | undefined,
  max = 5,
  rank: (t: T) => number = () => 0,
): { shown: Candidate<T>[]; total: number } {
  const hits: Candidate<T>[] = [];
  for (const item of items) {
    const how = nameMatch(sheetName, nameOf(item));
    if (how) hits.push({ item, how });
  }
  hits.sort((x, y) => rank(x.item) - rank(y.item) || (x.how === y.how ? 0 : x.how === 'exact' ? -1 : 1));
  return { shown: hits.slice(0, max), total: hits.length };
}

// ── Proposing the one lead ─────────────────────────────────────

/** A lead the name could be, with what the proposal reads. */
export interface LeadFact {
  id: string;
  how: NameMatch;
  /** In a WON column ("Converted" at Hauspire): AxLeads' mark of a booked client. */
  won: boolean;
  /** Can be brought in: not in the bin, not booked through One Interiors. */
  usable: boolean;
}

export type LeadProposal =
  | { id: string; why: 'quotation' | 'converted' | 'only' }
  | { id: null; why: 'none' | 'pick'; among: number };

/**
 * The lead to bring this project in on, or why a person must pick. A
 * proposal, never a decision: the report shows it and the team confirms
 * (owner, 12 Oct 2026: "easy, not automatic"). In order:
 *
 * 1. **quotation** — the quotations carrying this name are all on one usable
 *    lead (the Hauspire-app import put each quotation on its lead).
 * 2. **converted** — exactly one usable candidate sits in a WON column.
 * 3. **only** — exactly one candidate at all, usable, and an exact name.
 *
 * A lone partial name ("Abhinn" → "Abhinn Aadesh") is not proposed on its
 * own: a first name says too little.
 */
export function proposeLead(leads: readonly LeadFact[], quotedLeadIds: readonly (string | null)[]): LeadProposal {
  const usable = leads.filter((l) => l.usable);
  const onQuotes = new Set(quotedLeadIds.filter((id): id is string => Boolean(id)));
  if (onQuotes.size === 1) {
    const [id] = [...onQuotes];
    if (usable.some((l) => l.id === id)) return { id: id!, why: 'quotation' };
  }
  const won = usable.filter((l) => l.won);
  if (won.length === 1) return { id: won[0]!.id, why: 'converted' };
  if (leads.length === 1 && usable.length === 1 && usable[0]!.how === 'exact') return { id: usable[0]!.id, why: 'only' };
  return leads.length === 0 ? { id: null, why: 'none', among: 0 } : { id: null, why: 'pick', among: leads.length };
}

/** A mobile shown as its last four digits: enough to tell two leads apart, not enough to copy out of a pasted report. */
export function maskPhone(raw: string | null | undefined): string {
  const d = String(raw ?? '').replace(/\D/g, '');
  return d.length >= 4 ? `…${d.slice(-4)}` : 'no mobile';
}
