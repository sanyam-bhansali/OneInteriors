import { describe, it, expect } from 'vitest';
import { wardrobeWidthMm, bedroomsInOrder, areaSqft, planRoomFor } from '@/modules/floorplan/sizing';
import { buildFirstQuote } from '@/modules/quotation/first-quote';
import { planQuotation, type CatalogueProduct } from '@/modules/studio-quote/configure';
import { planRoomsFrom } from '@/modules/brief/mapping';
import { layoutRooms } from '@/components/floorplan/FloorPlanView';
import type { PlanRoomSize } from '@/modules/brief/types';
import type { StudioRates } from '@/modules/quotation/catalogue';

const ROOMS: PlanRoomSize[] = [
  { name: 'Bedroom', code: 'BEDROOM', widthMm: 3048, depthMm: 3353 }, // 10' x 11'
  { name: 'Master Bedroom', code: 'BEDROOM', widthMm: 3658, depthMm: 4267 }, // 12' x 14'
  { name: 'Kids Bedroom', code: 'BEDROOM', widthMm: 3200, depthMm: 3500 },
  { name: 'Living', code: 'LIVING', widthMm: 3962, depthMm: 5486 },
  { name: 'Dining', code: 'DINING', widthMm: 2743, depthMm: 3048 },
  { name: 'Kitchen', code: 'KITCHEN', widthMm: 2438, depthMm: 3048 },
  { name: 'Toilet', code: 'TOILET', widthMm: 1524, depthMm: 2438 },
];

describe('floor plan sizing (Hauspire rules)', () => {
  it('sizes a wardrobe to 55% of the shorter wall, rounded and kept between 1200 and 2400', () => {
    /* Shorter, as Hauspire's locked buildQuote.ts has it (12 Oct 2026; was the longer wall). */
    expect(wardrobeWidthMm({ widthMm: 3658, depthMm: 4267 })).toBe(2000); // 3658 × .55 = 2012 → 2000
    expect(wardrobeWidthMm({ widthMm: 1800, depthMm: 2000 })).toBe(1200);
    expect(wardrobeWidthMm({ widthMm: 5000, depthMm: 6000 })).toBe(2400);
  });

  it('puts the master first, then the rest largest first', () => {
    expect(bedroomsInOrder(ROOMS).map((r) => r.name)).toEqual(['Master Bedroom', 'Kids Bedroom', 'Bedroom']);
  });

  it('prices living and dining together, as the quotation does', () => {
    expect(planRoomFor('Living and dining', null, ROOMS)?.sqft).toBe(areaSqft(ROOMS[3]!) + areaSqft(ROOMS[4]!));
  });

  it('keeps only rooms whose sizes are sizes', () => {
    expect(planRoomsFrom([{ name: 'X', code: 'BEDROOM', widthMm: 3000, depthMm: 3000 }, { name: 'Y', code: 'BEDROOM', widthMm: 9, depthMm: 3000 }, 'nope'])).toHaveLength(1);
    expect(planRoomsFrom('nope')).toBeUndefined();
  });

  it('lays rooms out without overlap', () => {
    const { placed } = layoutRooms(ROOMS);
    for (const a of placed)
      for (const b of placed)
        if (a !== b) {
          const apart = a.x + a.widthMm <= b.x || b.x + b.widthMm <= a.x || a.y + a.depthMm <= b.y || b.y + b.depthMm <= a.y;
          expect(apart).toBe(true);
        }
  });
});

describe('a first quote from the plan', () => {
  const rates: StudioRates = {
    master_wardrobe: { code: 'master_wardrobe', ratePaise: 2580_00, fromQuotations: 10, filedOn: '2026-10-10' },
    master_loft: { code: 'master_loft', ratePaise: 2000_00, fromQuotations: 10, filedOn: '2026-10-10' },
    second_wardrobe: { code: 'second_wardrobe', ratePaise: 2580_00, fromQuotations: 10, filedOn: '2026-10-10' },
  };
  const base = { bhk: 3, carpetAreaSqft: 1150, bathrooms: 2, kitchenRunMm: null, runSource: 'standard' as const };

  it('sizes each bedroom wardrobe and loft to its wall, and says so', () => {
    const q = buildFirstQuote({ ...base, planRooms: ROOMS }, rates);
    const master = q.lines.find((l) => l.code === 'master_wardrobe')!;
    expect(master.size).toBe('2000 × 2100 mm');
    expect(master.standard).toBe(false);
    expect(q.lines.find((l) => l.code === 'master_loft')!.size).toBe('2000 × 600 mm');
    expect(q.lines.find((l) => l.code === 'second_wardrobe')!.size).toBe(`${wardrobeWidthMm(ROOMS[2]!)} × 2100 mm`);
    expect(q.assumptions.some((a) => a.includes('floor plan'))).toBe(true);
  });

  it('keeps the standard sizes without a plan', () => {
    const q = buildFirstQuote(base, rates);
    expect(q.lines.find((l) => l.code === 'master_wardrobe')!.size).toBe('1800 × 2100 mm');
  });
});

describe('a studio build from the plan', () => {
  let n = 0;
  const p = (over: Partial<CatalogueProduct> & Pick<CatalogueProduct, 'name' | 'unit' | 'rooms'>): CatalogueProduct => ({
    id: `p${++n}`,
    code: 'MODULAR',
    details: null,
    ratePaise: 1000_00,
    defaultWidthMm: 1500,
    defaultHeightMm: 2100,
    defaultQty: null,
    inStandardBuild: true,
    isActive: true,
    sortOrder: n,
    rules: null,
    ...over,
  });
  const catalogue = [
    p({ name: 'Premium Shutter wardrobe', unit: 'AREA', rooms: ['Bedroom'] }),
    p({ name: 'False Ceiling (Master Bedroom)', unit: 'SQFT', rooms: ['Bedroom'], rules: { sqft: 140 } }),
  ];

  it('sizes wardrobes to each bedroom and the master ceiling to its area', () => {
    const { lines, notes } = planQuotation({ config: '3 BHK', kitchenRunMm: 4000, bathrooms: 2, study: false, planRooms: ROOMS }, catalogue);
    const wardrobes = lines.filter((l) => /wardrobe/i.test(l.product)).map((l) => `${l.room}: ${l.widthMm}`);
    expect(wardrobes).toEqual([
      'Master bedroom: 2000',
      `Kids bedroom: ${wardrobeWidthMm(ROOMS[2]!)}`,
      `Guest bedroom: ${wardrobeWidthMm(ROOMS[0]!)}`,
    ]);
    expect(lines.find((l) => /false ceiling/i.test(l.product))!.qtyMilli).toBe(areaSqft(ROOMS[1]!) * 1000);
    expect(notes.some((x) => x.includes('floor plan'))).toBe(true);
  });

  it('builds the standard sizes without one', () => {
    const { lines } = planQuotation({ config: '3 BHK', kitchenRunMm: 4000, bathrooms: 2, study: false }, catalogue);
    expect(lines.filter((l) => /wardrobe/i.test(l.product)).every((l) => l.widthMm === 1500)).toBe(true);
  });
});
