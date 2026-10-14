/**
 * Pricing a quotation line against a crew's rate card (Studio OS Phase 3).
 * Ported from Hauspire's `resolveLine` (docs/studio-os/HAUSPIRE-VENDOR-APP.md
 * §3.5), with carpentry chosen per line (owner, 12 Oct 2026): INSTALL is
 * installation only, per sq ft (₹150 unless the crew's card says otherwise);
 * FULL is full carpentry, per sq ft per product type off the crew's card.
 *
 * The idea Hauspire proved on real flats: the area the client is billed on is
 * the area the crew is paid on. A line with width × height prices itself
 * (W × H / 92,903.04 sq ft × the crew's rate); the rest are priced by a
 * person. Nothing here guesses a price: an unmatched item comes out with no
 * rate, and lands in "Price these".
 *
 * Pure, tested in tests/studio-crews-pricing.test.ts.
 */

import { areaMilli } from '@/modules/studio-quote/pricing';
import { CARPENTRY, type CrewUnitName } from './trades';

export type CarpentryModeName = 'INSTALL' | 'FULL';
export type QtySourceName = 'QUOTE' | 'ESTIMATE' | 'SITE' | 'MANUAL' | 'INVOICE';

/** A rate-card row as pricing reads it. A 0 is read as no rate. */
export interface CardRow {
  item: string;
  unit: CrewUnitName;
  ratePaise: number | null;
}

/** The quotation line, as frozen on the work order. */
export interface QuoteLineIn {
  product: string;
  code: 'MODULAR' | 'ONSITE' | null;
  /** The quotation's unit: AREA is width × height. */
  unit: 'AREA' | 'SQFT' | 'RFT' | 'UNIT' | null;
  widthMm: number | null;
  heightMm: number | null;
  qtyMilli: number | null;
}

/** Square feet on the quotation, as thousandths; null when it has none. */
export function quoteSqftMilli(l: QuoteLineIn): number | null {
  if (l.widthMm && l.heightMm) {
    const a = areaMilli(l.widthMm, l.heightMm);
    return a > 0 ? a : null;
  }
  if (l.unit === 'SQFT' && l.qtyMilli && l.qtyMilli > 0) return l.qtyMilli;
  return null;
}

/** The default carpentry mode of a line: factory-made units are installed; site work is full carpentry. */
export const defaultCarpentry = (code: QuoteLineIn['code']): CarpentryModeName => (code === 'ONSITE' ? 'FULL' : 'INSTALL');

interface Resolver {
  when?: RegExp;
  needsSqft?: boolean;
  item: string;
  alias?: RegExp;
  qty: 'sqft' | 'one' | 'none' | 'quote';
  unit: CrewUnitName;
  source: QtySourceName;
  /** FULL carpentry: look the product itself up on the card first. */
  byProduct?: boolean;
  /** INSTALL: the studio's installation rate when the card has none. */
  installDefault?: boolean;
}

const CUSTOM: Resolver = { item: 'Customised work', alias: /custom/i, qty: 'none', unit: 'LUMP', source: 'ESTIMATE' };

const INSTALL: Resolver[] = [
  { when: /loft/i, needsSqft: true, item: 'Loft installation', alias: /loft/i, qty: 'sqft', unit: 'SQFT', source: 'QUOTE' },
  { needsSqft: true, item: 'Modular installation', alias: /modular/i, qty: 'sqft', unit: 'SQFT', source: 'QUOTE', installDefault: true },
  { when: /bed/i, item: 'Hydraulic bed assembly', alias: /hydraulic|\bbed\b/i, qty: 'one', unit: 'NOS', source: 'QUOTE' },
  { when: /workstation|dressing/i, item: 'Workstation / dressing unit', alias: /workstation|dressing/i, qty: 'one', unit: 'NOS', source: 'QUOTE' },
  { when: /vanity/i, item: 'Vanity unit', alias: /vanity/i, qty: 'one', unit: 'NOS', source: 'QUOTE' },
  CUSTOM,
];

