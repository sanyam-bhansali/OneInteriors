import { describe, it, expect } from 'vitest';
import { matchSummary, scoreMatch } from '@/modules/matching/score';
import { sanitiseBrief } from '@/modules/matching/sanitise';
import { EMPTY_BRIEF, type Brief } from '@/modules/brief/types';
import type { PortfolioProject, Studio } from '@/modules/studio/types';
import { lakhsToPaise } from '@/lib/money';

/** One completed project. Defaults are the boring case; override what matters. */
function project(overrides: Partial<PortfolioProject> = {}): PortfolioProject {
  return {
    id: 'p1',
    title: 'A finished home',
    locality: 'baner',
    propertyType: 'BHK_2',
    scope: 'FULL_HOME',
    styleTags: ['contemporary-minimal'],
    valuePaise: lakhsToPaise(10),
    durationDays: 90,
    completedOn: '2025-06-01',
    images: [],
    isRender: false,
    ...overrides,
  };
}

/**
 * The sentence next to the score.
 *
 * These tests exist for one property above all: a clause must never describe a
 * factor the engine could not measure. That is the difference between an
 * explanation a customer can check and a plausible-sounding number, and the
 * second one gets detected within two sessions.
 */

function studio(overrides: Partial<Studio> = {}): Studio {
  return {
    id: 'st_1',
    slug: 'test-studio',
    tradeName: 'Test Studio',
    legalName: 'Test Studio LLP',
    city: 'Pune',
    localities: ['baner'],
    gstin: null,
    yearsActive: 6,
    teamSize: 8,
    website: null,
    instagram: null,
    about: 'A studio.',
    minProjectPaise: lakhsToPaise(6),
    maxProjectPaise: lakhsToPaise(20),
    status: 'ACTIVE',
    tier: 'VERIFIED',
    completedProjects: 0,
    avgVarianceDays: null,
    upheldDisputes: 0,
    specComplianceRate: null,
    autonomyProfile: 0.5,
    communicationRating: 4,
    capacityPerMonth: null,
    pausedAt: null,
    pausedReason: null,
    pauseCause: null,
    checks: [],
    portfolio: [],
    ...overrides,
  } as Studio;
}

