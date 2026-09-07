/**
 * Verification tier — computed, never assigned.
 *
 * The single most important rule in this module: **a studio's tier is a pure
 * function of its checks and its delivery record.** There is no "set tier"
 * operation anywhere, for ops or anyone else. The moment a tier can be typed in
 * by a human, the badge stops meaning what the /verification page says it
 * means, and that page is the whole trust proposition.
 *
 * If a studio needs to be treated differently, that is a `status` change
 * (PAUSED / SUSPENDED), not a tier change.
 *
 * Tiers are also *not sticky*. An expired re-audit demotes. A pattern of upheld
 * disputes demotes. That is what makes the badge worth anything — an award that
 * can only go up is a participation trophy.
 */

import type {
  CheckResult,
  CheckType,
  Studio,
  VerificationCheck,
  VerificationTier,
} from '@/modules/studio/types';
import { TIER_CHECKS, MIN_PROJECTS_FOR_RELIABILITY } from '@/modules/studio/types';

/** Upheld disputes at or above this share of completed projects blocks PROVEN. */
export const MAX_DISPUTE_RATE_FOR_PROVEN = 0.15;

/** Above this average variance a studio cannot hold PROVEN. */
export const MAX_VARIANCE_DAYS_FOR_PROVEN = 30;

/** Tier 2 checks are re-audited on this cadence. */
export const REAUDIT_MONTHS = 6;

export interface TierAssessment {
  tier: VerificationTier;
  /** What is preventing the next tier up — empty when at PROVEN. */
  blockers: string[];
  /** Checks that have lapsed and need redoing. */
  expired: CheckType[];
  /** Per-tier completion, for the ops progress display. */
  progress: {
    listed: { passed: number; total: number };
    verified: { passed: number; total: number };
  };
}

function byType(checks: VerificationCheck[]): Map<CheckType, VerificationCheck> {
  return new Map(checks.map((c) => [c.type, c]));
}

/**
 * A check counts as satisfied when it PASSED, or when it genuinely does not
 * apply — a proprietorship has no MCA filing, and holding that against them
 * would be penalising a legal structure rather than a behaviour.
 */
function isSatisfied(check: VerificationCheck | undefined, now: Date): boolean {
  if (!check) return false;
  if (check.result === 'NOT_APPLICABLE') return true;
  if (check.result !== 'PASS') return false;
  return !hasExpired(check, now);
}

export function hasExpired(check: VerificationCheck, now: Date = new Date()): boolean {
  if (check.result === 'EXPIRED') return true;
  if (!check.checkedAt) return false;

  // Only Tier 2 (trading history) checks lapse. Identity does not go stale in
  // the same way — a PAN does not stop being someone's PAN.
  if (!TIER_CHECKS.VERIFIED.includes(check.type)) return false;

  const checked = new Date(check.checkedAt);
  const due = new Date(checked);
  due.setMonth(due.getMonth() + REAUDIT_MONTHS);
  return now > due;
}

function countPassed(
  types: CheckType[],
  map: Map<CheckType, VerificationCheck>,
  now: Date,
): number {
  return types.filter((t) => isSatisfied(map.get(t), now)).length;
}

/**
 * The whole tier calculation. Deliberately readable top to bottom — this is the
 * function someone will read when a studio asks "why am I not Proven yet?", and
 * they should be able to answer from the code.
 */
