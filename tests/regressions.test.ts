import { describe, it, expect } from 'vitest';
import { EMPTY_BRIEF, STYLE_TAGS, type Brief, type StyleTag } from '@/modules/brief/types';
import { scoreMatch, MAX_DISLIKED_SHARE } from '@/modules/matching/score';
import { describeDelivery, TIER_CHECKS } from '@/modules/studio/types';
import type { CheckType, PortfolioProject, Studio, VerificationCheck } from '@/modules/studio/types';
import { hasExpired, computeTier } from '@/modules/verification/tiers';
import { splitAcross, lakhsToPaise, formatINR, formatINRCompact, fromDb, toDb, applyBps } from '@/lib/money';
import { DEFAULT_MILESTONES } from '@/lib/money';

/**
 * Regressions found in the pre-deploy review. Each of these shipped a false or
 * broken thing to a customer; each fix gets a test so it cannot come back.
 */

const NOW = new Date('2026-09-07T00:00:00Z');

function project(over: Partial<PortfolioProject> = {}): PortfolioProject {
  return {
    id: 'p1',
    title: 'Test',
    locality: 'baner',
    propertyType: 'BHK_3',
    scope: 'FULL_HOME',
    styleTags: ['warm-modern'],
    valuePaise: lakhsToPaise(10),
    durationDays: 90,
    completedOn: '2026-01-01',
    images: [],
    isRender: false,
    ...over,
  };
}

function check(type: CheckType, checkedAt: string | null = '2026-08-01'): VerificationCheck {
  return { type, result: 'PASS', source: 'Our team', checkedAt, detail: null };
}

function studio(over: Partial<Studio> = {}): Studio {
  return {
    id: 's1', slug: 's1', legalName: 'S1 Pvt Ltd', tradeName: 'S1', about: '',
    city: 'pune', localities: ['baner'], status: 'ACTIVE', tier: 'PROVEN',
    gstin: null, yearsActive: 5, teamSize: 5,
    minProjectPaise: lakhsToPaise(5), maxProjectPaise: lakhsToPaise(20),
    completedProjects: 5, avgVarianceDays: 5, upheldDisputes: 0,
    specComplianceRate: 0.95, communicationRating: 4.5, autonomyProfile: 0.5,
    capacityPerMonth: null, pausedAt: null, pausedReason: null, pauseCause: null,
    checks: [...TIER_CHECKS.LISTED, ...TIER_CHECKS.VERIFIED].map((t) => check(t)),
    portfolio: [project()],
    ...over,
  };
}

const brief = (over: Partial<Brief> = {}): Brief => ({
  ...EMPTY_BRIEF,
  propertyType: 'BHK_3', locality: 'baner', scope: 'FULL_HOME',
  budgetMinPaise: lakhsToPaise(8), budgetMaxPaise: lakhsToPaise(12),
  styleLikes: ['warm-modern'], involvement: 'COLLABORATE',
  priorityRanking: ['BUDGET', 'SPEED', 'DESIGN_AMBITION', 'MATERIAL_QUALITY'],
  ...over,
});

describe('regression: "None of their portfolio goes there"', () => {
  // The hard filter only excludes above 40%, so a studio with up to 40% of its
  // work in a rejected style was shown AND told the customer none of it was.
  it('does not claim zero when the studio has some of the rejected style', () => {
    const s = studio({
      portfolio: [
        project({ id: 'a', styleTags: ['warm-modern'] }),
        project({ id: 'b', styleTags: ['warm-modern'] }),
        project({ id: 'c', styleTags: ['classical-ornate'] }), // 1/3 = 33%, under the 40% cut
      ],
    });
    const result = scoreMatch(brief({ styleDislikes: ['classical-ornate'] }), s);
    expect(result, 'should still be shown — 33% is under the threshold').not.toBeNull();
    const text = result!.reasoning.join(' ');
    expect(text).not.toMatch(/None of their portfolio/i);
    expect(text).toMatch(/33% of their work leans that way/i);
  });

  it('still says "none" when it genuinely is none', () => {
    const result = scoreMatch(brief({ styleDislikes: ['classical-ornate'] }), studio());
    expect(result!.reasoning.join(' ')).toMatch(/None of their portfolio goes there/i);
  });

  it('the exclusion threshold and the phrasing use the same number', () => {
    const overTheLine = studio({
      portfolio: [
        project({ id: 'a', styleTags: ['classical-ornate'] }),
        project({ id: 'b', styleTags: ['warm-modern'] }),
      ], // 50% > 40%
    });
    expect(MAX_DISLIKED_SHARE).toBe(0.4);
    expect(scoreMatch(brief({ styleDislikes: ['classical-ornate'] }), overTheLine)).toBeNull();
  });
});

