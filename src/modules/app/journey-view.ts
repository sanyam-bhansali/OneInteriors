/**
 * The first-visit journey as the phone app's API answers it
 * (docs/APP-API-JOURNEY.md): the estimate, the matches with their quotes,
 * every studio, one studio's profile and the comparison.
 *
 * Nothing is worked out here that the website's screens do not also show.
 * Ranking, pricing and the plain words are `journey.ts`; the estimate is
 * `estimate-range.ts`; the compare cells and the "why they suit you" lines
 * below are the ones the website's /app screens import too. This file only
 * shapes them into JSON. Pure, and tested.
 *
 * Only listed studios (verified and taking work, `listedStudios`) appear, and
 * only what a customer page may show: the roster has already been through
 * `publicStudios` in `appData`, and each card below picks its fields by name.
 */

import { filedRatesFor } from '@/data/filed-rates';
import { shownStudioCount } from '@/lib/claims';
import { styleDna } from '@/modules/brief/style-dna';
import { localityLabel, type Brief } from '@/modules/brief/types';
import { scoreMatch, type MatchResult } from '@/modules/matching/score';
import type { StudioRates } from '@/modules/quotation/catalogue';
import type { FirstQuote } from '@/modules/quotation/first-quote';
import { TIERS, type Tier } from '@/modules/quotation/tiers';
import { CHECK_LABELS, describeDelivery, hasDeliveryRecord, type Studio } from '@/modules/studio/types';
import { estimateFor, studiosForTier, type EstimateRange } from './estimate-range';
import { lateness, listedStudios, plainWords, quotesFor, quotesForStudios, topMatches, type AppQuote } from './journey';

/** What every journey answer is worked out from: `appData()`, or a test's own roster. */
export interface JourneyData {
  studios: Studio[];
  rates: Record<string, StudioRates>;
  allowUnverified: boolean;
}

/** A first quote holds for thirty days from the finished brief (the quote screen says "Valid till"). */
export const QUOTE_VALID_DAYS = 30;

export function quoteValidTill(completedAt: string | null, now = new Date()): Date {
  const from = completedAt ? new Date(completedAt) : now;
  return new Date((Number.isNaN(from.getTime()) ? now : from).getTime() + QUOTE_VALID_DAYS * 864e5);
}

const ratesOf = (data: JourneyData) => (slug: string) => data.rates[slug] ?? filedRatesFor(slug);

// ── The pieces the website's screens share ────────────────────

/** Checks passed of those that apply: "14/15 checks". */
export function checkCount(studio: Studio): { passed: number; total: number } {
  const counted = studio.checks.filter((c) => c.result !== 'NOT_APPLICABLE');
  return { passed: counted.filter((c) => c.result === 'PASS').length, total: counted.length };
}

/** "Why they suit you": the customer's first priority first, then the rest, at most `n`. */
export function matchReasons(match: MatchResult, n = 3): string[] {
  return [match.topPriority, ...match.reasoning.filter((r) => r !== match.topPriority)]
    .filter((r): r is string => Boolean(r))
    .slice(0, n);
}

/** The first spec part of a " · " spec, e.g. "18mm BWP"; null when the quote has no wardrobe. */
export function wardrobeBoard(q: AppQuote): string | null {
  return q.quote.lines.find((l) => /wardrobe/i.test(l.label))?.spec.split(' · ')[0]?.replace(/ carcass$/, '') ?? null;
}

/** A part of the kitchen's spec, e.g. its shutter or its counter; null when the quote does not say. */
export function kitchenPart(q: AppQuote, part: RegExp): string | null {
  for (const l of q.quote.lines.filter((x) => x.room === 'KITCHEN')) {
    const hit = l.spec.split(' · ').find((p) => part.test(p));
    if (hit) return hit;
  }
  return null;
}

export const COUNTER = /quartz|granite|counter/i;
export const SHUTTER = /shutter/i;

/** Median of the studio's finished homes, in weeks; null without a record. */
export function handoverWeeks(studio: Studio | undefined): number | null {
  const days = (studio?.portfolio ?? [])
    .map((p) => p.durationDays)
    .filter((d): d is number => typeof d === 'number' && d > 0)
    .sort((a, b) => a - b);
  return days.length === 0 ? null : Math.round(days[Math.floor(days.length / 2)]! / 7);
}

// ── The answers ───────────────────────────────────────────────

