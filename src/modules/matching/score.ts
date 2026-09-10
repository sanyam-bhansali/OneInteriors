/**
 * Matching engine v1 — deterministic, rules-based, explainable.
 *
 * Design constraints, in priority order:
 *  1. Every score must be explainable to the customer in plain sentences that
 *     quote their own inputs back. A score they cannot check is marketing, and
 *     they detect it within two sessions.
 *  2. Unmeasurable factors return null. We NEVER redistribute their weight to
 *     manufacture a flattering number — the UI says "matched on 4 of 6 factors".
 *  3. The engine is versioned. A stored match keeps the version that produced
 *     it, so an old score is never silently reinterpreted under new weights.
 *  4. No ML until >500 completed projects. Transparency beats accuracy here.
 */

import type { Brief, PriorityFactor } from '@/modules/brief/types';
import { STYLE_LABELS } from '@/modules/brief/types';
import type { Studio } from '@/modules/studio/types';
import { MIN_PROJECTS_FOR_RELIABILITY } from '@/modules/studio/types';

export const ENGINE_VERSION = 'match@1.0.0';

export const WEIGHTS = {
  styleOverlap: 25,
  budgetFit: 20,
  workingStyle: 20,
  deliveryReliability: 15,
  scopeExperience: 10,
  priorityAlignment: 10,
} as const;

export type FactorKey = keyof typeof WEIGHTS;

export const FACTOR_LABELS: Record<FactorKey, string> = {
  styleOverlap: 'Style overlap',
  budgetFit: 'Budget fit',
  workingStyle: 'Working style',
  deliveryReliability: 'Delivery reliability',
  scopeExperience: 'Scope experience',
  priorityAlignment: 'Your top priority',
};

/** null = not measurable yet. Never coerce to 0 or to the mean. */
export type FactorScores = Record<FactorKey, number | null>;

export interface MatchResult {
  studioId: string;
  score: number;
  factorsScored: number;
  factorsTotal: number;
  breakdown: FactorScores;
  reasoning: string[];
  engineVersion: string;
}

const FACTOR_COUNT = Object.keys(WEIGHTS).length;

/** Above this share of a studio's work in a rejected style, it is not shown. */
export const MAX_DISLIKED_SHARE = 0.4;

/**
 * Share of a studio's tagged work sitting in a style the customer ruled out.
 * null when there is nothing to measure. Used both to exclude and to phrase the
 * reasoning honestly — the same number, so the two can never disagree.
 */
function dislikedShare(brief: Brief, studio: Studio): number | null {
  if (brief.styleDislikes.length === 0) return null;
  const tags = studio.portfolio.flatMap((p) => p.styleTags);
  if (tags.length === 0) return null;
  const disliked = new Set<string>(brief.styleDislikes);
  return tags.filter((t) => disliked.has(t)).length / tags.length;
}

// ── Hard filters ───────────────────────────────────────────────
// These run before scoring. A studio failing one is not ranked low — it is not
// shown at all. A bad match displayed at 41% still costs trust.

export function passesHardFilters(brief: Brief, studio: Studio): boolean {
  if (studio.status !== 'ACTIVE') return false;
  if (studio.tier === 'UNVERIFIED') return false;

  // Q5 anti-style is an exclusion, not a weight.
  const share = dislikedShare(brief, studio);
  if (share !== null && share > MAX_DISLIKED_SHARE) return false;

  // Budget: exclude only on a hard miss, so we don't over-filter thin supply.
  if (brief.budgetMaxPaise !== null && studio.minProjectPaise !== null) {
    if (studio.minProjectPaise > brief.budgetMaxPaise * 2) return false;
  }

  if (brief.locality && studio.localities.length > 0) {
    if (!studio.localities.includes(brief.locality)) return false;
  }

  return true;
}

// ── Factors ────────────────────────────────────────────────────

