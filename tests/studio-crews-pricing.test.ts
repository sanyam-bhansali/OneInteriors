import { describe, expect, it } from 'vitest';
import { cardRate, defaultCarpentry, findRate, quoteSqftMilli, resolveLine, type CardRow, type QuoteLineIn } from '@/modules/studio-crews/pricing';
import { lineAmount } from '@/modules/studio-crews/money';

/** 3048 mm × 3048 mm is exactly 100 sq ft (W × H / 92,903.04). */
const wardrobe: QuoteLineIn = { product: 'Premium Shutter Wardrobe', code: 'MODULAR', unit: 'AREA', widthMm: 3048, heightMm: 3048, qtyMilli: null };
const OPTS = { installRatePaise: 15_000 };

describe('sq ft from the quotation', () => {
  it('is width × height / 92,903.04, in thousandths', () => {
    expect(quoteSqftMilli(wardrobe)).toBe(100_000);
    expect(quoteSqftMilli({ ...wardrobe, widthMm: 1000, heightMm: 900 })).toBe(Math.round((900_000 / 92_903.04) * 1000));
  });
  it('a sq ft line uses its quantity; a lump sum has none', () => {
    expect(quoteSqftMilli({ ...wardrobe, unit: 'SQFT', widthMm: null, heightMm: null, qtyMilli: 42_500 })).toBe(42_500);
    expect(quoteSqftMilli({ ...wardrobe, unit: 'UNIT', widthMm: null, heightMm: null, qtyMilli: 1000 })).toBeNull();
  });
});

describe('carpentry, chosen per line', () => {
  it('defaults: factory units are installed, site work is full carpentry', () => {
    expect(defaultCarpentry('MODULAR')).toBe('INSTALL');
    expect(defaultCarpentry('ONSITE')).toBe('FULL');
  });
  it('installation only prices at ₹150/sq ft when the crew’s card has no rate', () => {
    const p = resolveLine('carpentry', wardrobe, [], OPTS);
    expect(p).toMatchObject({ item: 'Modular installation', unit: 'SQFT', ratePaise: 15_000, qtyMilli: 100_000, carpentry: 'INSTALL' });
    expect(lineAmount({ ratePaise: p.ratePaise, qtyMilli: p.qtyMilli, measuredQtyMilli: null, agreedPaise: null, isExtra: false, quotedAmountPaise: null })).toBe(1_500_000);
  });
  it('the crew’s own installation rate wins over the studio default', () => {
    const card: CardRow[] = [{ item: 'Modular carpentory', unit: 'SQFT', ratePaise: 12_000 }];
    expect(resolveLine('carpentry', wardrobe, card, OPTS)).toMatchObject({ item: 'Modular carpentory', ratePaise: 12_000 });
  });
  it('a loft takes the loft rate when the card has one', () => {
    const loft = { ...wardrobe, product: 'Loft (Frame with Shutter)' };
    const card: CardRow[] = [
      { item: 'Modular installation', unit: 'SQFT', ratePaise: 15_000 },
      { item: 'Loft installation', unit: 'SQFT', ratePaise: 12_000 },
    ];
    expect(resolveLine('carpentry', loft, card, OPTS).ratePaise).toBe(12_000);
  });
  it('full carpentry prices per sq ft per product type off the card, never at the installation rate', () => {
    const card: CardRow[] = [
      { item: 'Modular installation', unit: 'SQFT', ratePaise: 15_000 },
      { item: 'Wardrobe', unit: 'SQFT', ratePaise: 95_000 },
      { item: 'Manual carpentry', unit: 'SQFT', ratePaise: 25_000 },
    ];
    expect(resolveLine('carpentry', wardrobe, card, { ...OPTS, carpentry: 'FULL' })).toMatchObject({ item: 'Wardrobe', ratePaise: 95_000, qtyMilli: 100_000, carpentry: 'FULL' });
    const tv = { ...wardrobe, product: 'TV Unit', code: 'ONSITE' as const };
    expect(resolveLine('carpentry', tv, card, OPTS)).toMatchObject({ item: 'Manual carpentry', ratePaise: 25_000, carpentry: 'FULL' });
  });
  it('full carpentry with no rate on the card needs a price (no default)', () => {
    expect(resolveLine('carpentry', wardrobe, [], { ...OPTS, carpentry: 'FULL' })).toMatchObject({ item: 'Manual carpentry', ratePaise: null, qtyMilli: 100_000 });
  });
  it('a bed with no size is one hydraulic bed assembly', () => {
    const bed = { ...wardrobe, product: 'King size Bed- Hydraulic Storage', widthMm: null, heightMm: null };
    const card: CardRow[] = [{ item: 'Hydraulic bed assembly', unit: 'NOS', ratePaise: 650_000 }];
    expect(resolveLine('carpentry', bed, card, OPTS)).toMatchObject({ unit: 'NOS', ratePaise: 650_000, qtyMilli: 1000 });
  });
});

describe('the other trades', () => {
  it('a lump-sum line comes out needing a quantity and the item named', () => {
    const fc: QuoteLineIn = { product: 'False Ceiling (per room)', code: 'ONSITE', unit: 'UNIT', widthMm: null, heightMm: null, qtyMilli: 1000 };
    expect(resolveLine('false_ceiling', fc, [{ item: 'Plain gypsum ceiling', unit: 'SQFT', ratePaise: 9_000 }], OPTS)).toMatchObject({ item: 'Plain gypsum ceiling', ratePaise: 9_000, qtyMilli: null });
  });
  it('a mirror with a size prices itself by sq ft', () => {
    const m: QuoteLineIn = { product: 'Dressing Unit- Mirror', code: 'ONSITE', unit: 'AREA', widthMm: 3048, heightMm: 3048, qtyMilli: null };
    expect(resolveLine('glass', m, [{ item: 'Mirror 5mm edge polished', unit: 'SQFT', ratePaise: 30_000 }], OPTS)).toMatchObject({ ratePaise: 30_000, qtyMilli: 100_000 });
  });
  it('hardware is billed on invoice: an amount to type', () => {
    const h: QuoteLineIn = { product: 'Base Cabinets- Tandems', code: 'MODULAR', unit: 'UNIT', widthMm: null, heightMm: null, qtyMilli: 4000 };
    expect(resolveLine('hardware', h, [], OPTS)).toMatchObject({ item: 'Supplied on invoice', ratePaise: null, qtySource: 'INVOICE' });
  });
  it('a trade added in Settings has no resolver: customised work to price', () => {
    expect(resolveLine('tiles', wardrobe, [], OPTS)).toMatchObject({ item: 'Customised work', ratePaise: null, qtyMilli: null });
  });
});

describe('finding the card row', () => {
  const card: CardRow[] = [
    { item: 'Vanity unit work', unit: 'NOS', ratePaise: 450_000 },
    { item: 'Point Wiring', unit: 'POINT', ratePaise: 0 },
  ];
  it('exact, canonical, then a shared significant word', () => {
    expect(findRate(card, 'point-wiring')?.item).toBe('Point Wiring');
    expect(findRate(card, 'Vanity Unit')?.item).toBe('Vanity unit work');
  });
  it('a rate of 0 is no rate', () => {
    expect(cardRate(findRate(card, 'Point wiring'))).toBeNull();
  });
});
