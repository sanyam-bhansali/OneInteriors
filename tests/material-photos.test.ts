import { describe, it, expect } from 'vitest';
import { MATERIAL_PHOTOS } from '@/data/material-photos';
import { MATERIALS } from '@/modules/materials/glossary';

describe('material close-ups', () => {
  it('belong to real glossary materials and are credited free Unsplash photos', () => {
    const ids = new Set(MATERIALS.map((m) => m.id));
    for (const [id, p] of Object.entries(MATERIAL_PHOTOS)) {
      expect(ids.has(id), id).toBe(true);
      expect(p!.src).toMatch(/^https:\/\/images\.unsplash\.com\/photo-[\w-]+$/);
      expect(p!.photographer.length).toBeGreaterThan(1);
    }
  });
});