const FULL: Resolver[] = [
  { needsSqft: true, item: '', qty: 'sqft', unit: 'SQFT', source: 'QUOTE', byProduct: true },
  // NOT /carpent/: a card with "Modular carpentry" and "Manual carpentry" would match the wrong one.
  { needsSqft: true, item: 'Manual carpentry', alias: /manual|onsite|on-site|full/i, qty: 'sqft', unit: 'SQFT', source: 'QUOTE' },
  { when: /bed/i, item: 'Hydraulic bed assembly', alias: /hydraulic|\bbed\b/i, qty: 'one', unit: 'NOS', source: 'QUOTE' },
  CUSTOM,
];

/** Ordered per trade, first match wins. A trade with none (added in Settings) gives "Customised work" to price. */
export const TRADE_RESOLVERS: Readonly<Record<string, readonly Resolver[]>> = {
  glass: [
    { when: /mirror/i, needsSqft: true, item: 'Mirror 5mm edge polished', alias: /mirror/i, qty: 'sqft', unit: 'SQFT', source: 'QUOTE' },
    { when: /mirror/i, item: 'Mirror 5mm edge polished', alias: /mirror/i, qty: 'none', unit: 'SQFT', source: 'ESTIMATE' },
    { when: /shutter|profile/i, item: 'Glass profile shutter', alias: /profile|shutter/i, qty: 'one', unit: 'NOS', source: 'QUOTE' },
    { item: 'Toughened glass partition', alias: /toughen|partition/i, qty: 'quote', unit: 'SQFT', source: 'ESTIMATE' },
  ],
  upholstery: [
    { when: /headboard/i, item: 'Cushion headboard', alias: /headboard|cushion/i, qty: 'one', unit: 'NOS', source: 'QUOTE' },
    { item: 'Bed / sofa upholstery', alias: /uphol|sofa/i, qty: 'one', unit: 'NOS', source: 'QUOTE' },
  ],
  fabrication: [
    { when: /door/i, item: 'MS safety door', alias: /safety door/i, qty: 'one', unit: 'NOS', source: 'QUOTE' },
    { item: 'MS structure / railing', alias: /railing|structure/i, qty: 'none', unit: 'RFT', source: 'ESTIMATE' },
  ],
  false_ceiling: [{ item: 'Plain gypsum ceiling', alias: /gypsum|ceiling/i, qty: 'quote', unit: 'SQFT', source: 'ESTIMATE' }],
  electrical: [{ item: 'Point wiring', alias: /point|wiring/i, qty: 'none', unit: 'POINT', source: 'ESTIMATE' }],
  painting: [
    { when: /polish/i, item: 'PU polish', alias: /polish/i, qty: 'quote', unit: 'SQFT', source: 'ESTIMATE' },
    { when: /texture/i, item: 'Texture finish', alias: /texture/i, qty: 'quote', unit: 'SQFT', source: 'ESTIMATE' },
    { item: 'Putty + primer + 2 coats', alias: /putty|primer|coat/i, qty: 'quote', unit: 'SQFT', source: 'ESTIMATE' },
  ],
  civil: [
    { when: /granite|platform/i, item: 'Granite / platform work', alias: /granite|platform/i, qty: 'none', unit: 'RFT', source: 'ESTIMATE' },
    { when: /plumb/i, item: 'Plumbing point', alias: /plumb/i, qty: 'none', unit: 'POINT', source: 'ESTIMATE' },
    { item: 'Civil breaking & making', alias: /civil|breaking/i, qty: 'none', unit: 'LUMP', source: 'ESTIMATE' },
  ],
  hardware: [{ item: 'Supplied on invoice', alias: /invoice|supplied/i, qty: 'none', unit: 'LUMP', source: 'INVOICE' }],
};

/** The item names a trade looks for, as suggestions in the rate-card editor. */
export function expectedItems(trade: string): string[] {
  const list = trade === CARPENTRY ? [...INSTALL, ...FULL] : (TRADE_RESOLVERS[trade] ?? [CUSTOM]);
  return [...new Set(list.map((r) => r.item).filter(Boolean))];
}

