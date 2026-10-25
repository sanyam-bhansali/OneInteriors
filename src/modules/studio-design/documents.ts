/**
 * Project documents (owner and Hauspire's design team, 24 Oct 2026;
 * docs/studio-os/DESIGN-PROCESS-PLAN.md §3): the types, the version numbers,
 * the file names, the final of each, and the handover pack. Pure, and tested
 * (tests/studio-design-documents.test.ts).
 *
 * ## Versions, worked out, never stored
 *
 * A document's chain is its uploads of one type for one room, oldest first
 * (`HomeDocument.version` 1, 2, 3…). The number people read is worked out
 * from the chain and the client's answers: the first upload is 1.0, each
 * upload after it adds .1, and a version the client approved becomes the
 * next whole number (1.2 approved reads 2.0; the next upload is 2.1). So
 * nobody types a version, an approval moves it by itself, and older
 * documents read right with no backfill.
 *
 * ## Names, made, never typed
 *
 * TYPE_Studio_Client_YYYY-MM-DD_HHMM_vX.Y.ext, from the type, the studio's
 * "Name on quotations", the client, the upload's IST moment and the version.
 * A wrong name cannot happen, so none is refused.
 */

import { daysBetween } from '@/modules/project/working-days';

export const DOC_TYPES = {
  LAYOUT_2D: { short: '2D', label: '2D layout', approval: true, offered: true },
  RENDER_3D: { short: '3D', label: '3D & renders', approval: true, offered: true },
  WORKING: { short: 'WD', label: 'Working drawings', approval: true, offered: true },
  ELECTRICAL: { short: 'ELEC', label: 'Electrical drawings & quotation', approval: true, offered: true },
  MATERIAL_LIST: { short: 'MATLIST', label: 'Material list', approval: false, offered: true },
  CUT_LIST: { short: 'CUTLIST', label: 'Factory cut list', approval: false, offered: true },
  SITE_PHOTO: { short: 'PHOTO', label: 'Site photo', approval: false, offered: true },
  /** Before 24 Oct 2026 the furniture layout was its own drawing; now part of the 2D. Read, never offered. */
  FURNITURE: { short: 'FURN', label: 'Furniture layout', approval: true, offered: false },
} as const;
export type DocType = keyof typeof DOC_TYPES;
export const isDocType = (v: unknown): v is DocType => typeof v === 'string' && v in DOC_TYPES;
/** The types offered when uploading, in the order of the work. */
export const OFFERED_TYPES: readonly DocType[] = (Object.keys(DOC_TYPES) as DocType[]).filter((k) => DOC_TYPES[k].offered);

/** The handover pack needs a final of each of these (DESIGN-PROCESS-PLAN.md §3.5). */
export const HANDOVER_REQUIRED: readonly DocType[] = ['WORKING', 'ELECTRICAL', 'MATERIAL_LIST', 'CUT_LIST'];

// ── Version numbers ───────────────────────────────────────────

export interface ChainDoc {
  id: string;
  version: number;
  supersedesId: string | null;
}

/**
 * Each document's version number, "1.0", "1.1", "2.0"…, by id. Chains are
 * followed by `supersedesId`; `approved` holds the ids the client approved
 * (their latest answer on that version).
 */
export function versionLabels(docs: readonly ChainDoc[], approved: ReadonlySet<string>): Map<string, string> {
  const out = new Map<string, string>();
  const next = new Map<string, ChainDoc>();
  for (const d of docs) if (d.supersedesId) next.set(d.supersedesId, d);
  const ids = new Set(docs.map((d) => d.id));
  const heads = docs.filter((d) => !d.supersedesId || !ids.has(d.supersedesId)).sort((a, b) => a.version - b.version);
  for (const head of heads) {
    let major = 1;
    let minor = 0;
    let first = true;
    for (let d: ChainDoc | undefined = head; d; d = next.get(d.id)) {
      if (!first) minor += 1;
      first = false;
      if (approved.has(d.id)) {
        major += 1;
        minor = 0;
      }
      out.set(d.id, `${major}.${minor}`);
    }
  }
  return out;
}

// ── Names ─────────────────────────────────────────────────────

/** One word of a file name: letters and digits only, words run together ("Rohan Kulkarni" → "RohanKulkarni"). */
export function nameWord(s: string | null | undefined, fallback: string): string {
  const w = String(s ?? '')
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9 ]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((x) => x[0]!.toUpperCase() + x.slice(1))
    .join('')
    .slice(0, 40);
  return w || fallback;
}

/** The IST date and time of a moment: "2026-10-25", "1430". */
function istParts(at: Date): { day: string; hhmm: string } {
  const ist = new Date(at.getTime() + 330 * 60_000);
  const iso = ist.toISOString();
  return { day: iso.slice(0, 10), hhmm: iso.slice(11, 13) + iso.slice(14, 16) };
}

/** The file's extension from its stored path or original name; "" when it has none. */
export const extOf = (name: string | null | undefined): string => {
  const m = String(name ?? '').match(/\.([A-Za-z0-9]{1,6})$/);
  return m ? m[1]!.toLowerCase() : '';
};

