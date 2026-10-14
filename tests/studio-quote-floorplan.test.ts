import { describe, it, expect } from 'vitest';
import {
  planQuotation,
  standardSelectionFor,
  withStandardSelection,
  itemRank,
  bhkOfProduct,
  ceilingProductFor,
  type CatalogueProduct,
  type HomeConfig,
} from '@/modules/studio-quote/configure';
import { wardrobeWidthMm, areaSqft, planRoomFor } from '@/modules/floorplan/sizing';
import {
  checkPlanFile,
  decideRead,
  istDayStart,
  isFinalFailure,
  planReadMessage,
  PLAN_READS_PER_DAY,
  STALE_READ_MS,
} from '@/modules/floorplan/plan-cache';
import {
  configFromBedrooms,
  fileReadingOf,
  homeFromLead,
  homeFromReading,
  jobView,
  outcomeMessage,
  readingSummary,
} from '@/modules/studio-quote/from-plan-rules';
import { normalisePlan, type FloorPlanReading } from '@/modules/floorplan/reading';
import { FEE_BPS, feeBpsOf, computeTotals } from '@/modules/studio-quote/pricing';

/**
 * Floor plan → first quotation (12 Oct 2026): Hauspire's first-quote rules
 * ported into the studio build, the reading turned into a flat, and the
 * guards that keep reading cheap.
 */

// ── A 3 BHK plan, as the reader returns it ─────────────────────

const RAW = {
  bedrooms: 3,
  hasStudy: true,
  bathrooms: 2,
  carpetAreaSqft: 1150,
  kitchen: { widthFt: 10, depthFt: 10.1667, shape: 'l' },
  confidence: 'high',
  rooms: [
    { name: 'Master Bedroom', widthFt: 12, depthFt: 14 },
    { name: 'Kids Bedroom', widthFt: 10.5, depthFt: 11.5 },
    { name: 'Bedroom', widthFt: 10, depthFt: 11 },
    { name: 'Living/Dining', widthFt: 13, depthFt: 18 },
    { name: 'Kitchen', widthFt: 10, depthFt: 10.1667 },
    { name: 'Study', widthFt: 8, depthFt: 9 },
    { name: 'Toilet', widthFt: 5, depthFt: 8 },
    { name: 'Toilet', widthFt: 5, depthFt: 7 },
    { name: 'Dry Balcony', widthFt: 4, depthFt: 6 },
  ],
};

function reading(over: Record<string, unknown> = {}): FloorPlanReading {
  const r = normalisePlan({ ...RAW, ...over });
  if (!r.ok) throw new Error('fixture did not read');
  return r.reading;
}

let n = 0;
const p = (over: Partial<CatalogueProduct> & Pick<CatalogueProduct, 'name'>): CatalogueProduct => ({
  id: `p${++n}`,
  code: 'MODULAR',
  unit: 'AREA',
  details: null,
  ratePaise: 2580_00,
  rooms: ['Kitchen'],
  defaultWidthMm: null,
  defaultHeightMm: null,
  defaultQty: null,
  inStandardBuild: true,
  isActive: true,
  sortOrder: n,
  rules: null,
  ...over,
});

