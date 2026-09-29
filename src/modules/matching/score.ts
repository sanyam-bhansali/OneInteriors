/**
 * Matching engine — deterministic, rules-based, explainable. `match@2.0.0`,
 * built to docs/CUSTOMER-JOURNEY-PLAN.md §5.
 *
 * Design constraints, in priority order:
 *  1. Every score must be explainable to the customer in plain sentences that
 *     quote their own inputs back. A score they cannot check is marketing.
 *  2. Unmeasurable factors return null. We NEVER redistribute their weight to
 *     manufacture a flattering number — the card says what was measured.
 *  3. The engine is versioned. A stored match keeps the version that produced
 *     it, so an old score is never silently reinterpreted under new weights.
 *  4. No ML until >500 completed projects. Transparency beats accuracy here.
 *
 * ## What changed from 1.x
 *
 * - **Filters stack band × scope × zone.** A customer who chose Premium sees
 *   Premium studios. A studio that takes homes anywhere in Pune passes the
 *   zone filter and is ranked on place instead (§4.4).
 * - **Every priority has its own signal** (signals.ts) instead of re-reading
 *   another factor: budget reads this studio's quote for this home, speed
 *   reads when they can start against possession, design reads services and
 *   depth, material reads carcass, warranty and factory. The customer's
 *   ranking splits 30 points 12 / 9 / 6 / 3.
 * - **Style earns partial credit** between neighbouring styles (style-affinity.ts).
 * - **Similar work** is scope, size and place — "a home in your society".
 * - **Household and needs** meet the studio's specialisms and tagged projects.
 * - **The order is confidence-adjusted**, so a studio measured on half the
 *   factors cannot outrank one measured on all of them on thin evidence. The
 *   displayed number is still normalised over what was measured.
 */

import type { Brief } from '@/modules/brief/types';
import { STYLE_LABELS, zoneOf } from '@/modules/brief/types';
import type { Studio } from '@/modules/studio/types';
import type { StudioRates } from '@/modules/quotation/catalogue';
import { TIERS, type Tier } from '@/modules/quotation/tiers';
import { scopeShare } from '@/modules/quotation/scope-band';
import { selectionOf } from '@/modules/quotation/scope';
import { homeShapeFor } from '@/modules/quotation/first-quote';
import { zonesServed } from '@/modules/studio/coverage';
import {
  dislikedShare,
  householdFit,
  priorities,
  similarWork,
  styleFit,
  timelineFit,
  workingStyle,
  type Signal,
  type SignalContext,
} from './signals';

/**
 * 2.0.0 (29 Sep 2026): the §5 engine — band, scope and zone filters; six
 * factors with their own signals; confidence-adjusted order.
 */
export const ENGINE_VERSION = 'match@2.0.0';

export const WEIGHTS = {
  style: 30,
  priorities: 30,
  similarWork: 15,
  workingStyle: 10,
  household: 10,
  timeline: 5,
} as const;

export type FactorKey = keyof typeof WEIGHTS;

export const FACTOR_LABELS: Record<FactorKey, string> = {
  style: 'Style',
  priorities: 'Your priorities',
  similarWork: 'Work like yours',
  workingStyle: 'Working style',
  household: 'Your household',
  timeline: 'Timing',
};

/** null = not measurable yet. Never coerce to 0 or to the mean. */
export type FactorScores = Record<FactorKey, number | null>;

export interface MatchResult {
  studioId: string;
  /** The displayed score: normalised over what was measured. */
  score: number;
  factorsScored: number;
  factorsTotal: number;
  breakdown: FactorScores;
  reasoning: string[];
  engineVersion: string;
  /** How much of the 100 points could be measured. */
  measuredWeight?: number;
  /** The confidence-adjusted score the order uses. Never displayed. */
  orderScore?: number;
  /** One line of evidence per measured factor, for the card. */
  evidence?: Partial<Record<FactorKey, string>>;
  /** "Can start in January, when you get the keys" — and whether it is late. */
  timeline?: { line: string; late: boolean } | null;
  /** Their projects most like this home, best first. */
  similarProjects?: string[];
  /** Homes they have done in the customer's society and area — checkable facts. */
  local?: { society: number; area: number };
  /** Set when a widening let this studio in — the card says so. */
  widened?: Widening;
}

