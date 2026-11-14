import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  isSlug,
  itemJsonLd,
  matchByName,
  missingPhotos,
  normaliseName,
  photoRefusal,
  photosRequired,
  publicPriceRange,
  resolveLine,
  safeJsonForScript,
  slugify,
  wordsFor,
  MIN_STUDIOS_FOR_RANGE,
  type ItemLite,
} from '@/modules/items/rules';
import { cleanItemInput, lines } from '@/modules/items/input';
import { STARTER_ITEMS } from '@/modules/items/starter';
import { CATALOGUE } from '@/modules/quotation/catalogue';
import { STARTER_CATALOGUE as STARTER_PRODUCTS } from '@/modules/studio-quote/starter-catalogue';
import { route } from '@/lib/host';
import { itemUrl } from '@/modules/items/urls';

/**
 * Item photos and pages (owner, 10 Nov 2026): every quotation line has a
 * photo, and every item its own public page.
 */

const item = (slug: string, name: string, aliases: string[] = [], photos: string[] = ['https://x/p.jpg']): ItemLite => ({
  id: slug,
  slug,
  name,
  aliases,
  photos,
});

const WARDROBE = item('wardrobe', 'Wardrobe', ['sliding wardrobe']);
const LOFT = item('loft-storage', 'Loft storage', ['loft', 'loft over wardrobe']);
const VANITY = item('bathroom-vanity', 'Bathroom vanity', ['vanity'], []);
const ITEMS = [WARDROBE, LOFT, VANITY];

describe('names and addresses', () => {
  it('normalises punctuation, case and ampersands', () => {
    expect(normaliseName('  Wardrobe – Sliding & Lofts ')).toBe('wardrobe sliding and lofts');
  });
  it('makes ASCII slugs and accepts only those', () => {
    expect(slugify('Base cabinets & lofts')).toBe('base-cabinets-and-lofts');
    expect(isSlug('base-cabinets')).toBe(true);
    expect(isSlug('Base cabinets')).toBe(false);
    expect(isSlug('../etc')).toBe(false);
  });
});

describe('matching a product to an item', () => {
  it('takes an exact name or alias first', () => {
    expect(matchByName('Sliding wardrobe', ITEMS)?.slug).toBe('wardrobe');
  });
  it('takes the longest alias found inside the name, so a loft over a wardrobe is a loft', () => {
    expect(matchByName('Loft over wardrobe', ITEMS)?.slug).toBe('loft-storage');
    expect(matchByName('Wardrobe - hinged, 18mm BWP', ITEMS)?.slug).toBe('wardrobe');
  });
  it('matches whole words only', () => {
    expect(matchByName('Wardrobeish thing', ITEMS)).toBeNull();
  });
  it('prefers the item set by hand over the name', () => {
    const links = new Map([[normaliseName('Sliding wardrobe'), 'loft-storage']]);
    expect(resolveLine('Sliding wardrobe', links, ITEMS)?.slug).toBe('loft-storage');
    expect(resolveLine('Vanity unit', new Map(), ITEMS)?.slug).toBe('bathroom-vanity');
  });
});

describe('the photo rule', () => {
  const resolve = (p: string) => matchByName(p, ITEMS);
  it('lists products with no item and items with no photo, once each, in order', () => {
    const missing = missingPhotos(
      [{ product: 'Wardrobe' }, { product: 'Vanity' }, { product: 'Mystery shelf' }, { product: 'vanity' }],
      resolve,
    );
    expect(missing).toEqual([
      { product: 'Vanity', item: { slug: 'bathroom-vanity', name: 'Bathroom vanity' } },
      { product: 'Mystery shelf', item: null },
    ]);
  });
  it('lets a quotation with every photo through', () => {
    expect(photoRefusal(missingPhotos([{ product: 'Wardrobe' }, { product: 'Loft' }], resolve), 'send')).toBeNull();
  });
  it('names what is missing in the refusal', () => {
    const msg = photoRefusal([{ product: 'Vanity', item: null }], 'send');
    expect(msg).toMatch(/before you send this quotation/);
    expect(msg).toMatch(/Vanity/);
    expect(photoRefusal([{ product: 'X', item: null }], 'final')).toMatch(/sales final/);
  });
  it('is off unless switched on (owner, 14 Nov 2026: studios send without photos; One Interiors adds them)', () => {
    expect(photosRequired({})).toBe(false);
    expect(photosRequired({ ITEM_PHOTOS_OPTIONAL: '0' })).toBe(false);
    expect(photosRequired({ ITEM_PHOTOS_REQUIRED: '0' })).toBe(false);
    expect(photosRequired({ ITEM_PHOTOS_REQUIRED: '1' })).toBe(true);
  });
});

