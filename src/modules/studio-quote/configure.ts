/**
 * A flat, described in the few facts that decide a quotation — and the
 * quotation those facts produce.
 *
 * Pure. No `server-only`, no Prisma, no session: it takes the studio's own
 * catalogue as plain rows and returns proposed lines. CONTRIBUTING §9.5. That
 * is what makes the arithmetic below testable without a database, which
 * matters here more than most places, because a mistake in this file is
 * twenty-five wrong lines in front of a homeowner rather than one.
 *
 * ## Why this exists at all
 *
 * A 3 BHK quotation is about forty lines, and roughly twenty-five of them are
 * the same twenty-five every time: base cabinets, wall cabinets, a loft, a
 * wardrobe per bedroom, a vanity per bathroom, false ceiling, painting,
 * electricals. Typing them by hand each time is an hour, and an hour is how
 * long it takes for a studio to decide a spreadsheet was fine.
 *
 * ## What this is not
 *
 * It is not a price list and it never invents a figure. Every rate comes off
 * the studio's own product, and a product they have not priced produces a line
 * at zero that the builder flags as needing a figure — visibly unfinished
 * rather than quietly wrong. The same promise `/studio/rates` makes in so many
 * words: *we do not set your prices.*
 *
 * It is also not a floor plan. The dimensions are the sizes that recur, not
 * the sizes that are correct, and every one of them is editable the moment it
 * lands. The build is a starting point that is faster to correct than to
 * create — which is the only honest claim available without a tape measure.
 */

import type { RoomCategory } from './starter-catalogue';

/** The configurations that cover essentially every flat in Pune. */
export const CONFIGS = ['1 BHK', '2 BHK', '3 BHK', '4 BHK'] as const;
export type ConfigName = (typeof CONFIGS)[number];

export function isConfigName(value: string | null | undefined): value is ConfigName {
  return typeof value === 'string' && (CONFIGS as readonly string[]).includes(value);
}

/**
 * A room on the quotation: a name a client would recognise, and the catalogue
 * category it draws products from.
 *
 * Two different things on purpose. "Kids bedroom" and "Guest bedroom" are
 * distinct rooms with distinct lines, and both take products filed under
 * Bedroom. Collapsing them would put one wardrobe on a quotation for a flat
 * with three.
 */
export interface PlannedRoom {
  name: string;
  category: RoomCategory;
}

/**
 * The bedrooms each configuration has, in the order a designer walks them.
 *
 * Master first because it is the one the client cares about and the one that
 * gets the walk-in wardrobe; the rest in descending likelihood of being used.
 */
const BEDROOMS: Record<ConfigName, string[]> = {
  '1 BHK': ['Master bedroom'],
  '2 BHK': ['Master bedroom', 'Second bedroom'],
  '3 BHK': ['Master bedroom', 'Kids bedroom', 'Guest bedroom'],
  '4 BHK': ['Master bedroom', 'Kids bedroom', 'Guest bedroom', 'Parents bedroom'],
};

export function bedroomCount(config: ConfigName): number {
  return BEDROOMS[config].length;
}

export interface HomeConfig {
  config: ConfigName;
  /**
   * Millimetres of kitchen run: base, wall and loft are all priced on it.
   *
   * Null is honest rather than defaulted. A studio who has not measured the
   * kitchen gets a kitchen with no widths and a flag saying so, which is a
   * question they can answer; a guessed 3000 is a number that prints.
   */
  kitchenRunMm: number | null;
  bathrooms: number;
  study: boolean;
}

/**
 * Every room this flat gets, in document order.
 *
 * Kitchen first, then bedrooms, then living, then the study if there is one,
 * then bathrooms, then the whole-home work. That is the order a quotation
 * reads in and the order a site is built in, and a client scanning for their
 * kitchen should find it at the top rather than in the middle.
 */
export function roomsFor(home: HomeConfig): PlannedRoom[] {
  const rooms: PlannedRoom[] = [{ name: 'Kitchen', category: 'Kitchen' }];

  for (const name of BEDROOMS[home.config]) {
    rooms.push({ name, category: 'Bedroom' });
  }

  rooms.push({ name: 'Living and dining', category: 'Living' });

  if (home.study) rooms.push({ name: 'Study', category: 'Study' });

  /* Numbered only when there is more than one. "Bathroom 1" on a flat with
     one bathroom is a form talking to itself. */
  const baths = Math.max(0, Math.min(home.bathrooms, 6));
  for (let i = 1; i <= baths; i += 1) {
    rooms.push({ name: baths === 1 ? 'Bathroom' : `Bathroom ${i}`, category: 'Bathroom' });
  }

  rooms.push({ name: 'Whole home', category: 'Whole home' });

  return rooms;
}

