/**
 * A studio's product master, read as the rates its customer first quotes use.
 *
 * ## One price list (owner's decision, 10 Oct 2026)
 *
 * The studio's product master prices both its own quotations and the first
 * quote a customer sees for it. Before this, the customer's quote came from
 * filed rates per catalogue line and the studio's builder from its products,
 * and the two could disagree — the one comparison a studio is guaranteed to
 * make. Now a rate a studio changes in /studio/products is the rate its next
 * customer is quoted.
 *
 * ## Why it maps rather than replaces
 *
 * The customer's quote stays on OUR catalogue: the same lines and sizes for
 * every studio, so a comparison is line for line (`catalogue.ts`). What comes
 * from the studio is each line's price — its own product, at its own rate,
 * turned into the catalogue line's unit:
 *
 * - an area product priced per sq ft of face prices an area line directly;
 * - anything else is priced at the product's own default size and the result
 *   spread over the catalogue line (per unit, per bathroom, or per sq ft of
 *   the catalogue's face);
 * - per-home work (painting, electricals, false ceiling) is the studio's own
 *   figure for each flat size (`perBhkPaise`).
 *
 * A catalogue line no product matches is simply absent, and the caller keeps
 * whatever priced it before (a filed rate, or nothing — `missingRates`).
 *
 * Pure: no Prisma, no session. CONTRIBUTING §9.5.
 */

import type { Paise } from '@/lib/money';
import { ITEM, type FiledRate, type StudioRates } from './catalogue';
import { TYPICAL_CARPET_SQFT } from './estimate';
import { bhkOfRule, namedRoomOf, roomsFor, type CatalogueProduct, type ConfigName } from '@/modules/studio-quote/configure';

const MM2_PER_SQFT = 92_903.04;

export interface MasterProduct extends CatalogueProduct {
  /** How many of the studio's quotations priced it, when known. */
  fromQuotations?: number;
}

/** What one product costs at its own default size. Null when it has none. */
export function productAmountPaise(p: CatalogueProduct): number | null {
  switch (p.unit) {
    case 'AREA':
      return p.defaultWidthMm && p.defaultHeightMm
        ? Math.round((p.ratePaise * p.defaultWidthMm * p.defaultHeightMm) / MM2_PER_SQFT)
        : null;
    case 'SQFT':
      return p.rules?.sqft ? Math.round(p.ratePaise * p.rules.sqft) : null;
    case 'RFT':
      return p.rules?.rft ? Math.round(p.ratePaise * p.rules.rft) : null;
    case 'UNIT':
      return p.ratePaise * (p.defaultQty ?? 1);
  }
}

interface Find {
  name: RegExp;
  not?: RegExp;
  room?: string;
  unit?: CatalogueProduct['unit'];
}

/** The studio's product for a description: standard ones first, then by order. */
function find(products: MasterProduct[], f: Find): MasterProduct | null {
  const hits = products.filter(
    (p) =>
      f.name.test(p.name) &&
      !(f.not && f.not.test(p.name)) &&
      (!f.room || p.rooms.includes(f.room) || (f.room === 'Bathroom' && p.rules?.perBath === true)) &&
      (!f.unit || p.unit === f.unit),
  );
  hits.sort((a, b) => Number(b.inStandardBuild) - Number(a.inStandardBuild) || a.sortOrder - b.sortOrder);
  return hits[0] ?? null;
}

function face(code: string): number | null {
  const item = ITEM[code];
  return item?.widthMm && item.heightMm ? (item.widthMm * item.heightMm) / MM2_PER_SQFT : null;
}

/**
 * Price one catalogue line from one or more products.
 *
 * An area line takes an area product's rate as it stands. Otherwise the
 * products' default amounts are summed and spread over the line's unit.
 */
function priceLine(code: string, parts: (MasterProduct | null)[], filedOn: string): FiledRate | null {
  const ps = parts.filter((p): p is MasterProduct => p !== null);
  if (ps.length === 0) return null;
  const item = ITEM[code];
  if (!item) return null;

  let ratePaise: number | null = null;
  if (item.sizing === 'AREA' && ps.length === 1 && ps[0]!.unit === 'AREA') {
    ratePaise = ps[0]!.ratePaise;
  } else {
    const amounts = ps.map(productAmountPaise);
    if (amounts.some((a) => a === null)) return null;
    const total = (amounts as number[]).reduce((t, a) => t + a, 0);
    if (item.sizing === 'AREA') {
      const sqft = face(code);
      ratePaise = sqft ? Math.round(total / sqft) : null;
    } else if (item.sizing === 'UNIT' || item.sizing === 'PER_BATHROOM') {
      ratePaise = total;
    }
  }
  if (!ratePaise || ratePaise <= 0) return null;

  return {
    code,
    ratePaise: ratePaise as Paise,
    fromQuotations: Math.max(...ps.map((p) => p.fromQuotations ?? 0)),
    filedOn,
    spec: ps.map((p) => p.details?.split('\n')[0]?.trim()).filter(Boolean)[0] ?? undefined,
  };
}

