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
   * Briefs a month this band is allocated.
   *
   * An internal allocation target, **not a number we promise a studio.** It
   * was removed from the sales deck on 26 Sep 2026: a guaranteed brief count
   * is a commitment we cannot keep in the first months, when the constraint is
   * homeowner demand rather than how we divide it, and a promise broken in
   * month two costs more than the one it won in month one.
   *
   * What we do say out loud is the shape of it — a subscription buys volume
   * and never position. Keep that distinction: we control how many customers
   * see a studio, never whether one picks them.
   */
  guaranteedBriefs: number;
  /** The typical project size this band is built around, in paise. */
  typicalProjectPaise: Paise;
}

/**
 * Fees, and what a band means.
 *
 * Revised 26 Sep 2026, when the bands were redefined for the partner pitch.
 * Two changes worth understanding rather than just reading.
 *
 * **A band is a rate per square foot, not a project size.** ₹25 lakh on a
 * 2 BHK is about ₹2,800/sqft and is Luxury; the same ₹25 lakh on a 4 BHK is
 * about ₹1,500 and is Essential. Banding on project value would put those two
 * studios in the same place, and they are not doing the same work. What the
 * band actually describes is scope: Essential is furnishing, Premium adds a
 * designer and project management, Luxury adds the premium materials.
 *
 * **Premium and Luxury moved to 49k and 99k** from 50k and 1L. Ending a price
 * below the round number is worth more in a room than the thousand it costs.
 *
 * The mix assumed across a city is roughly 25% Essential, 50% Premium, 25%
 * Luxury — see the financial model. The fee rises with the band and so does
 * the typical project, which is what keeps the effective take rate flat across
 * tiers rather than punishing the biggest studios.
 *
 * **One set of boundaries, since 29 Sep 2026:** ₹1,200–1,800 / 1,800–2,500 /
 * 2,500 and up, the same as the customer bands in
 * `src/modules/quotation/tiers.ts`. Until then the two files carried different
 * numbers under the same three names, and "Premium" meant one thing to a
 * studio and another to the homeowner being matched to it.
 */
export const TIER_TERMS: Record<SubscriptionTierName, TierTerms> = {
  ESSENTIAL: {
    label: 'Essential',
    monthlyPaise: 25_000_00,
    guaranteedBriefs: 8,
    /** ₹1,200–1,800/sqft, furnishing only. An 800 sqft 2 BHK lands near ₹12 lakh. */
    typicalProjectPaise: 12_00_000_00,
  },
  PREMIUM: {
    label: 'Premium',
    monthlyPaise: 49_000_00,
    guaranteedBriefs: 16,
    /** ₹1,800–2,500/sqft, with a designer and project management. */
    typicalProjectPaise: 18_00_000_00,
  },
  LUXURY: {
    label: 'Luxury',
    monthlyPaise: 99_000_00,
    guaranteedBriefs: 30,
    /** ₹2,500/sqft and up, in premium materials. */
    typicalProjectPaise: 30_00_000_00,
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
