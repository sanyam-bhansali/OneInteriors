/**
 * The Final (Original vs Revised) document, line by line (owner's team, 15
 * Oct 2026): "Work code aur description hona chahiye", and the change read
 * the way they say it — "Wall cabinet 2400 by 600 se 2400 by 697 ho gayi hai,
 * uska price 39,000 se 46,000 ... Wall cabinets ka vertical remove ho gaya,
 * 12,000 kam ... Dressing unit ka mirror 1 tha, 5 ho gaya, 32,000 badh gayi."
 *
 * Every line of both sides, room by room, with its product, work code,
 * details and note, its size or count before → after, its amount before →
 * after and the difference; added and removed lines marked; each room's
 * sub-total on both sides. And one plain sentence per change, for the top of
 * the page.
 *
 * Pure: the Final page and its PDF render it, tests/quote-final-doc.test.ts
 * pins it. No pricing: every amount is the stored, agreed figure.
 */

import { formatINR } from '@/lib/money';
import type { DocLineInput } from './document';
import { WORK_CODE_SHORT, unitsText } from './document';
import { orderedRooms } from './rooms';

/** A line on either side: the quotation's own lines, or a revision's frozen ones. */
export type FinalLineInput = DocLineInput;

export type FinalKind = 'ADDED' | 'REMOVED' | 'CHANGED' | 'UNCHANGED';

export interface FinalRow {
  n: number;
  kind: FinalKind;
  product: string;
  /** The work code as printed (MO-01 / NM-01): the revised one, or the original on a removed line. */
  code: string;
  /** The original's work code when it changed, else null. */
  codeWas: string | null;
  /** The revised details (the original's on a removed line). */
  details: string;
  /** The original's details when they changed, else null. */
  detailsWas: string | null;
  /** "2400 × 600 mm", "5 nos", "34.39 sqft"; '' on the side the line is not on. */
  sizeWas: string;
  sizeNow: string;
  sizeChanged: boolean;
  wasPaise: number;
  nowPaise: number;
  /** now − was. Negative is money off. */
  deltaPaise: number;
  /** The note for the client: the revised line's, else the original's. '' when none. */
  note: string;
}

export interface FinalRoom {
  room: string;
  rows: FinalRow[];
  wasPaise: number;
  nowPaise: number;
  deltaPaise: number;
}

const UNIT_WORD = { AREA: 'sqft', SQFT: 'sqft', RFT: 'rft', UNIT: 'nos' } as const;

/** What a line measures, as the Final prints it: W × H for an area line, else the count and its unit. */
export function sizeText(line: Pick<FinalLineInput, 'unit' | 'widthMm' | 'heightMm' | 'qtyMilli'>): string {
  if (line.unit === 'AREA') {
    const w = line.widthMm || null;
    const h = line.heightMm || null;
    if (w && h) return `${w} × ${h} mm`;
    if (w || h) return `${w ?? h} mm`;
    return '';
  }
  const q = unitsText(line);
  return q ? `${q} ${UNIT_WORD[line.unit]}` : '';
}

const clean = (t: string | null | undefined) => (t ?? '').trim();
const sameWork = (a: FinalLineInput, b: FinalLineInput) =>
  a.code === b.code && a.unit === b.unit && (a.widthMm || null) === (b.widthMm || null) && (a.heightMm || null) === (b.heightMm || null) && (a.qtyMilli ?? null) === (b.qtyMilli ?? null);
const identical = (a: FinalLineInput, b: FinalLineInput) => sameWork(a, b) && a.amountPaise === b.amountPaise && clean(a.details) === clean(b.details);

/**
 * Pairs the lines of one room and product. Lines are matched on room plus
 * product, as `compareToIssued` does (ids do not survive a Design Final or a
 * revision). Where a room has the same product twice, the lines that did not
 * change pair first, then the rest in the order they stand, so "the second
 * wardrobe went from 1800 to 2000" reads as that rather than as one removed
 * and one added.
 */
function pairUp(was: FinalLineInput[], now: FinalLineInput[]): [FinalLineInput | null, FinalLineInput | null][] {
  const wasLeft = [...was];
  const pairs = new Map<FinalLineInput, FinalLineInput>();
  for (const n of now) {
    const i = wasLeft.findIndex((w) => identical(w, n));
    if (i >= 0) pairs.set(n, wasLeft.splice(i, 1)[0]!);
  }
  const out: [FinalLineInput | null, FinalLineInput | null][] = [];
  for (const n of now) {
    const w = pairs.get(n) ?? wasLeft.shift() ?? null;
    out.push([w, n]);
  }
  for (const w of wasLeft) out.push([w, null]);
  return out;
}