function scoreStyleOverlap(brief: Brief, studio: Studio): number | null {
  if (brief.styleLikes.length === 0) return null;
  const tags = studio.portfolio.flatMap((p) => p.styleTags);
  if (tags.length === 0) return null;

  const liked = new Set<string>(brief.styleLikes);
  const hits = tags.filter((t) => liked.has(t)).length;

  // Share of the studio's body of work sitting in the customer's direction.
  // Divided by 0.6 so a studio need not be 100% one style to score full marks.
  return clamp((hits / tags.length / 0.6) * 100);
}

function scoreBudgetFit(brief: Brief, studio: Studio): number | null {
  if (brief.budgetMinPaise === null || brief.budgetMaxPaise === null) return null;

  // Prefer the studio's ACTUAL delivered values over their claimed range.
  // Claimed ranges are aspirational; delivered values are not.
  const delivered = studio.portfolio
    .map((p) => p.valuePaise)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);

  let lo: number;
  let hi: number;

  if (delivered.length >= 3) {
    lo = delivered[Math.floor(delivered.length * 0.1)];
    hi = delivered[Math.min(delivered.length - 1, Math.floor(delivered.length * 0.9))];
  } else if (studio.minProjectPaise !== null && studio.maxProjectPaise !== null) {
    lo = studio.minProjectPaise;
    hi = studio.maxProjectPaise;
  } else {
    return null;
  }

  const overlap = rangeOverlap(brief.budgetMinPaise, brief.budgetMaxPaise, lo, hi);
  const width = brief.budgetMaxPaise - brief.budgetMinPaise;
  if (width <= 0) return overlap > 0 ? 100 : 0;

  return clamp((overlap / width) * 100);
}

function scoreWorkingStyle(brief: Brief, studio: Studio): number | null {
  if (!brief.involvement) return null;
  if (studio.autonomyProfile === null || studio.communicationRating === null) return null;

  const want =
    brief.involvement === 'DECIDE_FOR_ME' ? 0 : brief.involvement === 'COLLABORATE' ? 0.5 : 1;

  const fit = 1 - Math.abs(want - studio.autonomyProfile);
  const comms = (studio.communicationRating - 1) / 4;

  return clamp((fit * 0.6 + comms * 0.4) * 100);
}

function scoreDeliveryReliability(studio: Studio): number | null {
  // The cold-start factor. Null until the studio has run projects through OUR
  // monitored milestone plan — exactly the data that makes Tier 3 uncopiable,
  // data we will not have on day one. Say so rather than invent it.
  if (studio.completedProjects < MIN_PROJECTS_FOR_RELIABILITY) return null;
  if (studio.avgVarianceDays === null) return null;

  // On time = 100. 30+ days late = 0. Early delivery earns no extra credit.
  const variance = Math.max(0, studio.avgVarianceDays);
  const base = clamp(100 - (variance / 30) * 100);

  return clamp(base - studio.upheldDisputes * 15);
}

function scoreScopeExperience(brief: Brief, studio: Studio): number | null {
  if (!brief.scope && !brief.propertyType) return null;
  if (studio.portfolio.length === 0) return null;

  const comparable = studio.portfolio.filter((p) => {
    const scopeMatch = !brief.scope || p.scope === brief.scope;
    const typeMatch = !brief.propertyType || p.propertyType === brief.propertyType;
    return scopeMatch && typeMatch;
  });

  // Five comparable projects is treated as full experience.
  return clamp((comparable.length / 5) * 100);
}

function scorePriorityAlignment(brief: Brief, studio: Studio): number | null {
  const top = brief.priorityRanking[0] as PriorityFactor | undefined;
  if (!top) return null;

  switch (top) {
    case 'SPEED':
      return scoreDeliveryReliability(studio);
    case 'BUDGET':
      return scoreBudgetFit(brief, studio);
    case 'MATERIAL_QUALITY':
      return studio.specComplianceRate === null ? null : clamp(studio.specComplianceRate * 100);
    case 'DESIGN_AMBITION':
      return scoreStyleOverlap(brief, studio);
    default:
      return null;
  }
}

// ── Composition ────────────────────────────────────────────────

