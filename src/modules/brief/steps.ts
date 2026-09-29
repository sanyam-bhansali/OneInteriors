/**
 * The brief's screens, in order, and what it takes to leave each one.
 *
 * ## Why steps have names now
 *
 * The quiz used to be nine numbered cases, and every rule about a screen —
 * whether it is answered, what it is called, which chapter it belongs to —
 * was a `switch` on a number. Moving one question meant renumbering every
 * rule after it, and a rule left on the old number silently described the
 * wrong screen. Since 29 Sep the order is this list and nothing else; a
 * screen is found by its id.
 *
 * The order follows docs/CUSTOMER-JOURNEY-PLAN.md §2: who you are, your
 * home, the work, your taste, how you live, how you work, and where to send
 * your matches.
 *
 * Pure — no `server-only` — so the quiz and the tests read the same rules
 * (CONTRIBUTING §9.5).
 */

import { possessionAnswered } from './possession';
import type { Brief, PropertyType } from './types';
import { BEDROOMS, TYPICAL_CARPET_SQFT } from '@/modules/quotation/estimate';
import { scopeReady, selectionOf } from '@/modules/quotation/scope';

export const STEP_IDS = [
  'name',
  'home',
  'plan',
  'possession',
  'scope',
  'level',
  'likes',
  'dislikes',
  'living',
  'working',
  'priorities',
  'contact',
] as const;

export type StepId = (typeof STEP_IDS)[number];

export const TOTAL_STEPS = STEP_IDS.length;

/**
 * The chapter each screen belongs to — what the header shows instead of a
 * bare "3 of 11", which answers a question nobody asked.
 */
export const CHAPTER: Record<StepId, string> = {
  name: 'You',
  home: 'Your home',
  plan: 'Your home',
  possession: 'Your home',
  scope: 'The work',
  level: 'The work',
  likes: 'Your taste',
  dislikes: 'Your taste',
  living: 'How you live',
  working: 'How you work',
  priorities: 'How you work',
  contact: 'Your matches',
};

/** The screen at a 1-based position, clamped into range. */
export function stepAt(position: number): StepId {
  const i = Math.min(Math.max(Math.round(position) || 1, 1), TOTAL_STEPS) - 1;
  return STEP_IDS[i]!;
}

/** The longest first name we keep. Long enough for anyone, short enough to print. */
export const NAME_MAX = 40;

/** A name as it will be shown and stored: trimmed, single-spaced, capped. */
export function cleanName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Control characters out, whitespace collapsed: this lands in a greeting,
  // on a quotation and in a studio's CRM.
  const cleaned = raw.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, NAME_MAX) : null;
}

/**
 * Carpet area when they have not given one: the typical figure for their
 * configuration, never a flat 850.
 *
 * It used to be 850 sq ft for every home — so a 4 BHK with the field left
 * blank was shown bands and quoted on the area of a 2 BHK, and nothing said
 * so. These are the typical areas the quote engine already uses
 * (`TYPICAL_CARPET_SQFT`, 550 / 850 / 1,150 / 1,650 — the same defaults the
 * Hauspire quotation software prices painting and electrical on). Wherever
 * one is used, the page says it was assumed.
 */
export function typicalCarpetSqft(propertyType: PropertyType | null): number {
  return TYPICAL_CARPET_SQFT[propertyType ?? 'BHK_2'];
}

/** The area to use for this brief, and whether it was theirs or ours. */
export function carpetAreaFor(brief: Pick<Brief, 'carpetAreaSqft' | 'propertyType'>): {
  sqft: number;
  assumed: boolean;
} {
  if (brief.carpetAreaSqft && brief.carpetAreaSqft > 0) {
    return { sqft: brief.carpetAreaSqft, assumed: false };
  }
  return { sqft: typicalCarpetSqft(brief.propertyType), assumed: true };
}

/** May they leave this screen? Continue says what is missing when not. */
export function isStepAnswered(brief: Brief, id: StepId): boolean {
  switch (id) {
    case 'name':
      return cleanName(brief.contactName) !== null;
    case 'home':
      return brief.propertyType !== null && brief.locality !== null;
    case 'plan':
      // Optional: without a plan the kitchen is priced on the standard run.
      return true;
    case 'possession':
      return possessionAnswered(brief);
    case 'scope':
      // A scope, the rooms a single-room job needs, and at least one line left.
      return scopeReady(BEDROOMS[brief.propertyType ?? 'BHK_2'], selectionOf(brief));
    case 'level':
      // The band's floor is the budget; the top band has no ceiling.
      return brief.budgetMinPaise !== null;
    case 'likes':
      // Two, not one. The reveal reads "leaning X, with a bit of Y" — a single
      // pick makes that sentence impossible and gives the matcher nothing to
      // weigh against.
      return brief.styleLikes.length >= 2;
    case 'dislikes':
      return true; // optional, but high-signal when given
    case 'living':
      // Answered by default: the screen shows two adults and nobody else, the
      // modal Pune household, and denying that it is an answer meant changing
      // something you agreed with and changing it back. Needs are optional.
      return true;
    case 'working':
      return brief.involvement !== null;
    case 'priorities':
      return brief.priorityRanking.length === 4;
    case 'contact':
      // The details live in the screen, not the brief; the screen checks them
      // with `checkContact` when they press on, and says what is missing.
      return true;
  }
}
