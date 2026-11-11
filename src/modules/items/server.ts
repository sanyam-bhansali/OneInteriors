import 'server-only';

/**
 * Item pages: the reads (owner, 10 Nov 2026). The rules are pure, in rules.ts.
 *
 * Nothing here returns a studio's name, a product's own name on a public page,
 * or a rate. The one figure that leaves is `publicPriceRange`, which needs at
 * least three live studios and is rounded (rules.ts says why).
 */

import { cache } from 'react';
import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { fromDb } from '@/lib/money';
import { productAmountPaise } from '@/modules/quotation/product-master-rates';
import { readRules } from '@/modules/studio-quote/configure';
import {
  matchByName,
  missingPhotos,
  normaliseName,
  photoRefusal,
  photosRequired,
  publicPriceRange,
  refOf,
  resolveLine,
  type ItemLite,
  type ItemRef,
  type MissingPhoto,
} from './rules';

const LITE = { id: true, slug: true, name: true, photos: true, aliases: true, catalogueCodes: true } as const;

type Lite = ItemLite & { catalogueCodes: string[] };

/** Every item, once per request. Small (tens of rows), so it is read whole. */
export const allItems = cache(async (): Promise<Lite[]> => {
  if (!hasDatabase()) return [];
  return prisma.itemPage.findMany({ select: LITE, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
});

/** A studio's product names (normalised) → the item set on them by hand. */
const studioLinks = cache(async (studioId: string): Promise<Map<string, string | null>> => {
  const products = await prisma.studioProduct.findMany({ where: { studioId }, select: { name: true, itemId: true } });
  return new Map(products.map((p) => [normaliseName(p.name), p.itemId]));
});

/** Resolve a studio's product names to items. */
export async function resolverFor(studioId: string): Promise<(product: string) => Lite | null> {
  const [items, links] = await Promise.all([allItems(), studioLinks(studioId)]);
  return (product: string) => resolveLine(product, links, items);
}

/** The photo and page for each product name on a studio's quotation, for the customer's screens. */
export async function itemRefsFor(studioId: string, products: string[]): Promise<Record<string, ItemRef | null>> {
  if (!hasDatabase() || products.length === 0) return {};
  const resolve = await resolverFor(studioId);
  const out: Record<string, ItemRef | null> = {};
  for (const p of new Set(products)) {
    const item = resolve(p);
    out[p] = item ? refOf(item) : null;
  }
  return out;
}

/** The photo and page for each first-quote catalogue line (catalogue.ts codes). */
export async function itemRefsForCatalogue(): Promise<Record<string, ItemRef>> {
  const items = await allItems();
  const out: Record<string, ItemRef> = {};
  for (const item of items) for (const code of item.catalogueCodes) out[code] = refOf(item);
  return out;
}

/** The products on this quotation's current lines that have no photo. */
export async function missingPhotosOnQuote(quoteId: string, studioId: string): Promise<MissingPhoto[]> {
  const lines = await prisma.studioQuoteLine.findMany({
    where: { quoteId, quote: { studioId } },
    orderBy: { sortOrder: 'asc' },
    select: { product: true },
  });
  const resolve = await resolverFor(studioId);
  return missingPhotos(lines, resolve);
}

/**
 * Why this quotation may not go out yet, or null when it may. The one call
 * every send and every sales final goes through.
 */
export async function photoGate(
  input: { studioId: string; quoteId?: string; lines?: { product: string }[] },
  action: 'send' | 'final',
): Promise<string | null> {
  if (!photosRequired()) return null;
  const missing = input.lines
    ? missingPhotos(input.lines, await resolverFor(input.studioId))
    : input.quoteId
      ? await missingPhotosOnQuote(input.quoteId, input.studioId)
      : [];
  return photoRefusal(missing, action);
}

// ── The public page ─────────────────────────────────────────────

export interface PublicItem {
  id: string;
  slug: string;
  name: string;
  room: string;
  summary: string;
  whatItDoes: string;
  materials: string[];
  finishes: string[];
  typicalSize: string | null;
  photos: string[];
  translations: unknown;
  updatedAt: Date;
}

const PUBLIC = {
  id: true,
  slug: true,
  name: true,
  room: true,
  summary: true,
  whatItDoes: true,
  materials: true,
  finishes: true,
  typicalSize: true,
  photos: true,
  translations: true,
  updatedAt: true,
} as const;

export async function publicItem(slug: string): Promise<PublicItem | null> {
  if (!hasDatabase()) return null;
  return prisma.itemPage.findFirst({ where: { slug, published: true }, select: PUBLIC });
}

export async function publishedItems(): Promise<PublicItem[]> {
  if (!hasDatabase()) return [];
  return prisma.itemPage.findMany({ where: { published: true }, select: PUBLIC, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
}

/** Up to four others: the same room first, then any with photos. */
export function relatedTo(item: PublicItem, all: PublicItem[]): PublicItem[] {
  const others = all.filter((i) => i.id !== item.id);
  const score = (i: PublicItem) => (i.room === item.room ? 2 : 0) + (i.photos.length ? 1 : 0);
  return others.sort((a, b) => score(b) - score(a)).slice(0, 4);
}

/**
 * The typical price, from live studios only, one figure per studio: its own
 * product for this item at its usual size, the standard-build one first.
 * Null under three studios (rules.ts `MIN_STUDIOS_FOR_RANGE`).
 */
export async function priceRangeFor(itemId: string) {
  if (!hasDatabase()) return null;
  const [items, products] = await Promise.all([
    allItems(),
    prisma.studioProduct.findMany({
      where: { isActive: true, ratePaise: { gt: 0 }, studio: { status: 'ACTIVE' } },
      select: {
        studioId: true,
        itemId: true,
        name: true,
        unit: true,
        code: true,
        ratePaise: true,
        rooms: true,
        defaultWidthMm: true,
        defaultHeightMm: true,
        defaultQty: true,
        inStandardBuild: true,
        sortOrder: true,
        rules: true,
      },
      orderBy: [{ inStandardBuild: 'desc' }, { sortOrder: 'asc' }],
    }),
  ]);
  const perStudio = new Map<string, number>();
  for (const p of products) {
    if (perStudio.has(p.studioId)) continue;
    const item = p.itemId ? items.find((i) => i.id === p.itemId) : matchByName(p.name, items);
    if (item?.id !== itemId) continue;
    const amount = productAmountPaise({
      id: '',
      name: p.name,
      code: p.code,
      unit: p.unit,
      details: null,
      ratePaise: fromDb(p.ratePaise),
      rooms: p.rooms,
      defaultWidthMm: p.defaultWidthMm,
      defaultHeightMm: p.defaultHeightMm,
      defaultQty: p.defaultQty,
      inStandardBuild: p.inStandardBuild,
      isActive: true,
      sortOrder: p.sortOrder,
      rules: readRules(p.rules),
    });
    if (amount && amount > 0) perStudio.set(p.studioId, amount);
  }
  return publicPriceRange([...perStudio.values()]);
}
