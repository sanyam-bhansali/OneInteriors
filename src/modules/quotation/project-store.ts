'use client';

/**
 * What the customer has done so far, before there is an account.
 *
 * The floor plan they gave us, the quotes they have generated, and which of
 * those they want compared. sessionStorage, for the same reason the brief uses
 * it: an abandoned project should not resurrect a week later with a stale
 * budget and a quote priced on rates that have since moved.
 *
 * ## Why quotes live here and not on a /quotes page
 *
 * There is no quotes screen any more. A quote belongs to the studio that
 * produced it — it is *their* pricing — so it renders inside that studio's
 * profile, under the work and the checks that justify the number. A separate
 * page collecting everybody's quotes invites exactly the comparison we want
 * people to make deliberately, on the compare screen, with the materials
 * beside it.
 *
 * ## Quotes are stored, not recomputed
 *
 * Generation takes ten seconds by design. Recomputing on every page view would
 * either mean sitting through that again or quietly skipping it, and the
 * second is worse — a number that took ten seconds the first time and none the
 * second reads as the first ten seconds having been a performance. So the
 * built quote is kept, with the rates and the date it was built from.
 */

import type { FirstQuote } from './first-quote';

const KEY = 'oi.project.v1';

export interface FloorPlan {
  /** What they uploaded, for showing back. Never the file itself. */
  fileName: string | null;
  /** The one number the plan is read for. */
  kitchenRunMm: number | null;
  source: 'floor_plan' | 'customer' | 'standard';
}

export interface StoredQuote {
  studioSlug: string;
  studioName: string;
  /** ISO timestamp. A quote without one cannot be told stale. */
  builtAt: string;
  quote: FirstQuote;
}

/**
 * A written read, kept so it is not paid for twice.
 *
 * Six matches means six model calls, and without this every return to
 * `/match` — back button, a reload, coming out of a quote — spends them all
 * again. `briefKey` is what the read was written against: change the brief
 * and the cached sentence is about a flat you no longer have, so it is
 * discarded rather than shown.
 */
export interface StoredRead {
  text: string;
  source: 'model' | 'rules';
  briefKey: string;
}

export interface Project {
  plan: FloorPlan | null;
  /** Keyed by studio slug. One quote per studio — regenerating replaces it. */
  quotes: Record<string, StoredQuote>;
  /** Slugs the customer has put side by side. */
  comparing: string[];
  /** Keyed by studio id. See StoredRead. */
  reads: Record<string, StoredRead>;
}

export const EMPTY_PROJECT: Project = { plan: null, quotes: {}, comparing: [], reads: {} };

/**
 * What the read was written against.
 *
 * Only the fields that reach the prompt. Changing a style preference should
 * invalidate it; renaming the uploaded floor plan should not.
 */
export function briefKey(brief: {
  propertyType: string | null;
  scope: string | null;
  locality: string | null;
  carpetAreaSqft: number | null;
  budgetMaxPaise: number | null;
  styleLikes: string[];
  styleDislikes: string[];
}): string {
  return [
    brief.propertyType,
    brief.scope,
    brief.locality,
    brief.carpetAreaSqft,
    brief.budgetMaxPaise,
    [...brief.styleLikes].sort().join('+'),
    [...brief.styleDislikes].sort().join('+'),
  ].join('|');
}

export function loadProject(): Project {
  if (typeof window === 'undefined') return EMPTY_PROJECT;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return EMPTY_PROJECT;
    return { ...EMPTY_PROJECT, ...(JSON.parse(raw) as Partial<Project>) };
  } catch {
    return EMPTY_PROJECT;
  }
}

export function saveProject(project: Project): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(project));
  } catch {
    // Private mode, or storage disabled. Everything still works in memory for
    // this page; it just will not survive a reload. Never throw into the UI.
  }
}

/** The compare screen needs two. One quote compared with nothing is a quote. */
export const MIN_TO_COMPARE = 2;

/**
 * No cap.
 *
 * There was one — three — on the reasoning that four columns do not fit a
 * laptop without shrinking the specs past readable. That is a layout problem,
 * and solving a layout problem by forbidding the customer something is the
 * wrong way round. The compare table scrolls sideways with the line item and
 * its material pinned to the left, so a fourth column costs a swipe rather
 * than legibility.

 * If somebody wants to price all fourteen and look at them together, that is
 * a customer doing exactly what this product is for.
 */
