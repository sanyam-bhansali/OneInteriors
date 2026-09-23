import { describe, it, expect } from 'vitest';
import {
  productsFromArchive,
  bridgeSummary,
  type DerivedRate,
  type ExistingProduct,
} from '@/modules/studio-quote/from-archive';
import { CATALOGUE } from '@/modules/quotation/catalogue';

/**
 * The bridge between the archive we read and the product master they use.
 *
 * The failure that matters here is not a crash. It is a studio opening their
 * product master and finding a rate they never typed sitting on a product
 * they price differently — which is a number that goes onto a document with
 * their name at the bottom.
 */

const rate = (code: string, rupees: number, from = 8): DerivedRate => ({
  code,
  ratePaise: rupees * 100,
  fromQuotations: from,
});

const existing = (name: string, rupees: number, id = name): ExistingProduct => ({
  id,
  name,
  ratePaise: rupees * 100,
});

describe('productsFromArchive — what it creates', () => {
  it('creates a product for a rate the studio has nothing for', () => {
    const { create } = productsFromArchive([rate('kitchen_base', 2580)], []);
    expect(create).toHaveLength(1);
    expect(create[0]!.name).toBe('Base cabinets');
    expect(create[0]!.ratePaise).toBe(258_000);
    expect(create[0]!.rooms).toEqual(['Kitchen']);
  });

  it('collapses the three wardrobe codes into one product', () => {
    /**
     * `master_wardrobe`, `second_wardrobe` and `third_wardrobe` are three
     * codes for one thing a studio sells. The canonical catalogue is room-
     * instanced because a customer's quote shows each bedroom separately; the
     * studio's product master is room-tagged. Three "Wardrobe" rows in their
     * catalogue would be three identical entries in the builder's picker.
     */
    const { create } = productsFromArchive(
      [rate('master_wardrobe', 2580), rate('second_wardrobe', 2400), rate('third_wardrobe', 2400)],
      [],
    );
    const wardrobes = create.filter((p) => p.name === 'Wardrobe');
    expect(wardrobes).toHaveLength(1);
    expect(wardrobes[0]!.rooms).toEqual(['Bedroom']);
  });

  it('takes the rate read from the most documents when codes disagree', () => {
    /* Not an average. A figure that appears in none of their quotations is
       one nobody could explain back to them. */
    const { create } = productsFromArchive(
      [
        rate('master_wardrobe', 2580, 3),
        rate('second_wardrobe', 2400, 14),
        rate('third_wardrobe', 2200, 2),
      ],
      [],
    );
    expect(create.find((p) => p.name === 'Wardrobe')!.ratePaise).toBe(240_000);
  });

  it('carries the sizing across in the studio catalogue vocabulary', () => {
    const { create } = productsFromArchive(
      [rate('painting', 32), rate('vanity', 2580), rate('safety_door', 42_000)],
      [],
    );

    const by = (name: string) => create.find((p) => p.name === name)!;
    /* Per carpet sqft becomes a SQFT line. */
    expect(by('Painting').unit).toBe('SQFT');
    /* Per bathroom becomes UNIT: the planner already puts one in each
       bathroom, so a per-bathroom unit here would multiply twice. */
    expect(by('Vanity').unit).toBe('UNIT');
    expect(by('Vanity').defaultQty).toBe(1);
    expect(by('Safety door').unit).toBe('UNIT');
  });

  it('keeps the work code, so the discount lands on the right half', () => {
    /* Modular carries the discount; on-site does not. Getting this wrong
       discounts site labour, which is how a studio wins a job and loses
       money on it. */
    const { create } = productsFromArchive([rate('kitchen_base', 2580), rate('painting', 32)], []);
    expect(create.find((p) => p.name === 'Base cabinets')!.code).toBe('MODULAR');
    expect(create.find((p) => p.name === 'Painting')!.code).toBe('ONSITE');
  });

  it('gives a kitchen item no default width', () => {
    /* Its width is the platform run — a fact about a flat, not about the
       product. A stored 4400 would look measured. */
    const { create } = productsFromArchive([rate('kitchen_base', 2580)], []);
    expect(create[0]!.defaultWidthMm).toBeNull();
    expect(create[0]!.defaultHeightMm).toBe(750);
  });

  it('keeps the standard size of everything else', () => {
    const { create } = productsFromArchive([rate('master_wardrobe', 2580)], []);
    expect(create[0]!.defaultWidthMm).toBe(1800);
    expect(create[0]!.defaultHeightMm).toBe(2100);
  });

  it('ignores a code with no rate', () => {
    const { create } = productsFromArchive([rate('kitchen_base', 0)], []);
    expect(create).toEqual([]);
  });

  it('reports a code no catalogue item claims rather than swallowing it', () => {
    const { unknownCodes, create } = productsFromArchive([rate('kitchen_island', 3000)], []);
    expect(unknownCodes).toEqual(['kitchen_island']);
    expect(create).toEqual([]);
  });
});

