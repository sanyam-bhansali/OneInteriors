import { describe, it, expect } from 'vitest';
import { planQuotation, readRules, namedRoomOf, type CatalogueProduct, type HomeConfig } from '@/modules/studio-quote/configure';
import { ratesFromProductMaster, productAmountPaise, type MasterProduct } from '@/modules/quotation/product-master-rates';
import { buildFirstQuote } from '@/modules/quotation/first-quote';

/**
 * One price list: a studio's product master prices its own standard build and
 * its customers' first quotes. The fixture is a slice of a real studio's
 * master (rates in paise), shaped the way the quotation read files it.
 */

let n = 0;
const p = (over: Partial<MasterProduct> & Pick<MasterProduct, 'name' | 'unit' | 'ratePaise' | 'rooms'>): MasterProduct => ({
  id: `p${++n}`,
  code: 'MODULAR',
  details: null,
  defaultWidthMm: null,
  defaultHeightMm: null,
  defaultQty: null,
  inStandardBuild: true,
  isActive: true,
  sortOrder: n * 10,
  rules: null,
  ...over,
});

const MASTER: MasterProduct[] = [
  p({ name: 'Base Cabinets', unit: 'AREA', ratePaise: 2580_00, rooms: ['Kitchen'], defaultHeightMm: 750, rules: { useRun: true } }),
  p({ name: 'Base Cabinets- Tandems (Horizantal)', unit: 'UNIT', ratePaise: 10000_00, rooms: ['Kitchen'], defaultQty: 3 }),
  p({ name: 'Base Cabinets Tandems - Bottle Pull Out', unit: 'UNIT', ratePaise: 12000_00, rooms: ['Kitchen'], defaultQty: 1 }),
  p({ name: 'Wall Cabinets', unit: 'AREA', ratePaise: 2580_00, rooms: ['Kitchen'], defaultHeightMm: 600, rules: { useRun: true } }),
  p({ name: 'Loft (Frame with Shutter)', unit: 'AREA', ratePaise: 2000_00, rooms: ['Kitchen', 'Bedroom', 'Study'], defaultWidthMm: 1500, defaultHeightMm: 600 }),
  p({ name: 'Dry Balcony- Base Storage (Frame with Shutter)', unit: 'AREA', ratePaise: 2000_00, rooms: ['Kitchen'], defaultWidthMm: 1200, defaultHeightMm: 750, rules: { balcony: true } }),
  p({ name: 'Premium Shutter wardrobe', unit: 'AREA', ratePaise: 2580_00, rooms: ['Bedroom', 'Study'], defaultWidthMm: 1500, defaultHeightMm: 2100 }),
  p({ name: 'Sliding wardrobe', unit: 'AREA', ratePaise: 2000_00, rooms: ['Bedroom'], inStandardBuild: false }),
  p({ name: 'Queen size Bed Hydraulic Storage', unit: 'UNIT', ratePaise: 54000_00, rooms: ['Bedroom'], defaultQty: 1 }),
  p({ name: 'King size Bed Hydraulic Storage', unit: 'UNIT', ratePaise: 64000_00, rooms: ['Bedroom'], defaultQty: 1, inStandardBuild: false }),
  p({ name: 'Queen Size - Headboard', unit: 'UNIT', ratePaise: 12000_00, rooms: ['Bedroom'], defaultQty: 1 }),
  p({ name: 'King Size - Headboard', unit: 'UNIT', ratePaise: 14000_00, rooms: ['Bedroom'], defaultQty: 1, inStandardBuild: false }),
  p({ name: 'Vanity Unit', unit: 'AREA', ratePaise: 2580_00, rooms: ['Bathroom'], defaultWidthMm: 900, defaultHeightMm: 750, rules: { perBath: true } }),
  p({ name: 'False Ceiling (Master Bedroom)', code: 'ONSITE', unit: 'SQFT', ratePaise: 150_00, rooms: ['Bedroom'], inStandardBuild: false, rules: { sqft: 140 } }),
  p({ name: 'False Ceiling (Kids Bedroom)', code: 'ONSITE', unit: 'SQFT', ratePaise: 150_00, rooms: ['Bedroom'], inStandardBuild: false, rules: { sqft: 110 } }),
  p({ name: 'False Ceiling (Guest Bedroom)', code: 'ONSITE', unit: 'SQFT', ratePaise: 150_00, rooms: ['Bedroom'], inStandardBuild: false, rules: { sqft: 110 } }),
  p({ name: 'False Ceiling (Living , Dining and Foyer)', code: 'ONSITE', unit: 'SQFT', ratePaise: 150_00, rooms: ['Living'], inStandardBuild: false, rules: { sqft: 220 } }),
  p({ name: 'Painting - 2BHK (Emulsion)', code: 'ONSITE', unit: 'UNIT', ratePaise: 45000_00, rooms: ['Whole home'], rules: { bhk: '2BHK' } }),
  p({ name: 'Painting - 3BHK (Emulsion)', code: 'ONSITE', unit: 'UNIT', ratePaise: 55000_00, rooms: ['Whole home'], rules: { bhk: '3BHK' } }),
  p({ name: 'Painting - 3BHK (Lustre)', code: 'ONSITE', unit: 'UNIT', ratePaise: 65000_00, rooms: ['Whole home'], inStandardBuild: false, rules: { bhk: '3BHK' } }),
  p({ name: 'Electricals (3BHK)', code: 'ONSITE', unit: 'UNIT', ratePaise: 40000_00, rooms: ['Whole home'], rules: { bhk: '3BHK' } }),
];

