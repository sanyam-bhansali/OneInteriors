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
import { standardKitchenRunMm } from '@/modules/quotation/first-quote';
import type { PlanRoomSize } from '@/modules/brief/types';
import { planRoomFor, wardrobeWidthMm } from '@/modules/floorplan/sizing';

/**
 * The configurations that cover essentially every flat in Pune, and the
 * villa (Hauspire's builder offers it): a villa is built like a 4 BHK with a
 * study, and its flat-size products are the 4 BHK ones.
 */
export const CONFIGS = ['1 BHK', '2 BHK', '3 BHK', '4 BHK', 'Villa'] as const;
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
  Villa: ['Master bedroom', 'Kids bedroom', 'Guest bedroom', 'Parents bedroom'],
};

/** The bedroom count a configuration stands for: its digit, and 4 for a villa. */
export function bhkNumber(config: ConfigName): number {
  return config === 'Villa' ? 4 : Number(config.charAt(0));
}

export function bedroomCount(config: ConfigName): number {
  return BEDROOMS[config].length;
}

/**
 * The run to assume when a studio has not measured the kitchen.
 *
 * The same ladder the customer-facing first quote uses, imported rather than
 * repeated. Two standard kitchens that disagree would mean a studio's own
 * builder and the quote we generate on their behalf pricing the same flat
 * differently — which is the one comparison a studio is guaranteed to make.
 *
 * `first-quote.ts` is pure and carries no `server-only`, so importing it here
 * is safe: this module is read by the browser.
 */
export function standardRunFor(config: ConfigName): number {
  return standardKitchenRunMm(bhkNumber(config));
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
  /**
   * A dry balcony to fit out. Absent reads as yes — nearly every Pune flat
   * has one, and a product a studio ticked as standard should not vanish
   * because an older form never asked.
   */
  balcony?: boolean;
  /**
   * The client's floor plan, read: wardrobes and lofts take each bedroom's
   * wall, a room's false ceiling takes its floor area. Filled on the server
   * from the brief, never from the browser (`applyConfiguration`).
   */
  planRooms?: PlanRoomSize[];
  /** Ask the server to use the client's floor plan. */
  usePlan?: boolean;
  /**
   * The master bedroom gets the studio's "King …" product in place of the
   * "Queen …" one (Hauspire's "Master: King bed"). Absent reads as yes, which
   * is what every build did before the switch existed.
   */
  kingMaster?: boolean;
  /**
   * Room-wise false ceiling (Hauspire's "False ceiling (room-wise)"): one line
   * per room — kitchen, bedrooms, living, study — from the studio's own
   * "False ceiling (Room)" product, sized to the room on the plan.
   */
  falseCeiling?: boolean;
  /**
   * A rate for a plain "False ceiling" line, per sq ft, used only when the
   * studio has no false-ceiling product at all. Typed on the quotation, never
   * invented: without it, a studio with no such product gets a note instead.
   */
  falseCeilingRatePaise?: number | null;
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

  /* A villa always has its study (Hauspire's applyConfig). */
  if (home.study || home.config === 'Villa') rooms.push({ name: 'Study', category: 'Study' });

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
  /** The product's build rules (`ProductRules`). Absent means none. */
  rules?: ProductRules | null;
}

/**
 * How a product behaves in the standard build — the same rules Hauspire's
 * Quotation Studio keeps in `fq_config`, carried over by the quotation read.
 *
 * - `bhk` ("3BHK"): only in a flat of that size. Painting and electricals are
 *   priced per home, one product per size.
 * - `balcony`: only when the flat has a dry balcony.
 * - `perBath`: one per bathroom, whatever room it is filed under.
 * - `perBed`: a whole-home product counted once per bedroom.
 * - `sqft` / `rft`: the default quantity of a sq ft or running ft product.
 * - `useRun`: width is the kitchen run (the name match below also catches it).
 */
export interface ProductRules {
  bhk?: string;
  balcony?: boolean;
  perBath?: boolean;
  perBed?: boolean;
  useRun?: boolean;
  sqft?: number;
  rft?: number;
}

