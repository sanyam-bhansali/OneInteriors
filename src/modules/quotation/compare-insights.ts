/**
 * What a comparison of platform quotes actually says — by room, by material,
 * in a few plain sentences — and the check that keeps an AI summary of it
 * honest (plan §8).
 *
 * Everything here reads `FirstQuote`s priced on the same lines, so every
 * difference is the studio's rate or the studio's material, never the size.
 *
 * ## The checker
 *
 * A written summary is shown only when every rupee figure and every
 * percentage in it can be found in the numbers it was given. One figure it
 * cannot place — a hallucinated rate, a total rounded the wrong way — and the
 * page shows the rule-based summary instead. The model is a writer here, not
 * a source.
 *
 * Pure, and tested.
 */

import { formatINRCompact } from '@/lib/money';
import { findTerms } from '@/modules/materials/glossary';
import type { FirstQuote, Comparison } from './first-quote';

export interface Entry {
  slug: string;
  name: string;
  quote: FirstQuote;
}

// ── By room ────────────────────────────────────────────────────

export interface RoomSpread {
  room: string;
  label: string;
  /** Per studio, in the comparison's order; null where it priced nothing in the room. */
  cells: { slug: string; name: string; subtotalPaise: number | null }[];
  lowPaise: number;
  highPaise: number;
  spreadPaise: number;
}

export function roomSpreads(entries: Entry[]): RoomSpread[] {
  const rooms = new Map<string, string>();
  for (const e of entries) for (const r of e.quote.rooms) rooms.set(r.room, r.label);
  const out: RoomSpread[] = [];
  for (const [room, label] of rooms) {
    const cells = entries.map((e) => ({
      slug: e.slug,
      name: e.name,
      subtotalPaise: e.quote.rooms.find((r) => r.room === room)?.subtotalPaise ?? null,
    }));
    const priced = cells.map((c) => c.subtotalPaise).filter((v): v is number => v !== null);
    if (priced.length === 0) continue;
    const low = Math.min(...priced);
    const high = Math.max(...priced);
    out.push({ room, label, cells, lowPaise: low, highPaise: high, spreadPaise: high - low });
  }
  return out.sort((a, b) => b.spreadPaise - a.spreadPaise);
}

// ── By material ────────────────────────────────────────────────

/**
 * The items whose price says most about a studio's materials: the big
 * carpentry faces. Compared as the price of the same item at the same size,
 * never as a per-square-foot rate — a studio's rate card is its own business,
 * and a customer screen that printed it would be the easiest place for a
 * competitor to read it (the owner, 30 Sep 2026).
 */
const MATERIAL_ITEMS = ['kitchen_base', 'kitchen_wall', 'master_wardrobe'];

export interface MaterialRow {
  code: string;
  label: string;
  unit: string;
  cells: {
    slug: string;
    name: string;
    /** The line's price at the standard size — the same size for every studio. */
    amountPaise: number | null;
    spec: string | null;
    /** Glossary ids in the spec — how two studios' words are matched to one material. */
    materials: string[];
  }[];
}

export function materialRows(entries: Entry[]): MaterialRow[] {
  const rows: MaterialRow[] = [];
  for (const code of MATERIAL_ITEMS) {
    const lines = entries.map((e) => e.quote.lines.find((l) => l.code === code) ?? null);
    const first = lines.find(Boolean);
    if (!first) continue;
    rows.push({
      code,
      label: first.label,
      unit: first.unit,
      cells: entries.map((e, i) => {
        const l = lines[i];
        return {
          slug: e.slug,
          name: e.name,
          amountPaise: l?.amountPaise ?? null,
          spec: l?.spec ?? null,
          materials: l?.spec ? [...new Set(findTerms(l.spec).map((t) => t.material.id))].sort() : [],
        };
      }),
    });
  }
  return rows;
}

/**
 * Studios that quote the same material, and what each charges for it — the
 * like-for-like the plan asks for ("18mm BWP ply, veneer: ₹2,130 at Akara,
 * ₹1,950 at Sixth Wall"). Grouped on glossary ids, never on the sentence.
 */
