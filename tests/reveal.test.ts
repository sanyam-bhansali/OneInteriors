import { describe, it, expect } from 'vitest';
import { revealSteps } from '@/modules/matching/reveal';
import { shownStudioCount, VERIFIED_STUDIOS } from '@/lib/claims';
import { EMPTY_BRIEF, type Brief } from '@/modules/brief/types';
import { STUDIOS } from '@/data/studios';

const brief: Brief = { ...EMPTY_BRIEF, propertyType: 'BHK_3', locality: 'kharadi', scope: 'FULL_HOME', tier: 'PREMIUM', styleLikes: ['warm-modern'] };

describe('the reveal, counted down', () => {
  it('starts at the stated number and never climbs', () => {
    const steps = revealSteps(brief, STUDIOS, 3);
    expect(steps[0]).toEqual({ count: VERIFIED_STUDIOS, label: 'verified studios' });
    for (let i = 1; i < steps.length; i++) expect(steps[i]!.count).toBeLessThanOrEqual(steps[i - 1]!.count);
    expect(steps.at(-1)!.label).toBe('for you');
  });

  it('caps a live count at the stated number', () => {
    expect(shownStudioCount(15)).toBe(VERIFIED_STUDIOS);
    expect(shownStudioCount(4)).toBe(4);
  });
});