/** Rules off a JSON column, keeping only what is well formed. */
export function readRules(raw: unknown): ProductRules | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const out: ProductRules = {};
  if (typeof r.bhk === 'string' && /\d/.test(r.bhk)) out.bhk = r.bhk;
  if (r.balcony === true) out.balcony = true;
  if (r.perBath === true) out.perBath = true;
  if (r.perBed === true) out.perBed = true;
  if (r.useRun === true) out.useRun = true;
  if (typeof r.sqft === 'number' && r.sqft > 0) out.sqft = r.sqft;
  if (typeof r.rft === 'number' && r.rft > 0) out.rft = r.rft;
  return Object.keys(out).length > 0 ? out : null;
}

/** The bedroom count a `bhk` rule names, or null. */
export function bhkOfRule(rule: string | undefined): number | null {
  const m = rule?.match(/(\d)/);
  return m ? Number(m[1]) : null;
}

/**
 * The room a product is named for, when its name says so: "False Ceiling
 * (Kids Bedroom)". Such a product goes only in that room. Matched on words,
 * so a studio's own spelling works.
 */
const ROOM_WORDS: { word: RegExp; room: RegExp }[] = [
  { word: /\bmaster\b/i, room: /^master/i },
  { word: /\bkids?\b/i, room: /^kids/i },
  { word: /\bguest\b/i, room: /^guest/i },
  { word: /\bparents?\b/i, room: /^parents/i },
  { word: /\bsecond\b/i, room: /^second/i },
  { word: /\bliving\b/i, room: /^living/i },
  { word: /\bstudy\b/i, room: /^study/i },
  /* "False Ceiling (Kitchen)": without this the kitchen's ceiling was never
     sized from the plan, and the room-wise toggle skipped it as already done. */
  { word: /\bkitchen\b/i, room: /^kitchen/i },
];

export function namedRoomOf(productName: string): RegExp | null {
  const q = productName.match(/\(([^)]*)\)/)?.[1];
  if (!q || /balcony/i.test(q)) return null;
  return ROOM_WORDS.find((w) => w.word.test(q))?.room ?? null;
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
  if (product.rules?.balcony) return false;
  if (product.rules?.useRun) return true;
  return RUN_WIDTH.some((pattern) => pattern.test(product.name));
}

/**
 * The flat size a product is for: its `bhk` rule, else its own name
 * ("Painting - 3BHK (Emulsion)", "Electricals (2 BHK)") — Hauspire's BHK
 * variant selection, which reads the size off the product name.
 */
export function bhkOfProduct(product: Pick<CatalogueProduct, 'name' | 'rules'>): number | null {
  return bhkOfRule(product.rules?.bhk) ?? bhkOfRule(product.name.match(/\b([1-6])\s*bhk\b/i)?.[1]);
}

/** Does this product belong in this flat at all? (`bhk`, `balcony`). */
function fitsHome(product: CatalogueProduct, home: HomeConfig): boolean {
  const bhk = bhkOfProduct(product);
  if (bhk !== null && bhk !== bhkNumber(home.config)) return false;
  if (product.rules?.balcony && home.balcony === false) return false;
  return true;
}

/** Does this product go in this room? */
function fitsRoom(product: CatalogueProduct, room: PlannedRoom): boolean {
  if (product.rules?.perBath) return room.category === 'Bathroom';
  if (!product.rooms.includes(room.category)) return false;
  const named = namedRoomOf(product.name);
  return named === null || named.test(room.name);
}

/**
 * The master bedroom gets the king: a standard "Queen …" product is swapped
 * for the studio's "King …" product of the same name there, when they have
 * one. Hauspire's first quote does exactly this.
 */
function kingFor(product: CatalogueProduct, room: PlannedRoom, all: CatalogueProduct[], home: HomeConfig): CatalogueProduct {
  if (home.kingMaster === false) return product;
  if (!/^master/i.test(room.name) || !/\bqueen\b/i.test(product.name)) return product;
  const want = squash(product.name.replace(/\bqueen\b/i, 'king'));
  return all.find((p) => p.isActive && p.ratePaise > 0 && squash(p.name) === want) ?? product;
}