/** TYPE_Studio_Client_YYYY-MM-DD_HHMM_vX.Y.ext (with the room after the type when there is one). */
export function docFileName(i: { type: DocType; room?: string | null; studio: string; client: string; at: Date; version: string; ext: string }): string {
  const { day, hhmm } = istParts(i.at);
  const parts = [DOC_TYPES[i.type].short, i.room ? nameWord(i.room, '') : '', nameWord(i.studio, 'Studio'), nameWord(i.client, 'Client'), day, hhmm, `v${i.version}`].filter(Boolean);
  return `${parts.join('_')}${i.ext ? `.${i.ext}` : ''}`;
}

// ── Finals ────────────────────────────────────────────────────

export interface DocVersion {
  id: string;
  type: DocType;
  room: string | null;
  version: number;
  supersedesId: string | null;
  shared: boolean;
  /** The client's latest answer on this version. */
  answer: 'APPROVED' | 'CHANGES' | null;
  at: Date;
}

export type FinalState = 'approved' | 'waiting' | 'changes' | 'shared' | 'draft';

export interface FinalDoc {
  /** The version that counts: the newest approved, else the newest shared, else the newest draft. */
  id: string;
  type: DocType;
  room: string | null;
  state: FinalState;
  /** Versions in the chain. */
  versions: number;
  /** A newer version than the final is waiting (shared after the approval). */
  newerWaiting: boolean;
}

/** One line per type and room: the version that counts now, for the project page and the handover pack. */
export function finalsOf(docs: readonly DocVersion[]): FinalDoc[] {
  const chains = new Map<string, DocVersion[]>();
  for (const d of docs) {
    const k = `${d.type}|${(d.room ?? '').toLowerCase()}`;
    chains.set(k, [...(chains.get(k) ?? []), d]);
  }
  const out: FinalDoc[] = [];
  for (const list of chains.values()) {
    const byNew = [...list].sort((a, b) => b.version - a.version || b.at.getTime() - a.at.getTime());
    const approved = byNew.find((d) => d.answer === 'APPROVED');
    const newestShared = byNew.find((d) => d.shared);
    const pick = approved ?? newestShared ?? byNew[0]!;
    const needs = DOC_TYPES[pick.type].approval;
    const state: FinalState = pick.answer === 'APPROVED' ? 'approved' : !pick.shared ? 'draft' : !needs ? 'shared' : pick.answer === 'CHANGES' ? 'changes' : 'waiting';
    out.push({
      id: pick.id,
      type: pick.type,
      room: pick.room,
      state,
      versions: list.length,
      newerWaiting: Boolean(approved && newestShared && newestShared.version > approved.version),
    });
  }
  const order = Object.keys(DOC_TYPES);
  return out.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type) || (a.room ?? '').localeCompare(b.room ?? ''));
}

/**
 * Is the handover pack complete (DESIGN-PROCESS-PLAN.md §3.5)? A final of each
 * required type: approved where the client approves it, shared or drafted
 * where they do not. The missing types, by label; empty when ready.
 */
export function handoverMissing(finals: readonly FinalDoc[]): string[] {
  return HANDOVER_REQUIRED.filter((t) => !finals.some((f) => f.type === t && (DOC_TYPES[t].approval ? f.state === 'approved' : true))).map((t) => DOC_TYPES[t].label);
}

/** The step whose tick needs the handover pack (Hauspire's "Final documentation for handover"). */
export const isHandoverDocsStep = (label: string): boolean => /^final documentation/i.test(label.trim());

// ── Files people can upload ───────────────────────────────────

/** 50 MB: a full drawing set or a SketchUp model. The bucket's own limit must allow it (Supabase, storage settings). */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** By extension, because browsers send no type (or a generic one) for DWG, SKP and the like. */
export const UPLOAD_TYPES: Readonly<Record<string, string>> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv',
  dwg: 'application/acad',
  dxf: 'application/dxf',
  skp: 'application/vnd.sketchup.skp',
  zip: 'application/zip',
};
export const UPLOAD_ACCEPT = Object.keys(UPLOAD_TYPES)
  .map((e) => `.${e}`)
  .join(',');

/** A file someone means to upload: its stored type and extension, or why not. */
export function checkUpload(name: unknown, bytes: unknown): { ok: true; ext: string; contentType: string } | { ok: false; error: string } {
  const ext = extOf(typeof name === 'string' ? name : '');
  const type = UPLOAD_TYPES[ext === 'jpeg' ? 'jpg' : ext];
  if (!type) return { ok: false, error: 'We take PDF, JPG, PNG, WebP, Excel (XLSX, XLS, CSV), DWG, DXF, SKP or ZIP.' };
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return { ok: false, error: 'That file is empty.' };
  if (n > MAX_UPLOAD_BYTES) return { ok: false, error: 'Files can be up to 50 MB. Split a larger set into parts.' };
  return { ok: true, ext: ext === 'jpeg' ? 'jpg' : ext, contentType: type };
}

/** Days since a moment, for "shared 3 days ago". */
export const daysSince = (from: string, today: string): number => Math.max(0, daysBetween(from, today));