const home = (over: Partial<HomeConfig> = {}): HomeConfig => ({ config: '3 BHK', kitchenRunMm: 4000, bathrooms: 2, study: false, ...over });

describe('readRules / namedRoomOf', () => {
  it('keeps well-formed rules and drops the rest', () => {
    expect(readRules({ bhk: '3BHK', perBath: true, sqft: 140, junk: 1, rft: -2 })).toEqual({ bhk: '3BHK', perBath: true, sqft: 140 });
    expect(readRules(null)).toBeNull();
    expect(readRules({})).toBeNull();
  });

  it('reads the room a product is named for', () => {
    expect(namedRoomOf('False Ceiling (Kids Bedroom)')?.test('Kids bedroom')).toBe(true);
    expect(namedRoomOf('False Ceiling (Kids Bedroom)')?.test('Guest bedroom')).toBe(false);
    expect(namedRoomOf('Loft (Frame with Shutter)')).toBeNull();
    expect(namedRoomOf('False Ceiling (Bedroom Balcony)')).toBeNull();
  });
});

describe('planQuotation follows the product rules', () => {
  const plan = (h: Partial<HomeConfig> = {}, master: CatalogueProduct[] = MASTER) => planQuotation(home(h), master).lines;

  it('puts only the painting and electricals for this flat size', () => {
    const whole = plan().filter((l) => l.room === 'Whole home').map((l) => l.product);
    expect(whole).toEqual(['Painting - 3BHK (Emulsion)', 'Electricals (3BHK)']);
    expect(plan({ config: '2 BHK' }).filter((l) => l.room === 'Whole home').map((l) => l.product)).toEqual(['Painting - 2BHK (Emulsion)']);
  });

  it('gives the master bedroom the king bed and headboard, the others the queen', () => {
    const lines = plan();
    const beds = (room: string) => lines.filter((l) => l.room === room && /bed|headboard/i.test(l.product)).map((l) => l.product);
    expect(beds('Master bedroom')).toEqual(['King size Bed Hydraulic Storage', 'King Size - Headboard']);
    expect(beds('Kids bedroom')).toEqual(['Queen size Bed Hydraulic Storage', 'Queen Size - Headboard']);
  });

  it('fits the balcony storage only when there is a balcony, and never on the kitchen run', () => {
    const balcony = plan().find((l) => /dry balcony/i.test(l.product));
    expect(balcony?.widthMm).toBe(1200);
    expect(plan({ balcony: false }).some((l) => /dry balcony/i.test(l.product))).toBe(false);
  });

  it('puts one vanity per bathroom', () => {
    expect(plan({ bathrooms: 3 }).filter((l) => l.product === 'Vanity Unit').map((l) => l.room)).toEqual(['Bathroom 1', 'Bathroom 2', 'Bathroom 3']);
  });

  it('puts a room-named product only in that room, with its sq ft', () => {
    const master = MASTER.map((m) => (/false ceiling/i.test(m.name) ? { ...m, inStandardBuild: true } : m));
    const fc = plan({}, master).filter((l) => /false ceiling/i.test(l.product));
    expect(fc.map((l) => `${l.room}: ${l.qtyMilli}`)).toEqual([
      'Master bedroom: 140000',
      'Kids bedroom: 110000',
      'Guest bedroom: 110000',
      'Living and dining: 220000',
    ]);
  });
});

