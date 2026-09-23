/**
 * Turning a studio's filed archive into their own product master.
 *
 * Pure — no Prisma, no session. CONTRIBUTING §9.5.
 *
 * ## The gap this closes
 *
 * A studio joining the roster uploads around twenty of their past quotations.
 * We read the line items out of them, map each onto our canonical catalogue,
 * derive a rate per item, and — once ops has approved it — quote customers on
 * their behalf at those rates. That worked, and it stopped there.
 *
 * Meanwhile the same studio opened the CRM's product master and found
 * thirty-eight rows with every rate blank, and was asked to type in prices we
 * had just spent an afternoon deriving from their own documents. That is the
 * software asking for something it already has, which is the fastest way to
 * make a studio stop believing the rest of it.
 *
 * So an approved archive now fills the product master too: same rates, same
 * studio, one derivation.
 *
 * ## Three rules, and the second is the important one
 *
 * 1. **Missing products are created.** Named as the catalogue names them,
 *    because that is what the rate was derived against — a rate filed for
 *    `master_wardrobe` prices a wardrobe, and calling the product something
 *    else here would be inventing a correspondence nobody checked.
 *
 * 2. **A rate the studio typed is never overwritten.** Not on the first
 *    approval, not on a re-analysis. The studio's own figure is the one they
 *    will be held to by their client; ours is derived from documents that may
 *    be eighteen months old. Where they have priced something, theirs stands
 *    and the archive is ignored for that row.
 *
 * 3. **Everything derived is marked standard.** The catalogue's membership
 *    rule is "appears in more than half of that room's quotations", which is
 *    the same question `inStandardBuild` asks. A studio can untick any of it.
 */

import { CATALOGUE, type CatalogueItem, type Room, type Sizing } from '@/modules/quotation/catalogue';
import type { RoomCategory } from './starter-catalogue';

/** Where a canonical room lands in the studio's own room categories. */
const ROOM_CATEGORY: Record<Room, RoomCategory> = {
  KITCHEN: 'Kitchen',
  MASTER_BEDROOM: 'Bedroom',
  SECOND_BEDROOM: 'Bedroom',
  THIRD_BEDROOM: 'Bedroom',
  LIVING_DINING: 'Living',
  BATHROOMS: 'Bathroom',
  WHOLE_HOME: 'Whole home',
};

/**
 * How a catalogue item is sized, in the studio catalogue's vocabulary.
 *
 * `PER_BATHROOM` becomes UNIT rather than a unit of its own: the planner
 * already puts one line in each bathroom, so the line is "one vanity", and a
 * per-bathroom unit here would mean multiplying by the bathroom count twice.
 */
const UNIT_FOR: Record<Sizing, 'AREA' | 'SQFT' | 'RFT' | 'UNIT'> = {
  AREA: 'AREA',
  UNIT: 'UNIT',
  PER_SQFT_CARPET: 'SQFT',
  PER_BATHROOM: 'UNIT',
};

/** A rate as it comes off the archive. */
export interface DerivedRate {
  code: string;
  ratePaise: number;
  /** How many of the studio's own documents it was derived from. */
  fromQuotations: number;
  spec?: string | null;
}

/** What the caller needs to know about a product that already exists. */
export interface ExistingProduct {
  id: string;
  name: string;
  ratePaise: number;
}

export interface ProductDraft {
  name: string;
  code: 'MODULAR' | 'ONSITE';
  unit: 'AREA' | 'SQFT' | 'RFT' | 'UNIT';
  details: string | null;
  ratePaise: number;
  rooms: RoomCategory[];
  defaultWidthMm: number | null;
  defaultHeightMm: number | null;
  defaultQty: number | null;
  sortOrder: number;
}

export interface BridgeResult {
  /** Products to insert. */
  create: ProductDraft[];
  /** Existing products to price, by id. Only ever ones sitting at zero. */
  priceExisting: { id: string; name: string; ratePaise: number }[];
  /** Existing products left alone because the studio had already priced them. */
  keptTheirs: string[];
  /** Codes with a rate that no catalogue item claims. Should be empty. */
  unknownCodes: string[];
}

/**
 * One product per distinct thing the catalogue prices.
 *
 * Grouped by label, work code and sizing rather than one product per catalogue
 * code, because `master_wardrobe`, `second_wardrobe` and `third_wardrobe` are
 * three codes for one product a studio sells. The studio's product master is
 * room-TAGGED — a wardrobe belongs in Bedroom — while the canonical catalogue
 * is room-INSTANCED, because a customer-facing quote has to show the second
 * bedroom's wardrobe as its own line. Both are right for their job; this is
 * the seam.
 */