const FACTOR_COUNT = Object.keys(WEIGHTS).length;

/** Above this share of a studio's work in a rejected style, it is not shown. */
export const MAX_DISLIKED_SHARE = 0.4;

// ── Options ────────────────────────────────────────────────────

export type Widening = 'ANY_ZONE' | 'BAND_UP';

export interface RankOptions {
  /**
   * Let studios through that are not yet ACTIVE and verified, or whose band
   * ops has not confirmed — so the funnel can be walked end to end before the
   * roster is set up. Decided on the server (`showUnverifiedStudios()`, which
   * refuses once the roster is declared real). A caller that passes nothing
   * gets the strict behaviour.
   */
  allowUnverified?: boolean;
  /** The studio's rates, to price this home for the budget priority. */
  ratesFor?: (slug: string) => StudioRates | undefined;
  /** Injected for deterministic tests. */
  today?: Date;
  /** One-tap widenings, offered by name when fewer than three fit. */
  widen?: Widening[];
}

// ── Hard filters ───────────────────────────────────────────────
// These run before scoring. A studio failing one is not ranked low — it is not
// shown at all. A bad match displayed at 41% still costs trust.

export type FilterReason =
  | 'NOT_VERIFIED'
  | 'PAUSED'
  | 'DISLIKED_STYLE'
  | 'OTHER_BAND'
  | 'SCOPE'
  | 'NO_CIVIL'
  | 'ZONE'
  | 'MINIMUM';

/** "Why not the others" — one plain line per reason. */
export const FILTER_REASON_LABELS: Record<FilterReason, string> = {
  NOT_VERIFIED: 'Not yet verified',
  PAUSED: 'Not taking new projects right now',
  DISLIKED_STYLE: 'Much of their work is in a style you ruled out',
  OTHER_BAND: 'Works at a different level from the one you chose',
  SCOPE: 'Does not take this kind of work',
  NO_CIVIL: 'Does not do the civil work a renovation needs',
  ZONE: 'Does not work in your part of Pune',
  MINIMUM: 'Their minimum for this work is above your range',
};

function nextBand(t: Tier): Tier | null {
  return TIERS[TIERS.indexOf(t) + 1] ?? null;
}

/** The first filter a studio fails for this brief, or null when it passes. */
export function failedFilter(brief: Brief, studio: Studio, options: RankOptions = {}): FilterReason | null {
  if (!options.allowUnverified) {
    if (studio.status !== 'ACTIVE') return 'NOT_VERIFIED';
    if (studio.tier === 'UNVERIFIED') return 'NOT_VERIFIED';
  }

  // Truthiness, not `!== null`: a mapper that forgets this field leaves it
  // undefined, and a missing field must fail open, not pause the roster.
  if (studio.pausedAt) return 'PAUSED';

  // Q5 anti-style is an exclusion, not a weight.
  const share = dislikedShare(brief, studio);
  if (share !== null && share > MAX_DISLIKED_SHARE) return 'DISLIKED_STYLE';

  /* The band. A customer who chose Premium sees Premium studios — the owner's
     rule (29 Sep). A studio ops has not placed in a band is in none of them;
     only the pre-launch gate lets it through. */
  if (brief.tier) {
    const allowed = new Set<Tier>([brief.tier]);
    const up = nextBand(brief.tier);
    if (up && options.widen?.includes('BAND_UP')) allowed.add(up);
    if (studio.band) {
      if (!allowed.has(studio.band)) return 'OTHER_BAND';
    } else if (!options.allowUnverified) {
      return 'OTHER_BAND';
    }
  }

  // Scope. A studio that has not said which work it takes fails open here —
  // its portfolio then decides how well it fits, in similar work.
  const profile = studio.matchingProfile;
  if (brief.scope && profile && profile.scopes.length > 0 && !profile.scopes.includes(brief.scope)) return 'SCOPE';
  if (brief.scope === 'RENOVATION' && profile?.civil === 'NONE') return 'NO_CIVIL';

  // Zone — city-wide studios pass and are ranked on place instead (§4.4).
  if (brief.locality && !options.widen?.includes('ANY_ZONE') && !profile?.cityWide) {
    const wanted = zoneOf(brief.locality);
    const served = zonesServed(studio);
    // A studio whose areas are all unknown to us yields no zones: fail open.
    if (wanted && served.length > 0 && !served.includes(wanted)) return 'ZONE';
  }

  // Minimums. The studio's declared minimum for this kind of work, against
  // the top of the customer's range for it — with 25% grace, so thin supply
  // is not filtered on a rounding difference.
  const scope = brief.scope ?? 'FULL_HOME';
  const min = profile?.minimumLakhs[scope];
  if (brief.budgetMaxPaise !== null && min !== undefined) {
    const shape = homeShapeFor(brief);
    const part = scopeShare(shape, selectionOf(brief)) ?? 1;
    if (min * 100_000 * 100 > brief.budgetMaxPaise * part * 1.25) return 'MINIMUM';
  } else if (brief.budgetMaxPaise !== null && studio.minProjectPaise !== null && scope === 'FULL_HOME') {
    // v1's rule, kept for studios without a per-scope minimum.
    if (studio.minProjectPaise > brief.budgetMaxPaise * 2) return 'MINIMUM';
  }

  return null;
}