const canon = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const FILLER = new Set(['work', 'works', 'unit', 'units', 'installation', 'install', 'assembly', 'custom', 'customised', 'customized', 'charges', 'labour', 'labor', 'storage']);
const significant = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 6 && !FILLER.has(w));

/**
 * The card row for an item, widest match last: exact, canonical, the
 * resolver's alias, a shared significant word. A wrong match prices work at
 * someone else's rate, which is worse than no match, so the last two are
 * narrow.
 */
export function findRate(card: readonly CardRow[], item: string, alias?: RegExp): CardRow | undefined {
  if (!item && !alias) return undefined;
  if (item) {
    const exact = card.find((r) => r.item.toLowerCase() === item.toLowerCase());
    if (exact) return exact;
    const key = canon(item);
    const byCanon = card.find((r) => canon(r.item) === key);
    if (byCanon) return byCanon;
  }
  if (alias) {
    const byAlias = card.find((r) => alias.test(r.item));
    if (byAlias) return byAlias;
  }
  const words = significant(item);
  if (words.length) {
    const byWord = card.find((r) => {
      const theirs = significant(r.item);
      return words.some((w) => theirs.includes(w));
    });
    if (byWord) return byWord;
  }
  return undefined;
}

/** A card rate: 0, negatives and blanks are no rate (a zero would price the line at ₹0 and it would never be paid). */
export const cardRate = (r: CardRow | undefined): number | null => (r && r.ratePaise !== null && r.ratePaise > 0 ? r.ratePaise : null);

export interface PricedLine {
  item: string;
  unit: CrewUnitName;
  ratePaise: number | null;
  qtyMilli: number | null;
  qtySource: QtySourceName;
  carpentry: CarpentryModeName | null;
}

function qtyFor(r: Resolver, sqft: number | null, line: QuoteLineIn, unit: CrewUnitName): number | null {
  if (r.qty === 'sqft') return sqft;
  if (r.qty === 'one') return 1000;
  if (r.qty === 'quote') {
    // The quote's own quantity, when it is in the crew's unit.
    if (unit === 'SQFT') return sqft;
    if (unit === 'RFT' && line.unit === 'RFT' && line.qtyMilli) return line.qtyMilli;
    return null;
  }
  return null;
}

/**
 * The item, unit, rate and quantity for one line on one crew. Two passes:
 * the most specific resolver the crew HAS A RATE for, then the most specific
 * overall with no rate, named so "Price these" says what to price.
 */
export function resolveLine(
  trade: string,
  line: QuoteLineIn,
  card: readonly CardRow[],
  opts: { carpentry?: CarpentryModeName | null; installRatePaise: number },
): PricedLine {
  const sqft = quoteSqftMilli(line);
  const carpentry = trade === CARPENTRY ? (opts.carpentry ?? defaultCarpentry(line.code)) : null;
  const list = trade === CARPENTRY ? (carpentry === 'FULL' ? FULL : INSTALL) : (TRADE_RESOLVERS[trade] ?? [CUSTOM]);
  const applicable = list.filter((r) => !(r.needsSqft && !sqft) && !(r.when && !r.when.test(line.product)));

  for (const r of applicable) {
    // Full carpentry never takes an installation-only rate, whatever the product is called.
    const row = r.byProduct ? findRate(card.filter((c) => !/install/i.test(c.item)), line.product) : findRate(card, r.item, r.alias);
    const rate = cardRate(row);
    if (!row || rate === null) continue;
    return { item: row.item, unit: row.unit, ratePaise: rate, qtyMilli: qtyFor(r, sqft, line, row.unit), qtySource: r.source, carpentry };
  }

  // Installation with no rate on the card: the studio's installation rate (₹150 by default).
  const install = applicable.find((r) => r.installDefault);
  if (install && opts.installRatePaise > 0) {
    return { item: install.item, unit: 'SQFT', ratePaise: opts.installRatePaise, qtyMilli: sqft, qtySource: 'QUOTE', carpentry };
  }

  const first = applicable.find((r) => !r.byProduct) ?? CUSTOM;
  return { item: first.item, unit: first.unit, ratePaise: null, qtyMilli: qtyFor(first, sqft, line, first.unit), qtySource: first.source, carpentry };
}
