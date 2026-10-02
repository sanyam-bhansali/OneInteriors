import { describe, it, expect } from 'vitest';
import {
  carpetAreaFrom,
  cleanImageRooms,
  cleanSocietyName,
  cleanTags,
  evidencedSpecialisms,
  perSqftOf,
  portfolioSocieties,
} from '@/modules/studio/portfolio-fields';

describe('portfolio fields', () => {
  it('aligns a room to every photograph, unknown as not said', () => {
    expect(cleanImageRooms(['a', 'b', 'c'], ['KITCHEN', 'SPACESHIP'])).toEqual(['KITCHEN', '', '']);
  });

  it('reads carpet area: blank is null, out of range is refused', () => {
    expect(carpetAreaFrom('')).toBeNull();
    expect(carpetAreaFrom('1150')).toBe(1150);
    expect(carpetAreaFrom('40')).toBeUndefined();
    expect(carpetAreaFrom('1150.5')).toBeUndefined();
  });

  it('prices a project per square foot only when both halves are known', () => {
    expect(perSqftOf({ valuePaise: 18_50_000_00, carpetAreaSqft: 1250 })).toBe(1480);
    expect(perSqftOf({ valuePaise: 18_50_000_00, carpetAreaSqft: null })).toBeNull();
  });

  it('counts a specialism only when two projects show it', () => {
    const projects = [{ tags: ['CHILDREN', 'PETS'] }, { tags: ['CHILDREN', 'NONSENSE'] }, { tags: ['VASTU'] }];
    expect(evidencedSpecialisms(projects)).toEqual(['CHILDREN']);
    expect(cleanTags(['PETS', 'PETS', 'X'])).toEqual(['PETS']);
  });

  it('lists societies once, whatever the case', () => {
    expect(portfolioSocieties([{ society: 'Gera World of Joy' }, { society: 'gera world of joy ' }, { society: null }])).toEqual([
      'Gera World of Joy',
    ]);
    expect(cleanSocietyName(' x ')).toBeNull();
  });
});
