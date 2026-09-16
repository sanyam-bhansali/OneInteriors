/**
 * The product master a studio starts from.
 *
 * Pure data. No `server-only`, so it can be tested and read from anywhere.
 *
 * ## Every rate here is zero, on purpose
 *
 * `/studio/rates` tells studios, in these words: *"We do not set your prices.
 * Nothing here is pre-filled, there is no suggested figure, and we will never
 * nudge you toward one."* Shipping a catalogue with plausible Pune rates in it
 * would break that promise on the first screen of the software, and break it in
 * the worst way — a studio in a hurry would accept the defaults, and we would
 * have quietly set the prices of a business we also take 5% from.
 *
 * So what this ships is the SHAPE of a catalogue: what the line is called, how
 * it is measured, whether it is factory or site work, and roughly how big it
 * usually is. The number is theirs. The product master screen counts what is
 * still blank and says so, because a catalogue with no rates cannot produce a
 * quotation and the studio should find that out from us rather than from a
 * client.
 *
 * ## Why not Hauspire's catalogue
 *
 * Hauspire's product master is 15KB of their own SKUs, their own work codes and
 * their own product names, calibrated to how they build. Handing it to a rival
 * studio would be handing over a competitor's operating detail, and it would
 * describe work that studio does not do in words it does not use.
 */

export type StarterUnit = 'AREA' | 'SQFT' | 'RFT' | 'UNIT';
export type StarterCode = 'MODULAR' | 'ONSITE';

/** The rooms the first-quote builder groups by. */
export const ROOM_CATEGORIES = [
  'Kitchen',
  'Bedroom',
  'Living',
  'Study',
  'Bathroom',
  'Whole home',
] as const;

export type RoomCategory = (typeof ROOM_CATEGORIES)[number];

export interface StarterProduct {
  name: string;
  code: StarterCode;
  unit: StarterUnit;
  rooms: RoomCategory[];
  /** Millimetres, for AREA lines. A starting size, always editable. */
  defaultWidthMm?: number;
  defaultHeightMm?: number;
  defaultQty?: number;
  details?: string;
  sortOrder: number;
}

/**
 * Sizes are the ones that recur, not the ones that are correct.
 *
 * A 1500 × 2100 wardrobe and a 750-high base run are what a designer starts
 * from before measuring, which is the point: the builder should put a plausible
 * line on the page fast, and be obviously editable.
 */