/** Painting or electricals: the studio's per-home product for each flat size. */
function perHome(code: string, products: MasterProduct[], name: RegExp, prefer: RegExp | null, filedOn: string): FiledRate | null {
  const byBhk: Partial<Record<number, Paise>> = {};
  let spec: string | undefined;
  let fromQuotations = 0;
  for (const bhk of [1, 2, 3, 4]) {
    const hits = products.filter((p) => name.test(p.name) && bhkOfRule(p.rules?.bhk) === bhk);
    hits.sort(
      (a, b) =>
        Number(b.inStandardBuild) - Number(a.inStandardBuild) ||
        Number(prefer ? prefer.test(b.name) : 0) - Number(prefer ? prefer.test(a.name) : 0) ||
        a.sortOrder - b.sortOrder,
    );
    const p = hits[0];
    const amount = p ? productAmountPaise(p) : null;
    if (p && amount) {
      byBhk[bhk] = amount as Paise;
      spec ??= p.details?.split('\n')[0]?.trim() || undefined;
      fromQuotations = Math.max(fromQuotations, p.fromQuotations ?? 0);
    }
  }
  return homeRate(code, byBhk, spec, fromQuotations, filedOn);
}

/** False ceiling: the studio's room-wise products, summed over a flat's rooms. */
function falseCeiling(products: MasterProduct[], filedOn: string): FiledRate | null {
  const fc = products.filter((p) => /false\s*ceiling/i.test(p.name) && !/minimal|balcony/i.test(p.name));
  if (fc.length === 0) return null;

  const forRoom = (roomName: string, category: string): MasterProduct | null => {
    const inCategory = fc.filter((p) => p.rooms.includes(category));
    const named = inCategory.find((p) => namedRoomOf(p.name)?.test(roomName));
    if (named) return named;
    const unnamed = inCategory.find((p) => namedRoomOf(p.name) === null);
    if (unnamed) return unnamed;
    // A second bedroom with only "Kids" and "Guest" products: any non-master one.
    return inCategory.find((p) => !/master/i.test(p.name)) ?? null;
  };

  const byBhk: Partial<Record<number, Paise>> = {};
  let fromQuotations = 0;
  for (const bhk of [1, 2, 3, 4]) {
    const rooms = roomsFor({ config: `${bhk} BHK` as ConfigName, kitchenRunMm: null, bathrooms: 0, study: false }).filter(
      (r) => r.category === 'Bedroom' || r.category === 'Living',
    );
    let total = 0;
    let complete = true;
    for (const room of rooms) {
      const p = forRoom(room.name, room.category);
      const amount = p ? productAmountPaise(p) : null;
      if (!amount) {
        complete = false;
        break;
      }
      total += amount;
      fromQuotations = Math.max(fromQuotations, p!.fromQuotations ?? 0);
    }
    if (complete) byBhk[bhk] = total as Paise;
  }
  const spec = fc[0]?.details?.split('\n')[0]?.trim() || undefined;
  return homeRate('false_ceiling', byBhk, spec, fromQuotations, filedOn);
}

const TYPICAL_BY_BHK: Record<number, number> = {
  1: TYPICAL_CARPET_SQFT.BHK_1,
  2: TYPICAL_CARPET_SQFT.BHK_2,
  3: TYPICAL_CARPET_SQFT.BHK_3,
  4: TYPICAL_CARPET_SQFT.BHK_4_PLUS,
};

/**
 * A per-home rate, plus the per-foot rate it implies for a flat size the
 * studio did not price (the median over the sizes it did).
 */
function homeRate(
  code: string,
  byBhk: Partial<Record<number, Paise>>,
  spec: string | undefined,
  fromQuotations: number,
  filedOn: string,
): FiledRate | null {
  const perFoot = Object.entries(byBhk)
    .map(([bhk, amount]) => (amount as number) / TYPICAL_BY_BHK[Number(bhk)]!)
    .sort((a, b) => a - b);
  if (perFoot.length === 0) return null;
  const median = perFoot[Math.floor(perFoot.length / 2)]!;
  return {
    code,
    ratePaise: Math.round(median) as Paise,
    fromQuotations,
    filedOn,
    spec,
    perBhkPaise: byBhk,
  };
}

