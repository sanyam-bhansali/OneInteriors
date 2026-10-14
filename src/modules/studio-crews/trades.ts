/**
 * Trades, and routing quotation lines to them (Studio OS Phase 3,
 * docs/studio-os/PHASE-3-EXECUTION.md §1–2). Ported from Hauspire's Vendor
 * Ledger (docs/studio-os/HAUSPIRE-VENDOR-APP.md §3.4): the matching STRATEGY
 * (exact, canonical, suffix stripped, longest name, keywords, work code) was
 * tuned on 943 real workbooks and is kept; the VOCABULARY is data, and a
 * studio adds its own rows in Settings, which win over Hauspire's.
 *
 * Two changes from Hauspire: Modular and Onsite carpentry are one trade,
 * Carpentry (the owner, 12 Oct 2026: each carpentry line is installation only
 * or full carpentry, chosen per line), and trades are keys with editable
 * labels, so renaming one never orphans a crew or a work order.
 *
 * Pure, tested in tests/studio-crews-routing.test.ts.
 */

export interface Trade {
  /** Stable: stored on crews, lines and work orders. */
  key: string;
  label: string;
  /** Switched off: not offered for new crews or work, still read on old. */
  active: boolean;
  /** Billed on the supplier's invoice, not labour on a rate. */
  invoice?: boolean;
}

/** Hauspire's trades (owner, 12 Oct 2026). */
export const DEFAULT_TRADES: readonly Trade[] = [
  { key: 'carpentry', label: 'Carpentry', active: true },
  { key: 'false_ceiling', label: 'False ceiling', active: true },
  { key: 'painting', label: 'Painting', active: true },
  { key: 'electrical', label: 'Electrical', active: true },
  { key: 'glass', label: 'Glass', active: true },
  { key: 'upholstery', label: 'Upholstery', active: true },
  { key: 'fabrication', label: 'Fabrication', active: true },
  { key: 'civil', label: 'Civil & plumbing', active: true },
  { key: 'hardware', label: 'Hardware & fittings', active: true, invoice: true },
];

export const CARPENTRY = 'carpentry';

/** A key for a new trade from its label: letters and digits, underscores. */
export function tradeKeyFor(label: string, taken: readonly string[]): string {
  const base = label.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30) || 'trade';
  let key = base;
  for (let i = 2; taken.includes(key); i++) key = `${base}_${i}`;
  return key;
}

export function tradeLabel(trades: readonly Trade[], key: string): string {
  return trades.find((t) => t.key === key)?.label ?? DEFAULT_TRADES.find((t) => t.key === key)?.label ?? key;
}

// ── Hauspire's routing table ──────────────────────────────────