export function assessTier(
  studio: Pick<
    Studio,
    'checks' | 'completedProjects' | 'avgVarianceDays' | 'upheldDisputes' | 'status'
  >,
  now: Date = new Date(),
): TierAssessment {
  const map = byType(studio.checks);
  const expired = studio.checks.filter((c) => hasExpired(c, now)).map((c) => c.type);

  const listedPassed = countPassed(TIER_CHECKS.LISTED, map, now);
  const verifiedPassed = countPassed(TIER_CHECKS.VERIFIED, map, now);

  const progress = {
    listed: { passed: listedPassed, total: TIER_CHECKS.LISTED.length },
    verified: { passed: verifiedPassed, total: TIER_CHECKS.VERIFIED.length },
  };

  const blockers: string[] = [];

  // A removed or suspended studio has no tier standing at all.
  if (studio.status === 'REMOVED' || studio.status === 'SUSPENDED') {
    return {
      tier: 'UNVERIFIED',
      blockers: [`Studio is ${studio.status.toLowerCase()}`],
      expired,
      progress,
    };
  }

  // ── Tier 1 ──
  const hasListed = listedPassed === TIER_CHECKS.LISTED.length;
  if (!hasListed) {
    for (const t of TIER_CHECKS.LISTED) {
      if (!isSatisfied(map.get(t), now)) blockers.push(labelFor(t, map.get(t)));
    }
    return { tier: 'UNVERIFIED', blockers, expired, progress };
  }

  // ── Tier 2 ──
  const hasVerified = verifiedPassed === TIER_CHECKS.VERIFIED.length;
  if (!hasVerified) {
    for (const t of TIER_CHECKS.VERIFIED) {
      if (!isSatisfied(map.get(t), now)) blockers.push(labelFor(t, map.get(t)));
    }
    return { tier: 'LISTED', blockers, expired, progress };
  }

  // ── Tier 3 ──
  // Earned by delivery, not by paperwork. This is the tier a competitor cannot
  // buy from a KYC vendor, so the bar has to actually mean something.
  if (studio.completedProjects < MIN_PROJECTS_FOR_RELIABILITY) {
    const need = MIN_PROJECTS_FOR_RELIABILITY - studio.completedProjects;
    blockers.push(`${need} more completed project${need === 1 ? '' : 's'} with us`);
  }

  if (studio.avgVarianceDays === null) {
    blockers.push('No delivery record yet');
  } else if (studio.avgVarianceDays > MAX_VARIANCE_DAYS_FOR_PROVEN) {
    blockers.push(
      `Average delivery is ${Math.round(studio.avgVarianceDays)} days late (limit ${MAX_VARIANCE_DAYS_FOR_PROVEN})`,
    );
  }

  if (studio.completedProjects > 0) {
    const rate = studio.upheldDisputes / studio.completedProjects;
    if (rate > MAX_DISPUTE_RATE_FOR_PROVEN) {
      blockers.push(
        `${studio.upheldDisputes} upheld dispute${studio.upheldDisputes === 1 ? '' : 's'} across ${studio.completedProjects} projects`,
      );
    }
  }

  return {
    tier: blockers.length === 0 ? 'PROVEN' : 'VERIFIED',
    blockers,
    expired,
    progress,
  };
}

/** Convenience for callers that only want the tier. */
export function computeTier(
  studio: Parameters<typeof assessTier>[0],
  now: Date = new Date(),
): VerificationTier {
  return assessTier(studio, now).tier;
}

/**
 * Detect a stored tier that disagrees with what the checks actually support.
 * Runs in the ops console and, later, as a scheduled job — drift here means
 * either a bug or someone bypassing the rule, and both are worth knowing about.
 */
export function tierDrift(
  studio: Parameters<typeof assessTier>[0] & { tier: VerificationTier },
  now: Date = new Date(),
): { drifted: boolean; stored: VerificationTier; computed: VerificationTier } {
  const computed = computeTier(studio, now);
  return { drifted: computed !== studio.tier, stored: studio.tier, computed };
}

const CHECK_BLOCKER_LABELS: Record<CheckType, string> = {
  PAN_NAME_MATCH: 'PAN name match',
  AADHAAR_KYC: 'Identity of the principal',
  ADDRESS_VISIT: 'Business address visit',
  CONTACT_REACHABLE: 'Contact reachable',
  CODE_OF_CONDUCT: 'Code of conduct',
  GSTIN_ACTIVE: 'GST registration',
  GST_FILING_HISTORY: '12 months of GST filings',
  MCA_STATUS: 'Company filings',
  UDYAM: 'Udyam registration',
  CLIENT_REFERENCE: 'Client references',
  SITE_INSPECTION: 'Site inspections',
  LITIGATION_SEARCH: 'Litigation search',
};

function labelFor(type: CheckType, check: VerificationCheck | undefined): string {
  const label = CHECK_BLOCKER_LABELS[type];
  const state: CheckResult = check?.result ?? 'PENDING';
  if (state === 'FAIL') return `${label} — failed`;
  if (state === 'EXPIRED') return `${label} — expired, needs re-audit`;
  return `${label} — pending`;
}