describe('the public price range', () => {
  it('shows nothing under three studios, so no studio’s own price leaks', () => {
    expect(MIN_STUDIOS_FOR_RANGE).toBe(3);
    expect(publicPriceRange([5_000_000, 6_000_000])).toBeNull();
    expect(publicPriceRange([5_000_000, 0, -1, Number.NaN])).toBeNull();
  });
  it('is the middle half, rounded outward to ₹1,000', () => {
    const r = publicPriceRange([4_000_000, 5_000_000, 6_000_000, 9_000_000])!;
    expect(r.studios).toBe(4);
    expect(r.lowPaise).toBe(4_700_000);
    expect(r.highPaise).toBe(6_800_000);
    expect(r.lowPaise % 100_000).toBe(0);
  });
});

describe('words in three languages', () => {
  const base = {
    name: 'Wardrobe',
    summary: 'A cupboard.',
    whatItDoes: 'Holds clothes.',
    materials: ['Ply'],
    finishes: ['Matt'],
    typicalSize: '1800 mm',
    translations: { hi: { name: 'वॉर्डरोब', materials: ['प्लाई'] } },
  };
  it('falls back to English field by field', () => {
    const hi = wordsFor(base, 'hi');
    expect(hi.name).toBe('वॉर्डरोब');
    expect(hi.materials).toEqual(['प्लाई']);
    expect(hi.summary).toBe('A cupboard.');
    expect(wordsFor(base, 'mr').name).toBe('Wardrobe');
  });
  it('every starter item has its words in Hindi and Marathi', () => {
    for (const s of STARTER_ITEMS) {
      for (const lang of ['hi', 'mr'] as const) {
        expect(s[lang].name, `${s.slug} ${lang}`).toBeTruthy();
        expect(s[lang].summary).toBeTruthy();
        expect(s[lang].whatItDoes).toBeTruthy();
        expect(s[lang].materials.length).toBe(s.materials.length);
        expect(s[lang].finishes.length).toBe(s.finishes.length);
      }
    }
  });
});

describe('the starter items', () => {
  it('have valid, unique addresses', () => {
    const slugs = STARTER_ITEMS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(isSlug(s), s).toBe(true);
  });
  it('cover every first-quote catalogue line exactly once', () => {
    const codes = STARTER_ITEMS.flatMap((s) => s.catalogueCodes);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of CATALOGUE) expect(codes, c.code).toContain(c.code);
  });
  it('match most of the product master a new studio starts with', () => {
    const lite = STARTER_ITEMS.map((s) => item(s.slug, s.name, s.aliases));
    const unmatched = STARTER_PRODUCTS.filter((p) => !matchByName(p.name, lite)).map((p) => p.name);
    expect(unmatched).toEqual([]);
  });
  it('never name a studio', () => {
    const text = JSON.stringify(STARTER_ITEMS).toLowerCase();
    expect(text).not.toContain('hauspire');
  });
});

describe('what our team types', () => {
  it('cleans lists one per line', () => {
    expect(lines(' Ply \n\nPly\nLaminate ')).toEqual(['Ply', 'Laminate']);
  });
  it('makes the address from the name when none is typed', () => {
    const r = cleanItemInput({ name: 'Sliding Wardrobe', room: 'Bedroom' }, { partial: true });
    expect(r.ok && r.value.slug).toBe('sliding-wardrobe');
  });
  it('refuses a bad address, a missing room and publishing without words', () => {
    expect(cleanItemInput({ name: 'X', room: 'Bedroom', slug: 'Bad Slug!' }).ok).toBe(false);
    expect(cleanItemInput({ name: 'X', room: 'Garage' }).ok).toBe(false);
    expect(cleanItemInput({ name: 'X', room: 'Bedroom', published: true }).ok).toBe(false);
  });
  it('keeps only the Hindi and Marathi actually written', () => {
    const r = cleanItemInput({ name: 'X', room: 'Bedroom', hi: { name: 'एक्स', summary: '' }, mr: { name: '' } });
    expect(r.ok && r.value.translations).toEqual({ hi: { name: 'एक्स' } });
  });
});

