import { describe, it, expect } from 'vitest';
import { libraryReading, shareable, societyKey } from '@/modules/floorplan/society-library';
import { buildFirstQuote, homeShapeFor } from '@/modules/quotation/first-quote';
import { filedRatesFor } from '@/data/filed-rates';
import { EMPTY_BRIEF } from '@/modules/brief/types';

describe('the society floor-plan library', () => {
  it('treats spelling variants as one building', () => {
    expect(societyKey('Sapphire Heights')).toBe(societyKey(' sapphire-heights '));
    expect(societyKey('A1')).toBeNull();
  });

  it('offers nothing until two homes have shared, then the median', () => {
    const one = [{ carpetAreaSqft: 1250, bathrooms: 3, kitchenRunMm: 4200 }];
    expect(libraryReading(one)).toBeNull();
    const three = [...one, { carpetAreaSqft: 1240, bathrooms: 3, kitchenRunMm: 4100 }, { carpetAreaSqft: 1600, bathrooms: 3, kitchenRunMm: null }];
    expect(libraryReading(three)).toEqual({ carpetAreaSqft: 1250, bathrooms: 3, kitchenRunMm: 4150, homes: 3 });
  });

  it('never records sizes that came from the library itself', () => {
    expect(shareable({ areaSource: 'printed' }, 'Sapphire Heights')).toBe(true);
    expect(shareable({ areaSource: 'society' }, 'Sapphire Heights')).toBe(false);
    expect(shareable({ areaSource: 'printed' }, null)).toBe(false);
  });
});


describe('a quote on sizes the building shared', () => {
  it('says the kitchen came from other homes’ plans, not theirs', () => {
    const shape = homeShapeFor({
      ...EMPTY_BRIEF,
      propertyType: 'BHK_3',
      carpetAreaSqft: 1250,
      society: 'Sapphire Heights',
      floorPlanName: 'mine.pdf',
      planReading: { kitchenRunMm: 4150, bathrooms: 3, hasStudy: false, areaSource: 'society' },
    });
    expect(shape.plan).toMatchObject({ fileName: null, kitchenRunMm: 4150, shared: true });
    const q = buildFirstQuote(
      { ...shape, kitchenRunMm: 4150, runSource: 'floor_plan', runShared: true },
      filedRatesFor('akara-design-studio'),
    );
    expect(q.assumptions.join(' ')).toMatch(/floor plans other homes in your building shared/);
  });
});
