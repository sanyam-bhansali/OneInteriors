import { describe, it, expect } from 'vitest';
import {
  planQuotation,
  roomsFor,
  bedroomCount,
  isConfigName,
  type CatalogueProduct,
  type HomeConfig,
} from '@/modules/studio-quote/configure';

/**
 * The builder's starting point.
 *
 * A mistake here is not one wrong line — it is twenty-five, on a document
 * going to a homeowner about a twenty-lakh job, produced in one click by
 * somebody who did not type any of them. So the cases below are the ones that
 * produce a plausible-looking wrong quotation rather than the ones that throw.
 */

const product = (over: Partial<CatalogueProduct> = {}): CatalogueProduct => ({
  id: 'p1',
  name: 'Wardrobe',
  code: 'MODULAR',
  unit: 'AREA',
  details: null,
  ratePaise: 258_000_00,
  rooms: ['Bedroom'],
  defaultWidthMm: 1500,
  defaultHeightMm: 2100,
  defaultQty: null,
  inStandardBuild: true,
  isActive: true,
  sortOrder: 100,
  ...over,
});

const home = (over: Partial<HomeConfig> = {}): HomeConfig => ({
  config: '3 BHK',
  kitchenRunMm: 3960,
  bathrooms: 2,
  study: false,
  ...over,
});

describe('roomsFor', () => {
  it('gives a 3 BHK three bedrooms, and names them', () => {
    const names = roomsFor(home()).map((r) => r.name);
    expect(names).toEqual([
      'Kitchen',
      'Master bedroom',
      'Kids bedroom',
      'Guest bedroom',
      'Living and dining',
      'Bathroom 1',
      'Bathroom 2',
      'Whole home',
    ]);
  });

  it('does not number a single bathroom', () => {
    /* "Bathroom 1" on a flat with one bathroom is a form talking to itself. */
    const names = roomsFor(home({ bathrooms: 1 })).map((r) => r.name);
    expect(names).toContain('Bathroom');
    expect(names).not.toContain('Bathroom 1');
  });

  it('adds the study only when asked', () => {
    expect(roomsFor(home()).map((r) => r.name)).not.toContain('Study');
    expect(roomsFor(home({ study: true })).map((r) => r.name)).toContain('Study');
  });

  it('counts bedrooms per configuration', () => {
    expect(bedroomCount('1 BHK')).toBe(1);
    expect(bedroomCount('4 BHK')).toBe(4);
  });

  it('refuses an absurd bathroom count without throwing', () => {
    /* A typed 40 is a typo, and a quotation with forty vanities is worse than
       one that quietly stops at six. */
    const baths = roomsFor(home({ bathrooms: 40 })).filter((r) => r.category === 'Bathroom');
    expect(baths).toHaveLength(6);
    expect(roomsFor(home({ bathrooms: -1 })).some((r) => r.category === 'Bathroom')).toBe(false);
  });

  it('knows a configuration name when it sees one', () => {
    expect(isConfigName('3 BHK')).toBe(true);
    expect(isConfigName('3BHK')).toBe(false);
    expect(isConfigName(null)).toBe(false);
  });
});