export interface ApiQuote {
  totalPaise: number;
  beforeGstPaise: number;
  gstPaise: number;
  /** The honest band either side of the total, until the studio measures. */
  lowPaise: number;
  highPaise: number;
  validTill: string;
  lines: { room: string; item: string; spec: string | null; size: string; amountPaise: number }[];
}

export interface StudioCard {
  slug: string;
  name: string;
  area: string | null;
  /** The year they started, from the years they have practised. */
  since: number | null;
  team: number | null;
  /** 0–100 on this brief; null when there is no finished brief to score. */
  score: number | null;
  reasons: string[];
  photo: string | null;
  /** Verified reviews only. None exist yet, so always null for now. */
  rating: { stars: number; count: number } | null;
  /** Homes handed over through One Interiors. */
  homes: number;
  checks: { passed: number; total: number };
  lateness: string | null;
  /** Their own band, when known — for the app's client-side filters. */
  band: 'essential' | 'premium' | 'luxury' | null;
  localities: string[];
}

export type ApiMatch = StudioCard & { score: number; quote: ApiQuote };

const tierKey = (t: Tier) => t.toLowerCase() as 'essential' | 'premium' | 'luxury';

function cover(studio: Studio): string | null {
  return studio.portfolio.find((p) => p.images.length > 0)?.images[0] ?? null;
}

export function studioCard(studio: Studio, match: MatchResult | null, now = new Date()): StudioCard {
  return {
    slug: studio.slug,
    name: studio.tradeName,
    area: studio.localities[0] ? localityLabel(studio.localities[0]) : null,
    since: studio.yearsActive ? now.getUTCFullYear() - studio.yearsActive : null,
    team: studio.teamSize,
    score: match ? Math.round(match.score) : null,
    reasons: match ? matchReasons(match) : [],
    photo: cover(studio),
    rating: null,
    homes: studio.completedProjects,
    checks: checkCount(studio),
    lateness: lateness(studio),
    band: studio.band ? tierKey(studio.band) : null,
    localities: studio.localities,
  };
}

export function apiQuote(quote: FirstQuote, validTill: Date): ApiQuote {
  return {
    totalPaise: quote.totalPaise,
    beforeGstPaise: quote.totalPaise - quote.gstPaise,
    gstPaise: quote.gstPaise,
    lowPaise: quote.lowPaise,
    highPaise: quote.highPaise,
    validTill: validTill.toISOString(),
    lines: quote.rooms.flatMap((r) =>
      r.lines.map((l) => ({ room: r.label, item: l.label, spec: l.spec || null, size: l.size, amountPaise: l.amountPaise })),
    ),
  };
}

/** The live estimate on the quiz screens: the same call the website's question pages make. */
export function journeyEstimate(brief: Brief, data: JourneyData): EstimateRange | null {
  return estimateFor(brief, studiosForTier(listedStudios(data), brief.tier), data.rates, filedRatesFor);
}

export interface MatchesView {
  studioCount: number;
  tiers: Record<'essential' | 'premium' | 'luxury', ApiMatch[]>;
  tier: 'essential' | 'premium' | 'luxury';
  style: { primary: { tag: string; label: string; pct: number }; secondary: { tag: string; label: string; pct: number } | null } | null;
}

/**
 * The matches for each band — the website's tier switch, worked out for all
 * three at once so the app's switch never waits. Empty until the brief is
 * finished (`completedAt`), as on the website.
 */
export function journeyMatches(brief: Brief, data: JourneyData, now = new Date()): MatchesView {
  const validTill = quoteValidTill(brief.completedAt ?? null, now);
  const forTier = (tier: Tier): ApiMatch[] => {
    if (!brief.completedAt) return [];
    const b = { ...brief, tier };
    const matched = topMatches(b, data.studios, data.rates, filedRatesFor, data.allowUnverified);
    const quotes = new Map(quotesFor(b, matched, data.rates, filedRatesFor).map((q) => [q.slug, q.quote]));
    return matched.flatMap(({ match, studio }) => {
      const quote = quotes.get(studio.slug);
      return quote ? [{ ...studioCard(studio, match, now), score: Math.round(match.score), quote: apiQuote(quote, validTill) }] : [];
    });
  };
  const dna = styleDna(brief.styleLikes);
  const share = (s: { tag: string; label: string; pct: number } | undefined) => (s ? { tag: s.tag, label: s.label, pct: s.pct } : null);
  return {
    studioCount: shownStudioCount(listedStudios(data).length),
    tiers: { essential: forTier('ESSENTIAL'), premium: forTier('PREMIUM'), luxury: forTier('LUXURY') },
    tier: tierKey(brief.tier && (TIERS as readonly string[]).includes(brief.tier) ? brief.tier : 'PREMIUM'),
    style: dna ? { primary: share(dna.shares[0])!, secondary: share(dna.shares[1]) } : null,
  };
}