export function passesHardFilters(brief: Brief, studio: Studio, options: RankOptions = {}): boolean {
  return failedFilter(brief, studio, options) === null;
}

// ── Composition ────────────────────────────────────────────────

/** How strongly an unmeasured factor pulls the ORDER toward the middle. */
const SHRINK = 0.5;
const PRIOR = 50;

function contextOf(options: RankOptions): SignalContext {
  return { today: options.today ?? new Date(), ratesFor: options.ratesFor };
}

export function scoreMatch(brief: Brief, studio: Studio, options: RankOptions = {}): MatchResult | null {
  if (!passesHardFilters(brief, studio, options)) return null;
  const ctx = contextOf(options);

  const timeline = timelineFit(brief, studio, ctx);
  const similar = similarWork(brief, studio);
  const signals: Record<FactorKey, Signal | null> = {
    style: styleFit(brief, studio, ctx),
    priorities: priorities(brief, studio, ctx),
    similarWork: similar,
    workingStyle: workingStyle(brief, studio),
    household: householdFit(brief, studio),
    timeline,
  };

  const breakdown = Object.fromEntries(
    (Object.keys(WEIGHTS) as FactorKey[]).map((k) => [k, signals[k] ? Math.round(signals[k]!.value) : null]),
  ) as FactorScores;

  let weighted = 0;
  let measuredWeight = 0;
  let factorsScored = 0;
  const evidence: Partial<Record<FactorKey, string>> = {};
  for (const key of Object.keys(WEIGHTS) as FactorKey[]) {
    const s = signals[key];
    if (!s) continue;
    weighted += s.value * WEIGHTS[key];
    measuredWeight += WEIGHTS[key];
    factorsScored += 1;
    if (s.evidence) evidence[key] = s.evidence;
  }
  if (measuredWeight === 0) return null;

  // The order shrinks toward the middle by how much could NOT be measured,
  // so a studio scored on half the factors does not outrank one scored on
  // all of them on thin evidence. The displayed score is not shrunk.
  const unmeasured = 100 - measuredWeight;
  const orderScore = (weighted + PRIOR * unmeasured * SHRINK) / (measuredWeight + unmeasured * SHRINK);

  const widened: Widening | undefined =
    options.widen && failedFilter(brief, studio, { ...options, widen: [] }) !== null
      ? failedFilter(brief, studio, { ...options, widen: ['ANY_ZONE'] }) === null
        ? 'ANY_ZONE'
        : 'BAND_UP'
      : undefined;

  return {
    studioId: studio.id,
    score: Math.round(weighted / measuredWeight),
    factorsScored,
    factorsTotal: FACTOR_COUNT,
    breakdown,
    reasoning: buildReasoning(brief, studio, evidence, timeline),
    engineVersion: ENGINE_VERSION,
    measuredWeight,
    // Late starters sort down, never out.
    orderScore: timeline?.late ? orderScore - 5 : orderScore,
    evidence,
    timeline: timeline ? { line: timeline.line, late: timeline.late } : null,
    similarProjects: similar?.projects ?? [],
    local: { society: similar?.sameSociety ?? 0, area: similar?.sameArea ?? 0 },
    ...(widened ? { widened } : {}),
  };
}

