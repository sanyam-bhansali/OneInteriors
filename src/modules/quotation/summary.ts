/**
 * The written summary shown above a comparison.
 *
 * ## Why this is written by arithmetic, not by a model
 *
 * The agent that drafts studio profiles is checked against facts before anyone
 * reads it. This is different: it is us telling a customer what a set of
 * numbers means, at the moment they are deciding how to spend several lakh
 * rupees. There is no version of that where "the model usually gets it right"
 * is good enough, and a mistake here is not a bad sentence — it is us pointing
 * someone at the wrong studio.
 *
 * So the summary is generated from the comparison itself, deterministically.
 * Every sentence it can produce is in this file and can be read, argued with
 * and tested. It is duller than a model would write. That is the correct
 * trade for this particular screen.
 *
 * ## The rule it exists to enforce
 *
 * **When the bands overlap, there is no cheaper studio.** An indicative quote
 * carries a ±15% band at best. Two quotes 4% apart are the same quote, and
 * saying otherwise reads noise as signal — which is how a customer ends up
 * choosing on a difference that will not survive the first site visit.
 */

import { formatINRCompact } from '@/lib/money';
import type { Paise } from '@/lib/money';
import type { PricedQuote, CategoryComparison } from './price';

export interface QuoteForSummary {
  studioId: string;
  studioName: string;
  quote: PricedQuote;
}

export interface Summary {
  /** The one-line read. Never names a winner the numbers cannot support. */
  headline: string;
  /** Two to four observations, most decision-relevant first. */
  points: string[];
  /** What the customer should ask on the call. The genuinely useful part. */
  questions: string[];
}

export function summarise(
  quotes: QuoteForSummary[],
  comparison: CategoryComparison[],
): Summary {
  if (quotes.length === 0) {
    return {
      headline: 'No quotes to compare yet.',
      points: [],
      questions: [],
    };
  }

  if (quotes.length === 1) {
    const only = quotes[0];
    return {
      headline: `One quote so far — ${only.studioName} at ${range(only.quote)}.`,
      points: [
        'A single quote tells you what one studio charges, not whether it is a fair price. Add at least one more before you decide.',
        ...assumptionPoints(only.quote),
      ],
      questions: baseQuestions(only.quote),
    };
  }

  const sorted = [...quotes].sort((a, b) => a.quote.totalPaise - b.quote.totalPaise);
  const cheapest = sorted[0];
  const dearest = sorted[sorted.length - 1];

  // The load-bearing check. Overlapping bands mean the difference is not real.
  const separated = cheapest.quote.highPaise < dearest.quote.lowPaise;
  const gap = dearest.quote.totalPaise - cheapest.quote.totalPaise;
  const gapShare = gap / cheapest.quote.totalPaise;

  const points: string[] = [];
  const headline = separated
    ? `${cheapest.studioName} is genuinely the cheaper quote — by about ${formatINRCompact(gap)}, and the ranges do not overlap.`
    : `These quotes are the same price, within the accuracy either of them can claim.`;

  if (!separated) {
    points.push(
      `The spread between them is ${Math.round(gapShare * 100)}%, and every quote here carries a band of ±${Math.round(
        cheapest.quote.variancePct * 100,
      )}%. That means the difference is inside the margin of error — it is not a reason to pick one over the other.`,
    );
    points.push(
      'Choose on the work, the way they communicate and what the expert tells you about their delivery record. The price will separate after a site visit, not before.',
    );
  } else {
    points.push(
      `${dearest.studioName} is around ${Math.round(gapShare * 100)}% more. That is a real difference, and it is worth understanding what it buys before treating it as a reason to say no.`,
    );
  }

  // The biggest single category difference is usually where the decision is.
  const biggest = comparison.find((c) => c.spreadPaise > 0);
  if (biggest && biggest.lowestStudioId && biggest.highestStudioId) {
    const low = nameOf(quotes, biggest.lowestStudioId);
    const high = nameOf(quotes, biggest.highestStudioId);
    points.push(
      `The largest single gap is ${biggest.label.toLowerCase()}: ${high} is ${formatINRCompact(
        biggest.spreadPaise,
      )} more than ${low}. On an indicative quote that usually means a different material assumption rather than a different margin.`,
    );
  }

  // Anything a studio did not price at all matters more than a rate difference.
  const gaps = quotes.filter((q) => q.quote.notPriced.length > 0);
  for (const entry of gaps) {
    points.push(
      `${entry.studioName} has not priced ${entry.quote.notPriced.length} item${
        entry.quote.notPriced.length === 1 ? '' : 's'
      } that the others may have included, so their total is not covering the same work. Compare the lines, not just the totals.`,
    );
  }

  return { headline, points, questions: baseQuestions(cheapest.quote) };
}

function range(quote: PricedQuote): string {
  return `${formatINRCompact(quote.lowPaise)}–${formatINRCompact(quote.highPaise)}`;
}

function nameOf(quotes: QuoteForSummary[], studioId: string): string {
  return quotes.find((q) => q.studioId === studioId)?.studioName ?? 'That studio';
}

function assumptionPoints(quote: PricedQuote): string[] {
  const points: string[] = [];
  if (quote.variancePct > 0.2) {
    points.push(
      `This quote carries a wide band (±${Math.round(
        quote.variancePct * 100,
      )}%) because your brief is missing something we would normally use. Filling that in will tighten it more than anything a studio can do.`,
    );
  }
  return points;
}

/**
 * The questions worth asking on the call.
 *
 * This is the part of the summary that actually changes an outcome. A customer
 * who asks these gets a better answer from every studio, including the ones we
 * did not recommend.
 */
function baseQuestions(quote: PricedQuote): string[] {
  const questions = [
    'What is not in this number? Ask each studio to name the three things most likely to be added later.',
    'What would change the price after you have seen the flat, and by how much?',
  ];

  if (quote.notPriced.length > 0) {
    questions.push(
      'Two of these quotes do not cover the same scope. Ask the studio that left an item out whether they do that work at all.',
    );
  }

  questions.push(
    'What is your committed handover date, and what happens if you miss it?',
  );

  return questions;
}

/**
 * The single number a customer remembers.
 *
 * Returned as a range and never as a midpoint, because a midpoint is what
 * people quote back at you six weeks later as though it were a price.
 */
export function headlineRange(quote: PricedQuote): { low: Paise; high: Paise } {
  return { low: quote.lowPaise, high: quote.highPaise };
}
