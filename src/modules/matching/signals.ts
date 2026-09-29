/**
 * The signals behind each factor of `match@2.0.0` (plan §5) — one function
 * each, pure, every one returning `null` when it cannot be measured.
 *
 * Each returns a value 0–100 and, where it has one, the plain-words evidence
 * the card shows beside it. A signal never invents a middle value for
 * something the studio has not told us: "not said" is null, and the score is
 * normalised over what was measured.
 */

import { sameSociety as isSameSociety } from '@/modules/brief/society';
import type { Brief, HomeNeed, PriorityFactor } from '@/modules/brief/types';
import { localityLabel, zoneOf } from '@/modules/brief/types';
import { monthOf, FULL_HOME_DAYS } from '@/modules/brief/possession';
import type { Studio, PortfolioProject } from '@/modules/studio/types';
import { MIN_PROJECTS_FOR_RELIABILITY } from '@/modules/studio/types';
import { earliestStartKnown, SPECIALISM_LABELS, type Specialism } from '@/modules/studio/matching-profile';
import { cleanTags, evidencedSpecialisms } from '@/modules/studio/portfolio-fields';
import { buildFirstQuote, homeShapeFor } from '@/modules/quotation/first-quote';
import { scopeBandRange } from '@/modules/quotation/scope-band';
import { selectionOf } from '@/modules/quotation/scope';
import type { StudioRates } from '@/modules/quotation/catalogue';
import { bestAffinity } from './style-affinity';

export interface Signal {
  value: number;
  evidence?: string;
}

