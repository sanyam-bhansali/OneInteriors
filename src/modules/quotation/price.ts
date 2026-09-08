/**
 * Pricing an estimate against one studio's rate card.
 *
 * ## The governance rule, in code
 *
 * **Every rupee here comes from the studio's own rate card.** There is no
 * platform rate, no default, no fallback to a market figure and no seeded
 * catalogue. A studio that has not entered a rate does not get quoted, and
 * `priceEstimate` returns a refusal rather than a number.
 *
 * That is not fussiness. Seeding rates from any one studio — and in our case
 * the only large catalogue available belongs to a business the founders own —
 * would be setting market prices in favour of ourselves, and pricing is where a
 * studio's margin lives. See `docs/FUTURE-SCOPE.md` §3 and
 * `docs/QUOTATION-BUILDER.md` §2. This file is where that promise is either
 * kept or quietly broken, so it is kept here and nowhere else is allowed to
 * supply a rate.
 *
 * Pure. Money is integer paise throughout.
 */

import { applyBps, type Paise } from '@/lib/money';
import { CATEGORY, missingCoreRates, type RateCategory } from './categories';
import type { Estimate } from './estimate';

/** A studio's rates, in paise, per the unit each category declares. */
export type RateCard = Partial<Record<RateCategory, Paise>>;

export interface QuoteLine {
  category: RateCategory;
  label: string;
  quantity: number;
  unit: string;
  ratePaise: Paise;
  amountPaise: Paise;
  assumption: string;
}

export interface PricedQuote {
  lines: QuoteLine[];
  subtotalPaise: Paise;
  designFeePaise: Paise;
  gstPaise: Paise;
  totalPaise: Paise;
  /** The honest range. Both ends are shown; the midpoint never appears alone. */
  lowPaise: Paise;
  highPaise: Paise;
  variancePct: number;
  assumptions: string[];
  /** Categories in scope that this studio has no rate for. */
  notPriced: RateCategory[];
}

export type PriceResult =
  | { ok: true; quote: PricedQuote }
  | { ok: false; reason: 'incomplete_rate_card'; missing: RateCategory[] };

/**
 * GST on interior work.
 *
 * 18% is the headline and it is what we show, but composite supply versus
 * works contract changes the treatment and this has NOT been confirmed by a
 * CA yet — it is the open item in `WHAT-I-NEED-FROM-YOU.md` §4.1. Until it is,
 * every quote says the tax is indicative. Getting this wrong on a document
 * someone signs is a different order of problem from getting a quantity wrong.
 */
export const GST_BPS = 1800;

export function priceEstimate(estimate: Estimate, rates: RateCard): PriceResult {
  // Only categories this brief actually needs. A studio without a flooring
  // rate is perfectly quotable for a job with no flooring in it.
  const needed = estimate.quantities.map((q) => q.category);
  const missing = missingCoreRates(rates).filter((c) => needed.includes(c));

  if (missing.length > 0) {
    return { ok: false, reason: 'incomplete_rate_card', missing };
  }

  const lines: QuoteLine[] = [];
  const notPriced: RateCategory[] = [];

  for (const quantity of estimate.quantities) {
    const rate = rates[quantity.category];
    if (!rate || rate <= 0) {
      // Optional category, no rate. Recorded and shown rather than silently
      // dropped — a total that quietly excludes plumbing is how a customer
      // ends up feeling misled by a number that was arithmetically correct.
      notPriced.push(quantity.category);
      continue;
    }

    lines.push({
      category: quantity.category,
      label: CATEGORY[quantity.category].label,
      quantity: quantity.quantity,
      unit: quantity.unit,
      ratePaise: rate,
      amountPaise: Math.round(rate * quantity.quantity),
      assumption: quantity.assumption,
    });
  }

  const subtotalPaise = lines.reduce((sum, l) => sum + l.amountPaise, 0);

  // A design fee is a percentage of the work, stored as basis points.
  const designFeeBps = rates.design_fee ?? 0;
  const designFeePaise = designFeeBps > 0 ? applyBps(subtotalPaise, designFeeBps) : 0;

  const beforeTax = subtotalPaise + designFeePaise;
  const gstPaise = applyBps(beforeTax, GST_BPS);
  const totalPaise = beforeTax + gstPaise;

  const assumptions = [...estimate.assumptions];
  if (notPriced.length > 0) {
    assumptions.push(
      `Not included: ${notPriced
        .map((c) => CATEGORY[c].label.toLowerCase())
        .join(', ')}. This studio has not published a rate for these, so they are not in the total.`,
    );
  }
  assumptions.push(
    'GST is shown at 18%. The exact treatment of interior work depends on how the contract is structured and will be confirmed on your firm quote.',
  );

  return {
    ok: true,
    quote: {
      lines,
      subtotalPaise,
      designFeePaise,
      gstPaise,
      totalPaise,
      lowPaise: Math.round(totalPaise * (1 - estimate.variancePct)),
      highPaise: Math.round(totalPaise * (1 + estimate.variancePct)),
      variancePct: estimate.variancePct,
      assumptions,
      notPriced,
    },
  };
}

/**
 * The comparison between two or more priced quotes.
 *
 * The reason the whole fixed-category scheme exists: a customer looking at
 * ₹8.4L against ₹9.1L learns nothing, but "their kitchen is ₹42,000 more and
 * their false ceiling is ₹18,000 less" is a decision they can actually make.
 */
export interface CategoryComparison {
  category: RateCategory;
  label: string;
  /** Amount per studio, keyed by studio id. Null where not priced. */
  amounts: Record<string, Paise | null>;
  lowestStudioId: string | null;
  highestStudioId: string | null;
  /** Spread between the cheapest and dearest, in paise. */
  spreadPaise: Paise;
}

export function compareQuotes(
  quotes: { studioId: string; quote: PricedQuote }[],
): CategoryComparison[] {
  const categories = new Set<RateCategory>();
  for (const q of quotes) for (const l of q.quote.lines) categories.add(l.category);

  const out: CategoryComparison[] = [];

  for (const category of categories) {
    const amounts: Record<string, Paise | null> = {};
    for (const { studioId, quote } of quotes) {
      const line = quote.lines.find((l) => l.category === category);
      amounts[studioId] = line ? line.amountPaise : null;
    }

    // Only studios that actually priced it can be compared. Treating an
    // unpriced category as zero would crown whoever left it blank.
    const priced = Object.entries(amounts).filter(
      (entry): entry is [string, Paise] => entry[1] !== null,
    );

    if (priced.length === 0) continue;

    const sorted = [...priced].sort((a, b) => a[1] - b[1]);
    const lowest = sorted[0];
    const highest = sorted[sorted.length - 1];

    out.push({
      category,
      label: CATEGORY[category].label,
      amounts,
      // With one studio there is no cheapest — saying so would be a
      // comparison the data cannot support.
      lowestStudioId: priced.length > 1 ? lowest[0] : null,
      highestStudioId: priced.length > 1 ? highest[0] : null,
      spreadPaise: highest[1] - lowest[1],
    });
  }

  // Biggest difference first — that is where the decision actually is.
  return out.sort((a, b) => b.spreadPaise - a.spreadPaise);
}

/**
 * Do these quotes overlap once the variance bands are taken into account?
 *
 * If they do, the difference is not yet real, and saying "this one is cheaper"
 * would be reading noise as signal. The compare view uses this to decide
 * whether to draw a conclusion or to say plainly that it cannot.
 */
export function bandsOverlap(a: PricedQuote, b: PricedQuote): boolean {
  return a.lowPaise <= b.highPaise && b.lowPaise <= a.highPaise;
}