/** Every listed studio, best match for this brief first (All studios). */
export function journeyStudios(brief: Brief, data: JourneyData, now = new Date()): StudioCard[] {
  const ratesFor = ratesOf(data);
  return listedStudios(data)
    .map((s) => studioCard(s, brief.completedAt ? scoreMatch(brief, s, { allowUnverified: data.allowUnverified, ratesFor }) : null, now))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.name.localeCompare(b.name));
}

export interface StudioProfile {
  slug: string;
  name: string;
  area: string | null;
  since: number | null;
  team: number | null;
  photo: string | null;
  about: string | null;
  verified: boolean;
  portfolio: { photo: string; caption: string | null; isRender: boolean }[];
  checks: { label: string; passed: boolean; source: string | null; checkedAt: string | null }[];
  delivery: { completed: number; avgLateDays: number | null; line: string | null };
  reviews: { name: string; stars: number; text: string; at: string }[];
}

/** One listed studio's profile, or null when it is not listed (paused, unverified, or no such studio). */
export function studioProfile(slug: string, data: JourneyData, now = new Date()): StudioProfile | null {
  const s = listedStudios(data).find((x) => x.slug === slug);
  if (!s) return null;
  const card = studioCard(s, null, now);
  const homes = [...s.portfolio].sort((a, b) => (b.completedOn ?? '').localeCompare(a.completedOn ?? ''));
  return {
    slug: s.slug,
    name: s.tradeName,
    area: card.area,
    since: card.since,
    team: card.team,
    photo: card.photo,
    about: s.about.trim() || null,
    verified: s.tier === 'VERIFIED' || s.tier === 'PROVEN',
    portfolio: homes.flatMap((p) => p.images.map((photo) => ({ photo, caption: p.title || null, isRender: p.isRender }))),
    checks: s.checks
      .filter((c) => c.result !== 'NOT_APPLICABLE')
      .map((c) => {
        const passed = c.result === 'PASS';
        return { label: CHECK_LABELS[c.type], passed, source: passed ? c.source : null, checkedAt: passed ? c.checkedAt : null };
      }),
    delivery: {
      completed: s.completedProjects,
      avgLateDays: hasDeliveryRecord(s) ? Math.round(s.avgVarianceDays as number) : null,
      line: describeDelivery(s),
    },
    // Only customers whose project went through One Interiors can review, after handover. None yet.
    reviews: [],
  };
}

export interface CompareView {
  plainWords: string[];
  columns: {
    slug: string;
    name: string;
    totalPaise: number;
    board: string | null;
    shutter: string | null;
    counter: string | null;
    weeks: number | null;
    lateness: string | null;
    checks: string;
  }[];
}

/**
 * Side by side, for the studios named (in that order), or the brief's own
 * matches when none are. Unlisted slugs are dropped, never priced.
 */
export function journeyCompare(brief: Brief, slugs: string[], data: JourneyData): CompareView {
  const listed = listedStudios(data);
  const studios = slugs.length
    ? slugs.map((slug) => listed.find((s) => s.slug === slug)).filter((s): s is Studio => Boolean(s))
    : topMatches(brief, data.studios, data.rates, filedRatesFor, data.allowUnverified).map((m) => m.studio);
  const quotes = quotesForStudios(brief, studios, data.rates, filedRatesFor);
  const bySlug = new Map(studios.map((s) => [s.slug, s]));
  return {
    plainWords: plainWords(quotes),
    columns: quotes.map((q) => {
      const s = bySlug.get(q.slug)!;
      const c = checkCount(s);
      return {
        slug: q.slug,
        name: q.name,
        totalPaise: q.quote.totalPaise,
        board: wardrobeBoard(q),
        shutter: kitchenPart(q, SHUTTER),
        counter: kitchenPart(q, COUNTER),
        weeks: handoverWeeks(s),
        lateness: lateness(s),
        checks: `${c.passed}/${c.total}`,
      };
    }),
  };
}
