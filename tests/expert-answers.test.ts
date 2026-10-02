import { describe, it, expect } from 'vitest';
import { briefAnswers } from '@/modules/consultation/answers';
import { EMPTY_BRIEF, type Brief } from '@/modules/brief/types';

const full: Brief = {
  ...EMPTY_BRIEF,
  contactName: 'Sanyam',
  propertyType: 'BHK_3',
  carpetAreaSqft: 1250,
  locality: 'kharadi',
  society: 'Riverstone Residency',
  possessionStatus: 'EXPECTED',
  possessionOn: '2027-01-01',
  scope: 'FULL_HOME',
  excludedItems: ['master_loft'],
  tier: 'PREMIUM',
  budgetMinPaise: 1800 * 1250 * 100,
  budgetMaxPaise: 2500 * 1250 * 100,
  styleLikes: ['warm-modern'],
  styleDislikes: ['industrial'],
  household: { adults: 2, children: 1, elderly: 1, pets: true, worksFromHome: true },
  needs: ['VASTU'],
  priorityRanking: ['MATERIAL_QUALITY', 'SPEED'],
  involvement: 'COLLABORATE',
  language: 'MR',
  planReading: { kitchenRunMm: 4200, bathrooms: 3, hasStudy: true, areaSource: 'printed' },
};

describe('briefAnswers', () => {
  it('puts every answer in words, in the order the brief asked', () => {
    const a = briefAnswers(full);
    expect(a.map((x) => x.label)).toEqual([
      'Name', 'Home', 'Where', 'Floor plan', 'Possession', 'Scope', 'Left out', 'Level',
      'Likes', 'Rules out', 'Household', 'Needs', 'Priorities', 'Involvement', 'Language',
    ]);
    const get = (l: string) => a.find((x) => x.label === l)!.value;
    expect(get('Where')).toBe('Riverstone Residency, Kharadi');
    expect(get('Household')).toBe('2 adults, 1 child, 1 elderly parent, pets, someone works from home');
    expect(get('Priorities')).toMatch(/^1\. /);
    expect(get('Floor plan')).toMatch(/4,200 mm, a study/);
  });

  it('leaves out what was not answered rather than printing blanks', () => {
    expect(briefAnswers({ ...EMPTY_BRIEF, propertyType: 'BHK_2' }).map((x) => x.label)).toEqual(['Home']);
  });
});
