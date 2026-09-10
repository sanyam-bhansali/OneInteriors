import { describe, it, expect } from 'vitest';
import { narrowing, type NarrowingInput } from '@/modules/quotation/narrowing';

const COMPLETE: NarrowingInput = {
  variancePct: 0.15,
  propertyTypeKnown: true,
  areaKnown: true,
  scopeKnown: true,
  floorPlanUploaded: true,
};

describe('narrowing', () => {
  it('formats the spread the way it is shown', () => {
    expect(narrowing({ ...COMPLETE, variancePct: 0.15 }).spread).toBe('±15%');
    expect(narrowing({ ...COMPLETE, variancePct: 0.225 }).spread).toBe('±23%');
  });

  /**
   * The order is not cosmetic: it mirrors what `estimate.ts` actually penalises
   * (property type +15 points, area +10, scope +5). Naming a smaller lever
   * first would send the customer to do the less useful thing.
   */
  it('names the biggest guess first, in the estimator\'s own order', () => {
    const nothingKnown = narrowing({
      ...COMPLETE,
      propertyTypeKnown: false,
      areaKnown: false,
      scopeKnown: false,
      floorPlanUploaded: false,
    });
    expect(nothingKnown.action).toContain('property type');

    const areaMissing = narrowing({ ...COMPLETE, areaKnown: false, scopeKnown: false });
    expect(areaMissing.action).toContain('carpet area');

    const scopeMissing = narrowing({ ...COMPLETE, scopeKnown: false });
    expect(scopeMissing.action).toContain('scope');
  });

  it('falls back to the floor plan once the brief itself is complete', () => {
    expect(narrowing({ ...COMPLETE, floorPlanUploaded: false }).action).toContain('floor plan');
  });

  /**
   * Nothing left for them to do. The caller must not print an empty
   * instruction, and must not invent one — the only remaining step is a site
   * visit, which is not something they can do from this page.
   */
  it('offers no action when everything we can use has been given', () => {
    expect(narrowing(COMPLETE).action).toBeNull();
  });

  it('flags a band too wide to plan against', () => {
    expect(narrowing({ ...COMPLETE, variancePct: 0.15 }).tooWide).toBe(false);
    expect(narrowing({ ...COMPLETE, variancePct: 0.25 }).tooWide).toBe(false);
    expect(narrowing({ ...COMPLETE, variancePct: 0.26 }).tooWide).toBe(true);
    expect(narrowing({ ...COMPLETE, variancePct: 0.45 }).tooWide).toBe(true);
  });
});
