import { describe, it, expect } from 'vitest';
import {
  configRooms,
  discountedPaise,
  moveInList,
  newRoomName,
  orderedRooms,
  renameInList,
  roomsOfLines,
  sortByRooms,
} from '@/modules/studio-quote/rooms';
import { bhkNumber, CONFIGS, isConfigName, planQuotation, roomsFor, standardRunFor, type CatalogueProduct } from '@/modules/studio-quote/configure';
import { categoryOfRoom, cleanProposal, mayReview, sameProductName } from '@/modules/studio-quote/proposal-rules';

/* The builder's room list, rebuilt in Hauspire's layout (13 Oct 2026). */

const L = (room: string, product = 'x') => ({ room, product });

describe('room list', () => {
  it('lists rooms in the order lines first use them', () => {
    expect(roomsOfLines([L('Kitchen'), L('Master bedroom'), L('Kitchen')])).toEqual(['Kitchen', 'Master bedroom']);
  });

  it('keeps the list order, then rooms only on a line', () => {
    expect(orderedRooms(['Kitchen', 'Study', 'Kitchen'], [L('Pooja'), L('Kitchen')])).toEqual(['Kitchen', 'Study', 'Pooja']);
  });

  it('sorts lines by room order, stable inside a room, unknown rooms last', () => {
    const lines = [L('Living', 'a'), L('Kitchen', 'b'), L('Pooja', 'c'), L('Kitchen', 'd')];
    expect(sortByRooms(lines, ['Kitchen', 'Living']).map((l) => l.product)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('applies a configuration without dropping a room already on the quotation', () => {
    /* Hauspire's applyConfig is non-destructive: no line is removed. */
    const list = configRooms('2 BHK', { study: false, bathrooms: 1 }, [L('Pooja room'), L('Kitchen')]);
    expect(list.slice(0, 2)).toEqual(['Kitchen', 'Master bedroom']);
    expect(list).toContain('Pooja room');
    expect(list.filter((r) => r === 'Kitchen')).toHaveLength(1);
    expect(list).toContain('Bathroom');
  });

  it('adds the study when ticked, and always for a villa', () => {
    expect(configRooms('3 BHK', { study: true, bathrooms: 2 }, [])).toContain('Study');
    expect(configRooms('3 BHK', { study: false, bathrooms: 2 }, [])).not.toContain('Study');
    expect(configRooms('Villa', { study: false, bathrooms: 4 }, [])).toContain('Study');
  });

  it('renames a room, merging onto one that exists', () => {
    expect(renameInList(['Kitchen', 'Kids bedroom', 'Guest bedroom'], 'Kids bedroom', 'Ayaan bedroom')).toEqual(['Kitchen', 'Ayaan bedroom', 'Guest bedroom']);
    expect(renameInList(['Kitchen', 'Kids bedroom', 'Guest bedroom'], 'Guest bedroom', 'Kids bedroom')).toEqual(['Kitchen', 'Kids bedroom']);
  });

  it('moves a room up and down, and not past either end', () => {
    expect(moveInList(['A', 'B', 'C'], 'B', -1)).toEqual(['B', 'A', 'C']);
    expect(moveInList(['A', 'B', 'C'], 'B', 1)).toEqual(['A', 'C', 'B']);
    expect(moveInList(['A', 'B', 'C'], 'A', -1)).toEqual(['A', 'B', 'C']);
    expect(moveInList(['A', 'B', 'C'], 'C', 1)).toEqual(['A', 'B', 'C']);
  });

  it('takes a new room name once', () => {
    expect(newRoomName('  Pooja   room ', ['Kitchen'])).toBe('Pooja room');
    expect(newRoomName('kitchen', ['Kitchen'])).toBeNull();
    expect(newRoomName('   ', [])).toBeNull();
  });
});

describe('Discounted column', () => {
  it('takes the modular discount off a modular line only', () => {
    expect(discountedPaise(3_749_100, 'MODULAR', 1500)).toBe(3_186_700); // Math.round(37,491 × 0.85), to the rupee as the old app
    expect(discountedPaise(3_749_100, 'ONSITE', 1500)).toBe(3_749_100);
    expect(discountedPaise(1000, 'MODULAR', 0)).toBe(1000);
  });
});

describe('Villa', () => {
  it('is a configuration, built like a 4 BHK with a study', () => {
    expect(CONFIGS).toContain('Villa');
    expect(isConfigName('Villa')).toBe(true);
    expect(bhkNumber('Villa')).toBe(4);
    expect(standardRunFor('Villa')).toBe(standardRunFor('4 BHK'));
    const rooms = roomsFor({ config: 'Villa', kitchenRunMm: null, bathrooms: 3, study: false });
    expect(rooms.filter((r) => r.category === 'Bedroom')).toHaveLength(4);
    expect(rooms.some((r) => r.name === 'Study')).toBe(true);
  });

  it('takes the 4 BHK painting, not the 3 BHK one', () => {
    const p = (id: string, name: string): CatalogueProduct => ({
      id, name, code: 'ONSITE', unit: 'UNIT', details: null, ratePaise: 100, rooms: ['Whole home'],
      defaultWidthMm: null, defaultHeightMm: null, defaultQty: 1, inStandardBuild: true, isActive: true, sortOrder: 1,
    });
    const { lines } = planQuotation({ config: 'Villa', kitchenRunMm: null, bathrooms: 2, study: false }, [p('a', 'Painting - 3BHK'), p('b', 'Painting - 4BHK')]);
    expect(lines.map((l) => l.product)).toEqual(['Painting - 4BHK']);
  });
});

describe('proposed products', () => {
  it('cleans a proposal from a browser', () => {
    const r = cleanProposal({ name: '  Pooja  unit ', code: 'MODULAR', unit: 'AREA', ratePaise: 250000, details: ' Teak ', room: 'Living and dining' });
    expect(r).toEqual({ ok: true, value: { name: 'Pooja unit', code: 'MODULAR', unit: 'AREA', ratePaise: 250000, details: 'Teak', room: 'Living and dining' } });
  });

  it('refuses a nameless or unpriced-nonsense proposal', () => {
    expect(cleanProposal({ name: 'x', ratePaise: 1 }).ok).toBe(false);
    expect(cleanProposal({ name: 'Shelf', ratePaise: -5 }).ok).toBe(false);
    expect(cleanProposal({ name: 'Shelf', ratePaise: 1.5 }).ok).toBe(false);
    expect(cleanProposal(null).ok).toBe(false);
  });

  it('defaults an unknown code and unit to on-site, each', () => {
    const r = cleanProposal({ name: 'Shelf', code: 'X', unit: 'Y', ratePaise: 0 });
    expect(r.ok && r.value.code).toBe('ONSITE');
    expect(r.ok && r.value.unit).toBe('UNIT');
  });

  it('files a room under a product category', () => {
    expect(categoryOfRoom('Master bedroom')).toBe('Bedroom');
    expect(categoryOfRoom('Kitchen')).toBe('Kitchen');
    expect(categoryOfRoom('Living and dining')).toBe('Living');
    expect(categoryOfRoom('Bathroom 2')).toBe('Bathroom');
    expect(categoryOfRoom(null)).toBe('Whole home');
  });

  it('decides a proposal once', () => {
    expect(mayReview('PENDING')).toBe(true);
    expect(mayReview('APPROVED')).toBe(false);
    expect(mayReview('REJECTED')).toBe(false);
  });

  it('matches names loosely', () => {
    expect(sameProductName('Base Cabinets', 'base-cabinets')).toBe(true);
    expect(sameProductName('Base', 'Wall')).toBe(false);
    expect(sameProductName('', '')).toBe(false);
  });
});
