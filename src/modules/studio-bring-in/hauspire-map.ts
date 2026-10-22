/**
 * The Hauspire quotation app's quotation, as our quotation (owner, 20 Oct
 * 2026; docs/studio-os/BRING-IN-PROJECTS.md). Pure: no network, no Prisma.
 * Tested in tests/bring-in-hauspire-map.test.ts with fake rows shaped like
 * the source schema (its `quotes` table: `lines` jsonb, `settings` jsonb,
 * `quote_no`, `stage` 'sales' | 'design', `tpv`).
 *
 * ## The rules
 *
 * - **Kept exactly as the client agreed.** Every line keeps its room,
 *   product, work code, details, sizes and amount. The amount is stored as
 *   the agreed figure (`amountPaise`), so our arithmetic never re-prices it;
 *   the rate and quantity are kept beside it so the builder shows how it was
 *   sized.
 * - **Sizing**, read the way the old app's own table reads a line
 *   (`QuoteTable.tsx`, 22 Oct 2026): `sqft` present → square feet; else
 *   `rft` → running feet; else `unitPrice` → each, `qty` (default 1) of
 *   them; else a `rate` with width and height → W × H (mm). A line with none
 *   of these (the old "+ add item" row, typed straight in) is an amount on
 *   its own: no quantity, so its Units cell prints blank as it did there,
 *   and any width or height typed on it is kept for the PDF.
 * - **Money.** The source works in rupees (rates may have decimals, e.g.
 *   ₹26.5 / sq ft); we store integer paise, rounded once here.
 * - **Terms.** `modularPct` is a fraction (0.15 = 15%; the source's default
 *   when unset) — a value above 1 is read as a percent; `onSpot` rupees;
 *   `feeOn` (default on) is our 7% fee; `gstOn` (default off) is 18%;
 *   `quoteDate` 'YYYY-MM-DD'.
 * - **Check.** Our total before GST is compared with the source's `tpv`. The
 *   arithmetic is now the old app's own to the paisa (pricing.ts, pinned
 *   against hauspire-calc.ts), so ANY difference is reported, never hidden.
 */

import { computeTotals, FEE_BPS, GST_BPS, QTY_SCALE, type QuoteTotals, type QuoteUnitName, type WorkCodeName } from '@/modules/studio-quote/pricing';

/** One line in the source's `lines` jsonb (src/lib/types.ts `QuoteLine`). */
export interface SourceLine {
  room?: unknown;
  product?: unknown;
  wc?: unknown;
  details?: unknown;
  width?: unknown;
  height?: unknown;
  amount?: unknown;
  rate?: unknown;
  qty?: unknown;
  unitPrice?: unknown;
  sqft?: unknown;
  rft?: unknown;
}

/** The source's `settings` jsonb (`QuoteSettings`). */
export interface SourceSettings {
  modularPct?: unknown;
  onSpot?: unknown;
  onSpotLabel?: unknown;
  feeOn?: unknown;
  gstOn?: unknown;
  quoteDate?: unknown;
}

/** One row of the source's `quotes` table, as the connector selects it. */
export interface SourceQuote {
  id: string;
  quote_no?: string | null;
  stage?: string | null;
  client_name?: string | null;
  location?: string | null;
  bhk?: string | null;
  tpv?: number | null;
  created_at?: string | null;
  lines?: unknown;
  settings?: unknown;
  /** The full import reads every column (`select=*`); the picker only a few. */
  mobile?: string | null;
  kitchen_run?: number | null;
  designer_id?: string | null;
  revision?: number | null;
}

/** A search result: what the picker shows. */
export interface SourceMatch {
  id: string;
  number: string;
  client: string;
  bhk: string | null;
  location: string | null;
  tpvPaise: number;
  /** 'YYYY-MM-DD': the quotation's own date, else the day it was saved. */
  date: string | null;
  stage: 'sales' | 'design';
}

/** Our line, ready for `studioQuoteLine.create`. */
export interface MappedLine {
  room: string;
  product: string;
  code: WorkCodeName;
  unit: QuoteUnitName;
  details: string | null;
  widthMm: number | null;
  heightMm: number | null;
  qtyMilli: number | null;
  ratePaise: number;
  amountPaise: number;
  sortOrder: number;
}

export interface MappedTerms {
  feeBps: number;
  discountBps: number;
  onSpotPaise: number;
  onSpotLabel: string | null;
  gstBps: number;
  /** 'YYYY-MM-DD' or null. */
  quoteDate: string | null;
}

export interface MappedQuote {
  sourceId: string;
  number: string;
  stage: 'sales' | 'design';
  client: string;
  /** The client's mobile as the old app stored it (trimmed), or null. */
  phone: string | null;
  location: string | null;
  bhk: string | null;
  /** The kitchen run the first quote was sized on, mm; null when not stored or 0. */
  kitchenRunMm: number | null;
  /** When the old app last saved it (its `created_at` is rewritten on every save). */
  savedAt: string | null;
  lines: MappedLine[];
  terms: MappedTerms;
  totals: QuoteTotals;
  /** The source's own total before GST, paise. */
  sourceTpvPaise: number;
  /** Our total before GST minus the source's, paise (0 when they agree). */
  differencePaise: number;
  /** Things the person should look at before confirming, in plain words. */
  warnings: string[];
}