const passed = (s: Studio) => s.checks.filter((c) => c.result === 'PASS').length;

export function rankStudios(
  brief: Brief,
  studios: Studio[],
  limit = 9,
  options: RankOptions = {},
): MatchResult[] {
  const byId = new Map(studios.map((s) => [s.id, s]));
  return studios
    .map((s) => scoreMatch(brief, s, options))
    .filter((m): m is MatchResult => m !== null)
    .sort((a, b) => {
      const d = (b.orderScore ?? b.score) - (a.orderScore ?? a.score);
      if (Math.abs(d) > 1e-9) return d;
      // Explicit tie-breaks: measured weight, then checks cleared, then
      // delivery record, then language, then a stable name order.
      const sa = byId.get(a.studioId)!;
      const sb = byId.get(b.studioId)!;
      return (
        (b.measuredWeight ?? 0) - (a.measuredWeight ?? 0) ||
        passed(sb) - passed(sa) ||
        sb.completedProjects - sa.completedProjects ||
        speaks(brief, sb) - speaks(brief, sa) ||
        sa.tradeName.localeCompare(sb.tradeName)
      );
    })
    .slice(0, limit); // never show more than ~6; scarcity of options IS the value
}

function speaks(brief: Brief, s: Studio): number {
  return brief.language && s.matchingProfile?.languages.includes(brief.language) ? 1 : 0;
}

// ── Fewer than three: widenings, and why not the others ────────

export interface WideningOffer {
  kind: Widening;
  /** How many more studios it would add. */
  adds: number;
}

/**
 * The named, one-tap widenings for a thin result (§4.4), with the count each
 * adds. "One band up" is offered only when the caller says the owner has
 * approved it (`allowBandUp`).
 */
export function wideningsFor(
  brief: Brief,
  studios: Studio[],
  options: RankOptions = {},
  allowBandUp = false,
): WideningOffer[] {
  const base = new Set(rankStudios(brief, studios, 99, { ...options, widen: [] }).map((r) => r.studioId));
  const offers: WideningOffer[] = [];
  const kinds: Widening[] = allowBandUp && brief.tier && nextBand(brief.tier) ? ['ANY_ZONE', 'BAND_UP'] : ['ANY_ZONE'];
  for (const kind of kinds) {
    const more = rankStudios(brief, studios, 99, { ...options, widen: [kind] }).filter((r) => !base.has(r.studioId));
    if (more.length > 0) offers.push({ kind, adds: more.length });
  }
  return offers;
}

/** Every studio left out, and the first reason — for "why not the others". */
export function whyNotTheOthers(
  brief: Brief,
  studios: Studio[],
  options: RankOptions = {},
): { studioId: string; name: string; reason: FilterReason }[] {
  const out: { studioId: string; name: string; reason: FilterReason }[] = [];
  for (const s of studios) {
    const reason = failedFilter(brief, s, options);
    // Unverified and paused studios are not the customer's business.
    if (reason && reason !== 'NOT_VERIFIED' && reason !== 'PAUSED') out.push({ studioId: s.id, name: s.tradeName, reason });
  }
  return out;
}

// ── Words ──────────────────────────────────────────────────────

/**
 * Customer-facing explanation. Rules:
 *   - quote the customer's own inputs back
 *   - include the unflattering number where we have one
 *   - never claim a factor we scored null
 */