/** Hauspire's product master, the parts the first quote uses, as a studio would hold it. */
const HAUSPIRE: CatalogueProduct[] = [
  p({ name: 'Wall Cabinets', rooms: ['Kitchen'], defaultHeightMm: 600, rules: { useRun: true }, sortOrder: 1 }),
  p({ name: 'Base Cabinets', rooms: ['Kitchen'], defaultHeightMm: 750, rules: { useRun: true }, sortOrder: 2 }),
  p({ name: 'Base Cabinets- Tandems (Horizantal)', code: 'ONSITE', unit: 'UNIT', ratePaise: 10_000_00, rooms: ['Kitchen'], defaultQty: 3 }),
  p({ name: 'Loft (Frame with Shutter)', ratePaise: 2000_00, rooms: ['Kitchen', 'Bedroom'], defaultWidthMm: 1500, defaultHeightMm: 600 }),
  p({ name: 'Premium Shutter wardrobe', rooms: ['Bedroom'], defaultWidthMm: 1500, defaultHeightMm: 2100 }),
  p({ name: 'Queen size Bed Hydraulic Storage', unit: 'UNIT', ratePaise: 54_000_00, rooms: ['Bedroom'], defaultQty: 1 }),
  p({ name: 'King size Bed Hydraulic Storage', unit: 'UNIT', ratePaise: 64_000_00, rooms: ['Bedroom'], defaultQty: 1, inStandardBuild: false }),
  p({ name: 'TV Unit', code: 'ONSITE', ratePaise: 1200_00, rooms: ['Living'], defaultWidthMm: 1500, defaultHeightMm: 2100 }),
  p({ name: 'Vanity Unit', rooms: ['Bathroom'], defaultWidthMm: 600, defaultHeightMm: 600, rules: { perBath: true } }),
  p({ name: 'Painting - 2BHK (Emulsion)', code: 'ONSITE', unit: 'UNIT', ratePaise: 45_000_00, rooms: ['Whole home'] }),
  p({ name: 'Painting - 3BHK (Emulsion)', code: 'ONSITE', unit: 'UNIT', ratePaise: 55_000_00, rooms: ['Whole home'] }),
  p({ name: 'False Ceiling (Master Bedroom)', code: 'ONSITE', unit: 'SQFT', ratePaise: 75_00, rooms: ['Bedroom'], inStandardBuild: false }),
  p({ name: 'False Ceiling (Kids Bedroom)', code: 'ONSITE', unit: 'SQFT', ratePaise: 75_00, rooms: ['Bedroom'], inStandardBuild: false }),
  p({ name: 'False Ceiling (Master Bedroom Balcony)', code: 'ONSITE', unit: 'SQFT', ratePaise: 75_00, rooms: ['Bedroom'], inStandardBuild: false }),
  p({ name: 'False Ceiling', code: 'ONSITE', unit: 'SQFT', ratePaise: 70_00, rooms: ['Whole home'], inStandardBuild: false }),
];

describe('a reading becomes the flat the build takes', () => {
  const stored = fileReadingOf(reading());

  it('keeps the rooms, run, baths, study and a dry balcony on the lead file', () => {
    expect(stored.rooms).toHaveLength(9);
    expect(stored.bathrooms).toBe(2);
    expect(stored.hasStudy).toBe(true);
    expect(stored.dryBalcony).toBe(true);
    /* L-kitchen: width + depth − 900 (Hauspire's calibrated run). */
    expect(stored.kitchenRunMm).toBe(3048 + 3099 - 900);
  });

  it('takes the size from the plan, the lead only as a fallback', () => {
    expect(homeFromReading(stored, '2 BHK')!.config).toBe('3 BHK');
    expect(homeFromReading({ ...stored, bedrooms: 0 }, '2 BHK')!.config).toBe('2 BHK');
    expect(homeFromReading({ ...stored, bedrooms: 0 }, null)).toBeNull();
    expect(configFromBedrooms(6)).toBe('4 BHK');
    expect(configFromBedrooms(0)).toBeNull();
  });

  it('turns false ceiling and the king bed on, and the plan sizing', () => {
    const home = homeFromReading(stored, null)!;
    expect(home).toMatchObject({ bathrooms: 2, study: true, balcony: true, usePlan: true, falseCeiling: true, kingMaster: true, kitchenRunMm: stored.kitchenRunMm });
  });

  it('says no dry balcony only when the plan shows rooms and none is one', () => {
    const noDry = fileReadingOf(reading({ rooms: RAW.rooms.filter((r) => r.name !== 'Dry Balcony') }));
    expect(noDry.dryBalcony).toBe(false);
    expect(homeFromReading(noDry, null)!.balcony).toBe(false);
  });

  it('falls back to the lead BHK template without a reading', () => {
    expect(homeFromLead('2 BHK')).toEqual({ config: '2 BHK', kitchenRunMm: null, bathrooms: 2, study: false });
    expect(homeFromLead('1 BHK')!.bathrooms).toBe(1);
    expect(homeFromLead(null)).toBeNull();
  });

  it('summarises in words', () => {
    expect(readingSummary(stored)).toBe(`3 bedrooms, 2 bathrooms, a study, kitchen run ${stored.kitchenRunMm} mm, about 1,150 sq ft`);
  });
});