const ROOM_FALLBACK = 'Whole home';
/** None: our arithmetic is the old app's to the paisa (22 Oct 2026), so any difference is a real one. */
export const TPV_TOLERANCE_PAISE = 0;
export const LINES_MAX = 600;

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** A finite number from a number or a numeric string; null otherwise. */
export function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '' && /^-?\d+(\.\d+)?$/.test(v.trim())) return Number(v.trim());
  return null;
}

/** Rupees (maybe with decimals) to integer paise. */
export const rupeesToPaise = (r: number): number => Math.round(r * 100);

/** 'MO-01' is modular (factory-made), 'NM-01' on-site; anything else is read as on-site and reported. */
export function workCodeOf(wc: unknown): { code: WorkCodeName; known: boolean } {
  const w = typeof wc === 'string' ? wc.trim().toUpperCase() : '';
  if (w === 'MO-01' || w === 'MO') return { code: 'MODULAR', known: true };
  if (w === 'NM-01' || w === 'NM') return { code: 'ONSITE', known: true };
  return { code: 'ONSITE', known: false };
}

/** One source line as ours, or null when it has no product and no amount (an empty row). */
export function mapLine(raw: SourceLine, sortOrder: number): { line: MappedLine; unknownCode: boolean } | null {
  const product = text(raw.product, 200);
  const amount = num(raw.amount);
  if (!product && (amount === null || amount === 0)) return null;
  const { code, known } = workCodeOf(raw.wc);
  const amountPaise = rupeesToPaise(amount ?? 0);
  const rate = num(raw.rate);
  const sqft = num(raw.sqft);
  const rft = num(raw.rft);
  const unitPrice = num(raw.unitPrice);
  const qty = num(raw.qty);
  /* Width and height as typed (the PDF prints them whatever the line is); W × H pricing needs both above zero. */
  const mm = (v: unknown): number | null => {
    const n = num(v);
    return n !== null && n >= 0 && n < 1_000_000 ? Math.round(n) : null;
  };
  const width = mm(raw.width);
  const height = mm(raw.height);
  const base = {
    room: text(raw.room, 120) || ROOM_FALLBACK,
    product: product || 'Item',
    code,
    details: text(raw.details, 2000) || null,
    amountPaise,
    sortOrder,
  };
  const milli = (q: number) => Math.round(q * QTY_SCALE);
  const per = (q: number) => (q > 0 ? (amount ?? 0) / q : 0);
  let line: MappedLine;
  if (sqft !== null) {
    line = { ...base, unit: 'SQFT', widthMm: null, heightMm: null, qtyMilli: milli(sqft), ratePaise: rupeesToPaise(rate ?? per(sqft)) };
  } else if (rft !== null) {
    line = { ...base, unit: 'RFT', widthMm: null, heightMm: null, qtyMilli: milli(rft), ratePaise: rupeesToPaise(rate ?? per(rft)) };
  } else if (unitPrice !== null) {
    line = { ...base, unit: 'UNIT', widthMm: width, heightMm: height, qtyMilli: milli(qty ?? 1), ratePaise: rupeesToPaise(unitPrice) };
  } else if (rate !== null && rate > 0 && width && height) {
    line = { ...base, unit: 'AREA', widthMm: width, heightMm: height, qtyMilli: null, ratePaise: rupeesToPaise(rate) };
  } else {
    /* An amount on its own: no quantity (Units prints blank, as it did there), the amount kept as agreed. */
    line = { ...base, unit: 'UNIT', widthMm: width, heightMm: height, qtyMilli: null, ratePaise: 0 };
  }
  return { line, unknownCode: !known };
}

/** The source's pricing choices as our terms. */
export function mapTerms(raw: unknown): MappedTerms {
  const s = (raw && typeof raw === 'object' ? raw : {}) as SourceSettings;
  const pct = num(s.modularPct);
  const fraction = pct === null ? 0.15 : pct > 1 ? pct / 100 : pct;
  const discountBps = Math.min(10_000, Math.max(0, Math.round(fraction * 10_000)));
  const onSpot = num(s.onSpot);
  const date = typeof s.quoteDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.quoteDate) && !Number.isNaN(Date.parse(`${s.quoteDate}T00:00:00Z`)) ? s.quoteDate : null;
  return {
    feeBps: s.feeOn === false ? 0 : FEE_BPS,
    discountBps,
    onSpotPaise: onSpot !== null && onSpot > 0 ? rupeesToPaise(onSpot) : 0,
    onSpotLabel: text(s.onSpotLabel, 60) || null,
    gstBps: s.gstOn === true ? GST_BPS : 0,
    quoteDate: date,
  };
}