describe('ratesFromProductMaster', () => {
  const rates = ratesFromProductMaster(MASTER, '2026-10-10');

  it('prices area lines at the studio rate per sq ft', () => {
    expect(rates.kitchen_base?.ratePaise).toBe(2580_00);
    expect(rates.master_wardrobe?.ratePaise).toBe(2580_00);
    expect(rates.master_loft?.ratePaise).toBe(2000_00);
  });

  it('bundles the standard tandems, and the king bed in the master', () => {
    expect(rates.kitchen_tandem?.ratePaise).toBe(42000_00);
    expect(rates.master_bed?.ratePaise).toBe(78000_00);
    expect(rates.second_bed?.ratePaise).toBe(66000_00);
  });

  it('prices the vanity per bathroom at its own default size', () => {
    expect(rates.vanity?.ratePaise).toBe(productAmountPaise(MASTER.find((m) => m.name === 'Vanity Unit')!));
  });

  it('prices painting and false ceiling per flat, and the first quote uses that figure', () => {
    expect(rates.painting?.perBhkPaise).toEqual({ 2: 45000_00, 3: 55000_00 });
    expect(rates.false_ceiling?.perBhkPaise?.[3]).toBe((140 + 110 + 110 + 220) * 150_00);

    const quote = buildFirstQuote(
      { bhk: 3, carpetAreaSqft: 1150, bathrooms: 2, kitchenRunMm: 4000, runSource: 'customer' },
      rates,
    );
    expect(quote.lines.find((l) => l.code === 'painting')?.amountPaise).toBe(55000_00);
    expect(quote.lines.find((l) => l.code === 'electrical')?.amountPaise).toBe(40000_00);
    expect(quote.lines.find((l) => l.code === 'false_ceiling')?.amountPaise).toBe(580 * 150_00);
  });

  it('falls back to a per-foot rate for a flat size the studio did not price', () => {
    const quote = buildFirstQuote({ bhk: 1, carpetAreaSqft: 550, bathrooms: 1, kitchenRunMm: null, runSource: 'standard' }, rates);
    const electrical = quote.lines.find((l) => l.code === 'electrical');
    expect(electrical?.unit).toBe('sq ft');
    expect(electrical?.amountPaise).toBeGreaterThan(0);
  });

  it('ignores switched-off and unpriced products', () => {
    const off = ratesFromProductMaster(MASTER.map((m) => (m.name === 'Vanity Unit' ? { ...m, isActive: false } : m)), '2026-10-10');
    expect(off.vanity).toBeUndefined();
  });
});

describe("the studio's own modular discount on the customer's first quote", () => {
  const rates = ratesFromProductMaster(MASTER, '2026-10-10');
  const input = { bhk: 3, carpetAreaSqft: 1150, bathrooms: 2, kitchenRunMm: 4000, runSource: 'customer' as const };

  it('takes the percentage the studio filled in', () => {
    const q = buildFirstQuote({ ...input, modularDiscountPct: 15 }, rates);
    expect(q.modularDiscountPct).toBe(15);
    expect(q.modularDiscountPaise).toBe(Math.round(q.modularPaise * 0.15));
  });

  it('gives none when the studio gives none', () => {
    const q = buildFirstQuote({ ...input, modularDiscountPct: null }, rates);
    expect(q.modularDiscountPaise).toBe(0);
  });

  it('keeps the archive median for the sample studios, which have no setting', () => {
    expect(buildFirstQuote(input, rates).modularDiscountPct).toBe(10);
  });
});