describe('the first quotation from the plan (Hauspire first-quote rules)', () => {
  const stored = fileReadingOf(reading());
  const home: HomeConfig = { ...homeFromReading(stored, null)!, planRooms: stored.rooms };
  const { lines, notes } = planQuotation(home, HAUSPIRE);
  const inRoom = (room: string) => lines.filter((l) => l.room === room).map((l) => l.product);

  it('has the rooms of a 3 BHK with a study and two bathrooms', () => {
    expect([...new Set(lines.map((l) => l.room))]).toEqual([
      'Kitchen',
      'Master bedroom',
      'Kids bedroom',
      'Guest bedroom',
      'Living and dining',
      'Study',
      'Bathroom 1',
      'Bathroom 2',
      'Whole home',
    ]);
  });

  it('sizes base, wall and loft in the kitchen to the run from the plan', () => {
    for (const name of ['Base Cabinets', 'Wall Cabinets', 'Loft (Frame with Shutter)']) {
      expect(lines.find((l) => l.room === 'Kitchen' && l.product === name)!.widthMm).toBe(stored.kitchenRunMm);
    }
  });

  it('lists the kitchen in Hauspire order, whatever the catalogue order', () => {
    expect(inRoom('Kitchen').slice(0, 4)).toEqual(['Base Cabinets', 'Base Cabinets- Tandems (Horizantal)', 'Wall Cabinets', 'Loft (Frame with Shutter)']);
  });

  it('sizes each wardrobe to 55% of its bedroom shorter wall', () => {
    const master = lines.find((l) => l.room === 'Master bedroom' && /wardrobe/i.test(l.product))!;
    expect(master.widthMm).toBe(wardrobeWidthMm({ widthMm: 3658, depthMm: 4267 }));
    expect(master.widthMm).toBe(2000); // 3658 × .55 = 2012 → 2000, not 2350 off the longer wall
  });

  it('puts one vanity in each bathroom', () => {
    expect(inRoom('Bathroom 1')).toEqual(['Vanity Unit']);
    expect(inRoom('Bathroom 2')).toEqual(['Vanity Unit']);
  });

  it('picks the painting for this flat size only (BHK variant from the name)', () => {
    expect(inRoom('Whole home')).toEqual(['Painting - 3BHK (Emulsion)']);
    expect(bhkOfProduct({ name: 'Electricals (2 BHK)', rules: null })).toBe(2);
    expect(bhkOfProduct({ name: 'Painting', rules: { bhk: '4BHK' } })).toBe(4);
  });

  it('gives the master bedroom the king bed', () => {
    expect(inRoom('Master bedroom')).toContain('King size Bed Hydraulic Storage');
    expect(inRoom('Kids bedroom')).toContain('Queen size Bed Hydraulic Storage');
    const queen = planQuotation({ ...home, kingMaster: false }, HAUSPIRE).lines;
    expect(queen.filter((l) => /king/i.test(l.product))).toHaveLength(0);
  });

  it('puts a false ceiling in every room but the bathrooms, sized to the room on the plan', () => {
    const fc = lines.filter((l) => /false ceiling/i.test(l.product));
    expect(fc.map((l) => l.room)).toEqual(['Kitchen', 'Master bedroom', 'Kids bedroom', 'Guest bedroom', 'Living and dining', 'Study']);
    expect(fc.find((l) => l.room === 'Master bedroom')!.product).toBe('False Ceiling (Master Bedroom)');
    expect(fc.find((l) => l.room === 'Master bedroom')!.qtyMilli).toBe(planRoomFor('Master bedroom', 0, stored.rooms)!.sqft * 1000);
    /* No room-named product for the kitchen: the plain one, sized to the kitchen. */
    expect(fc.find((l) => l.room === 'Kitchen')!.product).toBe('False Ceiling');
    expect(fc.find((l) => l.room === 'Kitchen')!.qtyMilli).toBe(areaSqft({ widthMm: 3048, depthMm: 3099 }) * 1000);
    expect(notes.some((x) => x.includes('false-ceiling'))).toBe(true);
  });

  it('builds a 2 BHK variant when the plan has two bedrooms', () => {
    const two = fileReadingOf(reading({ bedrooms: 2, hasStudy: false, rooms: RAW.rooms.filter((r) => r.name !== 'Bedroom' && r.name !== 'Study') }));
    const built = planQuotation({ ...homeFromReading(two, null)!, planRooms: two.rooms }, HAUSPIRE).lines;
    expect([...new Set(built.map((l) => l.room))]).toContain('Second bedroom');
    expect(built.filter((l) => l.room === 'Whole home').map((l) => l.product)).toEqual(['Painting - 2BHK (Emulsion)']);
  });
});

