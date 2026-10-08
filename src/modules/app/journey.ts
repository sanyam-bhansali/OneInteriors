/**
 * The app's journey, as pure functions (the owner's v1 screens, 8 Oct 2026):
 * the three studios a brief matches, each priced on the same lines, and the
 * comparison said in plain words.
 *
 * Nothing new is decided here. Matching is `rankStudios`, pricing is
 * `buildFirstQuote` through the canvas helper, so the app and the website can
 * never disagree about who fits or what anything costs.
 */

import { rankStudios, type MatchResult } from '@/modules/matching/score';
import { homeShapeFor, type FirstQuote } from '@/modules/quotation/first-quote';
import { draftFrom, priceDraft } from '@/modules/quotation/canvas';
import { kitchenFor } from '@/modules/quotation/price-all';
import type { StudioRates } from '@/modules/quotation/catalogue';
import { formatINRCompact } from '@/lib/money';
import type { Brief } from '@/modules/brief/types';
import type { Studio } from '@/modules/studio/types';

export const APP_MATCHES = 3;

export interface AppMatch {
  match: MatchResult;
  studio: Studio;
}

export interface AppQuote {
  slug: string;
  name: string;
  quote: FirstQuote;
}

function ratesOf(rates: Record<string, StudioRates>, fallback: (slug: string) => StudioRates) {
  return (slug: string) => rates[slug] ?? fallback(slug);
}

/** The top studios for this brief, best first — the same ranking as /match. */
export function topMatches(
  brief: Brief,
  studios: Studio[],
  rates: Record<string, StudioRates>,
  fallback: (slug: string) => StudioRates,
  allowUnverified: boolean,
  n = APP_MATCHES,
): AppMatch[] {
  const byId = new Map(studios.map((s) => [s.id, s]));
  return rankStudios(brief, studios, n, { allowUnverified, ratesFor: ratesOf(rates, fallback) })
    .map((match) => ({ match, studio: byId.get(match.studioId)! }))
    .filter((m) => Boolean(m.studio));
}

/** Each matched studio's quote for this brief, in match order (not price order). */
export function quotesFor(
  brief: Brief,
  matched: AppMatch[],
  rates: Record<string, StudioRates>,
  fallback: (slug: string) => StudioRates,
): AppQuote[] {
  const shape = homeShapeFor(brief);
  const priced = priceDraft({
    shape,
    plan: kitchenFor(shape, shape.plan, null),
    draft: draftFrom(shape),
    studios: matched.map((m) => ({
      slug: m.studio.slug,
      name: m.studio.tradeName,
      curatedDiscountPct: m.studio.matchingProfile?.curatedDiscountPct ?? null,
    })),
    ratesFor: ratesOf(rates, fallback),
  });
  const bySlug = new Map(priced.map((p) => [p.slug, p]));
  return matched.map((m) => bySlug.get(m.studio.slug)).filter((q): q is AppQuote => Boolean(q));
}

/**
 * "In plain words": who is cheaper, by how much, and where most of the gap
 * sits — every sentence a fact read off the quotes, never an opinion.
 */
export function plainWords(quotes: AppQuote[]): string[] {
  if (quotes.length < 2) return [];
  const byTotal = [...quotes].sort((a, b) => a.quote.totalPaise - b.quote.totalPaise);
  const low = byTotal[0]!;
  const high = byTotal[byTotal.length - 1]!;
  const gap = high.quote.totalPaise - low.quote.totalPaise;
  if (gap <= 0) {
    return [`All ${quotes.length} come to the same total, ${formatINRCompact(low.quote.totalPaise)}. The difference is in the materials below.`];
  }

  const rooms = new Map(low.quote.rooms.map((r) => [r.room, r]));
  let biggest: { label: string; diff: number } | null = null;
  for (const r of high.quote.rooms) {
    const other = rooms.get(r.room);
    if (!other) continue;
    const diff = r.subtotalPaise - other.subtotalPaise;
    if (!biggest || diff > biggest.diff) biggest = { label: r.label, diff };
  }

  const out = [
    `${low.name} is ${formatINRCompact(gap)} cheaper than ${high.name}.` +
      (biggest && biggest.diff > 0
        ? ` The biggest share of that is the ${biggest.label.toLowerCase()}: ${formatINRCompact(biggest.diff)} apart.`
        : ''),
  ];

  const middle = byTotal.slice(1, -1);
  for (const m of middle) {
    out.push(
      `${m.name} sits between them, ${formatINRCompact(m.quote.totalPaise - low.quote.totalPaise)} above ${low.name}.`,
    );
  }

  const specs = (q: AppQuote, code: string) => q.quote.lines.find((l) => l.code === code)?.spec ?? null;
  const wardrobe = low.quote.lines.find((l) => /wardrobe/i.test(l.label))?.code;
  if (wardrobe) {
    const a = specs(low, wardrobe);
    const b = specs(high, wardrobe);
    if (a && b && a !== b) {
      out.push(`Their wardrobes are not the same thing: ${low.name} quotes ${a}; ${high.name} quotes ${b}.`);
    }
  }
  return out;
}

/** "Usually 4 days late", "Usually on time", or null when we have no record. */
export function lateness(studio: Studio): string | null {
  const d = studio.avgVarianceDays;
  if (d === null || studio.completedProjects === 0) return null;
  const days = Math.round(d);
  if (days <= 0) return days < 0 ? `Usually ${Math.abs(days)} day${days === -1 ? '' : 's'} early` : 'Usually on time';
  return `Usually ${days} day${days === 1 ? '' : 's'} late`;
}