export interface SignalContext {
  /** Today, injected so ranking is deterministic in tests. */
  today: Date;
  /** The studio's rates, when the caller has them — priced on this home. */
  ratesFor?: (slug: string) => StudioRates | undefined;
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const DAY = 86_400_000;

// ── Style (weight 30) ──────────────────────────────────────────

/** Recent work says more about a studio's style than work from four years ago. */
function recency(p: PortfolioProject, today: Date): number {
  if (!p.completedOn) return 0.8;
  const years = (today.getTime() - Date.parse(p.completedOn)) / (365 * DAY);
  return years <= 1.5 ? 1 : years <= 3 ? 0.75 : 0.5;
}

export function styleFit(brief: Brief, studio: Studio, ctx: SignalContext): Signal | null {
  if (brief.styleLikes.length === 0) return null;
  let total = 0;
  let credit = 0;
  let exact = 0;
  for (const p of studio.portfolio) {
    const w = recency(p, ctx.today);
    for (const t of p.styleTags) {
      total += w;
      const a = bestAffinity(t, brief.styleLikes);
      credit += a * w;
      if (a === 1) exact += 1;
    }
  }
  if (total === 0) return null;
  // A studio need not be 100% one style to score full marks — 60% of its
  // recent work in the customer's direction is a studio that does it.
  const value = clamp((credit / total / 0.6) * 100);
  // Direct affinity (plan §5.2): they picked this studio's own photograph in
  // the style picker before they knew whose it was. The strongest style
  // evidence there is — lifted to at least PICKED_THEIR_PHOTO.
  if (brief.styleStudioPicks?.includes(studio.id)) {
    return { value: Math.max(value, PICKED_THEIR_PHOTO), evidence: 'You picked a photograph of their work in the style picker' };
  }
  return {
    value,
    evidence: exact > 0 ? `${exact} of their project tags are styles you picked` : 'Their work sits next to your styles rather than in them',
  };
}

/** The style score a studio gets, at least, when the customer picked its own photo. */
export const PICKED_THEIR_PHOTO = 90;

/** Share of the studio's work in a style the customer ruled out, or null. */
export function dislikedShare(brief: Brief, studio: Studio): number | null {
  if (brief.styleDislikes.length === 0) return null;
  const tags = studio.portfolio.flatMap((p) => p.styleTags);
  if (tags.length === 0) return null;
  const disliked = new Set<string>(brief.styleDislikes);
  return tags.filter((t) => disliked.has(t)).length / tags.length;
}

// ── Budget (the BUDGET priority) ───────────────────────────────

/**
 * Where this studio's quote for THIS home sits inside the band they chose —
 * lower is better — less a little for every line it has not priced.
 * Falls back to the studio's delivered values against the budget when the
 * caller has no rates to price with.
 */
export function budgetPosition(brief: Brief, studio: Studio, ctx: SignalContext): Signal | null {
  const rates = ctx.ratesFor?.(studio.slug);
  if (rates && brief.tier && Object.keys(rates).length > 0) {
    const shape = homeShapeFor(brief);
    const quote = buildFirstQuote(
      { ...shape, kitchenRunMm: shape.plan?.kitchenRunMm ?? null, runSource: shape.plan ? 'floor_plan' : 'standard' },
      rates,
    );
    const band = scopeBandRange(brief.tier, shape, selectionOf(brief));
    if (band) {
      const work = quote.totalPaise - quote.gstPaise;
      const top = band.highPaise ?? band.lowPaise * 1.5;
      const position = top > band.lowPaise ? (work - band.lowPaise) / (top - band.lowPaise) : 0;
      const missing = quote.notPriced.length * 8;
      return {
        value: clamp(100 - position * 70 - missing),
        evidence:
          position <= 0
            ? 'Their quote for your home comes in at the bottom of your range'
            : position >= 1
              ? 'Their quote for your home comes in above your range'
              : `Their quote for your home sits ${position < 0.5 ? 'in the lower half' : 'in the upper half'} of your range`,
      };
    }
  }
  return deliveredBudgetFit(brief, studio);
}

/** v1's budget fit: the studio's delivered values (or declared range) against the budget. */
export function deliveredBudgetFit(brief: Brief, studio: Studio): Signal | null {
  if (brief.budgetMinPaise === null) return null;
  const delivered = studio.portfolio
    .map((p) => p.valuePaise)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
  let lo: number;
  let hi: number;
  if (delivered.length >= 3) {
    lo = delivered[Math.floor(delivered.length * 0.1)]!;
    hi = delivered[Math.min(delivered.length - 1, Math.floor(delivered.length * 0.9))]!;
  } else if (studio.minProjectPaise !== null && studio.maxProjectPaise !== null) {
    lo = studio.minProjectPaise;
    hi = studio.maxProjectPaise;
  } else {
    return null;
  }
  const from = delivered.length >= 3 ? 'the projects they have delivered' : 'their stated project range';
  if (brief.budgetMaxPaise === null) {
    if (hi <= lo) return { value: hi >= brief.budgetMinPaise ? 100 : 0 };
    const above = Math.max(0, hi - Math.max(lo, brief.budgetMinPaise));
    return { value: clamp((above / (hi - lo)) * 100), evidence: `From ${from}` };
  }
  const overlap = Math.max(0, Math.min(brief.budgetMaxPaise, hi) - Math.max(brief.budgetMinPaise, lo));
  const width = brief.budgetMaxPaise - brief.budgetMinPaise;
  if (width <= 0) return { value: overlap > 0 ? 100 : 0 };
  return { value: clamp((overlap / width) * 100), evidence: `From ${from}` };
}

// ── Timeline (weight 5, and the SPEED priority) ────────────────

/** When work can start on their side: the later of possession and today. Null if not known. */
export function workCanStart(brief: Brief, today: Date): Date | null {
  if (brief.possessionStatus === 'HAVE_KEYS') return today;
  if (brief.possessionStatus === 'EXPECTED') {
    const m = monthOf(brief.possessionOn);
    return m ? new Date(Math.max(m.getTime(), today.getTime())) : null;
  }
  return null;
}

const monthName = (d: Date) => d.toLocaleDateString('en-IN', { month: 'long', timeZone: 'UTC' });

export interface TimelineSignal extends Signal {
  /** Over a month after the customer can start — sorted down and flagged, never hidden. */
  late: boolean;
  /** The line on the card, either way. */
  line: string;
}

/**
 * Can they start when the customer can? Full marks within a month of it;
 * falling to nothing four months after. A studio designing before possession
 * gains a fortnight, because the design month overlaps the wait.
 */
export function timelineFit(brief: Brief, studio: Studio, ctx: SignalContext): TimelineSignal | null {
  const theirs = workCanStart(brief, ctx.today);
  const profile = studio.matchingProfile;
  const start = profile ? earliestStartKnown(profile, iso(ctx.today)) : null;
  if (!theirs || !start) return null;
  const studioStart = new Date(Math.max(Date.parse(start), ctx.today.getTime()));
  let gapDays = (studioStart.getTime() - theirs.getTime()) / DAY;
  if (profile?.designBeforePossession && brief.possessionStatus === 'EXPECTED') gapDays -= 14;
  const late = gapDays > 30;
  const value = gapDays <= 30 ? 100 : clamp(100 - ((gapDays - 30) / 90) * 100);
  const line =
    gapDays <= 0
      ? brief.possessionStatus === 'HAVE_KEYS'
        ? 'Can start now'
        : `Can start in ${monthName(theirs)}, when you get the keys`
      : gapDays <= 30
        ? `Can start in ${monthName(studioStart)}, within a month of when you can`
        : `Booked until ${monthName(studioStart)} — ${Math.round(gapDays / 7)} weeks after you can start`;
  return { value, late, line, evidence: line };
}

/** SPEED: can they start in time, how long do they take for this scope, and do they finish on the date. */
export function speed(brief: Brief, studio: Studio, ctx: SignalContext): Signal | null {
  const parts: number[] = [];
  const t = timelineFit(brief, studio, ctx);
  if (t) parts.push(t.value);
  const scope = brief.scope ?? 'FULL_HOME';
  const days = studio.matchingProfile?.durationDays[scope];
  let evidence: string | undefined = t?.line;
  if (days !== undefined) {
    // Against the full-home norm, scaled down for smaller scopes.
    const norm = scope === 'FULL_HOME' ? FULL_HOME_DAYS.max : scope === 'RENOVATION' ? 120 : 50;
    parts.push(clamp(100 - Math.max(0, (days - norm * 0.7) / (norm * 0.6)) * 100));
    evidence ??= `Typically ${days} days from sign-off to handover`;
  }
  if (studio.completedProjects >= MIN_PROJECTS_FOR_RELIABILITY && studio.avgVarianceDays !== null) {
    parts.push(clamp(100 - (Math.max(0, studio.avgVarianceDays) / 30) * 100));
  }
  if (studio.matchingProfile?.production === 'OWN_FACTORY') parts.push(85);
  return parts.length === 0 ? null : { value: avg(parts), evidence };
}

// ── Design ambition and material quality ───────────────────────

export function designAmbition(brief: Brief, studio: Studio): Signal | null {
  const parts: number[] = [];
  const p = studio.matchingProfile;
  if (brief.styleLikes.length > 0 && studio.portfolio.length > 0) {
    const liked = new Set<string>(brief.styleLikes);
    const deep = studio.portfolio.filter((x) => x.styleTags.some((t) => liked.has(t))).length;
    parts.push(clamp((deep / 3) * 100));
  }
  if (p?.views3d) parts.push(p.views3d === 'EVERY_ROOM' ? 100 : p.views3d === 'KEY_ROOMS' ? 60 : 20);
  if (p?.revisions !== null && p?.revisions !== undefined) parts.push(clamp(20 + p.revisions * 20));
  if (p?.dedicatedDesigner !== null && p?.dedicatedDesigner !== undefined) parts.push(p.dedicatedDesigner ? 100 : 30);
  if (parts.length === 0) return null;
  const services = [
    p?.views3d === 'EVERY_ROOM' ? '3D views of every room' : p?.views3d === 'KEY_ROOMS' ? '3D views of key rooms' : null,
    p?.revisions ? `${p.revisions} design revisions included` : null,
    p?.dedicatedDesigner ? 'a dedicated designer' : null,
  ].filter(Boolean);
  return { value: avg(parts), evidence: services.length ? `Includes ${services.join(', ')}` : undefined };
}

const CARCASS_GRADE: Record<string, number> = { BWP_PLY: 100, SOLID_WOOD: 100, HDHMR: 75, MR_PLY: 50, MDF: 30 };

export function materialQuality(studio: Studio): Signal | null {
  const parts: number[] = [];
  const p = studio.matchingProfile;
  if (p && p.carcass.length > 0) parts.push(Math.max(...p.carcass.map((c) => CARCASS_GRADE[c] ?? 50)));
  if (p?.warrantyYears !== null && p?.warrantyYears !== undefined) parts.push(clamp((p.warrantyYears / 10) * 100));
  if (p?.production) parts.push(p.production === 'OWN_FACTORY' ? 100 : 60);
  if (studio.specComplianceRate !== null && studio.completedProjects >= MIN_PROJECTS_FOR_RELIABILITY) {
    parts.push(clamp(studio.specComplianceRate * 100));
  }
  if (parts.length === 0) return null;
  const bits = [
    p?.carcass.includes('BWP_PLY') ? 'BWP ply as standard' : p?.carcass.includes('SOLID_WOOD') ? 'solid wood as standard' : null,
    p?.warrantyYears ? `a ${p.warrantyYears}-year warranty` : null,
    p?.production === 'OWN_FACTORY' ? 'their own factory' : null,
  ].filter(Boolean);
  return { value: avg(parts), evidence: bits.length ? `${bits.join(', ')}`.replace(/^./, (c) => c.toUpperCase()) : undefined };
}

// ── Priorities (weight 30, split 12 / 9 / 6 / 3) ───────────────

export const PRIORITY_SPLIT = [12, 9, 6, 3] as const;

export function prioritySignal(p: PriorityFactor, brief: Brief, studio: Studio, ctx: SignalContext): Signal | null {
  switch (p) {
    case 'BUDGET':
      return budgetPosition(brief, studio, ctx);
    case 'SPEED':
      return speed(brief, studio, ctx);
    case 'DESIGN_AMBITION':
      return designAmbition(brief, studio);
    case 'MATERIAL_QUALITY':
      return materialQuality(studio);
    default:
      return null;
  }
}

export function priorities(brief: Brief, studio: Studio, ctx: SignalContext): Signal | null {
  let weighted = 0;
  let weight = 0;
  let evidence: string | undefined;
  brief.priorityRanking.slice(0, 4).forEach((p, i) => {
    const s = prioritySignal(p, brief, studio, ctx);
    if (!s) return;
    weighted += s.value * PRIORITY_SPLIT[i]!;
    weight += PRIORITY_SPLIT[i]!;
    evidence ??= s.evidence;
  });
  return weight === 0 ? null : { value: weighted / weight, evidence };
}

// ── Similar work (weight 15) ───────────────────────────────────

export interface SimilarWork extends Signal {
  /** Projects that count, best first, for "their work like yours". */
  projects: string[];
  sameSociety: number;
  sameArea: number;
}

/**
 * Projects like this one: the scope, a size within 25% (or the same
 * configuration when the project has no area), and the place — same society
 * above same area above same zone. Three strong matches is full marks.
 */
export function similarWork(brief: Brief, studio: Studio): SimilarWork | null {
  if (studio.portfolio.length === 0) return null;
  const scope = brief.scope ?? 'FULL_HOME';
  const area = homeShapeFor(brief).carpetAreaSqft;
  const zone = zoneOf(brief.locality);
  const scored = studio.portfolio.map((p) => {
    const scopeFit = p.scope === scope ? 1 : p.scope === 'FULL_HOME' && scope !== 'RENOVATION' ? 0.6 : 0;
    const sizeFit = p.carpetAreaSqft
      ? Math.abs(p.carpetAreaSqft - area) <= area * 0.25 ? 1 : 0.3
      : p.propertyType && p.propertyType === brief.propertyType ? 0.8 : 0.3;
    const society = isSameSociety(p.society, brief.society);
    const sameArea = Boolean(brief.locality && p.locality === brief.locality);
    const placeFit = society ? 1 : sameArea ? 0.8 : zone && zoneOf(p.locality) === zone ? 0.6 : 0.3;
    return { p, s: scopeFit * (0.4 + 0.3 * sizeFit + 0.3 * placeFit), society: Boolean(society), sameArea };
  });
  const best = scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  const sameSociety = scored.filter((x) => x.society).length;
  const sameArea = scored.filter((x) => x.sameArea).length;
  const value = clamp((best.slice(0, 4).reduce((a, x) => a + x.s, 0) / 3) * 100);
  const evidence =
    sameSociety > 0
      ? `They have done ${sameSociety === 1 ? 'a home' : `${sameSociety} homes`} in your society`
      : sameArea > 0 && brief.locality
        ? `They have completed ${sameArea} ${sameArea === 1 ? 'home' : 'homes'} in ${localityLabel(brief.locality)}`
        : best.length > 0
          ? `${best.length} of their projects are like yours`
          : undefined;
  return { value, evidence, projects: best.slice(0, 3).map((x) => x.p.id), sameSociety, sameArea };
}

// ── Working style and household (weight 10 each) ───────────────

const INVOLVEMENT_ORDER = { DECIDE_FOR_ME: 0, COLLABORATE: 1, APPROVE_EVERYTHING: 2 } as const;

export function workingStyle(brief: Brief, studio: Studio): Signal | null {
  if (!brief.involvement) return null;
  const theirs = studio.matchingProfile?.workingStyle;
  let fit: number | null = null;
  if (theirs) {
    fit = [100, 50, 0][Math.abs(INVOLVEMENT_ORDER[theirs] - INVOLVEMENT_ORDER[brief.involvement])]!;
  } else if (studio.autonomyProfile !== null) {
    const want = INVOLVEMENT_ORDER[brief.involvement] / 2;
    fit = (1 - Math.abs(want - studio.autonomyProfile)) * 100;
  }
  if (fit === null) return null;
  const value = studio.communicationRating !== null ? fit * 0.8 + ((studio.communicationRating - 1) / 4) * 100 * 0.2 : fit;
  return {
    value,
    evidence: theirs
      ? theirs === brief.involvement
        ? 'They run projects the way you said you want to'
        : 'They run projects a little differently from how you said you want to'
      : undefined,
  };
}

const NEED_TO_SPECIALISM: Partial<Record<HomeNeed, Specialism>> = {
  VASTU: 'VASTU',
  POOJA_ROOM: 'POOJA_ROOM',
  EXTRA_STORAGE: 'EXTRA_STORAGE',
  SMART_HOME: 'SMART_HOME',
};

/** What this household needs a studio to have done, as specialisms. */
export function wantedSpecialisms(brief: Brief): Specialism[] {
  const out: Specialism[] = [];
  const h = brief.household;
  if (h?.children) out.push('CHILDREN');
  if (h?.elderly) out.push('ELDERLY');
  if (h?.pets) out.push('PETS');
  if (h?.worksFromHome) out.push('HOME_OFFICE');
  for (const n of brief.needs) {
    const s = NEED_TO_SPECIALISM[n];
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

/**
 * Household and needs against what the studio has done: two tagged projects
 * is full credit, one is half, declared but not shown is 0.6 of it. A studio
 * that has said nothing about specialisms and tagged nothing is not scored —
 * not said is not "has not done".
 */
export function householdFit(brief: Brief, studio: Studio): Signal | null {
  const wanted = wantedSpecialisms(brief);
  if (wanted.length === 0) return null;
  const declared = studio.matchingProfile?.specialisms ?? [];
  const tagged = studio.portfolio.flatMap((p) => cleanTags(p.tags ?? []));
  if (declared.length === 0 && tagged.length === 0) return null;
  const shown = evidencedSpecialisms(studio.portfolio);
  const covered: Specialism[] = [];
  const credit = wanted.map((w) => {
    const c = shown.includes(w) ? 1 : tagged.includes(w) ? 0.5 : declared.includes(w) ? 0.6 : 0;
    if (c >= 0.6) covered.push(w);
    return c;
  });
  return {
    value: avg(credit) * 100,
    evidence: covered.length
      ? `Experienced in ${covered.map((c) => SPECIALISM_LABELS[c].toLowerCase()).join(', ')}`
      : undefined,
  };
}
