/**
 * Item pages: the rules (owner, 10 Nov 2026).
 *
 * "One Interiors quotation should have a mandatory photo of each line item …
 * when someone hovers over a line item it should show a picture of it and
 * when someone clicks on it a new page should open … a page for every item
 * helping in SEO as well as client understanding."
 *
 * ## Why items are ours and not the studio's
 *
 * A studio's product master is private (schema: StudioProduct): its product
 * names and rates are its own business. The page a stranger or a search engine
 * reads cannot be built from it. So the photos and the description live on a
 * shared `ItemPage` ("Wardrobe"), and a studio's product is tied to one —
 * by hand (`StudioProduct.itemId`), or by its name matching the item's name
 * or one of its aliases.
 *
 * ## The rule
 *
 * A quotation is not sent, sent again or marked the sales final while any of
 * its lines has no photo: either its product is tied to no item, or its item
 * has no photo yet. `ITEM_PHOTOS_OPTIONAL=1` turns the refusal off for an
 * emergency; nothing else does.
 *
 * Pure: no Prisma, no session, no `server-only`. CONTRIBUTING §9.5.
 */

import type { Lang } from '@/modules/i18n/site';

/** What a line needs to know about its item. */
export interface ItemLite {
  id: string;
  slug: string;
  name: string;
  photos: string[];
  aliases: string[];
}

/** What the customer's screens need: the name, the address and one photo. */
export interface ItemRef {
  slug: string;
  name: string;
  photo: string | null;
}

export function refOf(item: ItemLite): ItemRef {
  return { slug: item.slug, name: item.name, photo: item.photos[0] ?? null };
}

/** Lowercase, punctuation to spaces, single spaces. "Wardrobe – Sliding" → "wardrobe sliding". */
export function normaliseName(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** "Base cabinets & lofts" → "base-cabinets-and-lofts". ASCII only, so the address reads in every browser bar. */
export function slugify(s: string): string {
  return normaliseName(s)
    .normalize('NFKD')
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80)
    .replace(/-+$/, '');
}

/** A slug we accept from a form or a URL: lowercase words and hyphens. */
export function isSlug(s: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && s.length <= 80;
}

/**
 * The item a product name is, by name alone.
 *
 * An exact match on the item's name or an alias wins. Otherwise the LONGEST
 * name or alias found as whole words inside the product's name, so "Loft over
 * wardrobe" finds the loft and not the wardrobe, and "Wardrobe - sliding, 18mm
 * BWP" finds the wardrobe. Nothing found: null, and the line is missing a photo.
 */
export function matchByName<T extends ItemLite>(productName: string, items: T[]): T | null {
  const p = normaliseName(productName);
  if (!p) return null;
  let best: { item: T; len: number } | null = null;
  for (const item of items) {
    const names = [item.name, ...item.aliases].map(normaliseName).filter(Boolean);
    for (const n of names) {
      if (n === p) return item;
      if (` ${p} `.includes(` ${n} `) && (!best || n.length > best.len)) best = { item, len: n.length };
    }
  }
  return best?.item ?? null;
}

/**
 * The item for one quotation line: the item its product is tied to, else a
 * name match. `productItemIds` maps the studio's normalised product names to
 * the item id set on them.
 */
export function resolveLine<T extends ItemLite>(
  productName: string,
  productItemIds: Map<string, string | null>,
  items: T[],
): T | null {
  const linked = productItemIds.get(normaliseName(productName));
  if (linked) {
    const item = items.find((i) => i.id === linked);
    if (item) return item;
  }
  return matchByName(productName, items);
}

export interface MissingPhoto {
  /** The line's product, as the quotation prints it. */
  product: string;
  /** The item it resolved to; null when it resolved to none. */
  item: { slug: string; name: string } | null;
}

/** Every distinct product on these lines that has no photo, in the order they first appear. */
export function missingPhotos<T extends ItemLite>(
  lines: { product: string }[],
  resolve: (product: string) => T | null,
): MissingPhoto[] {
  const seen = new Set<string>();
  const out: MissingPhoto[] = [];
  for (const l of lines) {
    const key = normaliseName(l.product);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const item = resolve(l.product);
    if (!item) out.push({ product: l.product, item: null });
    else if (item.photos.length === 0) out.push({ product: l.product, item: { slug: item.slug, name: item.name } });
  }
  return out;
}

/**
 * Is the rule on? Off (owner, 14 Nov 2026: "Photo is not mandatory for studio
 * to add; it will be added through us, and they can send quotation without
 * it"). One Interiors adds the item photos; a studio is never stopped for a
 * missing one. `ITEM_PHOTOS_REQUIRED=1` switches the rule back on.
 */