describe('productsFromArchive — what it refuses to touch', () => {
  it('never overwrites a rate the studio typed', () => {
    /**
     * The rule this whole file turns on. Their figure is the one their client
     * holds them to; ours came off documents that may be eighteen months old.
     * A silent overwrite puts a number we invented on a document with their
     * name at the bottom.
     */
    const result = productsFromArchive(
      [rate('kitchen_base', 2580)],
      [existing('Base cabinets', 2900)],
    );
    expect(result.priceExisting).toEqual([]);
    expect(result.create).toEqual([]);
    expect(result.keptTheirs).toEqual(['Base cabinets']);
  });

  it('fills a product sitting at zero', () => {
    const result = productsFromArchive(
      [rate('kitchen_base', 2580)],
      [existing('Base cabinets', 0)],
    );
    expect(result.priceExisting).toEqual([
      { id: 'Base cabinets', name: 'Base cabinets', ratePaise: 258_000 },
    ]);
    expect(result.create).toEqual([]);
  });

  it('matches an existing product regardless of case or stray spacing', () => {
    /* The unique index is on the exact name, so a near-miss creates a second
       row and the builder's picker shows the product twice. */
    const result = productsFromArchive(
      [rate('kitchen_base', 2580)],
      [existing('  base cabinets ', 0, 'p1')],
    );
    expect(result.create).toEqual([]);
    expect(result.priceExisting[0]!.id).toBe('p1');
  });

  it('is safe to run twice', () => {
    /* A re-analysis must not double the catalogue. The second pass sees the
       products the first created and leaves the priced ones alone. */
    const first = productsFromArchive([rate('kitchen_base', 2580)], []);
    const afterwards = first.create.map((p, i) => existing(p.name, p.ratePaise / 100, `new-${i}`));
    const second = productsFromArchive([rate('kitchen_base', 2900)], afterwards);

    expect(second.create).toEqual([]);
    expect(second.priceExisting).toEqual([]);
    expect(second.keptTheirs).toEqual(['Base cabinets']);
  });
});

describe('the whole catalogue', () => {
  it('maps every catalogue code to a product', () => {
    /* A code we can price for a customer but cannot put in the studio's own
       catalogue is a gap that would show up as a quotation the studio cannot
       reproduce in their own builder. */
    const all = CATALOGUE.map((i) => rate(i.code, 1000));
    const { create, unknownCodes } = productsFromArchive(all, []);

    expect(unknownCodes).toEqual([]);
    expect(create.length).toBeGreaterThan(0);
    for (const product of create) {
      expect(product.name.length).toBeGreaterThan(0);
      expect(product.rooms.length).toBeGreaterThan(0);
      expect(product.ratePaise).toBeGreaterThan(0);
    }
  });

  it('produces fewer products than codes, and no duplicate names', () => {
    const all = CATALOGUE.map((i) => rate(i.code, 1000));
    const { create } = productsFromArchive(all, []);

    expect(create.length).toBeLessThan(CATALOGUE.length);
    expect(new Set(create.map((p) => p.name)).size).toBe(create.length);
  });
});

describe('bridgeSummary', () => {
  it('counts what was written, not what was considered', () => {
    const result = productsFromArchive(
      [rate('kitchen_base', 2580), rate('master_wardrobe', 2400)],
      [existing('Base cabinets', 2900)],
    );
    expect(bridgeSummary(result)).toContain('1 product is');
    expect(bridgeSummary(result)).toContain('1 you had already priced');
  });

  it('says so plainly when there was nothing to do', () => {
    expect(bridgeSummary(productsFromArchive([], []))).toContain('Nothing new');
  });
});
