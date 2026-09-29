import { describe, it, expect } from 'vitest';
import {
  CHAPTER,
  STEP_IDS,
  TOTAL_STEPS,
  carpetAreaFor,
  cleanName,
  isStepAnswered,
  stepAt,
  typicalCarpetSqft,
} from '@/modules/brief/steps';
import { EMPTY_BRIEF, type Brief } from '@/modules/brief/types';
import { matchingLocalities } from '@/app/quiz/LocalityPicker';

/**
 * The brief's screens since 29 Sep 2026: named, ordered by one list, and
 * grouped into chapters. docs/CUSTOMER-JOURNEY-PLAN.md §2.
 */

describe('the order', () => {
  it('opens with their name, then their home', () => {
    expect(STEP_IDS[0]).toBe('name');
    expect(STEP_IDS[1]).toBe('home');
    expect(STEP_IDS[2]).toBe('possession');
  });

  it('puts every screen in a chapter', () => {
    for (const id of STEP_IDS) expect(CHAPTER[id]).toBeTruthy();
  });

  it('clamps any stored position into range', () => {
    expect(stepAt(1)).toBe('name');
    expect(stepAt(0)).toBe('name');
    expect(stepAt(99)).toBe(STEP_IDS[TOTAL_STEPS - 1]);
    expect(stepAt(Number.NaN)).toBe('name');
  });
});

describe('isStepAnswered', () => {
  const b = (patch: Partial<Brief>): Brief => ({ ...EMPTY_BRIEF, ...patch });

  it('needs a real name, not spaces', () => {
    expect(isStepAnswered(b({ contactName: '   ' }), 'name')).toBe(false);
    expect(isStepAnswered(b({ contactName: 'Sanyam' }), 'name')).toBe(true);
  });

  it('needs the home and where it is', () => {
    expect(isStepAnswered(b({ propertyType: 'BHK_3' }), 'home')).toBe(false);
    expect(isStepAnswered(b({ propertyType: 'BHK_3', locality: 'kharadi' }), 'home')).toBe(true);
  });

  /**
   * The regression. The level screen used to require a budget ceiling — and
   * since 29 Sep the Luxury band has none, so choosing Luxury left Continue
   * disabled with no way forward.
   */
  it('lets them leave the level screen having chosen the open top band', () => {
    expect(
      isStepAnswered(
        b({ tier: 'LUXURY', budgetMinPaise: 25_00_000_00, budgetMaxPaise: null }),
        'level',
      ),
    ).toBe(true);
    expect(isStepAnswered(b({}), 'level')).toBe(false);
  });

  it('asks for the month when they are expecting possession', () => {
    expect(isStepAnswered(b({ possessionStatus: 'EXPECTED' }), 'possession')).toBe(false);
    expect(
      isStepAnswered(b({ possessionStatus: 'EXPECTED', possessionOn: '2027-01-01' }), 'possession'),
    ).toBe(true);
  });

  it('keeps the optional screens optional', () => {
    expect(isStepAnswered(b({}), 'dislikes')).toBe(true);
    expect(isStepAnswered(b({}), 'living')).toBe(true);
  });

  it('needs all four priorities ranked', () => {
    expect(isStepAnswered(b({ priorityRanking: ['BUDGET', 'SPEED'] }), 'priorities')).toBe(false);
    expect(
      isStepAnswered(
        b({ priorityRanking: ['BUDGET', 'SPEED', 'DESIGN_AMBITION', 'MATERIAL_QUALITY'] }),
        'priorities',
      ),
    ).toBe(true);
  });
});

/**
 * It used to be 850 sq ft for every home, so a 4 BHK left blank was banded
 * and quoted as a 2 BHK.
 */
describe('carpet area when they did not give one', () => {
  it('is the typical area for their configuration, and says it was assumed', () => {
    expect(typicalCarpetSqft('BHK_1')).toBe(550);
    expect(typicalCarpetSqft('BHK_4_PLUS')).toBe(1650);
    expect(carpetAreaFor({ carpetAreaSqft: null, propertyType: 'BHK_3' })).toEqual({
      sqft: 1150,
      assumed: true,
    });
  });

  it('is theirs when they gave it', () => {
    expect(carpetAreaFor({ carpetAreaSqft: 980, propertyType: 'BHK_3' })).toEqual({
      sqft: 980,
      assumed: false,
    });
  });
});

describe('cleanName', () => {
  it('trims, single-spaces and caps what lands in a greeting', () => {
    expect(cleanName('  Sanyam   ')).toBe('Sanyam');
    expect(cleanName('Anna  Maria')).toBe('Anna Maria');
    expect(cleanName('x'.repeat(100))).toHaveLength(40);
    expect(cleanName('Sa\u0000nyam')).toBe('Sanyam');
    expect(cleanName('')).toBeNull();
  });
});

describe('the locality search', () => {
  it('puts areas that start with what they typed first', () => {
    const results = matchingLocalities('ba');
    expect(results[0]?.label).toBe('Baner');
    expect(results.every((l) => l.label.toLowerCase().includes('ba'))).toBe(true);
  });

  it('forgives case, dashes and dots', () => {
    expect(matchingLocalities('NIBM').map((l) => l.slug)).toContain('nibm');
    expect(matchingLocalities('pimple saudagar').map((l) => l.slug)).toContain('pimple-saudagar');
  });

  it('returns nothing for nothing', () => {
    expect(matchingLocalities('   ')).toEqual([]);
  });
});
