import { describe, it, expect } from 'vitest';
import {
  assessTier,
  computeTier,
  hasExpired,
  tierDrift,
  REAUDIT_MONTHS,
  MAX_VARIANCE_DAYS_FOR_PROVEN,
} from '@/modules/verification/tiers';
import { TIER_CHECKS } from '@/modules/studio/types';
import type { CheckResult, CheckType, VerificationCheck } from '@/modules/studio/types';
import { STUDIOS } from '@/data/studios';

const NOW = new Date('2026-09-07T00:00:00Z');
const RECENT = '2026-08-01';

function check(type: CheckType, result: CheckResult = 'PASS', checkedAt = RECENT): VerificationCheck {
  return { type, result, source: 'Our team', checkedAt, detail: null };
}

function allOf(types: readonly CheckType[], result: CheckResult = 'PASS', checkedAt = RECENT) {
  return types.map((t) => check(t, result, checkedAt));
}

const TIER1 = () => allOf(TIER_CHECKS.LISTED);
const TIER2 = () => allOf(TIER_CHECKS.VERIFIED);

function studio(over: Partial<Parameters<typeof assessTier>[0]> = {}) {
  return {
    checks: [...TIER1(), ...TIER2()],
    completedProjects: 5,
    avgVarianceDays: 6,
    upheldDisputes: 0,
    status: 'ACTIVE' as const,
    ...over,
  };
}

describe('tier is earned in order', () => {
  it('is UNVERIFIED with no checks', () => {
    expect(computeTier(studio({ checks: [] }), NOW)).toBe('UNVERIFIED');
  });

  it('is UNVERIFIED while any identity check is pending', () => {
    const checks = [...TIER1(), ...TIER2()];
    checks[0] = check('PAN_NAME_MATCH', 'PENDING');
    expect(computeTier(studio({ checks }), NOW)).toBe('UNVERIFIED');
  });

  it('is LISTED with identity complete but trading history incomplete', () => {
    expect(computeTier(studio({ checks: TIER1() }), NOW)).toBe('LISTED');
  });

  it('is VERIFIED with all paperwork but no delivery record', () => {
    expect(
      computeTier(studio({ completedProjects: 0, avgVarianceDays: null }), NOW),
    ).toBe('VERIFIED');
  });

  it('is PROVEN only once delivery is proven', () => {
    expect(computeTier(studio(), NOW)).toBe('PROVEN');
  });
});

describe('NOT_APPLICABLE counts as satisfied', () => {
  // A proprietorship has no MCA filing. Penalising that would be punishing a
  // legal structure rather than a behaviour.
  it('does not block on a check that genuinely does not apply', () => {
    const checks = [...TIER1(), ...TIER2()];
    const i = checks.findIndex((c) => c.type === 'MCA_STATUS');
    checks[i] = check('MCA_STATUS', 'NOT_APPLICABLE');
    expect(computeTier(studio({ checks }), NOW)).toBe('PROVEN');
  });
});

describe('tiers are not sticky — they demote', () => {
  it('demotes to VERIFIED when delivery runs too late', () => {
    expect(
      computeTier(studio({ avgVarianceDays: MAX_VARIANCE_DAYS_FOR_PROVEN + 1 }), NOW),
    ).toBe('VERIFIED');
  });

  it('demotes to VERIFIED on a pattern of upheld disputes', () => {
    expect(computeTier(studio({ completedProjects: 5, upheldDisputes: 2 }), NOW)).toBe('VERIFIED');
  });

  it('tolerates a single dispute across many projects', () => {
    expect(computeTier(studio({ completedProjects: 20, upheldDisputes: 1 }), NOW)).toBe('PROVEN');
  });

  it('demotes to LISTED when a trading check lapses', () => {
    const stale = new Date(NOW);
    stale.setMonth(stale.getMonth() - (REAUDIT_MONTHS + 1));
    const checks = [...TIER1(), ...allOf(TIER_CHECKS.VERIFIED, 'PASS', stale.toISOString())];
    expect(computeTier(studio({ checks }), NOW)).toBe('LISTED');
  });

  it('strips all standing when suspended or removed', () => {
    expect(computeTier(studio({ status: 'SUSPENDED' }), NOW)).toBe('UNVERIFIED');
    expect(computeTier(studio({ status: 'REMOVED' }), NOW)).toBe('UNVERIFIED');
  });
});

describe('expiry', () => {
  it('lapses a trading check after the re-audit window', () => {
    const stale = new Date(NOW);
    stale.setMonth(stale.getMonth() - (REAUDIT_MONTHS + 1));
    expect(hasExpired(check('GST_FILING_HISTORY', 'PASS', stale.toISOString()), NOW)).toBe(true);
  });

  it('does not lapse identity checks — a PAN does not go stale', () => {
    const ancient = '2019-01-01';
    expect(hasExpired(check('PAN_NAME_MATCH', 'PASS', ancient), NOW)).toBe(false);
  });

  it('reports which checks expired', () => {
    const stale = new Date(NOW);
    stale.setMonth(stale.getMonth() - (REAUDIT_MONTHS + 1));
    const checks = [...TIER1(), ...allOf(TIER_CHECKS.VERIFIED, 'PASS', stale.toISOString())];
    expect(assessTier(studio({ checks }), NOW).expired.length).toBe(TIER_CHECKS.VERIFIED.length);
  });
});

describe('blockers explain the gap', () => {
  it('names every outstanding check', () => {
    const result = assessTier(studio({ checks: TIER1() }), NOW);
    expect(result.blockers.length).toBe(TIER_CHECKS.VERIFIED.length);
    expect(result.blockers.join(' ')).toMatch(/pending/i);
  });

  it('explains why PROVEN is out of reach', () => {
    const result = assessTier(studio({ completedProjects: 1, avgVarianceDays: 4 }), NOW);
    expect(result.tier).toBe('VERIFIED');
    expect(result.blockers.join(' ')).toMatch(/more completed project/i);
  });

  it('has no blockers at PROVEN', () => {
    expect(assessTier(studio(), NOW).blockers).toEqual([]);
  });

  it('reports per-tier progress for the ops display', () => {
    const result = assessTier(studio({ checks: TIER1() }), NOW);
    expect(result.progress.listed).toEqual({ passed: 5, total: 5 });
    expect(result.progress.verified.passed).toBe(0);
  });
});

describe('drift detection', () => {
  it('flags a stored tier the checks do not support', () => {
    const result = tierDrift({ ...studio({ checks: [] }), tier: 'PROVEN' }, NOW);
    expect(result.drifted).toBe(true);
    expect(result.computed).toBe('UNVERIFIED');
  });

  it('does not flag an agreeing tier', () => {
    expect(tierDrift({ ...studio(), tier: 'PROVEN' }, NOW).drifted).toBe(false);
  });

  /**
   * Guards the rule itself: fixtures carry a hand-written `tier`, and if any of
   * them disagrees with what the checks support, either the fixture is lying to
   * the UI or the rules changed underneath it. Both are bugs.
   */
  it('every fixture studio has a tier its checks actually support', () => {
    for (const s of STUDIOS) {
      const drift = tierDrift(s, NOW);
      expect(
        drift.drifted,
        `${s.tradeName}: stored ${drift.stored} but checks support ${drift.computed}`,
      ).toBe(false);
    }
  });
});