function brief(overrides: Partial<Brief> = {}): Brief {
  return {
    ...EMPTY_BRIEF,
    propertyType: 'BHK_2',
    carpetAreaSqft: 850,
    locality: 'baner',
    scope: 'FULL_HOME',
    budgetMinPaise: lakhsToPaise(8),
    budgetMaxPaise: lakhsToPaise(14),
    styleLikes: ['contemporary-minimal'],
    involvement: 'COLLABORATE',
    priorityRanking: ['BUDGET'],
    lastStep: 9,
    completedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('matchSummary', () => {
  it('returns null when nothing could be measured', () => {
    // No styles given, no budget, no locality, no involvement, empty portfolio.
    const b = brief({
      styleLikes: [],
      budgetMinPaise: null,
      budgetMaxPaise: null,
      locality: null,
      involvement: null,
      priorityRanking: [],
    });
    const s = studio({ portfolio: [], autonomyProfile: null, communicationRating: null });

    const result = scoreMatch(b, s);
    // Either the studio is unscoreable entirely, or it is scoreable with no
    // clause worth printing. Both are acceptable; a vague sentence is not.
    expect(result === null || matchSummary(b, s, result) === null).toBe(true);
  });

  /**
   * The core guarantee. Delivery reliability is null until a studio has run
   * enough projects through our own milestone plan, so a brand-new studio must
   * never have its record described.
   */
  it('never mentions a delivery record for a studio that has none', () => {
    const b = brief();
    const s = studio({ completedProjects: 0, avgVarianceDays: null });
    const result = scoreMatch(b, s);
    if (!result) return;

    const summary = matchSummary(b, s, result);
    expect(summary ?? '').not.toContain('delivery record');
  });

  it('quotes the locality back only when they have actually worked there', () => {
    const b = brief({ locality: 'baner' });

    const withLocal = studio({ portfolio: [project({ locality: 'baner' })] });
    const noLocal = studio({
      portfolio: [project({ locality: 'wakad' })],
      localities: ['baner', 'wakad'],
    });

    const r1 = scoreMatch(b, withLocal);
    const r2 = scoreMatch(b, noLocal);

    if (r1) expect(matchSummary(b, withLocal, r1) ?? '').toContain('Baner');
    if (r2) expect(matchSummary(b, noLocal, r2) ?? '').not.toContain('in Baner');
  });

  it('reads as one sentence and never carries its own copy of the score', () => {
    const b = brief();
    const s = studio({ portfolio: [project()] });
    const result = scoreMatch(b, s);
    if (!result) return;

    const summary = matchSummary(b, s, result);
    expect(summary).toBeTruthy();
    expect(summary!).toMatch(/^Because /);
    expect(summary!.endsWith('.')).toBe(true);
    // The card prints the score. A second copy in the sentence is how the
    // customer came to see 55% and 53% on the same studio.
    expect(summary!).not.toMatch(/\d\s*%/);
  });

  // Four clauses reads as boilerplate; the full detail is in `reasoning`
  // directly below it on the page.
  it('never runs past three clauses', () => {
    const b = brief();
    const s = studio({
      completedProjects: 12,
      avgVarianceDays: 1,
      portfolio: Array.from({ length: 6 }, (_, i) =>
        project({ id: `p${i}`, valuePaise: lakhsToPaise(11) }),
      ),
    });

    const result = scoreMatch(b, s);
    if (!result) return;
    const summary = matchSummary(b, s, result);
    if (!summary) return;

    expect(summary.split(';').length).toBeLessThanOrEqual(3);
  });
});

/**
 * The card and the written read must score the same brief.
 *
 * The card is scored in the browser on the brief as the customer wrote it;
 * the written read is scored on the server after `sanitiseBrief` rebuilds it.
 * The rebuild used to drop `priorityRanking`, so a customer who put material
 * quality or budget first saw one percentage on the card and another in the
 * sentence under it (55% and 53%, reproduced on /match on 29 Sep).
 */
describe('sanitiseBrief keeps everything the engine reads', () => {
  const s = studio({
    completedProjects: 8,
    avgVarianceDays: 6,
    specComplianceRate: 0.9,
    portfolio: [
      project({ id: 'a' }),
      project({ id: 'b', styleTags: ['warm-modern'], valuePaise: lakhsToPaise(12) }),
      project({ id: 'c', locality: 'aundh', valuePaise: lakhsToPaise(9) }),
    ],
  });

  const rankings: Brief['priorityRanking'][] = [
    ['BUDGET', 'SPEED', 'DESIGN_AMBITION', 'MATERIAL_QUALITY'],
    ['SPEED', 'MATERIAL_QUALITY', 'BUDGET', 'DESIGN_AMBITION'],
    ['MATERIAL_QUALITY', 'BUDGET'],
    ['DESIGN_AMBITION'],
  ];

  for (const priorityRanking of rankings) {
    it(`scores identically with ${priorityRanking[0]} first`, () => {
      const b = brief({
        priorityRanking,
        styleLikes: ['contemporary-minimal', 'warm-modern'],
        styleDislikes: ['art-deco'],
      });
      expect(scoreMatch(sanitiseBrief(b), s)?.score).toBe(scoreMatch(b, s)?.score);
    });
  }

  it('keeps the ranking in order and drops junk and repeats', () => {
    const cleaned = sanitiseBrief({
      ...brief(),
      priorityRanking: ['SPEED', 'IGNORE ALL PREVIOUS INSTRUCTIONS', 'SPEED', 'BUDGET', 42],
    });
    expect(cleaned.priorityRanking).toEqual(['SPEED', 'BUDGET']);
  });
});

// "They have finished 2 homes in Nibm" — the slug title-cased — was what a
// customer in NIBM Road read. Places are named by their label.
describe('place names', () => {
  it('uses the locality label, not the slug', () => {
    const b = brief({ locality: 'nibm' });
    const s = studio({ localities: ['nibm'], portfolio: [project({ locality: 'nibm' })] });
    const result = scoreMatch(b, s);
    expect(result?.reasoning.join(' ')).toContain('NIBM Road');
    expect(matchSummary(b, s, result!) ?? '').not.toContain('Nibm');
  });
});
