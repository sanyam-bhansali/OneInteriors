import { describe, it, expect } from 'vitest';
import { STYLE_PHOTOS, stylePhotoUrl } from '@/data/style-photos';
import { STYLE_TAGS } from '@/modules/brief/types';

describe('style picker photos', () => {
  it('cover every style, from Unsplash, each credited and described', () => {
    for (const tag of STYLE_TAGS) {
      const p = STYLE_PHOTOS[tag];
      expect(p.src, tag).toMatch(/^https:\/\/images\.unsplash\.com\/photo-[\w-]+$/);
      expect(p.page, tag).toMatch(/^https:\/\/unsplash\.com\/photos\//);
      expect(p.photographer.length, tag).toBeGreaterThan(1);
      // The alt describes the room and never names the style — the picker hides the name until chosen.
      expect(p.alt.toLowerCase(), tag).not.toContain(tag.replace('-', ' '));
    }
    expect(new Set(STYLE_TAGS.map((t) => STYLE_PHOTOS[t].src)).size).toBe(STYLE_TAGS.length);
  });

  it('crop to the tile', () => {
    expect(stylePhotoUrl(STYLE_PHOTOS.japandi, 400)).toMatch(/fit=crop&w=400&h=300/);
  });
});

describe('the picker shows the room they are doing', () => {
  it('kitchens for a kitchen job, bedrooms for bedrooms only, living rooms otherwise', async () => {
    const { pickerRoomFor } = await import('@/data/style-photos');
    expect(pickerRoomFor('KITCHEN_WARDROBE')).toBe('KITCHEN');
    expect(pickerRoomFor('SINGLE_ROOM', ['KITCHEN'])).toBe('KITCHEN');
    expect(pickerRoomFor('SINGLE_ROOM', ['MASTER_BEDROOM', 'SECOND_BEDROOM'])).toBe('BEDROOM');
    expect(pickerRoomFor('SINGLE_ROOM', ['KITCHEN', 'LIVING_DINING'])).toBe('LIVING');
    expect(pickerRoomFor('FULL_HOME')).toBe('LIVING');
  });

  it('every room photo is a free Unsplash photo, and a missing room falls back to the living room', async () => {
    const { ROOM_STYLE_PHOTOS, stylePhotoFor } = await import('@/data/style-photos');
    for (const rooms of Object.values(ROOM_STYLE_PHOTOS)) {
      for (const p of Object.values(rooms ?? {})) {
        expect(p!.src).toMatch(/^https:\/\/images\.unsplash\.com\/photo-[\w-]+$/);
        expect(p!.photographer.length).toBeGreaterThan(1);
      }
    }
    expect(stylePhotoFor('indian-contemporary', 'KITCHEN')).toBe(STYLE_PHOTOS['indian-contemporary']);
    expect(stylePhotoFor('warm-modern', 'KITCHEN')).not.toBe(STYLE_PHOTOS['warm-modern']);
  });
});