describe('false ceiling without a product', () => {
  const plain = HAUSPIRE.filter((x) => !/false ceiling/i.test(x.name));
  const home: HomeConfig = { config: '2 BHK', kitchenRunMm: 3000, bathrooms: 1, study: false, falseCeiling: true };

  it('adds nothing and says so when there is no product and no rate', () => {
    const { lines, notes } = planQuotation(home, plain);
    expect(lines.some((l) => /false ceiling/i.test(l.product))).toBe(false);
    expect(notes.some((x) => x.includes('no false-ceiling product'))).toBe(true);
  });

  it('uses a typed rate per sq ft for a plain line in each room', () => {
    const { lines } = planQuotation({ ...home, falseCeilingRatePaise: 75_00 }, plain);
    const fc = lines.filter((l) => l.product === 'False ceiling');
    expect(fc.map((l) => l.room)).toEqual(['Kitchen', 'Master bedroom', 'Second bedroom', 'Living and dining']);
    expect(fc.every((l) => l.unit === 'SQFT' && l.ratePaise === 75_00 && l.code === 'ONSITE')).toBe(true);
  });

  it('prefers the room-named product and skips balcony variants', () => {
    expect(ceilingProductFor({ name: 'Master bedroom', category: 'Bedroom' }, HAUSPIRE)!.name).toBe('False Ceiling (Master Bedroom)');
  });
});

describe('the standard selection when nothing is ticked (firstQuoteDefaults)', () => {
  it('reads what a product is for off its name', () => {
    expect(standardSelectionFor('Base Cabinets', 'AREA')).toMatchObject({ rooms: ['Kitchen'], rules: { useRun: true }, heightMm: 750 });
    expect(standardSelectionFor('Vanity Unit', 'AREA')).toMatchObject({ rooms: ['Bathroom'], rules: { perBath: true } });
    expect(standardSelectionFor('Painting - 3BHK (Emulsion)', 'UNIT')).toMatchObject({ rooms: ['Whole home'], rules: { bhk: '3BHK' } });
    expect(standardSelectionFor('Painting - 3BHK (Lustre)', 'UNIT')).toBeNull();
    expect(standardSelectionFor('King size Bed Hydraulic Storage', 'UNIT')).toBeNull();
    expect(standardSelectionFor('Bespoke bar unit', 'AREA')).toBeNull();
  });

  it('applies only when the studio has ticked nothing, and says so', () => {
    const none = HAUSPIRE.map((x) => ({ ...x, inStandardBuild: false }));
    expect(withStandardSelection(none).applied).toBe(true);
    expect(withStandardSelection(HAUSPIRE).applied).toBe(false);
    const { lines, notes } = planQuotation({ config: '3 BHK', kitchenRunMm: 4000, bathrooms: 2, study: false }, none);
    expect(lines.length).toBeGreaterThan(10);
    expect(notes[0]).toContain('standard selection');
  });

  it('ranks unknown products after the known ones', () => {
    expect(itemRank('Base Cabinets')).toBeLessThan(itemRank('Wall Cabinets'));
    expect(itemRank('Wardrobe')).toBeLessThan(itemRank('Queen size Bed Hydraulic Storage'));
    expect(itemRank('Something else')).toBeGreaterThan(itemRank('False ceiling'));
  });
});