describe('regression: locality claim must come from locality', () => {
  it('does not claim local homes when none of the portfolio is local', () => {
    const s = studio({
      localities: [], // no declared areas, so the hard filter is skipped
      portfolio: [project({ locality: 'kothrud' }), project({ id: 'b', locality: 'aundh' })],
    });
    const result = scoreMatch(brief({ locality: 'baner' }), s);
    expect(result!.reasoning.join(' ')).not.toMatch(/in Baner/i);
  });

  it('states the real count when there is local work', () => {
    const s = studio({
      portfolio: [project({ locality: 'baner' }), project({ id: 'b', locality: 'baner' })],
    });
    expect(scoreMatch(brief(), s)!.reasoning.join(' ')).toMatch(/completed 2 homes in Baner/i);
  });
});

describe('regression: "has not completed a project" at 1-2 projects', () => {
  it('does not say zero when the studio has completed one or two', () => {
    for (const n of [1, 2]) {
      const s = studio({ completedProjects: n, avgVarianceDays: null });
      const text = scoreMatch(brief(), s)!.reasoning.join(' ');
      expect(text, `${n} completed`).not.toMatch(/has not completed a project/i);
      expect(text).toMatch(new RegExp(`completed ${n} project`, 'i'));

      expect(describeDelivery(s)).not.toMatch(/has not completed a project/i);
      expect(describeDelivery(s)).toMatch(new RegExp(`${n} project`, 'i'));
    }
  });

  it('still says none at zero', () => {
    const s = studio({ completedProjects: 0, avgVarianceDays: null });
    expect(describeDelivery(s)).toMatch(/has not completed a project with us/i);
  });
});

describe('regression: a trading check with no date must not satisfy forever', () => {
  it('treats a dated-null Tier 2 PASS as expired', () => {
    expect(hasExpired(check('GST_FILING_HISTORY', null), NOW)).toBe(true);
  });

  it('does not expire an identity check without a date — a PAN does not go stale', () => {
    expect(hasExpired(check('PAN_NAME_MATCH', null), NOW)).toBe(false);
  });

  it('demotes a studio whose trading checks have no dates', () => {
    const s = studio({
      checks: [
        ...TIER_CHECKS.LISTED.map((t) => check(t)),
        ...TIER_CHECKS.VERIFIED.map((t) => check(t, null)),
      ],
    });
    expect(computeTier(s, NOW)).toBe('LISTED');
  });
});

describe('regression: milestone figures must add up on screen', () => {
  it('the displayed parts sum to the displayed contract value', () => {
    const total = lakhsToPaise(8.5);
    const parts = splitAcross(total, DEFAULT_MILESTONES.map((m) => m.weight));

    // Exact-rupee rendering: what a reader adds equals what we state.
    const read = parts.map((p) => Number(formatINR(p).replace(/[₹,]/g, '')));
    expect(read.reduce((a, b) => a + b, 0)).toBe(total / 100);
  });

  it('demonstrates why the compact form was wrong here', () => {
    const total = lakhsToPaise(8.5);
    const parts = splitAcross(total, DEFAULT_MILESTONES.map((m) => m.weight));
    const compactSum = parts
      .map((p) => parseFloat(formatINRCompact(p).replace(/[^\d.]/g, '')) * 100_000)
      .reduce((a, b) => a + b, 0);
    // Short by ₹1,000 — the reason MilestoneTrack uses formatINR.
    expect(Math.round(compactSum)).not.toBe(total / 100);
  });
});

describe('money: the Prisma BigInt boundary', () => {
  it('round-trips through the database types', () => {
    const v = lakhsToPaise(8.5);
    expect(fromDb(toDb(v))).toBe(v);
  });

  it('throws rather than silently losing precision', () => {
    expect(() => fromDb(BigInt(Number.MAX_SAFE_INTEGER) + 10n)).toThrow();
    expect(() => toDb(1.5)).toThrow();
  });

  it('applyBps gives the budget floor exactly, with no float drift', () => {
    // The quiz derives its lower bound as 80% of the slider value.
    expect(applyBps(lakhsToPaise(10), 8000)).toBe(lakhsToPaise(8));
  });
});

describe('style vocabulary stays in sync', () => {
  it('every fixture style tag is in the vocabulary', async () => {
    const { STUDIOS } = await import('@/data/studios');
    const vocab = new Set<string>(STYLE_TAGS);
    for (const s of STUDIOS) {
      for (const p of s.portfolio) {
        for (const t of p.styleTags) {
          expect(vocab.has(t), `"${t}" on ${s.tradeName} is not in STYLE_TAGS`).toBe(true);
        }
      }
    }
  });

  it('an unknown tag would be droppable rather than rendering "undefined"', () => {
    const unknown = 'not-a-real-style' as StyleTag;
    expect((STYLE_TAGS as readonly string[]).includes(unknown)).toBe(false);
  });
});
