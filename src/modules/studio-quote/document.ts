/**
 * The quotation PDF, as the owner's sample has it (Hauspire's format, 13 Oct
 * 2026), for every studio: the studio's brand pages first, then the header
 * grid, one table per room with an Amount and a Discounted column, the
 * summary by room with a donut, the totals box, the payment stages with what
 * the client receives at the end of each, the material specification, and the
 * terms on their own pages.
 *
 * Pure, no `server-only`: the builder's PDF preview runs it in the browser,
 * the print page on the server, and tests/quote-document.test.ts pins it.
 * No pricing here: every figure comes from `computeTotals` (pricing.ts), the
 * per-line Discounted figure from `discountedPaise` (rooms.ts), the stage
 * amounts from `scheduleAmounts` (payment-template.ts).
 */

import { scheduleAmounts, type PaymentStage } from '@/modules/studio-sales/payment-template';
import { BOOKING_DETAIL, HAUSPIRE_STAGES, type QuoteTotals, type QuoteUnitName, type WorkCodeName } from './pricing';
import { discountedPaise, orderedRooms } from './rooms';

/** The colour a studio's document falls back to (`StudioBranding.accentHex`'s default). */
export const DEFAULT_ACCENT = '#1F5C4D';

/** Up to this many full-page brand images (Settings → Quotation PDF). */
export const BRAND_PAGES_MAX = 3;

/** The work codes as the sample prints them. */
export const WORK_CODE_SHORT: Record<WorkCodeName, string> = { MODULAR: 'MO-01', ONSITE: 'NM-01' };

/** The sample's note under the payment stages. */
export const STAGES_NOTE = 'Each payment is made at the start of its stage. The End Deliverable is what you receive once that stage is complete.';

/**
 * A studio-supplied colour, checked before it reaches a style: it is
 * interpolated into CSS, where React does not escape. Anything that is not a
 * six-digit hex colour falls back.
 */