describe('planQuotation', () => {
  it('repeats a bedroom product in every bedroom', () => {
    /* The rule that turns twenty-five ticks into forty lines. */
    const { lines } = planQuotation(home(), [product()]);
    expect(lines.map((l) => l.room)).toEqual([
      'Master bedroom',
      'Kids bedroom',
      'Guest bedroom',
    ]);
  });

  it('quotes whole-home work once, not once per room', () => {
    /**
     * The most expensive possible mistake in this file. Painting is a
     * ₹55,000 line for the flat; repeated per room on a 3 BHK it is
     * ₹4,40,000, and it looks exactly like a real line while it does it.
     */
    const { lines } = planQuotation(
      home(),
      [product({ name: 'Painting', unit: 'UNIT', code: 'ONSITE', rooms: ['Whole home'], defaultQty: 1 })],
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]!.room).toBe('Whole home');
  });

  it('one vanity per bathroom', () => {
    const { lines } = planQuotation(
      home({ bathrooms: 3 }),
      [product({ name: 'Vanity unit', rooms: ['Bathroom'], defaultWidthMm: 600, defaultHeightMm: 600 })],
    );
    expect(lines).toHaveLength(3);
    expect(lines.map((l) => l.room)).toEqual(['Bathroom 1', 'Bathroom 2', 'Bathroom 3']);
  });

  it('sizes base, wall and loft to the kitchen run', () => {
    const { lines } = planQuotation(home({ kitchenRunMm: 3960 }), [
      product({ name: 'Base cabinets', rooms: ['Kitchen'], defaultWidthMm: null, defaultHeightMm: 750 }),
      product({ name: 'Wall cabinets', rooms: ['Kitchen'], defaultWidthMm: null, defaultHeightMm: 600 }),
      product({ name: 'Loft', rooms: ['Kitchen'], defaultWidthMm: 1500, defaultHeightMm: 600 }),
    ]);

    expect(lines.map((l) => l.widthMm)).toEqual([3960, 3960, 3960]);
    /* Heights are the product's own. One measurement sets the width; it says
       nothing about how tall a base run is. */
    expect(lines.map((l) => l.heightMm)).toEqual([750, 600, 600]);
  });

  it('leaves a tall unit at its own width', () => {
    /* A tall unit is 600 wide whatever the run is. Sizing it to 3960 would
       quote a pantry the length of the kitchen. */
    const { lines } = planQuotation(home(), [
      product({ name: 'Tall unit', rooms: ['Kitchen'], defaultWidthMm: 600, defaultHeightMm: 2100 }),
    ]);
    expect(lines[0]!.widthMm).toBe(600);
  });

  it('falls back to the standard width when the run is unmeasured, and says so', () => {
    const { lines, notes } = planQuotation(home({ kitchenRunMm: null }), [
      product({ name: 'Base cabinets', rooms: ['Kitchen'], defaultWidthMm: 3000, defaultHeightMm: 750 }),
    ]);
    expect(lines[0]!.widthMm).toBe(3000);
    expect(notes.some((n) => n.includes('kitchen run'))).toBe(true);
  });

  it('ignores products that are not marked standard, and inactive ones', () => {
    const { lines } = planQuotation(home(), [
      product({ name: 'Wardrobe', inStandardBuild: true }),
      product({ name: 'Walk-in wardrobe', inStandardBuild: false }),
      product({ name: 'Bed', inStandardBuild: true, isActive: false }),
    ]);
    expect([...new Set(lines.map((l) => l.product))]).toEqual(['Wardrobe']);
  });

  it('keeps an unpriced product on the quotation, at zero, with a note', () => {
    /**
     * Dropping it would produce a quotation SHORTER than the studio's own
     * standard specification, with nothing on screen to say a line is
     * missing. Short is the direction that loses money, and a zero somebody
     * can see is better than an omission nobody can.
     */
    const { lines, notes } = planQuotation(home(), [product({ ratePaise: 0 })]);
    expect(lines).toHaveLength(3);
    expect(lines.every((l) => l.ratePaise === 0)).toBe(true);
    expect(notes.some((n) => n.includes('no rate'))).toBe(true);
  });

  it('says so plainly when the catalogue has nothing marked', () => {
    const { lines, notes } = planQuotation(home(), [product({ inStandardBuild: false })]);
    expect(lines).toEqual([]);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain('marked as standard');
  });

  it('converts a default quantity to thousandths', () => {
    const { lines } = planQuotation(home(), [
      product({ name: 'Bedside tables', unit: 'UNIT', defaultQty: 2 }),
    ]);
    expect(lines[0]!.qtyMilli).toBe(2000);
    expect(lines[0]!.widthMm).toBeNull();
  });

  it('carries the studio wording across untouched', () => {
    const { lines } = planQuotation(home(), [
      product({ name: 'Premium Shutter wardrobe', details: '18mm BWP ply, soft-close' }),
    ]);
    expect(lines[0]!.product).toBe('Premium Shutter wardrobe');
    expect(lines[0]!.details).toBe('18mm BWP ply, soft-close');
  });

  it('follows the studio catalogue order within a room', () => {
    const { lines } = planQuotation(home({ config: '1 BHK' }), [
      product({ name: 'Second', sortOrder: 20 }),
      product({ name: 'First', sortOrder: 10 }),
    ]);
    expect(lines.map((l) => l.product)).toEqual(['First', 'Second']);
  });
});
