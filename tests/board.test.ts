import { describe, it, expect } from 'vitest';
import {
  ELEMENTS,
  ELEMENT_CATEGORIES,
  CATEGORY_LABELS,
  elementBySlug,
  isAboveBand,
} from '@/modules/prepare/catalogue';
import { pickerFor, seedBoard, readBoard, elementsForRoom } from '@/modules/prepare/board';
import { ROOM_KEYS, type RoomKey } from '@/modules/prepare/rooms';
import { STYLE_TAGS, type StyleTag } from '@/modules/brief/types';

/**
 * The board builder.
 *
 * The load-bearing assertions are the two that make "create your own board"
 * safe rather than aspirational:
 *
 *  - a disliked style never reaches the picker, because Q5 is a hard filter
 *    everywhere else in this product; and
 *  - the SEED is always within band, because our suggestion has to be
 *    affordable even though their choices need not be.
 *
 * Everything else documents behaviour.
 */

const LIKES: StyleTag[] = ['japandi', 'scandinavian'];

describe('the catalogue', () => {
  it('has no duplicate slugs', () => {
    const slugs = ELEMENTS.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('gives every element a label, a note and three colours', () => {
    for (const element of ELEMENTS) {
      expect(element.label).toBeTruthy();
      expect(element.note).toBeTruthy();
      expect(element.colours).toHaveLength(3);
      for (const colour of element.colours) {
        expect(colour).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });

  it('only uses styles from the shared vocabulary', () => {
    for (const element of ELEMENTS) {
      for (const style of element.styles) {
        expect(STYLE_TAGS).toContain(style);
      }
    }
  });

  it('labels every category, and fills every one with something', () => {
    for (const category of ELEMENT_CATEGORIES) {
      expect(CATEGORY_LABELS[category]).toBeTruthy();
      expect(ELEMENTS.some((e) => e.category === category)).toBe(true);
    }
  });

  /**
   * A catalogue that is mostly LUXURY would quietly push every customer above
   * their band while looking neutral. The essential band must be the widest —
   * it is where most Pune projects actually sit.
   */
  it('is weighted towards what people can afford', () => {
    const essential = ELEMENTS.filter((e) => e.band === 'ESSENTIAL').length;
    const luxury = ELEMENTS.filter((e) => e.band === 'LUXURY').length;

    expect(essential).toBeGreaterThan(luxury);
  });

  it('resolves a known slug and refuses an unknown one', () => {
    expect(elementBySlug('laminate-shutter')?.label).toBe('Laminate shutter');
    expect(elementBySlug('nope')).toBeNull();
  });

  /**
   * Every element must be reachable from somewhere, or it is dead weight that
   * still costs a reviewer's attention. Catches a `ROOM_ONLY` entry naming a
   * room whose category list excludes that element's category — a
   * contradiction that would silently hide it everywhere.
   */
  it('can be reached in at least one room', () => {
    const reachable = new Set(ROOM_KEYS.flatMap((room) => elementsForRoom(room).map((e) => e.slug)));

    for (const element of ELEMENTS) {
      expect(reachable.has(element.slug)).toBe(true);
    }
  });
});

describe('isAboveBand', () => {
  it('is true only for elements dearer than the chosen tier', () => {
    const marble = elementBySlug('italian-marble');
    const laminate = elementBySlug('laminate-shutter');
    expect(marble && isAboveBand(marble, 'ESSENTIAL')).toBe(true);
    expect(marble && isAboveBand(marble, 'LUXURY')).toBe(false);
    expect(laminate && isAboveBand(laminate, 'ESSENTIAL')).toBe(false);
  });

  /**
   * Nothing is above band before they have told us what they are spending. We
   * do not get to mark somebody's taste as extravagant against a budget they
   * have not given us.
   */
  it('marks nothing when no tier has been chosen', () => {
    for (const element of ELEMENTS) {
      expect(isAboveBand(element, null)).toBe(false);
    }
  });
});

describe('elementsForRoom', () => {
  it('offers something in every room', () => {
    for (const room of ROOM_KEYS) {
      expect(elementsForRoom(room as RoomKey).length).toBeGreaterThan(3);
    }
  });

  /** Category alone is not enough — a counter and a floor are both surfaces. */
  it('does not offer a kitchen counter in a bedroom', () => {
    const slugs = elementsForRoom('BEDROOM_MAIN').map((e) => e.slug);
    expect(slugs).not.toContain('granite-counter');
    expect(slugs).not.toContain('quartz-counter');
  });

  it('does not offer a sofa in the kitchen or a bed in the living room', () => {
    expect(elementsForRoom('KITCHEN').map((e) => e.slug)).not.toContain('fabric-sofa-low');
    expect(elementsForRoom('LIVING').map((e) => e.slug)).not.toContain('hydraulic-storage-bed');
  });

  it('offers the counters where they belong', () => {
    expect(elementsForRoom('KITCHEN').map((e) => e.slug)).toContain('granite-counter');
  });
});

describe('pickerFor', () => {
  /** THE test. Q5 is a hard filter and this is a surface that could leak it. */
  it('never offers anything in a style the customer ruled out', () => {
    const dislikes: StyleTag[] = ['luxe-glam', 'art-deco'];

    for (const room of ROOM_KEYS) {
      for (const { element } of pickerFor(room as RoomKey, LIKES, dislikes, 'PREMIUM')) {
        for (const style of element.styles) {
          expect(dislikes).not.toContain(style);
        }
      }
    }
  });

  /**
   * Style-neutral staples — paint, granite, a storage bed — survive every
   * dislike, because they carry no style to object to. Losing them would empty
   * the picker for anyone with strong opinions.
   */
  it('keeps style-neutral staples however much the customer rules out', () => {
    const slugs = pickerFor('KITCHEN', [], [...STYLE_TAGS], 'ESSENTIAL').map((e) => e.element.slug);
    expect(slugs).toContain('granite-counter');
  });

  it('marks above-band items rather than removing them', () => {
    const entries = pickerFor('LIVING', LIKES, [], 'ESSENTIAL');
    const marble = entries.find((e) => e.element.slug === 'marble-coffee-table');

    expect(marble).toBeDefined();
    expect(marble?.aboveBand).toBe(true);
  });

  it('puts something matching their style first', () => {
    const entries = pickerFor('LIVING', ['japandi'], [], 'ESSENTIAL');
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]?.element.styles).toContain('japandi');
  });

  it('does not mark anything above band when no tier is set', () => {
    const entries = pickerFor('LIVING', LIKES, [], null);
    expect(entries.every((e) => !e.aboveBand)).toBe(true);
  });
});

describe('seedBoard', () => {
  /**
   * Our suggestion has to be affordable. They can reach for the marble
   * themselves — us placing it there and letting them find the cost later is
   * exactly the bait this product exists to avoid.
   */
  it('never seeds anything above the customer’s band', () => {
    for (const room of ROOM_KEYS) {
      for (const tier of ['ESSENTIAL', 'PREMIUM'] as const) {
        for (const slug of seedBoard(room as RoomKey, LIKES, [], tier)) {
          const element = elementBySlug(slug);
          if (element === null) throw new Error(`seeded an unknown slug: ${slug}`);
          expect(isAboveBand(element, tier)).toBe(false);
        }
      }
    }
  });

  /** A blank canvas is the highest drop-off surface in any tool like this. */
  it('is never empty for any room', () => {
    for (const room of ROOM_KEYS) {
      expect(seedBoard(room as RoomKey, LIKES, [], 'ESSENTIAL').length).toBeGreaterThan(0);
    }
  });

  it('spreads across categories rather than seeding four floor tiles', () => {
    const slugs = seedBoard('LIVING', LIKES, [], 'PREMIUM');
    const categories = slugs.map((slug) => elementBySlug(slug)?.category);

    expect(new Set(categories).size).toBe(slugs.length);
  });

  it('is deterministic', () => {
    expect(seedBoard('KITCHEN', LIKES, [], 'PREMIUM')).toEqual(
      seedBoard('KITCHEN', LIKES, [], 'PREMIUM'),
    );
  });

  it('never repeats an element', () => {
    const slugs = seedBoard('BEDROOM_MAIN', LIKES, [], 'LUXURY', 8);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('respects dislikes', () => {
    const slugs = seedBoard('LIVING', ['art-deco'], ['art-deco', 'luxe-glam'], 'LUXURY');
    for (const slug of slugs) {
      const element = elementBySlug(slug);
      expect(element?.styles).not.toContain('art-deco');
      expect(element?.styles).not.toContain('luxe-glam');
    }
  });
});

/**
 * The budget reading — the one thing Pinterest structurally cannot do.
 *
 * It has to be quiet. A running commentary on every board becomes noise, then
 * nagging, and this page must never feel like it is marking somebody's work.
 * So `message` is null in the ordinary case and that is the assertion that
 * matters most here.
 */
describe('readBoard', () => {
  const BUDGET_BOARD = ['laminate-shutter', 'granite-counter', 'cotton-dhurrie', 'plain-paint'];
  const LAVISH_BOARD = ['italian-marble', 'lacquered-glass-shutter', 'chandelier', 'mirror-wall'];

  it('says nothing when the board sits inside the band', () => {
    const reading = readBoard(BUDGET_BOARD, 'ESSENTIAL');
    expect(reading.message).toBeNull();
    expect(reading.stretching).toBe(false);
    expect(reading.aboveBand).toBe(0);
  });

  it('says nothing about a single indulgence', () => {
    const reading = readBoard([...BUDGET_BOARD, ...BUDGET_BOARD, 'italian-marble'], 'ESSENTIAL');
    expect(reading.aboveBand).toBe(1);
    expect(reading.message).toBeNull();
  });

  it('speaks up when the board leans above the band', () => {
    const reading = readBoard(LAVISH_BOARD, 'ESSENTIAL');
    expect(reading.stretching).toBe(true);
    expect(reading.aboveBand).toBe(4);
    expect(reading.message).toBeTruthy();
  });

  it('has a distinct sentence for a board that is entirely above band', () => {
    const all = readBoard(LAVISH_BOARD, 'ESSENTIAL').message;
    const some = readBoard([...LAVISH_BOARD, ...BUDGET_BOARD], 'ESSENTIAL').message;

    expect(all).not.toBe(some);
    expect(some).toBeTruthy();
  });

  /** Never scolds. The customer is allowed to want things. */
  it('does not tell anyone off', () => {
    const message = readBoard(LAVISH_BOARD, 'ESSENTIAL').message ?? '';
    for (const word of ['afford', 'too expensive', 'cannot', 'unrealistic', 'reduce']) {
      expect(message.toLowerCase()).not.toContain(word);
    }
  });

  it('says nothing at all before a tier is chosen', () => {
    const reading = readBoard(LAVISH_BOARD, null);
    expect(reading.message).toBeNull();
    expect(reading.aboveBand).toBe(0);
  });

  it('is silent on an empty board', () => {
    expect(readBoard([], 'ESSENTIAL').message).toBeNull();
    expect(readBoard([], 'ESSENTIAL').total).toBe(0);
  });

  /**
   * A slug we retired must not be counted, and must not throw. Someone can have
   * this page open from last week.
   */
  it('skips slugs that are no longer in the catalogue', () => {
    const reading = readBoard(['plain-paint', 'element-we-deleted'], 'ESSENTIAL');
    expect(reading.total).toBe(1);
  });
});
