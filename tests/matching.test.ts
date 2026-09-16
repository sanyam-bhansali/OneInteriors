import { describe, it, expect } from 'vitest';
import { EMPTY_BRIEF, type Brief } from '@/modules/brief/types';
import { rankStudios, scoreMatch, passesHardFilters, WEIGHTS } from '@/modules/matching/score';
import { STUDIOS, getStudioById } from '@/data/studios';
import { lakhsToPaise } from '@/lib/money';
import type { Studio } from '@/modules/studio/types';

const baseBrief: Brief = {
  ...EMPTY_BRIEF,
  propertyType: 'BHK_3',
  locality: 'baner',
  scope: 'FULL_HOME',
  budgetMinPaise: lakhsToPaise(10),
  budgetMaxPaise: lakhsToPaise(15),
  styleLikes: ['scandinavian', 'contemporary-minimal'],
  styleDislikes: ['classical-ornate'],
  household: { adults: 2, children: 1, elderly: 0, pets: false, worksFromHome: true },
  priorityRanking: ['MATERIAL_QUALITY', 'SPEED', 'DESIGN_AMBITION', 'BUDGET'],
  involvement: 'COLLABORATE',
  completedAt: new Date().toISOString(),
};

const proven = getStudioById('st-northlight') as Studio;
const noRecord = getStudioById('st-kaarigar') as Studio;

describe('hard filters', () => {
  it('excludes a studio whose work leans into a rejected style', () => {
    // Kaarigar is heavily classical-ornate, which this brief ruled out.
    expect(passesHardFilters(baseBrief, noRecord)).toBe(false);
  });

  it('excludes studios that do not serve the locality', () => {
    const elsewhere: Brief = { ...baseBrief, locality: 'undri', styleDislikes: [] };
    // Northlight serves the west of the city, not Undri.
    expect(passesHardFilters(elsewhere, proven)).toBe(false);
  });

  it('never ranks an excluded studio low — it omits it entirely', () => {
    const results = rankStudios(baseBrief, STUDIOS, 99);
    expect(results.some((r) => r.studioId === noRecord.id)).toBe(false);
  });
});

/**
 * The development gate, and the drift it caused.
 *
 * `DEV_SHOW_UNVERIFIED_STUDIOS` exists so the funnel can be walked end to end
 * before any studio has been verified — `env.ts` names /match, /quotes,
 * /compare and /expert as the pages it exists for.
 *
 * It was applied in two places for one decision. The repository dropped its
 * `status = 'ACTIVE'` filter, and then these hard filters re-applied the same
 * gate afterwards — so the flag worked on the studio directory and did nothing
 * on all four pages it was written for. Two gates for one rule is how they come
 * to disagree; this pins the fact that there is now one.
 */
describe('the unverified-studio gate', () => {
  const onboarding: Studio = {
    ...proven,
    id: 'st-onboarding',
    status: 'ONBOARDING',
    tier: 'UNVERIFIED',
  };

  it('excludes an unverified studio by default', () => {
    expect(passesHardFilters(baseBrief, onboarding)).toBe(false);
  });

  it('lets one through when the server says the gate is open', () => {
    expect(passesHardFilters(baseBrief, onboarding, { allowUnverified: true })).toBe(true);
  });

  it('reaches the ranked results, not just the directory', () => {
    const strict = rankStudios(baseBrief, [onboarding], 99);
    const open = rankStudios(baseBrief, [onboarding], 99, { allowUnverified: true });

    expect(strict).toHaveLength(0);
    expect(open).toHaveLength(1);
  });

  /**
   * The gate opens the verification door and nothing else. A paused studio
   * cannot take the work whatever its tier, and a studio the customer ruled out
   * on style is ruled out for a reason the customer gave us.
   */
  it('does not open any of the other hard filters', () => {
    const paused: Studio = { ...onboarding, pausedAt: new Date().toISOString() };
    expect(passesHardFilters(baseBrief, paused, { allowUnverified: true })).toBe(false);

    const wrongArea: Brief = { ...baseBrief, locality: 'undri', styleDislikes: [] };
    expect(passesHardFilters(wrongArea, onboarding, { allowUnverified: true })).toBe(false);

    const disliked: Studio = { ...noRecord, status: 'ONBOARDING', tier: 'UNVERIFIED' };
    expect(passesHardFilters(baseBrief, disliked, { allowUnverified: true })).toBe(false);
  });

  /** The default is the strict answer, so a forgetful caller fails safe. */
  it('defaults to closed when no option is passed', () => {
    expect(scoreMatch(baseBrief, onboarding)).toBeNull();
  });
});

