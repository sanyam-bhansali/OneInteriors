/**
 * An Excel quotation, as rows of text the archive reader can send.
 *
 * Most Pune studios quote in Excel — the owner's own archive is mostly
 * workbooks — and the reader skipped every one of them: the API reads PDFs
 * and images, not workbooks, so a studio who sent sixty .xlsx files heard
 * "goes to ops by hand" sixty times. Here a workbook becomes plain rows,
 * one sheet after another, tab-separated, and goes to the same reader under
 * the same rules as a PDF.
 *
 * ## Why this reads the zip itself
 *
 * An .xlsx is a zip of XML files, and the three it needs (the workbook, the
 * shared strings, the sheets) are plain deflate — which Node's zlib already
 * does. A spreadsheet library would be a large dependency for a job this
 * narrow, and one more thing parsing untrusted uploads. The reader here does
 * only what is needed, and caps what it will inflate, so a zip bomb uploaded
 * as a "quotation" costs a refused file rather than the function's memory.
 *
 * .xls (the pre-2007 binary format) is not read; it still goes to ops by hand.
 *
 * Pure apart from zlib, and tested with workbooks built in the test.
 */

import { inflateRawSync } from 'node:zlib';

/** The most we will inflate from one workbook. A quotation is kilobytes. */
const MAX_INFLATED_BYTES = 24 * 1024 * 1024;
/** Enough rows for any quotation; a workbook past this is not one. */
const MAX_ROWS = 3000;
/** What we send per workbook — roughly a long multi-sheet quotation. */
export const MAX_WORKBOOK_CHARS = 120_000;

// ── The zip ──────────────────────────────────────────────────────

/** The entries of a zip whose names pass `wanted`, inflated — or null if it is not a zip we can read. */
export function unzip(buf: Buffer, wanted: (name: string) => boolean): Map<string, Buffer> | null {
  // The end-of-central-directory record: in the last 64 KB + 22 bytes.
  const floor = Math.max(0, buf.length - 65_557);
  let eocd = -1;
  for (let i = buf.length - 22; i >= floor; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;

  const count = buf.readUInt16LE(eocd + 10);
  let at = buf.readUInt32LE(eocd + 16);
  const out = new Map<string, Buffer>();
  let inflated = 0;

  for (let n = 0; n < count; n++) {
    if (at + 46 > buf.length || buf.readUInt32LE(at) !== 0x02014b50) return null;
    const method = buf.readUInt16LE(at + 10);
    const compressed = buf.readUInt32LE(at + 20);
    const size = buf.readUInt32LE(at + 24);
    const nameLen = buf.readUInt16LE(at + 28);
    const extraLen = buf.readUInt16LE(at + 30);
    const commentLen = buf.readUInt16LE(at + 32);
    const local = buf.readUInt32LE(at + 42);
    const name = buf.toString('utf8', at + 46, at + 46 + nameLen);
    at += 46 + nameLen + extraLen + commentLen;

    if (!wanted(name)) continue;
    if (local + 30 > buf.length || buf.readUInt32LE(local) !== 0x04034b50) return null;
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + compressed);
    if (data.length !== compressed) return null;

    inflated += size;
    if (inflated > MAX_INFLATED_BYTES) return null;
    try {
      if (method === 0) out.set(name, Buffer.from(data));
      else if (method === 8) out.set(name, inflateRawSync(data, { maxOutputLength: MAX_INFLATED_BYTES }));
      else return null;
    } catch {
      return null;
    }
  }
  return out;
}

// ── The XML ──────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function decodeXml(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    }
    return ENTITIES[e.toLowerCase()] ?? '';
  });
}

/** Every <t> inside a fragment, joined — rich text is split into runs. */
function textOf(fragment: string): string {
  let out = '';
  for (const m of fragment.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) out += m[1];
  return decodeXml(out);
}

function sharedStrings(xml: string | undefined): string[] {
  if (!xml) return [];
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]!));
}