/** What the planner needs to know about one of the studio's products. */
export interface CatalogueProduct {
  id: string;
  name: string;
  code: 'MODULAR' | 'ONSITE';
  unit: 'AREA' | 'SQFT' | 'RFT' | 'UNIT';
  details: string | null;
  ratePaise: number;
  rooms: string[];
  defaultWidthMm: number | null;
  defaultHeightMm: number | null;
  defaultQty: number | null;
  inStandardBuild: boolean;
  isActive: boolean;
  sortOrder: number;
}

/** A line the planner proposes. Deliberately the shape the builder edits. */
export interface PlannedLine {
  room: string;
  product: string;
  code: 'MODULAR' | 'ONSITE';
  unit: 'AREA' | 'SQFT' | 'RFT' | 'UNIT';
  details: string | null;
  widthMm: number | null;
  heightMm: number | null;
  /** Thousandths, as everywhere else. */
  qtyMilli: number | null;
  ratePaise: number;
}

/**
 * Products whose width IS the kitchen run.
 *
 * Matched on the studio's own names, loosely, because this is their catalogue
 * and they may call a loft an overhead. A miss costs nothing — the line still
 * lands, carrying the product's own default width for somebody to correct —
 * which is why this is a helpful guess rather than a rule the build depends
 * on.
 */
const RUN_WIDTH = [/\bbase\b/i, /\bwall\b/i, /\bloft\b/i, /\boverhead\b/i];

function takesKitchenRun(product: CatalogueProduct): boolean {
  if (product.unit !== 'AREA') return false;
  if (!product.rooms.includes('Kitchen')) return false;
  return RUN_WIDTH.some((pattern) => pattern.test(product.name));
}

export interface PlanResult {
  lines: PlannedLine[];
  /**
   * What the studio should know before they read the figures.
   *
   * Not errors. Each one is a thing that is missing rather than a thing that
   * has gone wrong, and each names what to do about it.
   */
  notes: string[];
}

/**
 * The quotation this flat and this catalogue produce.
 *
 * ## The rules, and the reason for each
 *
 * - **A product appears in every room of its category.** A wardrobe marked for
 *   Bedroom lands in all three bedrooms of a 3 BHK, because it does in life.
 *   This is the rule that turns twenty-five ticks into forty lines.
 * - **Whole-home work appears once.** Painting and electricals are quoted for
 *   the flat, not per room. Repeating them per room would multiply a ₹55,000
 *   line by five and produce a total nobody would question until the client
 *   did.
 * - **The kitchen run sets three widths.** See `takesKitchenRun`.
 * - **A product with no rate still lands.** At zero, flagged. Dropping it
 *   would silently produce a shorter quotation than the studio's own
 *   specification, and short is the direction that loses money.
 */
export function planQuotation(home: HomeConfig, catalogue: CatalogueProduct[]): PlanResult {
  const usable = catalogue
    .filter((p) => p.isActive && p.inStandardBuild)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (usable.length === 0) {
    return {
      lines: [],
      notes: [
        'Nothing in your product list is marked as standard yet. Tick the products you fit on nearly every job and this builds the quotation for you.',
      ],
    };
  }

  const lines: PlannedLine[] = [];

  for (const room of roomsFor(home)) {
    for (const product of usable) {
      if (!product.rooms.includes(room.category)) continue;

      const runWidth = takesKitchenRun(product) ? home.kitchenRunMm : null;

      lines.push({
        room: room.name,
        product: product.name,
        code: product.code,
        unit: product.unit,
        details: product.details,
        widthMm: product.unit === 'AREA' ? (runWidth ?? product.defaultWidthMm) : null,
        heightMm: product.unit === 'AREA' ? product.defaultHeightMm : null,
        qtyMilli:
          product.unit === 'AREA'
            ? null
            : product.defaultQty != null
              ? product.defaultQty * 1000
              : null,
        ratePaise: product.ratePaise,
      });
    }
  }

  const notes: string[] = [];

  const unpriced = new Set(usable.filter((p) => p.ratePaise <= 0).map((p) => p.name));
  if (unpriced.size > 0) {
    notes.push(
      unpriced.size === 1
        ? `${[...unpriced][0]} has no rate yet, so its lines are at zero. Price it in your product list and rebuild.`
        : `${unpriced.size} products have no rate yet, so their lines are at zero. Price them in your product list and rebuild.`,
    );
  }

  if (home.kitchenRunMm == null && usable.some(takesKitchenRun)) {
    notes.push(
      'No kitchen run, so the base, wall and loft lines carry standard widths. Measure it and rebuild to size them properly.',
    );
  }

  /* Said plainly rather than left for somebody to notice on site. A quotation
     with no measured line is a quotation nobody has been to the flat for. */
  const blank = lines.filter((l) => l.unit === 'AREA' && (!l.widthMm || !l.heightMm)).length;
  if (blank > 0) {
    notes.push(
      `${blank} ${blank === 1 ? 'line has' : 'lines have'} no size yet. They stay at zero until you fill them in.`,
    );
  }

  return { lines, notes };
}
