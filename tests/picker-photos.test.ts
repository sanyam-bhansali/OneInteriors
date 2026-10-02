import { describe, it, expect } from 'vitest';
import { studioPickerPhotos } from '@/modules/brief/picker-photos';
import { PICKED_THEIR_PHOTO, styleFit } from '@/modules/matching/signals';
import { sanitiseBrief } from '@/modules/matching/sanitise';
import { EMPTY_BRIEF } from '@/modules/brief/types';
import { STUDIOS } from '@/data/studios';
import type { PortfolioProject } from '@/modules/studio/types';

const project = (over: Partial<PortfolioProject>): PortfolioProject => ({
  id: 'p1',
  title: 'A flat',
  locality: 'kharadi',
  propertyType: 'BHK_3',
  scope: 'FULL_HOME',
  styleTags: ['japandi'],
  valuePaise: null,
  durationDays: null,
  completedOn: '2026-06-01',
  images: ['https://example.com/kitchen.jpg', 'https://example.com/living.jpg'],
  imageRooms: ['KITCHEN', 'LIVING'],
  isRender: false,
  pickerConsent: true,
  ...over,
});

describe("studios' photos in the style picker", () => {
  it('uses a consented photo for its first style, living room first, and never names the studio', () => {
    const photos = studioPickerPhotos([{ id: 's1', portfolio: [project({})] }]);
    expect(photos.japandi).toEqual({
      src: 'https://example.com/living.jpg',
      alt: 'A finished living room in a Pune home',
      studioId: 's1',
    });
    expect(Object.keys(photos)).toEqual(['japandi']);
  });

  it('leaves out anything without consent, any render, and a style that is not the project’s first', () => {
    expect(studioPickerPhotos([{ id: 's1', portfolio: [project({ pickerConsent: false })] }])).toEqual({});
    expect(studioPickerPhotos([{ id: 's1', portfolio: [project({ isRender: true })] }])).toEqual({});
    expect(studioPickerPhotos([{ id: 's1', portfolio: [project({ styleTags: ['warm-modern', 'japandi'] })] }]).japandi).toBeUndefined();
  });
});

describe('picking their photo', () => {
  const studio = STUDIOS[0]!;
  const brief = { ...EMPTY_BRIEF, styleLikes: ['industrial' as const, 'luxe-glam' as const] };
  const ctx = { today: new Date('2026-09-20T00:00:00Z') };

  it('lifts the style score to at least 90, and says why', () => {
    const plain = styleFit(brief, studio, ctx);
    const picked = styleFit({ ...brief, styleStudioPicks: [studio.id] }, studio, ctx);
    expect(picked!.value).toBeGreaterThanOrEqual(PICKED_THEIR_PHOTO);
    expect(picked!.value).toBeGreaterThanOrEqual(plain!.value);
    expect(picked!.evidence).toBe('You picked a photograph of their work in the style picker');
  });

  it('survives the trip through the sanitiser, and nothing else does', () => {
    const clean = sanitiseBrief({ ...brief, styleStudioPicks: [studio.id, '<script>', 42] });
    expect(clean.styleStudioPicks).toEqual([studio.id]);
  });
});
