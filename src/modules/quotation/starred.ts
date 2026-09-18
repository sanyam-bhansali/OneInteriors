/**
 * The verdict on the lines the customer actually cares about.
 *
 * ## Why this exists
 *
 * A comparison's bottom row is the least useful number on it. Two quotes
 * ₹1.25 L apart are almost never both pricing the same house — one of them has
 * a mandir in it, or thicker board, or a kitchen the other quietly left out.
 * So the total answers a question nobody asked: *which of these two different
 * jobs costs less?*
 *
 * Starring lets the customer say which work they are actually buying, and this
 * module answers on exactly those lines. "On your six starred lines, Chitra &
 * Co. is ₹38,400 cheaper" is a sentence somebody can act on, because they
 * chose the six.
 *
 * ## The rule that keeps it honest
 *
 * A tally is a price verdict, and a price verdict with no material beside it
 * is the whole disease this product was built against. So:
 *
 * - A studio that did not quote a starred line is **excluded from the
 *   comparison** rather than credited with ₹0. Not quoting the mandir is how
 *   you win a price comparison you should have lost.
 * - When the starred lines contain a material disagreement, the result carries
 *   it, and the screen must print it. `cheaper` is never allowed to travel
 *   without `caveats`.
 *
 * Pure, per CONTRIBUTING §9.5 — no `server-only`, imported by a client
 * component and by the tests.
 */

import type { Paise } from '@/lib/money';
import type { ComparedLine } from './first-quote';

export interface StarredStudio {
  slug: string;
  name: string;
  /** Total across the starred lines this studio actually priced. */
  totalPaise: Paise;
  /** Starred lines this studio left unpriced. */
  missing: string[];
}

export interface StarredTally {
  /** Codes that were starred AND exist in this comparison. */
  codes: string[];
  /** Everyone, cheapest first. Studios missing a starred line come last. */
  studios: StarredStudio[];
  /** Cheapest among the studios that priced every starred line. Null if none did. */
  leader: StarredStudio | null;
  /** Second cheapest of those, so the gap can be stated. */
  runnerUp: StarredStudio | null;
  /**
   * What must be said alongside the number. Never empty when a material
   * disagreement exists on a starred line.
   */
  caveats: string[];
}

/**
 * Add up the starred lines.
 *
 * `lines` is every line in the comparison; `starred` is the codes the customer
 * marked. Codes that are starred but absent from this comparison — a line from
 * a different property type, say — are ignored rather than counted as missing.
 */
export function tallyStarred(
  lines: ComparedLine[],
  starred: readonly string[],
  studios: { slug: string; name: string }[],
): StarredTally {
  const set = new Set(starred);
  const picked = lines.filter((l) => set.has(l.code));

  const rows: StarredStudio[] = studios.map((s) => {
    let total = 0;
    const missing: string[] = [];
    for (const line of picked) {
      const cell = line.cells.find((c) => c.slug === s.slug);
      if (!cell || cell.amountPaise === null) {
        missing.push(line.label);
        continue;
      }
      total += cell.amountPaise;
    }
    return { slug: s.slug, name: s.name, totalPaise: total, missing };
  });

  // Missing a starred line means you are not in the race for it. Sorting the
  // incompletes to the bottom rather than dropping them keeps them visible,
  // which is the point — a gap is a finding, not an absence.
  const sorted = [...rows].sort((a, b) => {
    if (a.missing.length !== b.missing.length) return a.missing.length - b.missing.length;
    return a.totalPaise - b.totalPaise;
  });

  const complete = sorted.filter((r) => r.missing.length === 0);

  const caveats: string[] = [];
  for (const line of picked) {
    if (!line.materialsDiffer) continue;
    caveats.push(line.label);
  }

  return {
    codes: picked.map((l) => l.code),
    studios: sorted,
    leader: complete[0] ?? null,
    runnerUp: complete[1] ?? null,
    caveats,
  };
}

/**
 * The gap between the leader and the next one, or null when there is no
 * meaningful race — nobody priced everything, or only one studio did.
 */
export function starredGap(tally: StarredTally): Paise | null {
  if (!tally.leader || !tally.runnerUp) return null;
  return tally.runnerUp.totalPaise - tally.leader.totalPaise;
}