/** Exact product names → trade key. Hauspire's ProductMaster and archive, typos kept as typed. */
export const HAUSPIRE_PRODUCTS: Readonly<Record<string, string>> = {
  'Base Cabinets': 'carpentry',
  'Wall Cabinets': 'carpentry',
  'Tall Unit': 'carpentry',
  'Tall Pantry Unit': 'carpentry',
  'Premium Shutter Wardrobe': 'carpentry',
  'Walk-In Premium Shutter Wardrobe': 'carpentry',
  'Sliding Wardrobe': 'carpentry',
  'Loft (Frame with Shutter)': 'carpentry',
  Bookshelf: 'carpentry',
  'Study Unit': 'carpentry',
  'Storage Unit': 'carpentry',
  'Dry Balcony- Base Storage': 'carpentry',
  'Dry Balcony- Overhead Storage': 'carpentry',
  'Console Unit/Shoe Rack': 'carpentry',
  'Foyer Unit': 'carpentry',
  'Dressing Unit- Back Storage': 'carpentry',
  'Dressing Unit- Base Storage': 'carpentry',
  'Crockery Unit': 'carpentry',
  'Vanity Unit': 'carpentry',
  Workstation: 'carpentry',
  'Workstation- Overhead': 'carpentry',
  'Side Table': 'carpentry',
  'Single Bed': 'carpentry',
  'King size Bed- Hydraulic Storage': 'carpentry',
  'Queen size Bed- Hydraulic Storage': 'carpentry',
  Mandir: 'carpentry',
  'TV Unit': 'carpentry',
  Partition: 'carpentry',
  'Entrance Décor': 'carpentry',
  'Foyer Décor': 'carpentry',
  'Sofa Back Wall Décor': 'carpentry',
  'Bay Window': 'carpentry',
  'Window Seatout': 'carpentry',
  'Breakfast Counter': 'carpentry',
  'Foldable Dining': 'carpentry',
  'Murphy Bed': 'carpentry',
  Bed: 'carpentry',
  'Base Cabinets- Tandems': 'hardware',
  'Sliding Mechanism': 'hardware',
  'Appliance Unit': 'hardware',
  'Dressing Unit- Mirror': 'glass',
  'Wall Cabinets- Glass Profile Shutters': 'glass',
  Headboard: 'upholstery',
  'Sofa Cum Bed': 'upholstery',
  'Day Bed': 'upholstery',
  'Safety Door': 'fabrication',
  'False Ceiling (per room)': 'false_ceiling',
  'Minimal False Ceiling (per room)': 'false_ceiling',
  Electricals: 'electrical',
  Painting: 'painting',
  'Civil & Plumbing Changes': 'civil',
  'Granite Change': 'civil',
  'Platform Creation': 'civil',
  'Dry Balcony- Overhead Unit': 'carpentry',
  'Dry Balcony- Base Unit': 'carpentry',
  'Dry Balcony- Overhead -01': 'carpentry',
  'Bar Unit': 'carpentry',
  'Bar Counter': 'carpentry',
  'Crcokery Unit': 'carpentry',
  'Wall Caninet': 'carpentry',
  'Store Room': 'carpentry',
  'Show Piece Unit': 'carpentry',
  'Foladble Dining': 'carpentry',
  'Folable Dining': 'carpentry',
  'Inverter Unit': 'carpentry',
  'Paiting -3bhk': 'painting',
  'Paiting- 2bhk': 'painting',
  'Service Platfrom Creation': 'civil',
  'Dry Balcony- Platfrom Creation': 'civil',
  'Dry Balcony- New Platfrom Creation': 'civil',
  'Sink Creation': 'civil',
  'Counter Top Change': 'civil',
  'Wall Break': 'civil',
  'Renovation of 2 Washroom': 'civil',
  'Window frame': 'fabrication',
  'Iron Table': 'fabrication',
  'Staircase with Framing for Slab': 'fabrication',
  'Dry Balcony-Fabrication': 'fabrication',
  Sofa: 'upholstery',
  'Indian Seating': 'upholstery',
  'Dining Seating': 'upholstery',
};

/**
 * Ordered keyword rules, first match wins, only when no name matched.
 * Loose on purpose: designers type "Electrcials", "Slding Mechanism".
 * Specialist trades come before the factory-unit words, so a "Day Bed" is
 * upholstery, not carpentry.
 */
export const HAUSPIRE_KEYWORDS: readonly { test: RegExp; trade: string }[] = [
  { test: /tandem|sl[iy]?d(?:e|ing)? ?mech|appliance unit|hardware|trolley|basket|hinge|channel/i, trade: 'hardware' },
  { test: /vanity/i, trade: 'carpentry' },
  { test: /glass|mirror/i, trade: 'glass' },
  { test: /headboard|sofa cum bed|day bed|cushion/i, trade: 'upholstery' },
  { test: /safety door|\bms\b|railing|grill/i, trade: 'fabrication' },
  { test: /false ceiling|gypsum|\bpop\b/i, trade: 'false_ceiling' },
  { test: /electr/i, trade: 'electrical' },
  { test: /paint|polish|texture/i, trade: 'painting' },
  { test: /civil|plumb|granite|platform|dado|\btile|marble/i, trade: 'civil' },
  { test: /mandir|partition|d[eé]cor|panell?ing|bay window|seat ?out|sit ?out|breakfast counter|fold(?:able|ing) dining|entrance|tv unit/i, trade: 'carpentry' },
  {
    test: /wardrobe|loft|shoe ?rack|foyer|console|workstation|study|bookshelf|tall (unit|pantry)|crockery|dressing|storage|cabinet|\bbed\b|side table|shelf/i,
    trade: 'carpentry',
  },
];