export function safeAccent(hex: string | null | undefined): string {
  const t = String(hex ?? '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(t) ? t.toUpperCase() : DEFAULT_ACCENT;
}

function rgb(hex: string): [number, number, number] {
  const h = safeAccent(hex).slice(1);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function hexOf([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** `a` moved `t` (0–1) of the way towards `b`. */
export function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return hexOf([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

/**
 * The document's colours from one accent: the room band (darker), the column
 * header row (the accent), the table rules and the sub-total tint (light).
 * The sample's maroon is Hauspire's accent; every studio gets its own.
 */
export function docColours(accentHex: string | null | undefined): { band: string; head: string; line: string; tint: string; acc: string } {
  const acc = safeAccent(accentHex);
  if (isHauspireAccent(acc)) return { acc: HAUSPIRE_COLOURS.light, band: HAUSPIRE_COLOURS.brand, head: HAUSPIRE_COLOURS.light, line: HAUSPIRE_COLOURS.line, tint: HAUSPIRE_COLOURS.band };
  return { acc, band: mix(acc, '#000000', 0.28), head: acc, line: mix(acc, '#FFFFFF', 0.8), tint: mix(acc, '#FFFFFF', 0.9) };
}

/**
 * Hauspire's own colours, exactly as their quotation app's Tailwind theme
 * has them (`brand`, `brand.light`, `brand.band`, `brand.line`), and its
 * donut's slices (`RoomDonut.tsx`). A studio whose accent is either maroon
 * gets these to the hex, so the PDF matches the old app's (owner, 22 Oct
 * 2026); every other studio's colours are worked out from its accent.
 */
export const HAUSPIRE_COLOURS = { brand: '#531220', light: '#7A2A3A', band: '#F3E9EC', line: '#E0CDD3' } as const;
export const HAUSPIRE_DONUT = ['#7A1C2B', '#9C2A34', '#B8433C', '#CF5B3F', '#E07A4E', '#EB9A68', '#F0B787', '#CAA06F', '#8F5B3A'] as const;
export function isHauspireAccent(hex: string | null | undefined): boolean {
  const a = safeAccent(hex);
  return a === HAUSPIRE_COLOURS.brand || a === HAUSPIRE_COLOURS.light;
}

/** The donut's slices: the accent, warming and lightening slice by slice, as the sample's maroon → peach. */
export function donutPalette(accentHex: string | null | undefined, n: number): string[] {
  const acc = safeAccent(accentHex);
  if (isHauspireAccent(acc)) return Array.from({ length: n }, (_, i) => HAUSPIRE_DONUT[i % HAUSPIRE_DONUT.length]!);
  const end = mix(mix(acc, '#F0A060', 0.55), '#FFFFFF', 0.25);
  if (n <= 1) return [acc];
  return Array.from({ length: n }, (_, i) => mix(acc, end, i / (n - 1)));
}

/** What a line needs to be printed. A subset of the stored line and the builder's priced line. */
export interface DocLineInput {
  room: string;
  product: string;
  code: WorkCodeName;
  unit: QuoteUnitName;
  details: string | null;
  widthMm: number | null;
  heightMm: number | null;
  qtyMilli: number | null;
  amountPaise: number;
  /** The line's note for the client, printed under its details (15 Oct 2026). */
  note?: string | null;
}

export interface DocRow {
  n: number;
  product: string;
  code: string;
  modular: boolean;
  details: string;
  /** The count, for a line priced per unit; blank otherwise, as the old PDF prints it. */
  units: string;
  widthMm: number | null;
  heightMm: number | null;
  amountPaise: number;
  discountedPaise: number;
  /** The note for the client under the details; '' when none. */
  note: string;
}

export interface DocRoom {
  room: string;
  rows: DocRow[];
  subPaise: number;
  subDiscountedPaise: number;
}

/**
 * The PDF's Units cell, as Hauspire's printed it (`PrintDocument.tsx`:
 * `unitPrice != null ? qty : ""`): the count on a line priced per unit, and
 * nothing on a W × H, square-foot or running-foot line, or on a line that
 * is an amount on its own (no quantity).
 */
export function docUnitsText(line: Pick<DocLineInput, 'unit' | 'qtyMilli'>): string {
  return line.unit === 'UNIT' ? unitsText(line) : '';
}

/** A quantity as words for a line's size (the Final's "34.39 sqft"); '' for W × H or no quantity. */
export function unitsText(line: Pick<DocLineInput, 'unit' | 'qtyMilli'>): string {
  if (line.unit === 'AREA' || line.qtyMilli == null) return '';
  const q = line.qtyMilli / 1000;
  return Number.isInteger(q) ? String(q) : q.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

/** The rooms in the quotation's order, each with its rows and both sub-totals. */
export function docRooms(lines: readonly DocLineInput[], roomOrder: readonly string[], discountBps: number): DocRoom[] {
  return orderedRooms(roomOrder, lines)
    .map((room) => {
      const inRoom = lines.filter((l) => l.room === room);
      const rows = inRoom.map((l, i) => ({
        n: i + 1,
        product: l.product,
        code: WORK_CODE_SHORT[l.code],
        /* Struck through on every MO-01 line, as the old PDF did, discount or not. */
        modular: l.code === 'MODULAR',
        details: l.details?.trim() ?? '',
        units: docUnitsText(l),
        widthMm: l.widthMm ?? null,
        heightMm: l.heightMm ?? null,
        amountPaise: l.amountPaise,
        discountedPaise: discountedPaise(l.amountPaise, l.code, discountBps),
        note: l.note?.trim() ?? '',
      }));
      return {
        room,
        rows,
        subPaise: rows.reduce((a, r) => a + r.amountPaise, 0),
        subDiscountedPaise: rows.reduce((a, r) => a + r.discountedPaise, 0),
      };
    })
    .filter((r) => r.rows.length > 0);
}

/** Each room's share of the work, whole percent, for the donut's legend. */
export function roomShares(rooms: readonly DocRoom[]): { room: string; paise: number; pct: number }[] {
  const total = rooms.reduce((a, r) => a + Math.max(0, r.subPaise), 0);
  return rooms.map((r) => ({ room: r.room, paise: r.subPaise, pct: total > 0 ? Math.round((Math.max(0, r.subPaise) / total) * 100) : 0 }));
}

export interface DocStage {
  label: string;
  deliverable: string;
  amountPaise: number;
}

/**
 * The payment stages as printed: the studio's schedule (Settings → Payment
 * stages, or the sales final's own copy) on this quotation's total, the
 * label carrying its percent or its refund window as the sample does. When
 * there is no schedule, or it cannot split this total (the fixed amounts are
 * more than the whole), the stages `computeTotals` already worked out.
 */
export function docStages(schedule: readonly PaymentStage[] | null, totals: Pick<QuoteTotals, 'totalPaise' | 'stages'>): DocStage[] {
  if (schedule && schedule.length > 0 && totals.totalPaise > 0) {
    const split = scheduleAmounts(schedule, totals.totalPaise);
    if (split.ok) {
      return split.stages.map((s) => {
        const words = hauspireWords(s.label, s.note);
        return {
          label:
            s.kind === 'PCT'
              ? `${words.label} (${trimPct(s.pct ?? 0)}%)`
              : s.refundDays && s.refundDays > 0
                ? `${words.label} (Fully refundable within ${s.refundDays} ${s.refundDays === 1 ? 'day' : 'days'})`
                : words.label,
          deliverable: words.note,
          amountPaise: s.amountPaise,
        };
      });
    }
  }
  return totals.stages.map((s) => ({ label: s.pct ? `${s.label} (${trimPct(s.pct)}%)` : s.label, deliverable: s.detail, amountPaise: s.amountPaise }));
}

/**
 * A stage of Hauspire's standard six, printed in the old app's words: its
 * capitalised label ("Design Advance") and its End Deliverable with the
 * **bold** it printed. Only when the studio's stage is that stage — its
 * name, any case, and its End Deliverable unchanged; a stage a studio wrote
 * or reworded prints exactly as they wrote it.
 */
const HAUSPIRE_WORDS: { label: string; detail: string }[] = [{ label: 'Booking Advance', detail: BOOKING_DETAIL }, ...HAUSPIRE_STAGES.map((s) => ({ label: s.label, detail: s.detail }))];
export function hauspireWords(label: string, note: string): { label: string; note: string } {
  const w = HAUSPIRE_WORDS.find((x) => x.label.toLowerCase() === label.trim().toLowerCase());
  if (!w) return { label, note };
  return { label: w.label, note: note.trim() === w.detail.replace(/\*\*/g, '') ? w.detail : note };
}

const trimPct = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ''));

// ── Terms ───────────────────────────────────────────────────────

export type TermsBlock =
  | { kind: 'title'; text: string }
  | { kind: 'heading'; text: string }
  /** `sub`: written indented under the bullet above ("  * Electrical fittings…"), printed indented. */
  | { kind: 'bullet'; text: string; sub?: boolean }
  | { kind: 'text'; text: string }
  | { kind: 'gap' };

/**
 * The studio's terms as blocks, so the PDF prints headings and bullets rather
 * than the raw "##" the sample shows. Markdown (`#`, `##`, `###`, `-`, `*`,
 * `•`) and Hauspire's own convention (a short line ending with ":" is a
 * heading) both read.
 */
export function parseTerms(text: string | null | undefined): TermsBlock[] {
  const out: TermsBlock[] = [];
  for (const raw of String(text ?? '').replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line) {
      if (out.length > 0 && out[out.length - 1]!.kind !== 'gap') out.push({ kind: 'gap' });
      continue;
    }
    const h = line.match(/^(#{1,6})\s*(.+)$/);
    if (h) {
      out.push({ kind: h[1]!.length <= 2 ? 'title' : 'heading', text: h[2]!.replace(/\s*#+\s*$/, '').trim() });
      continue;
    }
    const b = line.match(/^[-*•–]\s+(.+)$/);
    if (b && !/^\*\*/.test(line)) {
      /* Two or more leading spaces: a sub-point (Hauspire's terms, 5 Sep 2026). */
      out.push(/^\s{2,}/.test(raw) ? { kind: 'bullet', text: b[1]!, sub: true } : { kind: 'bullet', text: b[1]! });
      continue;
    }
    if (line.endsWith(':') && line.length <= 70 && !/[.;]\s/.test(line)) {
      out.push({ kind: 'heading', text: line.replace(/\s*:$/, '') });
      continue;
    }
    out.push({ kind: 'text', text: line });
  }
  while (out.length > 0 && out[out.length - 1]!.kind === 'gap') out.pop();
  return out;
}

/** "**bold**" segments of one line: odd entries are bold. */
export function boldSegments(text: string): string[] {
  return text.split(/\*\*(.+?)\*\*/g);
}

// ── Material specification ─────────────────────────────────────

export interface DocSpecRow {
  item: string;
  brand?: string;
  spec: string;
}

/** Whether to print the Brand column: any row names a brand. */
export function specHasBrands(rows: readonly DocSpecRow[]): boolean {
  return rows.some((r) => Boolean(r.brand?.trim()));
}

// ── The file name ──────────────────────────────────────────────

/** "06-10-2026", for the file name. */
function dmy(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
}

/**
 * What the print dialog saves the PDF as: "{client} {studio} Quotation {no}
 * {date}", as Hauspire's `quoteFilename`, with the studio's own name.
 */
export function quoteFileName(client: string, studio: string, number: string, date: Date | string, final = false): string {
  const d = new Date(date);
  const when = Number.isNaN(d.getTime()) ? '' : dmy(d);
  return [client.trim() || 'Client', studio.trim(), final ? 'Final Quotation' : 'Quotation', number.trim(), when]
    .filter(Boolean)
    .join(' ')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "13 Oct 2026", as the sample prints the date (fixed, so no browser prints "Sept"). */
export function docDate(date: Date | string): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(d.getDate()).padStart(2, '0')} ${M[d.getMonth()]} ${d.getFullYear()}`;
}

// ── Who it is from, who it is for ──────────────────────────────

export interface DocStudio {
  /** The registered name, else the trade name. */
  name: string;
  /** The name the studio goes by, for the cover and the terms header. */
  tradeName: string | null;
  addressLine: string | null;
  city: string | null;
  pincode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  gstin: string | null;
  logoUrl: string | null;
  accentHex: string | null;
  /** A few true facts for the drawn cover ("12 years in practice"). */
  facts?: string[];
}

export interface DocHead {
  clientName: string;
  clientPhone: string | null;
  flatNo: string | null;
  config: string | null;
  number: string;
  date: Date | string;
  location: string | null;
}

/**
 * The header grid from a quotation: the sample's Flat No is our society /
 * building line, its Location our locality (else the studio's city).
 */
export function docHead(
  q: { clientName: string; clientPhone: string | null; society: string | null; locality: string | null; config: string | null; number: string; quoteDate: Date | string },
  city: string | null,
): DocHead {
  return {
    clientName: q.clientName,
    clientPhone: q.clientPhone,
    flatNo: q.society,
    config: q.config,
    number: q.number,
    date: q.quoteDate,
    location: q.locality || city,
  };
}

/** The drawn cover's facts, from the studio's profile; only what is true and filled in. */
export function coverFacts(p: { yearsActive: number | null; teamSize: number | null; localities: string[] } | null): string[] {
  if (!p) return [];
  return [
    p.yearsActive ? `${p.yearsActive}+ years of practice` : null,
    p.teamSize ? `A team of ${p.teamSize}` : null,
    p.localities.length ? `Working across ${p.localities.length} ${p.localities.length === 1 ? 'locality' : 'localities'}` : null,
  ].filter((x): x is string => Boolean(x));
}
