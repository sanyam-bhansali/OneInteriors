import { describe, expect, it } from 'vitest';
import { canon, routeProduct, stripSuffix, tradeKeyFor, type RouteTable } from '@/modules/studio-crews/trades';
import { planFromFinal, type SourceLine } from '@/modules/studio-crews/rules';

const H: RouteTable = { studio: [], useHauspire: true };

describe('routing a quotation line to a trade (Hauspire’s order)', () => {
  it('exact name', () => {
    expect(routeProduct('Safety Door', H)).toEqual({ trade: 'fabrication', via: 'exact', guessed: false });
    expect(routeProduct('Electricals', H).trade).toBe('electrical');
  });
  it('canonical name: spacing and punctuation do not matter', () => {
    expect(routeProduct('Queen Size Bed Hydraulic Storage', H)).toMatchObject({ trade: 'carpentry', via: 'canon' });
  });
  it('a context suffix is stripped, a real bracket is not', () => {
    expect(stripSuffix('Minimal False Ceiling (per room) -(Kids Bedroom)')).toBe('Minimal False Ceiling (per room)');
    expect(stripSuffix('Loft (Frame with Shutter)')).toBe('Loft (Frame with Shutter)');
    expect(routeProduct('Minimal False Ceiling (per room) -(Kids Bedroom)', H)).toMatchObject({ trade: 'false_ceiling', via: 'suffix' });
  });
  it('the longest Hauspire name it contains', () => {
    expect(routeProduct('Premium Shutter Wardrobe - Master', H)).toMatchObject({ trade: 'carpentry', via: 'partial' });
  });
  it('keyword rules, specialist trades before factory-unit words, typos caught', () => {
    expect(routeProduct('Electrcials 3BHK', H)).toMatchObject({ trade: 'electrical', via: 'rule' });
    expect(routeProduct('Slding Mechanism set', H).trade).toBe('hardware');
    expect(routeProduct('Bathroom Mirror large', H).trade).toBe('glass');
    expect(routeProduct('Texture paint wall', H).trade).toBe('painting');
    expect(routeProduct('Kitchen platform granite', H).trade).toBe('civil');
    expect(routeProduct('Guest wardrobe', H).trade).toBe('carpentry');
  });
  it('nothing matched: carpentry, marked as a guess', () => {
    expect(routeProduct('Aquariam Setup', H)).toEqual({ trade: 'carpentry', via: 'workcode', guessed: true });
  });
  it('the studio’s own rows win, exact before keyword', () => {
    const t: RouteTable = {
      useHauspire: true,
      studio: [
        { match: 'keyword', text: 'door', trade: 'glass' },
        { match: 'exact', text: 'Safety Door', trade: 'civil' },
      ],
    };
    expect(routeProduct('Safety Door', t)).toEqual({ trade: 'civil', via: 'studio', guessed: false });
    expect(routeProduct('Sliding Door', t)).toEqual({ trade: 'glass', via: 'studio', guessed: false });
  });
  it('without Hauspire’s table, only the studio’s rows route', () => {
    expect(routeProduct('Safety Door', { studio: [], useHauspire: false }).guessed).toBe(true);
  });
});

describe('trade keys', () => {
  it('are made from labels and never clash', () => {
    expect(tradeKeyFor('Tiles & Stone', [])).toBe('tiles_and_stone');
    expect(tradeKeyFor('Painting', ['painting'])).toBe('painting_2');
    expect(canon('Base Cabinets- Tandems')).toBe('basecabinetstandems');
  });
});

describe('building from the final', () => {
  const line = (id: string, product: string): SourceLine => ({ id, room: 'Kitchen', product, code: 'MODULAR', unit: 'AREA', details: null, widthMm: 1000, heightMm: 900, qtyMilli: null, amountPaise: 100_000 });
  it('groups by trade and leaves out lines already on a live work order', () => {
    const plan = planFromFinal([line('a', 'Base Cabinets'), line('b', 'Electricals'), line('c', 'Wall Cabinets')], H, new Set(['c']));
    expect([...plan.keys()].sort()).toEqual(['carpentry', 'electrical']);
    expect(plan.get('carpentry')!.map((l) => l.id)).toEqual(['a']);
  });
});
