/**
 * The two sizes an icon takes on the studio surface, and one rule.
 *
 * Pure constants — no component, no `server-only`, importable from anywhere.
 *
 * ## Why these are shared rather than typed out per file
 *
 * Because the thing they replaced was not shared. Onboarding carried
 * seventeen hand-drawn SVGs across thirteen files, six of which were the same
 * tick redrawn six times at three different stroke weights. Nothing made them
 * agree, so they did not: 2.4 here, 1.5 there, 13px in one card and 14 in the
 * next.
 *
 * ## `absoluteStrokeWidth` is the whole point
 *
 * Without it lucide scales the stroke with the icon, so a 24px icon beside an
 * 18px one is visibly heavier and the pair reads as a mistake. With it the
 * line is the same weight at every size, which is what lets a panel icon and
 * an inline one sit in the same column.
 */

/** Beside body copy, inside a button, in a list. */
export const INLINE_ICON = { size: 18, strokeWidth: 2, absoluteStrokeWidth: true } as const;

/** A panel's own icon, above its heading. */
export const PANEL_ICON = { size: 24, strokeWidth: 2, absoluteStrokeWidth: true } as const;

/**
 * Inside a disc, a chip, or a step marker.
 *
 * Stroke 2.5 rather than 2: at thirteen pixels a two-pixel tick on a coloured
 * ground loses about a third of its weight to antialiasing, which is why the
 * hand-drawn ones were at 2.4.
 */
export const DISC_ICON = { size: 13, strokeWidth: 2.5, absoluteStrokeWidth: true } as const;