describe('search engines', () => {
  it('describes the item as a Product with an offer only when there is a range', () => {
    const words = { name: 'Wardrobe', summary: 'A cupboard.', whatItDoes: 'Holds clothes.', materials: ['Ply'], finishes: [], typicalSize: null };
    const bare = itemJsonLd({ url: 'https://oneinteriors.in/items/wardrobe', words, photos: [], category: 'Bedroom', range: null });
    expect(bare['@type']).toBe('Product');
    expect(bare.offers).toBeUndefined();
    const priced = itemJsonLd({ url: 'u', words, photos: ['p'], category: 'Bedroom', range: { lowPaise: 4_700_000, highPaise: 6_800_000, studios: 4 } });
    expect(priced.offers).toMatchObject({ '@type': 'AggregateOffer', priceCurrency: 'INR', lowPrice: 47_000, highPrice: 68_000 });
  });
  it('cannot be broken out of its script tag', () => {
    expect(safeJsonForScript({ a: '</script><script>alert(1)</script>' })).not.toContain('</script>');
  });
  it('uses the public domain once there is one', () => {
    expect(itemUrl('wardrobe', { PUBLIC_HOST: 'oneinteriors.in' })).toBe('https://oneinteriors.in/items/wardrobe');
    expect(itemUrl(undefined, { NEXT_PUBLIC_SITE_URL: 'https://x.vercel.app/' })).toBe('https://x.vercel.app/items');
  });
});

describe('item pages answer on every host', () => {
  const SPLIT = { STUDIO_HOST: 'studio.oneinteriors.in', OPS_HOST: 'ops.oneinteriors.in', PUBLIC_HOST: 'oneinteriors.in', APP_HOST: 'app.oneinteriors.in', CUSTOMER_PROJECTS_LIVE: '1' };
  for (const host of ['studio.oneinteriors.in', 'app.oneinteriors.in', 'oneinteriors.in', 'ops.oneinteriors.in']) {
    it(host, () => {
      expect(route(host, '/items/wardrobe', SPLIT)).toEqual({ kind: 'next' });
      expect(route(host, '/items', SPLIT)).toEqual({ kind: 'next' });
    });
  }
});

describe('the server refuses to send without photos', () => {
  const src = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
  it('on send, send again and the sales final', () => {
    expect(src('src/modules/studio-quote/quotes.ts')).toMatch(/photoGate\(\{ studioId, quoteId \}, 'send'\)/);
    expect(src('src/modules/studio-sales/revisions.ts')).toMatch(/photoGate\(\{ studioId, quoteId: q\.id \}, 'send'\)/);
    expect(src('src/modules/studio-sales/revisions.ts')).toMatch(/photoGate\(\{ studioId, lines: readRevisionLines\(revision\.lines\) \}, 'final'\)/);
  });
});

describe('the starter example photos', () => {
  it('give every starter item at least one photo, and every file is in public/items', async () => {
    const { existsSync } = await import('node:fs');
    const { STARTER_PHOTOS, starterPhotoPaths, isStarterPhoto } = await import('@/modules/items/starter-photos');
    for (const s of STARTER_ITEMS) {
      const paths = starterPhotoPaths(s.slug);
      expect(paths.length, s.slug).toBeGreaterThan(0);
      for (const p of paths) {
        expect(existsSync(join(process.cwd(), 'public', p)), p).toBe(true);
        expect(isStarterPhoto(p)).toBe(true);
      }
    }
    for (const rows of Object.values(STARTER_PHOTOS)) for (const r of rows) expect(r.source).toMatch(/^https:\/\/unsplash\.com\/photos\//);
    expect(isStarterPhoto('https://x.supabase.co/storage/v1/object/public/portfolio-images/items/abc/uuid.webp')).toBe(false);
  });
});
