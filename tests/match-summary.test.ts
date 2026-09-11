import { describe, it, expect } from 'vitest';
import { matchSummary, scoreMatch } from '@/modules/matching/score';
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

  it('opens with the score and reads as one sentence', () => {
    const b = brief();
    const s = studio({ portfolio: [project()] });
    const result = scoreMatch(b, s);
    if (!result) return;

    const summary = matchSummary(b, s, result);
    expect(summary).toBeTruthy();
    expect(summary!).toMatch(/^\d{1,3}% match — because /);
    expect(summary!.endsWith('.')).toBe(true);
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