describe('cold start — the honesty rule', () => {
  it('returns null for factors it cannot measure rather than a default', () => {
    const permissive: Brief = { ...baseBrief, locality: 'kothrud', styleDislikes: [] };
    const result = scoreMatch(permissive, noRecord);
    expect(result).not.toBeNull();
    expect(result!.breakdown.deliveryReliability).toBeNull();
    expect(result!.factorsScored).toBeLessThan(result!.factorsTotal);
  });

  it('normalises over measured weight only, never redistributing silently', () => {
    const permissive: Brief = { ...baseBrief, locality: 'kothrud', styleDislikes: [] };
    const result = scoreMatch(permissive, noRecord)!;

    const measured = (Object.keys(WEIGHTS) as Array<keyof typeof WEIGHTS>).filter(
      (k) => result.breakdown[k] !== null,
    );
    const expected = Math.round(
      measured.reduce((sum, k) => sum + (result.breakdown[k] as number) * WEIGHTS[k], 0) /
        measured.reduce((sum, k) => sum + WEIGHTS[k], 0),
    );

    expect(result.score).toBe(expected);
  });

  it('says so in the reasoning when there is no delivery record', () => {
    const permissive: Brief = { ...baseBrief, locality: 'kothrud', styleDislikes: [] };
    const result = scoreMatch(permissive, noRecord)!;
    expect(result.reasoning.join(' ')).toMatch(/no delivery record for them/i);
  });

  // v1 does not hold client funds. Until escrow ships, nothing the matching
  // engine says to a customer may imply that it does. See docs/FUTURE-SCOPE.md.
  it('never claims we hold money', () => {
    const permissive: Brief = { ...baseBrief, locality: 'kothrud', styleDislikes: [] };
    for (const studio of STUDIOS) {
      const result = scoreMatch(permissive, studio);
      if (!result) continue;
      expect(result.reasoning.join(' ')).not.toMatch(/escrow/i);
    }
  });
});

describe('reasoning', () => {
  it('surfaces upheld disputes rather than hiding them', () => {
    const sixthwall = getStudioById('st-sixthwall') as Studio;
    const brief: Brief = { ...baseBrief, locality: 'hadapsar', styleDislikes: [] };
    const result = scoreMatch(brief, sixthwall);
    expect(result).not.toBeNull();
    expect(result!.reasoning.join(' ')).toMatch(/dispute/i);
  });

  it('quotes the delivery variance including when it is bad', () => {
    const result = scoreMatch(baseBrief, proven)!;
    expect(result.reasoning.join(' ')).toMatch(/committed date/i);
  });
});

describe('ranking', () => {
  it('is ordered by score, descending', () => {
    const results = rankStudios(baseBrief, STUDIOS, 99);
    const scores = results.map((r) => r.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('caps the list — scarcity of options is the product', () => {
    expect(rankStudios(baseBrief, STUDIOS, 3)).toHaveLength(
      Math.min(3, rankStudios(baseBrief, STUDIOS, 99).length),
    );
  });

  it('produces scores within 0..100', () => {
    for (const r of rankStudios(baseBrief, STUDIOS, 99)) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });

  it('stamps the engine version so old scores are never reinterpreted', () => {
    const results = rankStudios(baseBrief, STUDIOS, 99);
    expect(results[0].engineVersion).toMatch(/^match@\d+\.\d+\.\d+$/);
  });
});