export function scoreMatch(brief: Brief, studio: Studio): MatchResult | null {
  if (!passesHardFilters(brief, studio)) return null;

  const breakdown: FactorScores = {
    styleOverlap: scoreStyleOverlap(brief, studio),
    budgetFit: scoreBudgetFit(brief, studio),
    workingStyle: scoreWorkingStyle(brief, studio),
    deliveryReliability: scoreDeliveryReliability(studio),
    scopeExperience: scoreScopeExperience(brief, studio),
    priorityAlignment: scorePriorityAlignment(brief, studio),
  };

  // Normalise over MEASURED weight only. This is the honest cold-start move:
  // the score means "88 on what we could actually check", and factorsScored
  // lets the UI say "matched on 4 of 6 factors — reliability builds after
  // their first project with us."
  let weighted = 0;
  let measuredWeight = 0;
  let factorsScored = 0;

  for (const key of Object.keys(WEIGHTS) as FactorKey[]) {
    const value = breakdown[key];
    if (value === null) continue;
    weighted += value * WEIGHTS[key];
    measuredWeight += WEIGHTS[key];
    factorsScored += 1;
  }

  if (measuredWeight === 0) return null;

  return {
    studioId: studio.id,
    score: Math.round(weighted / measuredWeight),
    factorsScored,
    factorsTotal: FACTOR_COUNT,
    breakdown,
    reasoning: buildReasoning(brief, studio, breakdown),
    engineVersion: ENGINE_VERSION,
  };
}

export function rankStudios(brief: Brief, studios: Studio[], limit = 9): MatchResult[] {
  return studios
    .map((s) => scoreMatch(brief, s))
    .filter((m): m is MatchResult => m !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit); // never show more than ~12; scarcity of options IS the value
}

/**
 * Customer-facing explanation. Rules:
 *   - quote the customer's own inputs back
 *   - include the unflattering number where we have one
 *   - never claim a factor we scored null
 */
function buildReasoning(brief: Brief, studio: Studio, breakdown: FactorScores): string[] {
  const lines: string[] = [];
  const name = studio.tradeName;

  if (breakdown.styleOverlap !== null && breakdown.styleOverlap >= 55) {
    lines.push(
      `You leaned toward ${formatStyles(brief.styleLikes)} — most of ${name}'s recent work sits in that direction.`,
    );
  }

  // Say the true thing, not the flattering one. The hard filter only excludes a
  // studio when MORE than 40% of its work sits in a rejected style — so
  // "none of their portfolio goes there" was false for anything up to 40%.
  if (brief.styleDislikes.length > 0) {
    const share = dislikedShare(brief, studio);
    if (share === 0) {
      lines.push(
        `You ruled out ${formatStyles(brief.styleDislikes)}. None of their portfolio goes there.`,
      );
    } else if (share !== null) {
      lines.push(
        `You ruled out ${formatStyles(brief.styleDislikes)}. About ${Math.round(share * 100)}% of their work leans that way.`,
      );
    }
  }

  if (breakdown.deliveryReliability !== null && studio.avgVarianceDays !== null) {
    const d = Math.round(studio.avgVarianceDays);
    lines.push(
      d <= 0
        ? `Their last ${studio.completedProjects} projects finished on or ahead of the committed date.`
        : `Their last ${studio.completedProjects} projects averaged ${d} day${d === 1 ? '' : 's'} past the committed date.`,
    );
  } else if (studio.completedProjects === 0) {
    lines.push(
      `${name} has not completed a project with us yet, so we have no delivery record for them.`,
    );
  } else {
    // 1 or 2 completed projects: they HAVE delivered, just not enough to state
    // a reliable average. Saying "has not completed a project" here was false.
    const n = studio.completedProjects;
    lines.push(
      `${name} has completed ${n} project${n === 1 ? '' : 's'} with us — not yet enough to state a reliable delivery average.`,
    );
  }

  if (brief.priorityRanking[0] === 'MATERIAL_QUALITY' && studio.specComplianceRate !== null) {
    lines.push(
      `You put material quality first. On ${studio.completedProjects} projects, ${Math.round(studio.specComplianceRate * 100)}% used exactly the materials quoted.`,
    );
  }

  // Derived from locality, not from scope. scoreScopeExperience never looks at
  // p.locality, so gating this on that score claimed local experience a studio
  // might not have — and the locality hard filter is skipped entirely when a
  // studio has declared no service areas.
  if (brief.locality) {
    const local = studio.portfolio.filter((p) => p.locality === brief.locality).length;
    if (local > 0) {
      lines.push(
        `They have completed ${local} ${local === 1 ? 'home' : 'homes'} in ${titleCase(brief.locality)}.`,
      );
    }
  }

  if (studio.upheldDisputes > 0) {
    const n = studio.upheldDisputes;
    lines.push(`Worth knowing: ${n} dispute${n === 1 ? '' : 's'} against them ${n === 1 ? 'was' : 'were'} upheld.`);
  }

  return lines;
}

