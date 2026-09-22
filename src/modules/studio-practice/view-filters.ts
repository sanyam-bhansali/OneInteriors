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

/** At most this many per person. Every view is a control in a menu. */
export const MAX_VIEWS = 12;

export interface ViewFilters {
  /**
   * Who the board is showing.
   *
   * `''` everyone · `'pool'` nobody has taken it · `'quiet'` gone silent ·
   * anything else is a member id. The same four-way value `Board.tsx` already
   * uses, deliberately — a saved view that spoke a different dialect would
   * need a translation layer nobody would keep in sync.
   */
  who?: string;

  /** A `StudioField.key` to group the columns by, or '' for none. */
  groupBy?: string;
}

/** Keys a view may carry. Everything else is dropped. */
const ALLOWED = ['who', 'groupBy'] as const;

/**
 * Ids and field keys are bounded, not validated against the database.
 *
 * Checking that `who` names a real member would mean a query on every read of
 * every view, to catch a case the board already handles: a filter naming
 * somebody who has left simply matches nothing, which reads as an empty
 * board rather than a crash. Length is the only thing worth enforcing here,
 * and it is enforced because this lands in a JSONB column.
 */
const MAX_VALUE = 64;

export function cleanFilters(raw: unknown): ViewFilters {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {};

  const input = raw as Record<string, unknown>;
  const out: ViewFilters = {};

  for (const key of ALLOWED) {
    const value = input[key];
    if (typeof value !== 'string') continue;

    const tidy = value.trim();
    /* An empty string is the board's own "no filter", and storing it is the
       same as storing nothing. Dropped so two views that filter identically
       compare equal. */
    if (tidy.length === 0 || tidy.length > MAX_VALUE) continue;

    out[key] = tidy;
  }

  return out;
}

/** True when a view would show exactly what an unfiltered board shows. */
export function isEmpty(filters: ViewFilters): boolean {
  return Object.keys(filters).length === 0;
}

/**
 * A sentence describing a view, for the menu row under its name.
 *
 * Built from the filters rather than stored, because unlike a timeline
 * summary this describes the PRESENT state of a view that can be edited —
 * there is nothing historical to preserve, and a stale description would be
 * the bug.
 *
 * `memberName` is passed in rather than looked up: this file is pure, and the
 * caller already has the team list for its own dropdown.
 */
export function describe(
  filters: ViewFilters,
  memberName?: (id: string) => string | null,
): string {
  const bits: string[] = [];

  if (filters.who === 'pool') bits.push('nobody has taken');
  else if (filters.who === 'quiet') bits.push('gone quiet');
  else if (filters.who) {
    const name = memberName?.(filters.who);
    /* A view pointing at somebody who has left says so, rather than showing
       a raw id. It still loads — the board simply matches nothing — and the
       honest label is what tells the owner to delete it. */
    bits.push(name ? `${name}'s` : 'somebody who has left');
  }

  if (filters.groupBy) bits.push(`grouped by ${filters.groupBy}`);

  return bits.length === 0 ? 'Everything' : capitalise(bits.join(' · '));
}

function capitalise(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}
