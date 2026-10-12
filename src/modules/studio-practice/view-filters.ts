/**
 * What a saved view is allowed to contain.
 *
 * Pure, no `server-only` — CONTRIBUTING §9.5. The board composes these and
 * the store validates them, so both sides need the shape.
 *
 * ## Cleaned on the way in AND on the way out
 *
 * Coming in, `filters` is JSON from a browser and has to be treated as such:
 * anything not recognised is dropped rather than stored, because a JSONB
 * column will happily hold a megabyte of whatever somebody posts.
 *
 * Going out, the same function runs again. A view saved last March may hold a
 * key for a filter that has since been removed, and the board applying a
 * filter that no longer means anything would quietly show the wrong rows —
 * which is worse than the view refusing to load, because nobody notices.
 *
 * So unknown keys are ignored in both directions, and adding a filter is
 * exactly one change here.
 */

import { leadFiltersToQuery, parseLeadFilters, describeFilters, parseSort, type LeadFilters } from '@/modules/studio-sales/lead-filters';

/** At most this many per person. Every view is a control in a menu. */
export const MAX_VIEWS = 5;

export interface ViewFilters {
  /**
   * The leads list's filters, as the URL carries them (leads at scale,
   * 12 Oct 2026; `studio-sales/lead-filters.ts`), plus `sort`. Cleaned by
   * parsing and writing it again, so only filters this build knows survive.
   */
  query?: string;
  /** List or board. */
  view?: 'list' | 'board';
  /**
   * The old board's "who" (before leads at scale): `pool`, `quiet` or a
   * member id. Still read, and turned into `query` on the way out.
   */
  who?: string;
  /** A `StudioField.key` to group the columns by, or '' for none. */
  groupBy?: string;
}

/** Ids and field keys are bounded, not validated against the database. */
const MAX_VALUE = 64;
const MAX_QUERY = 1000;

/** The filters a view's query holds, cleaned; `sort` rides along when not the default. */
function cleanQuery(raw: string): string {
  const p = new URLSearchParams(raw.slice(0, MAX_QUERY));
  const out = new URLSearchParams(leadFiltersToQuery(parseLeadFilters(p)));
  const sort = parseSort(p.get('sort'));
  if (sort !== 'newest') out.set('sort', sort);
  return out.toString();
}

export function cleanFilters(raw: unknown): ViewFilters {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const input = raw as Record<string, unknown>;
  const out: ViewFilters = {};

  let query = typeof input.query === 'string' ? cleanQuery(input.query) : '';
  /* A view saved before leads at scale: its "who" becomes the same filter. */
  if (!query && typeof input.who === 'string') {
    const who = input.who.trim();
    const legacy: LeadFilters = who === 'pool' ? { owner: 'pool' } : who === 'quiet' ? { quiet: true } : who && who.length <= MAX_VALUE ? { owner: who } : {};
    query = leadFiltersToQuery(parseLeadFilters(new URLSearchParams(leadFiltersToQuery(legacy))));
  }
  if (query) out.query = query;
  if (input.view === 'list' || input.view === 'board') out.view = input.view;
  if (typeof input.groupBy === 'string') {
    const g = input.groupBy.trim();
    if (g.length > 0 && g.length <= MAX_VALUE) out.groupBy = g;
  }
  return out;
}

/** True when a view would show exactly what an unfiltered board shows. */
export function isEmpty(filters: ViewFilters): boolean {
  return !filters.query && !filters.groupBy;
}

/**
 * A sentence describing a view, for the menu row under its name. Built from
 * the filters rather than stored: it describes the view as it is now.
 */
export function describe(filters: ViewFilters, memberName?: (id: string) => string | null): string {
  const bits = describeFilters(parseLeadFilters(new URLSearchParams(filters.query ?? '')), { member: memberName }).map((c) => c.label);
  if (filters.groupBy) bits.push(`grouped by ${filters.groupBy}`);
  return bits.length === 0 ? 'Everything' : bits.join(' · ');
}