function buildReasoning(
  brief: Brief,
  studio: Studio,
  evidence: Partial<Record<FactorKey, string>>,
  timeline: { line: string; late: boolean } | null,
): string[] {
  const lines: string[] = [];
  const name = studio.tradeName;

  if (evidence.style && brief.styleLikes.length > 0) {
    lines.push(`You leaned toward ${formatStyles(brief.styleLikes)}. ${evidence.style}.`);
  }

  // Say the true thing, not the flattering one: the filter excludes only
  // above 40%, so "none of their work goes there" is false below that.
  if (brief.styleDislikes.length > 0) {
    const share = dislikedShare(brief, studio);
    if (share === 0) {
      lines.push(`You ruled out ${formatStyles(brief.styleDislikes)}. None of their portfolio goes there.`);
    } else if (share !== null) {
      lines.push(
        `You ruled out ${formatStyles(brief.styleDislikes)}. About ${Math.round(share * 100)}% of their work leans that way.`,
      );
    }
  }

  if (evidence.similarWork) lines.push(`${evidence.similarWork}.`);
  if (evidence.household) lines.push(`${evidence.household}.`);
  if (evidence.priorities) lines.push(`${evidence.priorities}.`);
  if (evidence.workingStyle) lines.push(`${evidence.workingStyle}.`);
  if (timeline) lines.push(`${timeline.line}.`);

  if (studio.completedProjects === 0) {
    lines.push(`${name} has not completed a project with us yet, so we have no delivery record for them.`);
  } else if (studio.avgVarianceDays !== null && studio.completedProjects >= 3) {
    const d = Math.round(studio.avgVarianceDays);
    lines.push(
      d <= 0
        ? `Their last ${studio.completedProjects} projects finished on or ahead of the committed date.`
        : `Their last ${studio.completedProjects} projects averaged ${d} day${d === 1 ? '' : 's'} past the committed date.`,
    );
  } else {
    const n = studio.completedProjects;
    lines.push(`${name} has completed ${n} project${n === 1 ? '' : 's'} with us — not yet enough to state a reliable delivery average.`);
  }

  if (studio.upheldDisputes > 0) {
    const n = studio.upheldDisputes;
    lines.push(`Worth knowing: ${n} dispute${n === 1 ? '' : 's'} against them ${n === 1 ? 'was' : 'were'} upheld.`);
  }

  return lines;
}

/**
 * The one-sentence version, for the card.
 *
 * Composed from the evidence of the factors that scored well — every clause
 * quotes something measured about this studio against this brief, and no
 * clause describes a factor that scored null. Three clauses at most. No
 * number in the sentence: the score lives in one place on the card.
 */
export function matchSummary(brief: Brief, studio: Studio, result: MatchResult): string | null {
  const b = result.breakdown;
  const e = result.evidence ?? {};
  const clauses: string[] = [];
  const add = (key: FactorKey, min: number) => {
    const text = e[key];
    if (b[key] !== null && (b[key] as number) >= min && text) clauses.push(lowerFirst(text));
  };
  // Checkable facts about the customer's own street and household first. A
  // home in their society or area is said whatever the factor scored — it is
  // a fact about this studio, not a judgement.
  const local = (result.local?.society ?? 0) + (result.local?.area ?? 0) > 0;
  add('similarWork', local ? 0 : 40);
  add('household', 50);
  if (b.style !== null && b.style >= 55 && brief.styleLikes.length > 0) {
    clauses.push(`you leaned toward ${formatStyles(brief.styleLikes)} and most of their work sits there`);
  }
  add('priorities', 60);
  add('workingStyle', 60);
  if (result.timeline && !result.timeline.late && b.timeline !== null) {
    clauses.push(lowerFirst(result.timeline.line));
  }
  if (clauses.length === 0) return null;
  return `Because ${clauses.slice(0, 3).join('; ')}.`;
}

// ── Helpers ────────────────────────────────────────────────────

/** Lower-case the first letter to join a clause — but never an acronym ("BWP ply"). */
function lowerFirst(text: string): string {
  return /^[A-Z]{2}/.test(text) ? text : text.charAt(0).toLowerCase() + text.slice(1);
}

function formatStyles(tags: string[]): string {
  const pretty = tags.map((t) => STYLE_LABELS[t as keyof typeof STYLE_LABELS] ?? titleCase(t));
  if (pretty.length <= 1) return pretty[0] ?? '';
  return `${pretty.slice(0, -1).join(', ')} and ${pretty[pretty.length - 1]}`;
}

function titleCase(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