/**
 * The one-sentence version, for the hero card.
 *
 * ## Why this exists alongside `reasoning`
 *
 * `reasoning` is a list of complete sentences — right for a detail panel, wrong
 * for the top of the page, where a customer is deciding in about two seconds
 * whether the ranking is worth trusting. A score with no sentence next to it is
 * a number they cannot check, and an unverifiable number reads as marketing.
 *
 * So this composes short clauses into one line: *"because you leaned toward
 * Warm Minimalist and most of their work sits there; their delivered projects
 * land in your range; they work in Baner."*
 *
 * ## The rules it inherits
 *
 * Every clause must quote something the customer actually told us, and no
 * clause may describe a factor that scored `null`. A studio with nothing
 * measurable gets no sentence rather than a vague one — `null` is a real
 * return value here and the caller must handle it.
 *
 * Capped at three clauses. A fourth is read as boilerplate, and the honest
 * detail lives in `reasoning` directly below it on the page.
 */
export function matchSummary(
  brief: Brief,
  studio: Studio,
  result: MatchResult,
): string | null {
  const clauses: string[] = [];
  const b = result.breakdown;

  if (b.styleOverlap !== null && b.styleOverlap >= 55 && brief.styleLikes.length > 0) {
    clauses.push(
      `you leaned toward ${formatStyles(brief.styleLikes)} and most of their work sits there`,
    );
  }

  // Phrased from delivered values where we used them, because "fits your
  // budget" from a studio's own claimed range is a claim, not a measurement.
  if (b.budgetFit !== null && b.budgetFit >= 50) {
    const delivered = studio.portfolio.filter((p) => p.valuePaise !== null).length;
    clauses.push(
      delivered >= 3
        ? 'the projects they have actually delivered land in your range'
        : 'their stated project range covers your budget',
    );
  }

  if (b.workingStyle !== null && b.workingStyle >= 60 && brief.involvement) {
    clauses.push(
      brief.involvement === 'DECIDE_FOR_ME'
        ? 'they are used to running a project without needing you at every step'
        : brief.involvement === 'APPROVE_EVERYTHING'
          ? 'they work with clients who want to sign off on every detail'
          : 'they work the way you said you want to — decisions made together',
    );
  }

  if (brief.locality) {
    const local = studio.portfolio.filter((p) => p.locality === brief.locality).length;
    if (local > 0) {
      clauses.push(
        `they have finished ${local} ${local === 1 ? 'home' : 'homes'} in ${titleCase(brief.locality)}`,
      );
    }
  }

  if (b.deliveryReliability !== null && b.deliveryReliability >= 70) {
    clauses.push('their delivery record holds up');
  }

  if (clauses.length === 0) return null;

  return `${result.score}% match — because ${clauses.slice(0, 3).join('; ')}.`;
}

// ── Helpers ────────────────────────────────────────────────────

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function rangeOverlap(aLo: number, aHi: number, bLo: number, bHi: number): number {
  const lo = Math.max(aLo, bLo);
  const hi = Math.min(aHi, bHi);
  return hi > lo ? hi - lo : 0;
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