/** Names Hauspire leaves for the studio to decide: they arrive "trade guessed". */
export const FLAGGED_FOR_STUDIO = ['Acrylic Sheet', 'Acrylic Finish', 'Sliding Door', 'Main Door', 'Window change', 'Windows Change', 'Laminate Change', 'Dry Balcony - PVC Covering', 'Ledges on wall', 'Aquariam Setup'] as const;

// ── The studio's own rows ─────────────────────────────────────

/** A studio's routing rule: an exact product name, or a word the name contains. */
export interface RouteRule {
  match: 'exact' | 'keyword';
  text: string;
  trade: string;
}

export type RouteVia = 'studio' | 'exact' | 'canon' | 'suffix' | 'partial' | 'rule' | 'workcode';

/** Letters and digits only: "Queen size Bed- Hydraulic Storage" and "Queen Size Bed Hydraulic Storage" agree. */
export const canon = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** A trailing "-(Kids Bedroom)", "- 3BHK" or "(2 nos)" is context, not the name. "Loft (Frame with Shutter)" keeps its brackets. */
export const stripSuffix = (p: string): string =>
  p
    .replace(/\s*-\s*\([^)]*\)\s*$/, '')
    .replace(/\s*-\s*\d\s*BHK\s*$/i, '')
    .replace(/\s*\(\s*\d+\s*(no\.?s?|nos)?\s*\)\s*$/i, '')
    .trim();

export interface RouteTable {
  studio: readonly RouteRule[];
  /** Hauspire's table underneath the studio's rows (a setting; on by default). */
  useHauspire: boolean;
}

const HAUSPIRE_CANON: ReadonlyMap<string, string> = new Map(Object.entries(HAUSPIRE_PRODUCTS).map(([k, v]) => [canon(k), v]));
const HAUSPIRE_KEYS: readonly string[] = [...HAUSPIRE_CANON.keys()].sort((a, b) => b.length - a.length);

/**
 * The trade a quotation line goes to, and how it got there. A studio row wins
 * (exact before keyword, in their order); then Hauspire's table; then the
 * work code (both codes are carpentry now), flagged as a guess — leaving a
 * line out is the dearer mistake, because the work happens and nobody is
 * billed for it.
 */
export function routeProduct(product: string, table: RouteTable): { trade: string; via: RouteVia; guessed: boolean } {
  const clean = product.replace(/\s+/g, ' ').trim();
  const key = canon(clean);
  const strippedKey = canon(stripSuffix(clean));
  for (const r of table.studio) {
    if (r.match === 'exact' && (canon(r.text) === key || canon(r.text) === strippedKey)) return { trade: r.trade, via: 'studio', guessed: false };
  }
  for (const r of table.studio) {
    const word = r.text.trim().toLowerCase();
    if (r.match === 'keyword' && word && clean.toLowerCase().includes(word)) return { trade: r.trade, via: 'studio', guessed: false };
  }
  if (table.useHauspire) {
    const exact = HAUSPIRE_PRODUCTS[clean];
    if (exact) return { trade: exact, via: 'exact', guessed: false };
    const byCanon = HAUSPIRE_CANON.get(key);
    if (byCanon) return { trade: byCanon, via: 'canon', guessed: false };
    if (strippedKey !== key && HAUSPIRE_CANON.has(strippedKey)) return { trade: HAUSPIRE_CANON.get(strippedKey)!, via: 'suffix', guessed: false };
    // Longest Hauspire name containing, or contained by, this one; nine characters at least so short names swallow nothing.
    for (const k of HAUSPIRE_KEYS) {
      if (k.length < 9) continue;
      if (key.includes(k) || (key.length >= 9 && k.includes(key))) return { trade: HAUSPIRE_CANON.get(k)!, via: 'partial', guessed: false };
    }
    for (const r of HAUSPIRE_KEYWORDS) if (r.test.test(clean)) return { trade: r.trade, via: 'rule', guessed: false };
  }
  return { trade: CARPENTRY, via: 'workcode', guessed: true };
}

