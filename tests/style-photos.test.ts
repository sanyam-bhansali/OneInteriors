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
