/**
 * Subscription tiers, fees, and what each one buys.
 *
 * ## Why fees live here and not in the database
 *
 * A price is a commercial decision that changes. An enum value is a migration.
 * Keeping the names in Postgres and the money in code means changing what
 * Premium costs is a one-line edit rather than a schema change plus a backfill —
 * and it keeps the answer to "what does this cost" in one findable place rather
 * than spread between a migration file and a pricing page.
 *
 * ## What a subscription buys
 *
 * **Volume.** How many briefs a studio is shown for. It does not buy position:
 * where a studio lands in one customer's results is computed from fit, and
 * nothing in this file is readable by the matching engine. See
 * `tests/allocation-governance.test.ts`, which asserts that structurally.
 *
 * Pure — no `server-only` — so the fees can be shown on a studio-facing page
 * and tested directly.
 */

import type { Paise } from '@/lib/money';

export const SUBSCRIPTION_TIERS = ['ESSENTIAL', 'PREMIUM', 'LUXURY'] as const;
export type SubscriptionTierName = (typeof SUBSCRIPTION_TIERS)[number];

export interface TierTerms {
  label: string;
  /** Monthly fee in paise. */
  monthlyPaise: Paise;
  /**
   * Briefs a month we undertake to show them for.
   *
   * Not projects. We control how many customers see a studio; we do not control
   * whether a customer picks them, and promising closed projects would be
   * promising something the customer decides. The distinction has to survive
   * into the contract or the first shortfall conversation goes badly.
   */
  guaranteedBriefs: number;
  /** The typical project size this band is built around, in paise. */
  typicalProjectPaise: Paise;
}

/**
 * Fees as set in the year-one plan.
 *
 * The mix assumed across a city is roughly 25% Essential, 50% Premium, 25%
 * Luxury — see the financial model. Note that the fee rises with the band and
 * so does the typical project value, which is what keeps the effective take
 * rate flat across tiers rather than punishing the biggest studios.
 */
export const TIER_TERMS: Record<SubscriptionTierName, TierTerms> = {
  ESSENTIAL: {
    label: 'Essential',
    monthlyPaise: 25_000_00,
    guaranteedBriefs: 8,
    typicalProjectPaise: 7_00_000_00,
  },
  PREMIUM: {
    label: 'Premium',
    monthlyPaise: 50_000_00,
    guaranteedBriefs: 16,
    typicalProjectPaise: 12_00_000_00,
  },
  LUXURY: {
    label: 'Luxury',
    monthlyPaise: 1_00_000_00,
    guaranteedBriefs: 30,
    typicalProjectPaise: 20_00_000_00,
  },
};

/** Commission on a closed project, in basis points. Charged in every phase. */
export const COMMISSION_BPS = 500;

/**
 * What a studio pays us in a month, as a share of what it earned.
 *
 * The number a studio actually decides on. It does not compare our fee to zero
 * — it compares the total to what it paid during the pilot, and to what a
 * booked project through its own ads costs it today.
 *
 * Returns null rather than Infinity at zero projects: a studio that closed
 * nothing has no revenue to take a share of, and printing "∞%" on an ops screen
 * is worse than admitting the question does not apply.
 */
export function effectiveTakeRate(
  tier: SubscriptionTierName,
  projectsClosed: number,
  averageProjectPaise: Paise,
): number | null {
  const revenue = projectsClosed * averageProjectPaise;
  if (revenue <= 0) return null;

  const commission = (revenue * COMMISSION_BPS) / 10_000;
  return ((TIER_TERMS[tier].monthlyPaise + commission) / revenue) * 100;
}

/**
 * How many projects a month before the fixed fee stops mattering.
 *
 * Defined as the point where the subscription is under one percentage point of
 * the studio's revenue. Below it the fee is the dominant cost and the studio is
 * paying well above the pilot rate — which is exactly the stretch of the ramp
 * where studios decide to leave. Ops should know this number per tier, because
 * it is the volume a studio has to reach before the deal feels fair to them.
 */
export function volumeWhereFeeStopsBiting(tier: SubscriptionTierName): number {
  const { monthlyPaise, typicalProjectPaise } = TIER_TERMS[tier];
  return Math.ceil(monthlyPaise / (typicalProjectPaise * 0.01));
}