function squash(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** The default quantity of a non-area product, in thousandths. */
function defaultQtyMilli(product: CatalogueProduct, home: HomeConfig): number | null {
  if (product.unit === 'SQFT' && product.rules?.sqft) return Math.round(product.rules.sqft * 1000);
  if (product.unit === 'RFT' && product.rules?.rft) return Math.round(product.rules.rft * 1000);
  if (product.unit === 'UNIT' && product.rules?.perBed) return bedroomCount(home.config) * 1000;
  return product.defaultQty != null ? product.defaultQty * 1000 : product.unit === 'UNIT' ? 1000 : null;
}

/**
 * Hauspire's standard first-quote selection, by product name
 * (`firstQuoteDefaults.ts standardPatch`), in our room categories.
 *
 * Used only when a studio has ticked nothing as standard: their own ticks
 * always win. Generalised in two ways — names are matched loosely, so a
 * studio's own spelling of "Base cabinets" still lands, and the sizes it
 * carries are defaults a product's own sizes override.
 */
export interface StandardPatch {
  rooms: RoomCategory[];
  rules?: ProductRules;
  widthMm?: number;
  heightMm?: number;
  qty?: number;
}

export function standardSelectionFor(name: string, unit: CatalogueProduct['unit']): StandardPatch | null {
  const s = name.toLowerCase();
  const bhk = s.match(/([1-4])\s*bhk/)?.[1];
  const dims = (w: number, h: number) => (unit === 'AREA' ? { widthMm: w, heightMm: h } : {});

  // Kitchen
  if (/tandem/.test(s) && /(horizon|horizant)/.test(s)) return { rooms: ['Kitchen'], qty: 3 };
  if (/tandem/.test(s) && /(vertical|bottle)/.test(s)) return { rooms: ['Kitchen'], qty: 1 };
  if (/tandem/.test(s)) return { rooms: ['Kitchen'], qty: 4 };
  if (/base cabinet/.test(s)) return { rooms: ['Kitchen'], rules: { useRun: true }, heightMm: 750 };
  if (/wall cabinet/.test(s) && /(glass|profile shutter)/.test(s)) return { rooms: ['Kitchen'], qty: 1 };
  if (/wall cabinet/.test(s)) return { rooms: ['Kitchen'], rules: { useRun: true }, heightMm: 600 };
  if (/\bloft\b/.test(s)) return { rooms: ['Kitchen', 'Bedroom', 'Study'], rules: { useRun: true }, ...dims(1500, 600) };
  if (/dry balcony/.test(s)) return { rooms: ['Kitchen'], rules: { balcony: true }, ...dims(1200, 600) };

  // Bedroom
  if (/wardrobe/.test(s) && !/walk/.test(s)) return { rooms: ['Bedroom', 'Study'], ...dims(1500, 2100) };
  if (/bed/.test(s) && /(hydraulic|storage)/.test(s) && !/king/.test(s)) return { rooms: ['Bedroom'], qty: 1 };
  if (/headboard/.test(s) && !/king/.test(s)) return { rooms: ['Bedroom'], qty: 1 };
  if (/dressing/.test(s) && /(base|back)\s*storage/.test(s)) return { rooms: ['Bedroom'], qty: 1 };
  if (/dressing/.test(s) && /mirror/.test(s)) return { rooms: ['Bedroom'], qty: 1 };
  if (/workstation/.test(s) && !/overhead/.test(s) && !/fold/.test(s)) return { rooms: ['Bedroom', 'Study'], ...dims(1200, 750) };

  // Living
  if (/tv unit/.test(s) && !/ledge/.test(s) && !/base/.test(s)) return { rooms: ['Living'], ...dims(1500, 2100) };
  if (/safety door/.test(s)) return { rooms: ['Living'], qty: 1 };
  if (/mandir/.test(s)) return { rooms: ['Living'], ...dims(600, 1800) };
  if (/(console|shoe rack)/.test(s)) return { rooms: ['Living'], ...dims(1200, 900) };

  // Other services
  if (/vanity/.test(s)) return { rooms: ['Bathroom'], rules: { perBath: true }, ...dims(600, 600) };
  if (/painting/.test(s) && !/lust/.test(s)) return { rooms: ['Whole home'], ...(bhk ? { rules: { bhk: `${bhk}BHK` } } : {}) };
  if (/electrical/.test(s)) return { rooms: ['Whole home'], ...(bhk ? { rules: { bhk: `${bhk}BHK` } } : {}) };

  return null;
}

/**
 * The catalogue with Hauspire's standard selection applied — only when the
 * studio has not ticked a single active product as standard. Returns the
 * catalogue unchanged otherwise, and says which happened.
 */
export function withStandardSelection(catalogue: CatalogueProduct[]): { catalogue: CatalogueProduct[]; applied: boolean } {
  if (catalogue.some((p) => p.isActive && p.inStandardBuild)) return { catalogue, applied: false };
  let applied = false;
  const out = catalogue.map((p) => {
    if (!p.isActive) return p;
    const patch = standardSelectionFor(p.name, p.unit);
    if (!patch) return p;
    applied = true;
    return {
      ...p,
      inStandardBuild: true,
      rooms: patch.rooms,
      rules: { ...(patch.rules ?? {}), ...(p.rules ?? {}) },
      defaultWidthMm: p.defaultWidthMm ?? patch.widthMm ?? null,
      defaultHeightMm: p.defaultHeightMm ?? patch.heightMm ?? null,
      defaultQty: p.defaultQty ?? patch.qty ?? null,
    };
  });
  return { catalogue: out, applied };
}

/**
 * The order lines sit in within a room, as Hauspire's real quotations list
 * them (`buildQuote.ts ITEM_ORDER`): base cabinets before tandems before wall
 * cabinets before the loft; wardrobe before dressing before bed; TV unit
 * before console before mandir. A product the list does not know keeps the
 * studio's own order, after the known ones.
 */
const ITEM_ORDER: ((s: string) => boolean)[] = [
  // Kitchen
  (s) => /base cabinet/.test(s) && !/tandem/.test(s),
  (s) => /tandem/.test(s) && /horiz/.test(s),
  (s) => /tandem/.test(s) && /(vertical|bottle)/.test(s),
  (s) => /tandem/.test(s),
  (s) => /wall cabinet/.test(s) && !/glass|profile shutter/.test(s),
  (s) => /wall cabinet/.test(s) && /(glass|profile shutter)/.test(s),
  (s) => /\bloft\b/.test(s),
  (s) => /tall pantry/.test(s),
  (s) => /appliance/.test(s),
  (s) => /crockery/.test(s),
  (s) => /breakfast/.test(s),
  (s) => /platform/.test(s),
  (s) => /dry balcony/.test(s),
  // Bedroom
  (s) => /wardrobe/.test(s) && !/walk/.test(s),
  (s) => /walk.?in/.test(s) && /wardrobe/.test(s),
  (s) => /dressing/.test(s) && /(base|back)\s*storage/.test(s),
  (s) => /dressing/.test(s) && /mirror/.test(s),
  (s) => /bed/.test(s) && /(hydraulic|storage)/.test(s),
  (s) => /headboard/.test(s),
  (s) => /side table/.test(s),
  (s) => /workstation/.test(s) && !/overhead/.test(s),
  (s) => /workstation/.test(s) && /overhead/.test(s),
  (s) => /bay window/.test(s),
  // Living
  (s) => /tv unit/.test(s) && !/base/.test(s),
  (s) => /tv unit/.test(s),
  (s) => /(console|shoe rack)/.test(s),
  (s) => /safety door/.test(s),
  (s) => /mandir/.test(s),
  (s) => /foyer/.test(s),
  // Other services
  (s) => /vanity/.test(s),
  (s) => /painting/.test(s),
  (s) => /electrical/.test(s),
  (s) => /windows/.test(s),
  (s) => /civil|plumbing/.test(s),
  (s) => /false ceiling/.test(s),
];

export function itemRank(name: string): number {
  const s = name.toLowerCase();
  const i = ITEM_ORDER.findIndex((t) => t(s));
  return i < 0 ? ITEM_ORDER.length : i;
}

/** The rooms that take a false ceiling: not bathrooms, not the whole-home line. */
function takesCeiling(room: PlannedRoom): boolean {
  return room.category !== 'Bathroom' && room.category !== 'Whole home';
}

/** A room's key for matching "False Ceiling (Kids Bedroom)" to "Kids bedroom". */
function ceilingKey(room: PlannedRoom): string {
  if (room.category === 'Study') return 'study';
  if (room.category === 'Living') return 'living';
  if (room.category === 'Kitchen') return 'kitchen';
  return room.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const isCeiling = (p: Pick<CatalogueProduct, 'name'>) => /false\s*ceiling/i.test(p.name);

/**
 * The studio's false-ceiling product for a room: the room-named one
 * ("False Ceiling (Master Bedroom)"), the plainest name first, skipping
 * balcony / bathroom / utility variants; else a plain "False ceiling" with
 * no room in its name. Null when they have neither.
 */
export function ceilingProductFor(room: PlannedRoom, catalogue: CatalogueProduct[]): CatalogueProduct | null {
  const ceilings = catalogue.filter((p) => p.isActive && isCeiling(p));
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  const key = ceilingKey(room);
  const named = ceilings
    .filter((p) => {
      const inner = norm(p.name).replace(/^.*false ceiling/, '').trim();
      return inner.includes(key) && !/balcony|bathroom|toilet|utility/.test(inner);
    })
    .sort((a, b) => a.name.length - b.name.length);
  if (named[0]) return named[0];
  const plain = ceilings
    .filter((p) => !/\(/.test(p.name) || /per room/i.test(p.name))
    .sort((a, b) => a.name.length - b.name.length);
  return plain[0] ?? null;
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
export function planQuotation(home: HomeConfig, studioCatalogue: CatalogueProduct[]): PlanResult {
  const standard = withStandardSelection(studioCatalogue);
  const catalogue = standard.catalogue;
  /* Hauspire's order within a room, the studio's own order after that. */
  const usable = catalogue
    .filter((p) => p.isActive && p.inStandardBuild && fitsHome(p, home))
    .slice()
    .sort((a, b) => itemRank(a.name) - itemRank(b.name) || a.sortOrder - b.sortOrder);

  if (usable.length === 0) {
    return {
      lines: [],
      notes: [
        'Nothing in your product list is marked as standard yet. Tick the products you fit on nearly every job and this builds the quotation for you.',
      ],
    };
  }

  const lines: PlannedLine[] = [];
  const planned = roomsFor(home);
  let sizedFromPlan = 0;
  let ceilingsFromPlan = 0;
  let noCeilingProduct = false;

  for (const room of planned) {
    /* The plan room for this one: bedrooms in order (master first), living,
       study. Null without a plan, or for a room the plan does not show. */
    const bedIndex = room.category === 'Bedroom' ? planned.filter((r) => r.category === 'Bedroom').indexOf(room) : null;
    const fromPlan = home.planRooms?.length ? planRoomFor(room.name, bedIndex, home.planRooms) : null;

    for (const standardProduct of usable) {
      if (!fitsRoom(standardProduct, room)) continue;
      const product = kingFor(standardProduct, room, catalogue, home);

      /* Measured if they gave it, the standard for this configuration if not.
         A base run with no width at all would price at zero and look like a
         kitchen nobody quoted, which is worse than a stated assumption. */
      /* In the kitchen only. A loft filed under Kitchen and Bedroom took the
         kitchen run in every bedroom too — 4,200 mm over a wardrobe (11 Oct). */
      const runWidth =
        room.category === 'Kitchen' && takesKitchenRun(product)
          ? (home.kitchenRunMm ?? standardRunFor(home.config))
          : null;

      /* From the plan: a bedroom's wardrobe or loft takes its wall; a
         room-named ceiling (sq ft) takes the room's floor area. */
      const planWidth =
        fromPlan && runWidth === null && product.unit === 'AREA' && room.category === 'Bedroom' && /wardrobe|loft/i.test(product.name)
          ? wardrobeWidthMm(fromPlan)
          : null;
      /* In the kitchen, only the ceiling takes the floor area: a "Backsplash
         (Kitchen)" priced per sq ft is wall, not floor. */
      const planSqft =
        fromPlan &&
        product.unit === 'SQFT' &&
        namedRoomOf(product.name) !== null &&
        (room.category !== 'Kitchen' || isCeiling(product))
          ? fromPlan.sqft
          : null;
      if (planWidth !== null || planSqft !== null) sizedFromPlan += 1;

      lines.push({
        room: room.name,
        product: product.name,
        code: product.code,
        unit: product.unit,
        details: product.details,
        widthMm: product.unit === 'AREA' ? (runWidth ?? planWidth ?? product.defaultWidthMm) : null,
        heightMm: product.unit === 'AREA' ? product.defaultHeightMm : null,
        qtyMilli: product.unit === 'AREA' ? null : planSqft !== null ? planSqft * 1000 : defaultQtyMilli(product, home),
        ratePaise: product.ratePaise,
      });
    }

    /* Room-wise false ceiling (Hauspire's toggle): the studio's product for
       this room, sized to the room on the plan — area for sq ft, the room's
       two sides for a W × H product, one for a per-room price. Skipped where
       the standard build already put a ceiling in this room. */
    if (home.falseCeiling && takesCeiling(room) && !lines.some((l) => l.room === room.name && isCeiling({ name: l.product }))) {
      const ceilingRoom = home.planRooms?.length ? planRoomFor(room.name, bedIndex, home.planRooms) : null;
      const fc = ceilingProductFor(room, catalogue);
      if (fc) {
        const sqft = ceilingRoom?.sqft ?? null;
        lines.push({
          room: room.name,
          product: fc.name,
          code: fc.code,
          unit: fc.unit,
          details: fc.details,
          widthMm: fc.unit === 'AREA' ? (ceilingRoom?.widthMm ?? fc.defaultWidthMm) : null,
          heightMm: fc.unit === 'AREA' ? (ceilingRoom?.depthMm ?? fc.defaultHeightMm) : null,
          qtyMilli:
            fc.unit === 'AREA'
              ? null
              : fc.unit === 'SQFT' && sqft !== null
                ? sqft * 1000
                : defaultQtyMilli(fc, home),
          ratePaise: fc.ratePaise,
        });
        if (ceilingRoom) ceilingsFromPlan += 1;
      } else if (home.falseCeilingRatePaise && home.falseCeilingRatePaise > 0) {
        lines.push({
          room: room.name,
          product: 'False ceiling',
          code: 'ONSITE',
          unit: 'SQFT',
          details: 'Single-layer false ceiling with concealed wiring and panel lights. Priced by room area.',
          widthMm: null,
          heightMm: null,
          qtyMilli: ceilingRoom ? ceilingRoom.sqft * 1000 : null,
          ratePaise: home.falseCeilingRatePaise,
        });
        if (ceilingRoom) ceilingsFromPlan += 1;
      } else {
        noCeilingProduct = true;
      }
    }
  }

  const notes: string[] = [];

  if (standard.applied) {
    notes.push(
      'Nothing in your product list is ticked as standard, so the standard selection was used by product name (kitchen units on the run, a wardrobe and bed per bedroom, a vanity per bathroom, painting and electricals for the flat size). Tick your own in Products and the build follows them instead.',
    );
  }

  if (ceilingsFromPlan > 0) {
    notes.push(
      `${ceilingsFromPlan} false-ceiling ${ceilingsFromPlan === 1 ? 'line is' : 'lines are'} sized to the room on the floor plan.`,
    );
  }

  if (noCeilingProduct) {
    notes.push(
      'False ceiling is on, but your product list has no false-ceiling product. Add one (for example "False Ceiling (Master Bedroom)", per sq ft), or type a rate per sq ft on the quotation and rebuild.',
    );
  }

  if (sizedFromPlan > 0) {
    notes.push(
      `${sizedFromPlan} ${sizedFromPlan === 1 ? 'line is' : 'lines are'} sized from the client's floor plan — wardrobes and lofts to 55% of each bedroom's shorter wall, ceilings to each room's area. Check them against your site measurement.`,
    );
  }

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
      `No kitchen run, so the base, wall and loft lines are sized to ${standardRunFor(home.config)}mm — what a ${home.config} usually has. Measure it and rebuild: this is the number that moves the total most.`,
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