export function sameSpecGroups(row: MaterialRow): { spec: string; studios: { name: string; amountPaise: number }[] }[] {
  const groups = new Map<string, { spec: string; studios: { name: string; amountPaise: number }[] }>();
  for (const c of row.cells) {
    if (c.amountPaise === null || !c.spec) continue;
    const key = c.materials.length > 0 ? c.materials.join('+') : c.spec.toLowerCase();
    const g = groups.get(key) ?? { spec: c.spec, studios: [] };
    g.studios.push({ name: c.name, amountPaise: c.amountPaise });
    groups.set(key, g);
  }
  return [...groups.values()];
}

// ── The rule-based summary ─────────────────────────────────────

export interface CompareSummary {
  headline: string;
  points: string[];
  questions: string[];
}

const money = (p: number) => formatINRCompact(p);

export function deterministicSummary(entries: Entry[], comparison: Comparison): CompareSummary {
  const sorted = [...entries].sort((a, b) => a.quote.totalPaise - b.quote.totalPaise);
  const low = sorted[0]!;
  const high = sorted[sorted.length - 1]!;
  const gap = high.quote.totalPaise - low.quote.totalPaise;
  const pct = low.quote.totalPaise > 0 ? Math.round((gap / low.quote.totalPaise) * 100) : 0;

  const headline =
    gap === 0
      ? `All ${entries.length} quotes come to ${money(low.quote.totalPaise)}.`
      : `${low.name} is lowest at ${money(low.quote.totalPaise)}; ${high.name} is highest at ${money(high.quote.totalPaise)}, ${pct}% more.`;

  const points: string[] = [];
  const rooms = roomSpreads(entries).filter((r) => r.spreadPaise > 0).slice(0, 2);
  for (const r of rooms) {
    points.push(`${r.label}: ${money(r.lowPaise)} to ${money(r.highPaise)} across these studios.`);
  }
  const materialDiffers = comparison.tellingRows.filter((l) => l.materialsDiffer).slice(0, 2);
  for (const l of materialDiffers) {
    points.push(`${l.label}: the studios quote different materials — read the specs before the prices.`);
  }
  const gaps = entries.filter((e) => e.quote.notPriced.length > 0);
  for (const e of gaps) {
    points.push(`${e.name} has not priced ${e.quote.notPriced.length} item${e.quote.notPriced.length === 1 ? '' : 's'}, so its total leaves them out.`);
  }

  const questions = [
    'Which lines would change after a site measurement?',
    materialDiffers.length > 0 ? 'Can each studio quote the same board and finish, so the prices compare?' : null,
    'What is paid before anything is installed?',
  ].filter((q): q is string => q !== null);

  return { headline, points: points.slice(0, 4), questions };
}

// ── What the model is given ────────────────────────────────────

/** The only numbers a written summary may use, as plain lines. */
export function compareFacts(entries: Entry[]): string {
  const lines: string[] = ['Quotes, each priced on the same lines and sizes, with GST:'];
  for (const e of entries) lines.push(`- ${e.name}: total ${money(e.quote.totalPaise)}.`);
  lines.push('', 'By room (subtotals before fees and GST):');
  for (const r of roomSpreads(entries)) {
    lines.push(`- ${r.label}: ${r.cells.map((c) => `${c.name} ${c.subtotalPaise === null ? 'not priced' : money(c.subtotalPaise)}`).join(', ')}.`);
  }
  lines.push('', 'Materials and prices on the main carpentry items, each at the same size (never state a rate per square foot):');
  for (const row of materialRows(entries)) {
    lines.push(`- ${row.label}: ${row.cells.map((c) => (c.amountPaise === null ? `${c.name} not priced` : `${c.name} ${money(c.amountPaise)} (${c.spec ?? 'no spec given'})`)).join('; ')}.`);
  }
  return lines.join('\n');
}