function rowOf(n: number, was: FinalLineInput | null, now: FinalLineInput | null): FinalRow {
  const line = (now ?? was)!;
  const sizeWas = was ? sizeText(was) : '';
  const sizeNow = now ? sizeText(now) : '';
  const wasPaise = was?.amountPaise ?? 0;
  const nowPaise = now?.amountPaise ?? 0;
  const codeChanged = Boolean(was && now && was.code !== now.code);
  const detailsChanged = Boolean(was && now && clean(was.details) !== clean(now.details));
  const sizeChanged = Boolean(was && now && (!sameWork({ ...was, code: now.code }, now) || sizeWas !== sizeNow));
  const kind: FinalKind = !was ? 'ADDED' : !now ? 'REMOVED' : codeChanged || detailsChanged || sizeChanged || wasPaise !== nowPaise ? 'CHANGED' : 'UNCHANGED';
  return {
    n,
    kind,
    product: line.product,
    code: WORK_CODE_SHORT[line.code],
    codeWas: codeChanged ? WORK_CODE_SHORT[was!.code] : null,
    details: clean(line.details),
    detailsWas: detailsChanged ? clean(was!.details) : null,
    sizeWas,
    sizeNow,
    sizeChanged,
    wasPaise,
    nowPaise,
    deltaPaise: nowPaise - wasPaise,
    note: clean(now?.note) || clean(was?.note),
  };
}

/**
 * Both sides, room by room in the revised quotation's order (rooms only the
 * original had come after), every line with what happened to it. Removed
 * lines stand at the end of their room.
 */
export function finalRooms(was: readonly FinalLineInput[], now: readonly FinalLineInput[], roomOrder: readonly string[]): FinalRoom[] {
  const rooms = orderedRooms(roomOrder, [...now, ...was]);
  return rooms
    .map((room) => {
      const w = was.filter((l) => l.room === room);
      const c = now.filter((l) => l.room === room);
      const products: string[] = [];
      for (const l of [...c, ...w]) if (!products.includes(l.product)) products.push(l.product);
      const byProduct = new Map(products.map((p) => [p, pairUp(w.filter((l) => l.product === p), c.filter((l) => l.product === p))]));
      /* The revised order first, then what was removed. */
      const kept: [FinalLineInput | null, FinalLineInput | null][] = [];
      const gone: [FinalLineInput | null, FinalLineInput | null][] = [];
      for (const l of c) {
        const pair = byProduct.get(l.product)!.find(([, n]) => n === l)!;
        kept.push(pair);
      }
      for (const p of products) for (const pair of byProduct.get(p)!) if (pair[1] === null) gone.push(pair);
      const rows = [...kept, ...gone].map(([a, b], i) => rowOf(i + 1, a, b));
      const wasPaise = rows.reduce((t, r) => t + r.wasPaise, 0);
      const nowPaise = rows.reduce((t, r) => t + r.nowPaise, 0);
      return { room, rows, wasPaise, nowPaise, deltaPaise: nowPaise - wasPaise };
    })
    .filter((r) => r.rows.length > 0);
}

/** How many lines were added, changed and removed. */
export function finalCounts(rooms: readonly FinalRoom[]): { added: number; changed: number; removed: number } {
  const rows = rooms.flatMap((r) => r.rows);
  return {
    added: rows.filter((r) => r.kind === 'ADDED').length,
    changed: rows.filter((r) => r.kind === 'CHANGED').length,
    removed: rows.filter((r) => r.kind === 'REMOVED').length,
  };
}

const rupees = (paise: number) => formatINR(Math.abs(paise));

/** "+ ₹7,000", "− ₹12,000", "no change". */
export function deltaText(paise: number): string {
  if (paise === 0) return 'no change';
  return `${paise > 0 ? '+' : '−'} ${rupees(paise)}`;
}

/**
 * The change in one sentence, the way the team says it: "Kitchen — Wall
 * cabinets: 2400 × 600 mm → 2400 × 697 mm; ₹39,000 → ₹46,000 (+ ₹7,000)."
 * Null for a line that did not change.
 */
export function changeSentence(room: string, r: FinalRow): string | null {
  const at = `${room} — ${r.product}`;
  if (r.kind === 'UNCHANGED') return null;
  if (r.kind === 'ADDED') return `${at} added${r.sizeNow ? `, ${r.sizeNow}` : ''}: ${rupees(r.nowPaise)} more.`;
  if (r.kind === 'REMOVED') return `${at}${r.sizeWas ? ` (${r.sizeWas})` : ''} removed: ${rupees(r.wasPaise)} less.`;
  const parts: string[] = [];
  if (r.sizeChanged) parts.push(`${r.sizeWas || '—'} → ${r.sizeNow || '—'}`);
  if (r.codeWas) parts.push(`work code ${r.codeWas} → ${r.code}`);
  if (r.detailsWas !== null) parts.push('details changed');
  parts.push(r.deltaPaise === 0 ? `price unchanged at ${rupees(r.nowPaise)}` : `${rupees(r.wasPaise)} → ${rupees(r.nowPaise)} (${deltaText(r.deltaPaise)})`);
  return `${at}: ${parts.join('; ')}.`;
}

/**
 * A frozen side whose lines lack what the document prints (details, a note),
 * filled from the quotation's own lines of the same room and product: show
 * what is known rather than a blank. Lines that have their own keep them.
 */
export function withKnownDetails<T extends FinalLineInput>(lines: readonly T[], from: readonly FinalLineInput[]): T[] {
  return lines.map((l) => {
    if (clean(l.details)) return l;
    const match = from.find((f) => f.room === l.room && f.product === l.product && clean(f.details));
    return match ? { ...l, details: match.details } : l;
  });
}
