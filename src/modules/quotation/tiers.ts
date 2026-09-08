/**
 * Essential, Premium and Luxury.
 *
 * ## What a tier is, and what it is not
 *
 * A tier is a **budget band with a materials standard attached** — a statement
 * about what the customer gets for their money. It is not a ranking of
 * studios, not a status, and it is **never influenced by what a studio pays
 * us.**
 *
 * That last one is the load-bearing rule of this file, so it is worth being
 * exact about where money is allowed to touch the product:
 *
 *  - **Allowed.** A studio's subscription buys *volume* — how many briefs they
 *    are shown for in a month. That is the allocation engine, it is what the
 *    Signature and Verified tiers actually sell, and it is normal.
 *  - **Not allowed.** A studio's subscription may never move them above a
 *    better-fitting studio for a particular customer. Order within a tier
 *    comes from the matching engine and nothing else.
 *
 * If those two ever get mixed, the recommendation stops meaning what its label
 * says, and the verification tiers, the published variance and the whole
 * "we show the bad numbers" position stop being worth anything. Nothing in
 * this file takes a subscription, a fee or a payment as an argument, which is
 * the cheapest way to keep it true.
 *
 * Pure and tested.
 */

import type { Paise } from '@/lib/money';

export const TIERS = ['ESSENTIAL', 'PREMIUM', 'LUXURY'] as const;
export type Tier = (typeof TIERS)[number];

export interface TierDefinition {
  label: string;
  /** One line, on the selection card. */
  promise: string;
  /**
   * Where this tier sits per square foot of carpet area, as a rough all-in
   * cost. Used to place a studio's rate card into a band, and to show the
   * customer what a band means before they have a quote.
   */
  perSqftFrom: number;
  perSqftTo: number;
  /** What actually differs. Materials, not adjectives. */
  materials: string[];
  /** Said plainly, because a tier that suits everyone tells you nothing. */
  notFor: string;
}

/**
 * Bands in rupees per sqft of carpet area, all-in before GST.
 *
 * Derived from what the Pune market actually advertises — the entry points
 * published by studios in this segment sit around ₹3.5–5 lakh for a 1 BHK and
 * ₹6–9 lakh for a 2 BHK, which lands roughly where these bands are drawn. They
 * are ours, not any one studio's, and no studio's catalogue was used to set
 * them.
 */
export const TIER: Record<Tier, TierDefinition> = {
  ESSENTIAL: {
    label: 'Essential',
    promise: 'Everything you need, made well, with nothing spent on show.',
    perSqftFrom: 700,
    perSqftTo: 1100,
    materials: [
      'Branded laminate finishes',
      'Standard soft-close hardware',
      'False ceiling in the living room and bedrooms',
      'Modular kitchen with a standard counter',
    ],
    notFor:
      'Not the band for veneer, imported fittings or heavy custom joinery. If you want those, Premium is the honest starting point rather than a stretched Essential quote.',
  },
  PREMIUM: {
    label: 'Premium',
    promise: 'Better materials where they are touched, and more design time.',
    perSqftFrom: 1100,
    perSqftTo: 1800,
    materials: [
      'Veneer and acrylic on the pieces you see and touch',
      'Hettich or Hafele hardware throughout',
      'Designed lighting rather than standard fittings',
      'Quartz or granite counters',
      'More design revisions before anything is cut',
    ],
    notFor:
      'Not the band for imported stone, bespoke furniture design or a full civil rework. Those belong in Luxury and pricing them here means cutting somewhere else.',
  },
  LUXURY: {
    label: 'Luxury',
    promise: 'Made to your drawings, in the materials you chose.',
    perSqftFrom: 1800,
    perSqftTo: 3200,
    materials: [
      'Imported veneer, stone and specialist finishes',
      'Furniture designed for the room rather than selected',
      'Full lighting and automation design',
      'Civil changes where the layout needs them',
      'A dedicated designer for the length of the project',
    ],
    notFor:
      'Not the band for a quick turnaround. Custom work has lead times, and a studio promising Luxury finishes on an Essential timeline is telling you something about how it will end.',
  },
};

/**
 * Which tier a per-sqft figure falls into.
 *
 * Anything below Essential still returns Essential rather than null — a studio
 * cheaper than the band is perfectly legitimate, and telling a customer their
 * budget fits nothing would be both wrong and rude.
 */
export function tierForPerSqft(perSqft: number): Tier {
  if (perSqft >= TIER.LUXURY.perSqftFrom) return 'LUXURY';
  if (perSqft >= TIER.PREMIUM.perSqftFrom) return 'PREMIUM';
  return 'ESSENTIAL';
}

/**
 * What a tier costs for a given home, as a range.
 *
 * Shown before any studio is chosen, so a customer can see whether a band is
 * even in reach before spending time on it. GST is excluded and labelled —
 * a band that quietly included tax would read as cheaper than the quotes that
 * follow it.
 */
export function tierRangeFor(
  tier: Tier,
  carpetAreaSqft: number,
): { lowPaise: Paise; highPaise: Paise } {
  const definition = TIER[tier];
  return {
    lowPaise: Math.round(definition.perSqftFrom * carpetAreaSqft * 100),
    highPaise: Math.round(definition.perSqftTo * carpetAreaSqft * 100),
  };
}

/**
 * Does a studio work in this band?
 *
 * Answered from **the studio's own rate card**, by pricing a notional home and
 * seeing where the total lands. Not from what they pay us, not from a
 * self-declared tier, and not from anything ops types in — a studio's band is
 * a consequence of their prices, so it cannot be bought or claimed.
 */
export function studioTierFrom(quoteTotalPaise: Paise, carpetAreaSqft: number): Tier {
  if (carpetAreaSqft <= 0) return 'ESSENTIAL';
  const perSqft = quoteTotalPaise / 100 / carpetAreaSqft;
  return tierForPerSqft(perSqft);
}

/**
 * Which tiers to offer, given what the customer said they would spend.
 *
 * A budget is a fact about the customer, so a band above it is shown but
 * marked as a stretch rather than hidden — people routinely move up when they
 * see what the difference buys, and silently removing the option would be
 * deciding for them. A band far below is dropped, because offering someone
 * with ₹20 lakh an Essential quote wastes everybody's time.
 */
export function tiersForBudget(
  budgetMaxPaise: Paise | null,
  carpetAreaSqft: number,
): { tier: Tier; withinBudget: boolean }[] {
  return TIERS.map((tier) => {
    if (budgetMaxPaise === null) return { tier, withinBudget: true };
    const { lowPaise } = tierRangeFor(tier, carpetAreaSqft);
    return { tier, withinBudget: budgetMaxPaise >= lowPaise };
  }).filter((entry, index, all) => {
    // Drop a band only when the customer's budget clears the *next* band's
    // floor comfortably — i.e. they have visibly outgrown this one.
    if (budgetMaxPaise === null) return true;
    const next = all[index + 1];
    if (!next) return true;
    const nextRange = tierRangeFor(next.tier, carpetAreaSqft);
    return budgetMaxPaise < nextRange.highPaise;
  });
}