/**
 * Every catalogue line this product master prices.
 *
 * Only active products with a rate are considered. `filedOn` is the day ops
 * approved the master (`Studio.ratesFilledAt`).
 */
export function ratesFromProductMaster(all: MasterProduct[], filedOn: string): StudioRates {
  const products = all.filter((p) => p.isActive && p.ratePaise > 0);
  const out: StudioRates = {};
  const put = (rate: FiledRate | null) => {
    if (rate) out[rate.code] = rate;
  };

  // Kitchen
  put(priceLine('kitchen_base', [find(products, { name: /\bbase\s*cabinets?\b/i, not: /tandem|pull|platform|island|balcony/i, room: 'Kitchen', unit: 'AREA' })], filedOn));
  put(priceLine('kitchen_wall', [find(products, { name: /\bwall\s*cabinets?\b/i, not: /glass|profile|shutter/i, room: 'Kitchen', unit: 'AREA' })], filedOn));
  put(priceLine('kitchen_loft', [find(products, { name: /\bloft\b/i, room: 'Kitchen', unit: 'AREA' })], filedOn));
  const tandems = products.filter((p) => /tandem|drawer.*basket|basket/i.test(p.name) && p.rooms.includes('Kitchen'));
  const standardTandems = tandems.filter((p) => p.inStandardBuild);
  put(priceLine('kitchen_tandem', standardTandems.length > 0 ? standardTandems : tandems.slice(0, 1), filedOn));

  // Bedrooms
  const wardrobe = find(products, { name: /wardrobe/i, not: /walk|sliding/i, room: 'Bedroom', unit: 'AREA' }) ??
    find(products, { name: /wardrobe/i, room: 'Bedroom' });
  const bedLoft = find(products, { name: /\bloft\b/i, room: 'Bedroom' });
  for (const code of ['master_wardrobe', 'second_wardrobe', 'third_wardrobe']) put(priceLine(code, [wardrobe], filedOn));
  for (const code of ['master_loft', 'second_loft', 'third_loft']) put(priceLine(code, [bedLoft], filedOn));

  const dressing = products.filter((p) => /dressing|dresser/i.test(p.name) && p.rooms.includes('Bedroom'));
  const standardDressing = dressing.filter((p) => p.inStandardBuild);
  put(priceLine('master_dressing', standardDressing.length > 0 ? standardDressing : dressing.slice(0, 1), filedOn));

  const queen = find(products, { name: /queen.*bed|bed.*queen/i, room: 'Bedroom' });
  const king = find(products, { name: /king.*bed|bed.*king/i, room: 'Bedroom' });
  const anyBed = find(products, { name: /\bbed\b/i, not: /side|drawer|sofa|headboard/i, room: 'Bedroom' });
  const queenHead = find(products, { name: /headboard/i, not: /king/i, room: 'Bedroom' });
  const kingHead = find(products, { name: /king.*headboard|headboard.*king/i, room: 'Bedroom' });
  put(priceLine('master_bed', [king ?? queen ?? anyBed, (king ? kingHead : null) ?? queenHead], filedOn));
  for (const code of ['second_bed', 'third_bed']) put(priceLine(code, [queen ?? anyBed, queenHead], filedOn));

  put(priceLine('second_workstation', [find(products, { name: /workstation|study\s*(table|desk|unit)/i, not: /overhead|foldable/i })], filedOn));

  // Living
  put(priceLine('tv_unit', [find(products, { name: /\btv\b/i, not: /base\s*storage/i, room: 'Living' })], filedOn));
  put(priceLine('console_shoe', [find(products, { name: /shoe|console|foyer/i, room: 'Living' })], filedOn));
  put(priceLine('mandir', [find(products, { name: /mandir|pooja|puja/i })], filedOn));
  put(priceLine('safety_door', [find(products, { name: /safety\s*door/i })], filedOn));

  // Bathrooms
  put(priceLine('vanity', [find(products, { name: /vanit/i })], filedOn));

  // Whole home, per flat
  put(perHome('painting', products, /paint/i, /emulsion/i, filedOn));
  put(perHome('electrical', products, /electric/i, null, filedOn));
  put(falseCeiling(products, filedOn));

  return out;
}