// ── The checker ────────────────────────────────────────────────

/** Devanagari digits (०–९) as ASCII, so a Hindi or Marathi figure is checked like any other. */
export function asciiDigits(text: string): string {
  return text.replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966));
}

/* Longest first, so "lakhs" is not read as "L". The Latin letters must not run
   on into a word ("3 Living rooms" is not ₹3 L). */
const MONEY =
  /(₹|Rs\.?|रु\.?|रुपये)?\s?(\d[\d,]*(?:\.\d+)?)\s*(crores|crore|Cr|lakhs|lakh|L|thousand|K|k|करोड़|करोड|कोटी|लाख|हज़ार|हजार)?(?![A-Za-z])/g;

/**
 * Every rupee figure in a text, in paise: "₹6.16 L", "₹2.13 K", "Rs 61,633",
 * "₹1.2 Cr", "६.१६ लाख", "4.53 lakh". A number counts as money when it has a
 * rupee sign or a money unit — so a translated figure without the sign is
 * still checked, and "4,400 mm" is not.
 */
export function rupeeFigures(text: string): number[] {
  const out: number[] = [];
  for (const m of asciiDigits(text).matchAll(MONEY)) {
    if (!m[1] && !m[3]) continue;
    const n = Number(m[2]!.replace(/,/g, ''));
    if (!Number.isFinite(n)) continue;
    const unit = (m[3] ?? '').toLowerCase();
    const mult = /^(cr|करोड|कोटी)/.test(unit)
      ? 1e7
      : /^(l|लाख)/.test(unit)
        ? 1e5
        : /^(k|thousand|हज़ार|हजार)/.test(unit)
          ? 1e3
          : 1;
    out.push(Math.round(n * mult * 100));
  }
  return out;
}

export function percentFigures(text: string): number[] {
  return [...asciiDigits(text).matchAll(/(\d+(?:\.\d+)?)\s?(%|per ?cent|प्रतिशत|टक्के|टक्का)/g)].map((m) => Number(m[1]));
}

/** Every figure the summary is allowed to state: totals, subtotals, item prices, and the differences between them. */
export function allowedFigures(entries: Entry[]): { paise: number[]; percents: number[] } {
  const base: number[] = [];
  for (const e of entries) {
    base.push(e.quote.totalPaise);
    for (const r of e.quote.rooms) base.push(r.subtotalPaise);
  }
  for (const row of materialRows(entries)) for (const c of row.cells) if (c.amountPaise !== null) base.push(c.amountPaise);
  const diffs: number[] = [];
  const percents: number[] = [];
  const groups = [
    entries.map((e) => e.quote.totalPaise),
    ...roomSpreads(entries).map((r) => r.cells.map((c) => c.subtotalPaise).filter((v): v is number => v !== null)),
    ...materialRows(entries).map((row) => row.cells.map((c) => c.amountPaise).filter((v): v is number => v !== null)),
  ];
  for (const g of groups) {
    for (const a of g) for (const b of g) {
      if (a >= b) continue;
      diffs.push(b - a);
      percents.push(Math.round(((b - a) / a) * 100));
    }
  }
  return { paise: [...base, ...diffs], percents };
}

/**
 * Does every figure in the text come from the data? Compact rupee figures
 * round (₹6.16 L is any of ₹6,15,500–6,16,499), so a figure matches an
 * allowed value within 1%; a percentage must be within one point.
 */
export function figuresCheck(text: string, allowed: { paise: number[]; percents: number[] }): { ok: boolean; stray: string[] } {
  const stray: string[] = [];
  for (const p of rupeeFigures(text)) {
    if (!allowed.paise.some((a) => Math.abs(a - p) <= Math.max(a * 0.01, 100))) stray.push(`₹${p / 100}`);
  }
  for (const pc of percentFigures(text)) {
    if (!allowed.percents.some((a) => Math.abs(a - pc) <= 1)) stray.push(`${pc}%`);
  }
  return { ok: stray.length === 0, stray };
}