export const STARTER_CATALOGUE: StarterProduct[] = [
  // ── Kitchen ──────────────────────────────────────────────────
  { name: 'Base cabinets', code: 'MODULAR', unit: 'AREA', rooms: ['Kitchen'], defaultHeightMm: 750, sortOrder: 10, details: 'Carcass, shutters, hardware and installation. Priced on the run.' },
  { name: 'Wall cabinets', code: 'MODULAR', unit: 'AREA', rooms: ['Kitchen'], defaultHeightMm: 600, sortOrder: 20, details: 'Carcass, shutters, hardware and installation.' },
  { name: 'Tall unit', code: 'MODULAR', unit: 'AREA', rooms: ['Kitchen'], defaultWidthMm: 600, defaultHeightMm: 2100, sortOrder: 30 },
  { name: 'Loft', code: 'MODULAR', unit: 'AREA', rooms: ['Kitchen', 'Bedroom', 'Study'], defaultWidthMm: 1500, defaultHeightMm: 600, sortOrder: 40 },
  { name: 'Drawer and basket sets', code: 'MODULAR', unit: 'UNIT', rooms: ['Kitchen'], defaultQty: 4, sortOrder: 50, details: 'Soft-close runners. Quote per set.' },
  { name: 'Countertop', code: 'ONSITE', unit: 'RFT', rooms: ['Kitchen'], sortOrder: 60, details: 'Stone, cut, edged and fitted.' },
  { name: 'Dado and backsplash tiling', code: 'ONSITE', unit: 'SQFT', rooms: ['Kitchen', 'Bathroom'], sortOrder: 70 },
  { name: 'Sink, tap and plumbing fittings', code: 'ONSITE', unit: 'UNIT', rooms: ['Kitchen'], defaultQty: 1, sortOrder: 80 },

  // ── Bedroom ──────────────────────────────────────────────────
  { name: 'Wardrobe', code: 'MODULAR', unit: 'AREA', rooms: ['Bedroom'], defaultWidthMm: 1500, defaultHeightMm: 2100, sortOrder: 110, details: 'Carcass, shutters, internal shelving and hanging.' },
  { name: 'Walk-in wardrobe', code: 'MODULAR', unit: 'AREA', rooms: ['Bedroom'], defaultWidthMm: 2400, defaultHeightMm: 2100, sortOrder: 120 },
  { name: 'Bed with storage', code: 'MODULAR', unit: 'UNIT', rooms: ['Bedroom'], defaultQty: 1, sortOrder: 130 },
  { name: 'Headboard', code: 'MODULAR', unit: 'UNIT', rooms: ['Bedroom'], defaultQty: 1, sortOrder: 140 },
  { name: 'Bedside tables', code: 'MODULAR', unit: 'UNIT', rooms: ['Bedroom'], defaultQty: 2, sortOrder: 150 },
  { name: 'Dresser with mirror', code: 'MODULAR', unit: 'UNIT', rooms: ['Bedroom'], defaultQty: 1, sortOrder: 160 },

  // ── Living ───────────────────────────────────────────────────
  { name: 'TV unit', code: 'MODULAR', unit: 'AREA', rooms: ['Living'], defaultWidthMm: 1500, defaultHeightMm: 2100, sortOrder: 210 },
  { name: 'Crockery unit', code: 'MODULAR', unit: 'AREA', rooms: ['Living'], defaultWidthMm: 1200, defaultHeightMm: 2100, sortOrder: 220 },
  { name: 'Console and shoe rack', code: 'MODULAR', unit: 'AREA', rooms: ['Living'], defaultWidthMm: 1200, defaultHeightMm: 900, sortOrder: 230 },
  { name: 'Pooja unit', code: 'MODULAR', unit: 'AREA', rooms: ['Living'], defaultWidthMm: 600, defaultHeightMm: 1800, sortOrder: 240 },
  { name: 'Sofa and upholstery', code: 'ONSITE', unit: 'UNIT', rooms: ['Living'], defaultQty: 1, sortOrder: 250 },
  { name: 'Safety door', code: 'ONSITE', unit: 'UNIT', rooms: ['Living'], defaultQty: 1, sortOrder: 260 },

  // ── Study ────────────────────────────────────────────────────
  { name: 'Workstation', code: 'MODULAR', unit: 'AREA', rooms: ['Study', 'Bedroom'], defaultWidthMm: 1200, defaultHeightMm: 750, sortOrder: 310 },
  { name: 'Bookshelf', code: 'MODULAR', unit: 'AREA', rooms: ['Study', 'Living'], defaultWidthMm: 1200, defaultHeightMm: 2100, sortOrder: 320 },

  // ── Bathroom ─────────────────────────────────────────────────
  { name: 'Vanity unit', code: 'MODULAR', unit: 'AREA', rooms: ['Bathroom'], defaultWidthMm: 600, defaultHeightMm: 600, sortOrder: 410 },
  { name: 'Mirror with storage', code: 'MODULAR', unit: 'UNIT', rooms: ['Bathroom'], defaultQty: 1, sortOrder: 420 },

  // ── Whole home ───────────────────────────────────────────────
  { name: 'False ceiling — plain', code: 'ONSITE', unit: 'SQFT', rooms: ['Whole home'], sortOrder: 510, details: 'Single-layer gypsum with concealed wiring and panel lights. Priced on room area.' },
  { name: 'False ceiling — designer', code: 'ONSITE', unit: 'SQFT', rooms: ['Whole home'], sortOrder: 520, details: 'Cove, drops or profile lighting.' },
  { name: 'Painting — putty, primer and two coats', code: 'ONSITE', unit: 'SQFT', rooms: ['Whole home'], sortOrder: 530, details: 'Priced on wall area, not floor area.' },
  { name: 'Painting — texture or accent wall', code: 'ONSITE', unit: 'SQFT', rooms: ['Whole home'], sortOrder: 540 },
  { name: 'PU polish on woodwork', code: 'ONSITE', unit: 'SQFT', rooms: ['Whole home'], sortOrder: 550 },
  { name: 'Electrical points', code: 'ONSITE', unit: 'UNIT', rooms: ['Whole home'], sortOrder: 560, details: 'Per point, including wiring and switch plate.' },
  { name: 'Plumbing points', code: 'ONSITE', unit: 'UNIT', rooms: ['Whole home', 'Bathroom'], sortOrder: 570 },
  { name: 'Civil breaking and making', code: 'ONSITE', unit: 'SQFT', rooms: ['Whole home'], sortOrder: 580 },
  { name: 'Glass partition', code: 'ONSITE', unit: 'SQFT', rooms: ['Whole home'], sortOrder: 590, details: 'Toughened, with hardware.' },
  { name: 'Mirror, edge polished', code: 'ONSITE', unit: 'SQFT', rooms: ['Whole home', 'Bedroom', 'Bathroom'], sortOrder: 600 },
  { name: 'Wallpaper', code: 'ONSITE', unit: 'SQFT', rooms: ['Whole home'], sortOrder: 610 },
  { name: 'Curtains and blinds', code: 'ONSITE', unit: 'RFT', rooms: ['Whole home'], sortOrder: 620 },
  { name: 'Site supervision and project management', code: 'ONSITE', unit: 'UNIT', rooms: ['Whole home'], defaultQty: 1, sortOrder: 630, details: 'Where it is charged separately rather than inside the professional fee.' },
];

/** How many products a studio still has to price before it can quote. */
export function unpricedCount(products: { ratePaise: number }[]): number {
  return products.filter((p) => p.ratePaise <= 0).length;
}

/**
 * The catalogue as rows ready for insertion, with every rate at zero.
 *
 * Takes the studio id rather than reaching for it, so this stays pure and the
 * caller owns the database.
 */
export function starterRowsFor(studioId: string) {
  return STARTER_CATALOGUE.map((p) => ({
    studioId,
    name: p.name,
    code: p.code,
    unit: p.unit,
    details: p.details ?? null,
    ratePaise: BigInt(0),
    rooms: p.rooms as string[],
    defaultWidthMm: p.defaultWidthMm ?? null,
    defaultHeightMm: p.defaultHeightMm ?? null,
    defaultQty: p.defaultQty ?? null,
    sortOrder: p.sortOrder,
  }));
}