export function photosRequired(env: Record<string, string | undefined> = process.env): boolean {
  return env.ITEM_PHOTOS_REQUIRED?.trim() === '1';
}

/** The refusal a studio reads when it presses Send. Names up to five products. */
export function photoRefusal(missing: MissingPhoto[], action: 'send' | 'final'): string | null {
  if (missing.length === 0) return null;
  const names = missing.slice(0, 5).map((m) => m.product);
  const more = missing.length > 5 ? ` and ${missing.length - 5} more` : '';
  const verb = action === 'send' ? 'send this quotation' : 'mark it the sales final';
  return `Every line needs a photo before you ${verb}. Missing: ${names.join(', ')}${more}. The list above the lines shows how to fix each one.`;
}

// ── The price range on the public page ───────────────────────────

/**
 * Fewest studios whose prices may make a public range.
 *
 * With one or two, a "range" is a studio's price with a rounding on it, and
 * any studio's own rate is private (owner, 30 Sep 2026: no per-unit rate on
 * any customer screen). Three or more, the middle half of them, rounded.
 */
export const MIN_STUDIOS_FOR_RANGE = 3;
const ROUND_PAISE = 100_000; // ₹1,000

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

/**
 * A typical price range from one figure per studio (each studio's price for
 * the item at its usual size). Null below the minimum, or when the figures
 * are not positive. Rounded outward to ₹1,000.
 */
export function publicPriceRange(perStudioPaise: number[]): { lowPaise: number; highPaise: number; studios: number } | null {
  const xs = perStudioPaise.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (xs.length < MIN_STUDIOS_FOR_RANGE) return null;
  const low = Math.floor(quantile(xs, 0.25) / ROUND_PAISE) * ROUND_PAISE;
  const high = Math.ceil(quantile(xs, 0.75) / ROUND_PAISE) * ROUND_PAISE;
  return { lowPaise: Math.max(ROUND_PAISE, low), highPaise: Math.max(high, low + ROUND_PAISE), studios: xs.length };
}

// ── Words in the customer's language ─────────────────────────────

export interface ItemWords {
  name: string;
  summary: string;
  whatItDoes: string;
  materials: string[];
  finishes: string[];
  typicalSize: string | null;
}

export interface ItemContent extends ItemWords {
  translations: unknown;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function strs(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out = v.map(str).filter((x): x is string => x !== null);
  return out.length ? out : null;
}

/** The item's words in this language, field by field, English where a translation is missing. */
export function wordsFor(item: ItemContent, lang: Lang): ItemWords {
  const en: ItemWords = {
    name: item.name,
    summary: item.summary,
    whatItDoes: item.whatItDoes,
    materials: item.materials,
    finishes: item.finishes,
    typicalSize: item.typicalSize,
  };
  if (lang === 'en' || !item.translations || typeof item.translations !== 'object') return en;
  const t = (item.translations as Record<string, unknown>)[lang];
  if (!t || typeof t !== 'object') return en;
  const r = t as Record<string, unknown>;
  return {
    name: str(r.name) ?? en.name,
    summary: str(r.summary) ?? en.summary,
    whatItDoes: str(r.whatItDoes) ?? en.whatItDoes,
    materials: strs(r.materials) ?? en.materials,
    finishes: strs(r.finishes) ?? en.finishes,
    typicalSize: str(r.typicalSize) ?? en.typicalSize,
  };
}

// ── Search engines ──────────────────────────────────────────────

/**
 * schema.org Product for the page. An offer only when there is a public
 * range (AggregateOffer, INR, rupees not paise); never a seller, because the
 * item is not one studio's.
 */
export function itemJsonLd(input: {
  url: string;
  words: ItemWords;
  photos: string[];
  category: string;
  range: { lowPaise: number; highPaise: number; studios: number } | null;
}): Record<string, unknown> {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.words.name,
    description: `${input.words.summary} ${input.words.whatItDoes}`.trim(),
    url: input.url,
    category: input.category,
    brand: { '@type': 'Brand', name: 'One Interiors' },
  };
  if (input.photos.length) ld.image = input.photos;
  if (input.words.materials.length) ld.material = input.words.materials.join(', ');
  if (input.range) {
    ld.offers = {
      '@type': 'AggregateOffer',
      priceCurrency: 'INR',
      lowPrice: Math.round(input.range.lowPaise / 100),
      highPrice: Math.round(input.range.highPaise / 100),
      offerCount: input.range.studios,
    };
  }
  return ld;
}

/** JSON for a <script> tag: `<` escaped so a description can never close the tag. */
export function safeJsonForScript(v: unknown): string {
  return JSON.stringify(v).replace(/</g, '\\u003c');
}
