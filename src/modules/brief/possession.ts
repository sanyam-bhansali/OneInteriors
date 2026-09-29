/**
 * Possession — the date everything in a Pune interior project counts from.
 *
 * ## Why the brief asks this instead of a move-in date
 *
 * Q9 used to ask "when do you want to move in?" and promised, underneath,
 * that a date too tight would be flagged. Nothing flagged it, and the
 * question was the wrong one anyway: most of these customers are buying into
 * a new building, and the fact that governs the project is when they get the
 * keys. A studio cannot start work before possession, design can start
 * before it, and the move-in date follows from both. So the brief asks where
 * they are with the flat, and the timeline is built from that.
 *
 * Pure — no `server-only` — so the quiz, the studio's brief panel, the ops
 * call sheet and the tests all read the same rules (CONTRIBUTING §9.5).
 */

import type { Brief, PossessionStatus, ScopeType } from './types';

/**
 * How long a full home takes from design sign-off to handover, in days.
 *
 * The only duration this product has evidence for, and the one the quiz has
 * always quoted. Other scopes get no window until studios' own durations are
 * collected (docs/STUDIO-PROFILE-REQUIREMENTS.md §4) — a guessed kitchen
 * timeline shown as ours would be exactly the invented number this product
 * exists not to print.
 */
export const FULL_HOME_DAYS = { min: 70, max: 130 } as const;

/** Has Q9 been answered well enough to move on? */
export function possessionAnswered(
  brief: Pick<Brief, 'possessionStatus' | 'possessionOn'>,
): boolean {
  if (brief.possessionStatus === 'HAVE_KEYS' || brief.possessionStatus === 'NOT_SURE') return true;
  // "Expecting it" needs the month, or it tells a studio nothing.
  return brief.possessionStatus === 'EXPECTED' && monthOf(brief.possessionOn) !== null;
}

/** "December 2026". Month precision, because that is the precision asked for. */
export function monthLabel(iso: string | null | undefined): string | null {
  const d = monthOf(iso);
  return d ? d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : null;
}

/**
 * The answer in a few words, for anyone reading the brief back — the quiz's
 * running panel, the studio's brief panel, the note on an introduced lead,
 * the ops call sheet. One wording everywhere.
 *
 * Briefs written before 29 Sep have no status. They fall back to the move-in
 * date they did give, then to a possession month, so an older brief still
 * says something to the studio it reaches.
 */
export function possessionPhrase(
  brief: Pick<Brief, 'possessionStatus' | 'possessionOn' | 'moveInBy'>,
): string | null {
  switch (brief.possessionStatus) {
    case 'HAVE_KEYS':
      return 'Has the keys';
    case 'EXPECTED': {
      const month = monthLabel(brief.possessionOn);
      return month ? `Possession expected ${month}` : 'Expecting possession';
    }
    case 'NOT_SURE':
      return 'Possession date not known yet';
    default: {
      const moveIn = monthLabel(brief.moveInBy);
      if (moveIn) return `Wants to move in by ${moveIn}`;
      const month = monthLabel(brief.possessionOn);
      return month ? `Possession ${month}` : null;
    }
  }
}

/**
 * When a full home could be ready, counting from the keys.
 *
 * Assumes the design is signed off by possession — which is what designing
 * before handover is for — and says so wherever it is shown. `from` is the
 * later of the possession month and `today`, so a date already past does not
 * produce a window in the past.
 *
 * `null` for any scope but a full home (see `FULL_HOME_DAYS`), and when there
 * is nothing to count from.
 */
export function readyWindow(
  status: PossessionStatus | null,
  possessionOn: string | null,
  scope: ScopeType | null,
  today: Date = new Date(),
): { from: Date; to: Date } | null {
  if (scope !== 'FULL_HOME') return null;

  let start: Date | null = null;
  if (status === 'HAVE_KEYS') start = today;
  else if (status === 'EXPECTED') start = monthOf(possessionOn);
  if (!start) return null;
  if (start < today) start = today;

  return { from: addDays(start, FULL_HOME_DAYS.min), to: addDays(start, FULL_HOME_DAYS.max) };
}

/** First of the month for "2026-12" or "2026-12-01"; null for anything else. */
export function monthOf(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return new Date(Date.UTC(year, month - 1, 1));
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}
