import { describe, it, expect } from 'vitest';
import { flatLayout, layoutArea } from '@/modules/brief/flat-layout';

describe('the flat layout', () => {
  it('has a bedroom per BHK, plus living, kitchen and bathrooms', () => {
    for (const bhk of [1, 2, 3, 4]) {
      const l = flatLayout(bhk, 1000);
      expect(l.rooms.filter((r) => r.kind === 'bedroom')).toHaveLength(bhk);
      expect(l.rooms.map((r) => r.kind)).toEqual(expect.arrayContaining(['living', 'kitchen', 'bath']));
    }
  });

  it('adds up to the carpet area, and stays inside the plan', () => {
    const l = flatLayout(3, 1250);
    expect(layoutArea(l)).toBeCloseTo(1250 * 0.092903, 1);
    for (const r of l.rooms) {
      expect(r.x + r.w).toBeLessThanOrEqual(l.width + 1e-9);
      expect(r.z + r.d).toBeLessThanOrEqual(l.depth + 1e-9);
    }
  });
});

describe('the rooms in the work', () => {
  it('follows the scope — kitchen and wardrobes lights the kitchen and bedrooms, not the living room', async () => {
    const { layoutRoomsInScope } = await import('@/modules/brief/flat-layout');
    const k = layoutRoomsInScope(3, { scope: 'KITCHEN_WARDROBE', scopeRooms: [], excludedItems: [] });
    expect(k).toContain('KITCHEN');
    expect(k).toContain('MASTER_BEDROOM');
    expect(k).not.toContain('LIVING_DINING');
    expect(layoutRoomsInScope(4, { scope: 'FULL_HOME', scopeRooms: [], excludedItems: [] })).toContain('FOURTH_BEDROOM');
  });
});