const stageOf = (v: unknown): 'sales' | 'design' => (typeof v === 'string' && v.trim().toLowerCase() === 'design' ? 'design' : 'sales');

/** A source row's date: the printed quotation date, else the day it was saved (IST). */
export function dateOf(row: Pick<SourceQuote, 'created_at' | 'settings'>): string | null {
  const own = mapTerms(row.settings).quoteDate;
  if (own) return own;
  const t = row.created_at ? Date.parse(row.created_at) : Number.NaN;
  return Number.isNaN(t) ? null : new Date(t + 330 * 60_000).toISOString().slice(0, 10);
}

/** A search row, for the picker. */
export function toMatch(row: SourceQuote): SourceMatch {
  return {
    id: row.id,
    number: text(row.quote_no, 40) || '—',
    client: text(row.client_name, 120) || 'No name',
    bhk: text(row.bhk, 20) || null,
    location: text(row.location, 120) || null,
    tpvPaise: rupeesToPaise(num(row.tpv) ?? 0),
    date: dateOf(row),
    stage: stageOf(row.stage),
  };
}

/** The whole quotation as ours, with the check against the source's total. */
export function mapQuote(row: SourceQuote): MappedQuote {
  const raw = Array.isArray(row.lines) ? (row.lines as SourceLine[]) : [];
  const warnings: string[] = [];
  const lines: MappedLine[] = [];
  let unknownCodes = 0;
  for (const l of raw.slice(0, LINES_MAX)) {
    const m = mapLine(l && typeof l === 'object' ? l : {}, lines.length);
    if (!m) continue;
    lines.push(m.line);
    if (m.unknownCode) unknownCodes += 1;
  }
  if (raw.length > LINES_MAX) warnings.push(`Only the first ${LINES_MAX} lines were read.`);
  if (unknownCodes) warnings.push(`${unknownCodes} line${unknownCodes === 1 ? ' has' : 's have'} no MO-01 / NM-01 work code; read as on-site.`);
  if (lines.length === 0) warnings.push('This quotation has no lines.');
  const terms = mapTerms(row.settings);
  const totals = computeTotals(
    lines.map((l) => ({ unit: l.unit, code: l.code, ratePaise: l.ratePaise, widthMm: l.widthMm, heightMm: l.heightMm, qtyMilli: l.qtyMilli, amountPaise: l.amountPaise })),
    { feeBps: terms.feeBps, discountBps: terms.discountBps, onSpotPaise: terms.onSpotPaise, gstBps: terms.gstBps },
  );
  const sourceTpvPaise = rupeesToPaise(num(row.tpv) ?? 0);
  const difference = totals.beforeTaxPaise - sourceTpvPaise;
  const differencePaise = Math.abs(difference) <= TPV_TOLERANCE_PAISE ? 0 : difference;
  if (differencePaise !== 0) {
    const abs = Math.abs(differencePaise);
    const shown = abs % 100 === 0 ? (abs / 100).toLocaleString('en-IN') : (abs / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    warnings.push(`Our total before GST differs from the quotation app's by ₹${shown}. Check the lines and the discounts against what the client signed.`);
  }
  const run = num(row.kitchen_run);
  const phone = text(row.mobile, 20);
  return {
    sourceId: row.id,
    number: text(row.quote_no, 40) || row.id.slice(0, 8),
    stage: stageOf(row.stage),
    client: text(row.client_name, 120) || 'No name',
    phone: phone || null,
    location: text(row.location, 120) || null,
    bhk: text(row.bhk, 20) || null,
    kitchenRunMm: run !== null && run > 0 && run < 100_000 ? Math.round(run) : null,
    savedAt: typeof row.created_at === 'string' ? row.created_at : null,
    lines,
    terms,
    totals,
    sourceTpvPaise,
    differencePaise,
    warnings,
  };
}

/** The key we keep on our quotation, so the same source row is never imported twice. */
export const importKey = (sourceId: string): string => `hauspire:${sourceId}`;

/** Which product names are not in the studio's product master (compared without case or extra spaces). */
export function notInMaster(lines: readonly Pick<MappedLine, 'product'>[], masterNames: readonly string[]): Set<number> {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const known = new Set(masterNames.map(norm));
  const out = new Set<number>();
  lines.forEach((l, i) => {
    if (!known.has(norm(l.product))) out.add(i);
  });
  return out;
}

/**
 * What a search box may send to the source's PostgREST filter: letters,
 * digits, spaces, dot and hyphen only (commas, parentheses, quotes and
 * asterisks would change the filter), at most 40 characters. Empty when
 * nothing usable is left.
 */
export function cleanSearch(raw: unknown): string {
  return typeof raw === 'string' ? raw.replace(/[^\p{L}\p{N} .-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) : '';
}
