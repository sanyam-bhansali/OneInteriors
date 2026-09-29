import { describe, it, expect } from 'vitest';
import { EMPTY_BRIEF, type Brief } from '@/modules/brief/types';
import { rankStudios, scoreMatch, topPriorityLine } from '@/modules/matching/score';
import { STUDIOS } from '@/data/studios';
import { filedRatesFor } from '@/data/filed-rates';

const TODAY = new Date('2026-09-20T00:00:00Z');
const opts = { today: TODAY, ratesFor: filedRatesFor };
const ctx = { today: TODAY, ratesFor: filedRatesFor };

const brief: Brief = {
  ...EMPTY_BRIEF,
  propertyType: 'BHK_3',
  carpetAreaSqft: 1250,
  locality: 'kharadi',
  possessionStatus: 'EXPECTED',
  possessionOn: '2026-12-01',
  scope: 'FULL_HOME',
  tier: 'PREMIUM',
  budgetMinPaise: 1800 * 1250 * 100,
  budgetMaxPaise: 2500 * 1250 * 100,
  styleLikes: ['warm-modern'],
  priorityRanking: ['SPEED', 'BUDGET', 'MATERIAL_QUALITY', 'DESIGN_AMBITION'],
  involvement: 'COLLABORATE',
  completedAt: '2026-09-20T00:00:00Z',
};

describe("the customer's first priority leads the card", () => {
  it('answers finishing on time with when they can start', () => {
    const [first] = rankStudios(brief, STUDIOS, 9, opts);
    expect(first!.topPriority).toMatch(/^You put finishing on time first: they (can|are booked)/);
    expect(first!.reasoning[0]).toBe(first!.topPriority);
  });

  it('follows whichever priority came first', () => {
    const budgetFirst: Brief = { ...brief, priorityRanking: ['BUDGET', 'SPEED', 'MATERIAL_QUALITY', 'DESIGN_AMBITION'] };
    const [first] = rankStudios(budgetFirst, STUDIOS, 9, opts);
    expect(first!.topPriority).toMatch(/^You put staying in budget first: (their quote|their past projects|most of their past)/i);
  });

  it('says so when we know nothing on it, rather than leaving it out', () => {
    const bare = { ...STUDIOS[0]!, portfolio: [], matchingProfile: undefined, completedProjects: 0, avgVarianceDays: null, specComplianceRate: null };
    const line = topPriorityLine({ ...brief, priorityRanking: ['MATERIAL_QUALITY'] }, bare, ctx);
    expect(line).toBe(`You put material quality first. We have nothing on that for ${bare.tradeName} yet.`);
  });

  it('is absent without a ranking', () => {
    const s = STUDIOS.find((x) => scoreMatch({ ...brief, priorityRanking: [] }, x, opts))!;
    expect(scoreMatch({ ...brief, priorityRanking: [] }, s, opts)!.topPriority).toBeUndefined();
  });
});