/** "AB12" → 27 (zero-based column). */
function columnOf(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, '').toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function sheetRows(xml: string, strings: string[]): string[][] {
  const rows: string[][] = [];
  for (const row of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    if (rows.length >= MAX_ROWS) break;
    const cells: string[] = [];
    for (const c of row[1]!.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1] ?? '';
      const body = c[2] ?? '';
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
      const type = attrs.match(/\bt="(\w+)"/)?.[1];
      const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let value = '';
      if (type === 's' && v !== undefined) value = strings[Number(v)] ?? '';
      else if (type === 'inlineStr') value = textOf(body);
      else if (type === 'b') value = v === '1' ? 'TRUE' : 'FALSE';
      else if (v !== undefined) value = decodeXml(v);
      const col = ref ? columnOf(ref) : cells.length;
      if (col < 0 || col > 200) continue;
      while (cells.length < col) cells.push('');
      cells[col] = value.replace(/\s+/g, ' ').trim();
    }
    if (cells.some((c) => c !== '')) rows.push(cells);
  }
  return rows;
}

export interface Sheet {
  name: string;
  rows: string[][];
}

/** The sheets of an .xlsx / .xlsm, in workbook order — or null if it cannot be read. */
export function readWorkbook(buf: Buffer): Sheet[] | null {
  const files = unzip(buf, (n) => (n.startsWith('xl/') && n.endsWith('.xml')) || n.endsWith('.rels'));
  if (!files) return null;
  const text = (name: string) => files.get(name)?.toString('utf8');

  const workbook = text('xl/workbook.xml');
  if (!workbook) return null;
  const rels = text('xl/_rels/workbook.xml.rels') ?? '';
  const target = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const id = m[1]!.match(/\bId="([^"]+)"/)?.[1];
    const t = m[1]!.match(/\bTarget="([^"]+)"/)?.[1];
    if (id && t) target.set(id, t.startsWith('/') ? t.slice(1) : `xl/${t.replace(/^\.\//, '')}`);
  }
  const strings = sharedStrings(text('xl/sharedStrings.xml'));

  const sheets: Sheet[] = [];
  for (const m of workbook.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const name = decodeXml(m[1]!.match(/\bname="([^"]*)"/)?.[1] ?? 'Sheet');
    const rid = m[1]!.match(/\br:id="([^"]+)"/)?.[1];
    const path = rid ? target.get(rid) : undefined;
    const xml = path ? text(path) : undefined;
    if (!xml) continue;
    const rows = sheetRows(xml, strings);
    if (rows.length > 0) sheets.push({ name, rows });
  }
  return sheets;
}

/**
 * The workbook as the reader sees it: each sheet named, each row one line,
 * cells separated by " | " so an empty cell is still visible as a column.
 * Cut at `MAX_WORKBOOK_CHARS`, and says so, rather than silently.
 */
export function workbookText(sheets: Sheet[]): string {
  const lines: string[] = [];
  for (const sheet of sheets) {
    lines.push(`## Sheet: ${sheet.name}`);
    for (const row of sheet.rows) lines.push(row.join(' | '));
    lines.push('');
  }
  const all = lines.join('\n');
  return all.length <= MAX_WORKBOOK_CHARS
    ? all
    : `${all.slice(0, MAX_WORKBOOK_CHARS)}\n[Cut here — the workbook is longer than we send in one piece.]`;
}

/** What kind of spreadsheet a file is, by type or — for octet-stream — by name. */
export function spreadsheetKind(contentType: string, filename: string): 'xlsx' | 'csv' | null {
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  if (
    contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    contentType === 'application/vnd.ms-excel.sheet.macroEnabled.12' ||
    ext === 'xlsx' ||
    ext === 'xlsm'
  ) {
    return 'xlsx';
  }
  if (contentType === 'text/csv' || ext === 'csv') return 'csv';
  return null;
}