// ── Rate items each trade looks for ───────────────────────────

export type CrewUnitName = 'SQFT' | 'RFT' | 'POINT' | 'NOS' | 'LUMP';
export const CREW_UNITS: readonly CrewUnitName[] = ['SQFT', 'RFT', 'POINT', 'NOS', 'LUMP'];
export const CREW_UNIT_LABEL: Record<CrewUnitName, string> = { SQFT: 'sq ft', RFT: 'running ft', POINT: 'point', NOS: 'number', LUMP: 'lump sum' };
export const CREW_UNIT_SHORT: Record<CrewUnitName, string> = { SQFT: 'sq ft', RFT: 'rft', POINT: 'pt', NOS: 'no.', LUMP: 'lump' };
export const isCrewUnit = (v: unknown): v is CrewUnitName => typeof v === 'string' && (CREW_UNITS as readonly string[]).includes(v);

export interface TemplateItem {
  item: string;
  unit: CrewUnitName;
  /** Paise per unit; null = set your own (only ₹150 modular installation is confirmed). */
  ratePaise: number | null;
}

/** Hauspire's ₹150 per sq ft, installation only (the units come made). */
export const INSTALL_RATE_PAISE = 15_000;

/** Rate templates per trade, copied onto a new crew. Only the installation rate is Hauspire's real number. */
export const DEFAULT_TEMPLATES: Readonly<Record<string, readonly TemplateItem[]>> = {
  carpentry: [
    { item: 'Modular installation', unit: 'SQFT', ratePaise: INSTALL_RATE_PAISE },
    { item: 'Loft installation', unit: 'SQFT', ratePaise: null },
    { item: 'Manual carpentry', unit: 'SQFT', ratePaise: null },
    { item: 'Wardrobe', unit: 'SQFT', ratePaise: null },
    { item: 'Kitchen', unit: 'SQFT', ratePaise: null },
    { item: 'TV unit', unit: 'SQFT', ratePaise: null },
    { item: 'Hydraulic bed assembly', unit: 'NOS', ratePaise: null },
    { item: 'Vanity unit', unit: 'NOS', ratePaise: null },
    { item: 'Customised work', unit: 'LUMP', ratePaise: null },
  ],
  false_ceiling: [{ item: 'Plain gypsum ceiling', unit: 'SQFT', ratePaise: null }],
  painting: [
    { item: 'Putty + primer + 2 coats', unit: 'SQFT', ratePaise: null },
    { item: 'PU polish', unit: 'SQFT', ratePaise: null },
    { item: 'Texture finish', unit: 'SQFT', ratePaise: null },
  ],
  electrical: [{ item: 'Point wiring', unit: 'POINT', ratePaise: null }],
  glass: [
    { item: 'Mirror 5mm edge polished', unit: 'SQFT', ratePaise: null },
    { item: 'Glass profile shutter', unit: 'NOS', ratePaise: null },
    { item: 'Toughened glass partition', unit: 'SQFT', ratePaise: null },
  ],
  upholstery: [
    { item: 'Cushion headboard', unit: 'NOS', ratePaise: null },
    { item: 'Bed / sofa upholstery', unit: 'NOS', ratePaise: null },
  ],
  fabrication: [
    { item: 'MS safety door', unit: 'NOS', ratePaise: null },
    { item: 'MS structure / railing', unit: 'RFT', ratePaise: null },
  ],
  civil: [
    { item: 'Granite / platform work', unit: 'RFT', ratePaise: null },
    { item: 'Plumbing point', unit: 'POINT', ratePaise: null },
    { item: 'Civil breaking & making', unit: 'LUMP', ratePaise: null },
  ],
  hardware: [{ item: 'Supplied on invoice', unit: 'LUMP', ratePaise: null }],
};