function groupKey(item: CatalogueItem): string {
  return `${item.label}\u0000${item.work}\u0000${item.sizing}`;
}

/**
 * Which rate wins when three codes map to one product and disagree.
 *
 * The one derived from the most documents. A wardrobe rate read from
 * fourteen quotations is a better estimate of what this studio charges than
 * one read from two, and averaging them would produce a figure that appears in
 * none of their documents — which is the thing nobody could later explain to
 * them.
 */
function bestRate(rates: DerivedRate[]): DerivedRate | null {
  let best: DerivedRate | null = null;
  for (const rate of rates) {
    if (rate.ratePaise <= 0) continue;
    if (!best || rate.fromQuotations > best.fromQuotations) best = rate;
  }
  return best;
}

export function productsFromArchive(
  derived: DerivedRate[],
  existing: ExistingProduct[],
): BridgeResult {
  const byCode = new Map(derived.map((r) => [r.code, r]));

  const unknownCodes = derived
    .filter((r) => !CATALOGUE.some((i) => i.code === r.code))
    .map((r) => r.code);

  /* Grouped in catalogue order, which is room order, so a product master
     built from this reads the way a quotation does. */
  const groups = new Map<string, CatalogueItem[]>();
  for (const item of CATALOGUE) {
    const key = groupKey(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }

  const create: ProductDraft[] = [];
  const priceExisting: { id: string; name: string; ratePaise: number }[] = [];
  const keptTheirs: string[] = [];

  /* Case-insensitive, because the studio may have renamed a row and a
     duplicate product is worse than a missed fill: the unique index is on the
     exact name, so two rows differing only in case would both exist and both
     show up in the builder's picker. */
  const known = new Map(existing.map((p) => [p.name.trim().toLowerCase(), p]));

  let order = 0;

  for (const items of groups.values()) {
    order += 10;

    const rate = bestRate(items.map((i) => byCode.get(i.code)).filter((r): r is DerivedRate => !!r));
    if (!rate) continue;

    const first = items[0]!;
    const name = first.label;
    const match = known.get(name.trim().toLowerCase());

    if (match) {
      /* Rule 2. Their figure stands — see the header. */
      if (match.ratePaise > 0) keptTheirs.push(match.name);
      else priceExisting.push({ id: match.id, name: match.name, ratePaise: rate.ratePaise });
      continue;
    }

    /* A kitchen item's width is the platform run, which is a fact about a
       flat rather than about the product, so it gets no default: the planner
       fills it from the measured or standard run. */
    const sized = items.find((i) => i.widthMm != null || i.heightMm != null);

    create.push({
      name,
      code: first.work === 'MO' ? 'MODULAR' : 'ONSITE',
      unit: UNIT_FOR[first.sizing],
      details: rate.spec ?? first.spec,
      ratePaise: rate.ratePaise,
      rooms: [...new Set(items.map((i) => ROOM_CATEGORY[i.room]))],
      defaultWidthMm: first.fromKitchenRun ? null : (sized?.widthMm ?? null),
      defaultHeightMm: sized?.heightMm ?? null,
      /* One of whatever it is. A unit line with no quantity prices at zero,
         and "one safety door" is right far more often than blank. */
      defaultQty: UNIT_FOR[first.sizing] === 'UNIT' ? 1 : null,
      sortOrder: order,
    });
  }

  return { create, priceExisting, keptTheirs, unknownCodes };
}

/**
 * What to tell the studio afterwards, in one sentence.
 *
 * Written here rather than in the page because it is the only part of this
 * anybody reads, and because "we filled in 19 of your rates" is a claim that
 * has to match what was actually written.
 */
export function bridgeSummary(result: BridgeResult): string {
  const filled = result.create.length + result.priceExisting.length;
  if (filled === 0) {
    return 'Nothing new to fill in — your product list already has a rate everywhere we could read one.';
  }

  const kept =
    result.keptTheirs.length > 0
      ? ` ${result.keptTheirs.length} you had already priced ${result.keptTheirs.length === 1 ? 'was' : 'were'} left alone.`
      : '';

  return `${filled} ${filled === 1 ? 'product is' : 'products are'} now priced from your own quotations.${kept}`;
}