describe('reading cheaply: file limits, one read per file, the daily cap', () => {
  const now = new Date('2026-10-12T10:00:00Z');

  it('takes PDF and photos within their limits', () => {
    expect(checkPlanFile('application/pdf', 10 * 1024 * 1024)).toEqual({ ok: true });
    expect(checkPlanFile('image/jpeg', 6 * 1024 * 1024)).toEqual({ ok: false, reason: 'photo-too-large' });
    expect(checkPlanFile('image/heic', 1000)).toEqual({ ok: false, reason: 'file-type' });
    expect(checkPlanFile('image/png; charset=binary', 1000)).toEqual({ ok: true });
  });

  it('uses a stored reading without calling, even past the cap', () => {
    expect(decideRead({ status: 'READ', reason: null, attempts: 1, lastAttemptAt: now }, now, 999)).toEqual({ kind: 'use' });
  });

  it('reads a new file, and refuses once the studio has read 200 today', () => {
    expect(decideRead(null, now, 0)).toEqual({ kind: 'read', retry: false });
    expect(decideRead(null, now, PLAN_READS_PER_DAY)).toEqual({ kind: 'refuse', reason: 'daily-cap' });
  });

  it('waits while the same file is being read, and treats a stale read as failed', () => {
    const running = { status: 'READING' as const, reason: null, attempts: 1, lastAttemptAt: new Date(now.getTime() - 10_000) };
    expect(decideRead(running, now, 0)).toEqual({ kind: 'busy' });
    const dead = { ...running, lastAttemptAt: new Date(now.getTime() - STALE_READ_MS - 1) };
    expect(decideRead(dead, now, 0)).toEqual({ kind: 'read', retry: true });
  });

  it('never re-reads a plan the reader could not make out; retries a timeout once', () => {
    expect(decideRead({ status: 'FAILED', reason: 'unreadable', attempts: 1, lastAttemptAt: now }, now, 0)).toEqual({ kind: 'refuse', reason: 'unreadable' });
    expect(decideRead({ status: 'FAILED', reason: 'reader-failed', attempts: 1, lastAttemptAt: now }, now, 0)).toEqual({ kind: 'read', retry: true });
    expect(decideRead({ status: 'FAILED', reason: 'reader-failed', attempts: 2, lastAttemptAt: now }, now, 0)).toEqual({ kind: 'refuse', reason: 'reader-failed' });
    expect(isFinalFailure('no-rooms')).toBe(true);
    expect(isFinalFailure('reader-failed')).toBe(false);
  });

  it('counts the day from India midnight', () => {
    expect(istDayStart(new Date('2026-10-12T10:00:00Z')).toISOString()).toBe('2026-10-11T18:30:00.000Z');
    expect(istDayStart(new Date('2026-10-12T19:00:00Z')).toISOString()).toBe('2026-10-12T18:30:00.000Z');
  });
});

describe('what the lead page says', () => {
  it('says plainly when reading is not switched on', () => {
    expect(planReadMessage('not-configured')).toBe("Floor-plan reading isn't switched on yet.");
    const msg = outcomeMessage({ read: false, reason: 'not-configured', built: { number: '2026-014', lines: 31 }, builtFrom: 'lead' });
    expect(msg).toContain("Floor-plan reading isn't switched on yet.");
    expect(msg).toContain("built from the lead's BHK");
  });

  it('names the quotation built from the plan', () => {
    expect(outcomeMessage({ read: true, summary: '3 bedrooms', built: { number: '2026-014', lines: 40 }, builtFrom: 'plan' })).toContain('First quotation 2026-014 is built from it (40 lines)');
  });

  it('shows a dead run as failed', () => {
    const now = new Date('2026-10-12T10:00:00Z');
    const old = new Date(now.getTime() - STALE_READ_MS - 1);
    expect(jobView({ status: 'READING', message: null, quoteId: null, startedAt: old }, null, now).status).toBe('FAILED');
    expect(jobView({ status: 'READING', message: null, quoteId: null, startedAt: now }, null, now).message).toContain('Reading the plan');
  });
});

describe('the fee: 7% for every studio, on or off', () => {
  it('is 7% or nothing', () => {
    expect(FEE_BPS).toBe(700);
    expect(feeBpsOf(true)).toBe(700);
    expect(feeBpsOf(false)).toBe(0);
  });

  it('prices as Hauspire: fee on the work, discount on modular only, GST after', () => {
    const t = computeTotals(
      [
        { unit: 'UNIT', code: 'MODULAR', ratePaise: 100_000_00, qtyMilli: 1000 },
        { unit: 'UNIT', code: 'ONSITE', ratePaise: 50_000_00, qtyMilli: 1000 },
      ],
      { feeBps: FEE_BPS, discountBps: 1500, gstBps: 1800 },
    );
    expect(t.feePaise).toBe(10_500_00);
    expect(t.discountPaise).toBe(15_000_00);
    expect(t.beforeTaxPaise).toBe(145_500_00);
    expect(t.gstPaise).toBe(26_190_00);
  });
});
