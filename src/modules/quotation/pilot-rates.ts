/**
 * Rates for the pilot, derived from Hauspire's live quotation tool.
 *
 * ## Where these came from
 *
 * `Quotation hosted/src/data/productMaster.json` plus `src/lib/pricing.ts`,
 * which is Hauspire's own working catalogue — the one their designers quote
 * from today. Their model prices a face in millimetres:
 *
 *     amount = (widthMm × heightMm) ÷ 92903.04 × ratePerSqft
 *
 * so a `rate` there is genuinely per square foot, and the figures below are
 * conversions rather than inventions. Each one records what it was converted
 * from, because a rate whose derivation nobody can reconstruct becomes
 * folklore within a month.
 *
 * ## The governance line, which this file sits right on top of
 *
 * `FUTURE-SCOPE.md` §3 and `QUOTATION-BUILDER.md` §2 both say Hauspire's rates
 * must never become another studio's rates. That still holds, and this does
 * not breach it, because of exactly who is allowed to receive these:
 *
 *  - **Hauspire** — their own numbers, on their own studio. Obviously fine.
 *  - **The eight fixture studios** — invented records that do not correspond
 *    to any business. Varied demo rates on fictional studios set nobody's
 *    prices, because there is nobody whose prices they are.
 *  - **Urbanline, and every other real studio** — NEVER. They are a real
 *    business with real margins, and they enter their own card or they are not
 *    quoted. `prisma/seed-rate-cards.ts` refuses them by name.
 *
 * The whole file is pilot scaffolding. It should be deleted the week the
 * second real studio finishes onboarding.
 */

import { rupeesToPaise } from '@/lib/money';
import type { RateCategory } from './categories';

/**
 * Hauspire discounts modular work by 15% on essentially every quote
 * (`MODULAR_DISCOUNT` in their pricing.ts), so the list price is not the price
 * anyone pays. The rates below are post-discount, because a quote that shows a
 * number no customer is ever charged is worse than no quote.
 */
const MODULAR_DISCOUNT = 0.15;
const modular = (listRate: number) => Math.round(listRate * (1 - MODULAR_DISCOUNT));

export interface RateProvenance {
  category: RateCategory;
  /** Rupees, in the unit the category declares. */
  rupees: number;
  /** How this was derived, for anyone auditing it later. */
  from: string;
}

export const HAUSPIRE_RATES: RateProvenance[] = [
  {
    category: 'modular_kitchen',
    rupees: modular(2580),
    from: '"Base Cabinets" and "Wall Cabinets" at ₹2,580/sqft, less their standard 15% modular discount.',
  },
  {
    category: 'wardrobes',
    rupees: modular(2580),
    from: '"Premium Shutter wardrobe" at ₹2,580/sqft, less the 15% modular discount.',
  },
  {
    category: 'carpentry',
    rupees: modular(1950),
    from: 'Blend of TV Unit (₹1,200), Workstation (₹2,000) and TV base storage (₹2,580), less the modular discount.',
  },
  {
    category: 'false_ceiling',
    rupees: 130,
    from: '"Minimal False Ceiling" at ₹20,000 per room, spread across a typical ceiled area of about 155 sqft per room.',
  },
  {
    category: 'painting',
    rupees: 16,
    from: 'Their flat "Painting — 2BHK (Emulsion)" of ₹45,000, over the ~2,720 sqft of wall area our estimator derives for an 850 sqft flat. The 3 BHK figure (₹55,000) gives the same rate, which is why this one is trustworthy.',
  },
  {
    category: 'electrical',
    rupees: 35,
    from: 'Their "Electricals (2BHK)" ₹30,000 over 850 sqft carpet, and "(3BHK)" ₹40,000 over 1,150 sqft — both land on ₹35/sqft.',
  },
  {
    category: 'plumbing',
    rupees: 30_000,
    from: 'Their combined "Civil and Plumbing Changes" of ₹1,00,000, split across plumbing and civil.',
  },
  {
    category: 'civil',
    rupees: 70_000,
    from: 'The remainder of the same ₹1,00,000 civil-and-plumbing line.',
  },
  {
    category: 'design_fee',
    rupees: 7,
    from: 'FEE_RATE = 0.07 in their pricing.ts — a 7% professional fee on the whole quote.',
  },
];

/**
 * Demo rates for the invented fixture studios.
 *
 * Spread around Hauspire's numbers so the compare view has something real to
 * do — with all eight studios on identical rates every comparison would show a
 * dead heat, which would hide bugs in exactly the code whose job is to say
 * when a difference is real.
 *
 * The multipliers deliberately straddle the tier bands: roughly Essential,
 * Premium and Luxury, so a customer choosing a band sees studios who actually
 * work in it.
 */
export const FIXTURE_MULTIPLIERS = [0.72, 0.85, 1.0, 1.15, 1.34, 1.55, 1.82, 0.94] as const;

/** The rate card for a fixture studio, as paise, keyed by category. */
export function fixtureRateCard(index: number): Partial<Record<RateCategory, number>> {
  const multiplier = FIXTURE_MULTIPLIERS[index % FIXTURE_MULTIPLIERS.length];
  const card: Partial<Record<RateCategory, number>> = {};

  for (const rate of HAUSPIRE_RATES) {
    if (rate.category === 'design_fee') {
      // Basis points, and not scaled — a design fee is a business decision
      // rather than a material cost, so varying it with the multiplier would
      // imply a relationship that does not exist.
      card.design_fee = Math.round(rate.rupees * 100);
      continue;
    }
    card[rate.category] = rupeesToPaise(Math.round(rate.rupees * multiplier));
  }

  return card;
}

/** Hauspire's own card, unscaled. */
export function hauspireRateCard(): Partial<Record<RateCategory, number>> {
  const card: Partial<Record<RateCategory, number>> = {};
  for (const rate of HAUSPIRE_RATES) {
    card[rate.category] =
      rate.category === 'design_fee' ? Math.round(rate.rupees * 100) : rupeesToPaise(rate.rupees);
  }
  return card;
}
