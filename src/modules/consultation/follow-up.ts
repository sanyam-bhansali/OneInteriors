/**
 * The follow-up call (pilot plan, 30 Sep 2026): everyone who finishes the
 * brief and leaves a number but does not book the expert call gets a call from
 * the team, within a day — "I have read your quotes; would thirty minutes
 * help?". It is the biggest lever on the brief → call rate, and it withholds
 * nothing from anyone.
 *
 * Covered by DATA_PROCESSING consent, whose notice already says we use the
 * number to reach them about their matches and their call.
 *
 * Pure, and tested.
 */

export const FOLLOW_UP_OUTCOMES = ['BOOKED', 'CALL_BACK', 'NO_ANSWER', 'NOT_INTERESTED'] as const;
export type FollowUpOutcome = (typeof FOLLOW_UP_OUTCOMES)[number];

export const OUTCOME_LABELS: Record<FollowUpOutcome, string> = {
  BOOKED: 'Booked the call',
  CALL_BACK: 'Asked us to call back',
  NO_ANSWER: 'No answer',
  NOT_INTERESTED: 'Not interested',
};

/** Briefs finished within this window are on the list. */
export const WINDOW_DAYS = 14;
/** The target: called within this long of finishing the brief. */
export const TARGET_HOURS = 24;
/** A "call back" or "no answer" comes back onto the list after this long. */
export const RETRY_HOURS = 24;
/** Stop after this many unanswered tries — the follow-up is a call, not a campaign. */
export const MAX_TRIES = 3;

const HOUR = 3_600_000;

export interface FollowUpFacts {
  completedAt: Date | null;
  hasPhone: boolean;
  /** A consultation exists, in any state. */
  hasCall: boolean;
  outcome: string | null;
  followedUpAt: Date | null;
  /** Unanswered tries so far. */
  tries: number;
}

export function isOutcome(v: unknown): v is FollowUpOutcome {
  return typeof v === 'string' && (FOLLOW_UP_OUTCOMES as readonly string[]).includes(v);
}

/** Should this brief be on today's call list? */
export function needsFollowUp(f: FollowUpFacts, now: Date): boolean {
  if (!f.completedAt || !f.hasPhone || f.hasCall) return false;
  if (now.getTime() - f.completedAt.getTime() > WINDOW_DAYS * 24 * HOUR) return false;
  if (f.outcome === null) return true;
  if (f.outcome === 'BOOKED' || f.outcome === 'NOT_INTERESTED') return false;
  if (f.tries >= MAX_TRIES) return false;
  return !f.followedUpAt || now.getTime() - f.followedUpAt.getTime() >= RETRY_HOURS * HOUR;
}

/** Past the 24-hour target without a first call. */
export function isOverdue(f: Pick<FollowUpFacts, 'completedAt' | 'outcome'>, now: Date): boolean {
  return f.outcome === null && !!f.completedAt && now.getTime() - f.completedAt.getTime() > TARGET_HOURS * HOUR;
}

/** "3 hours ago", "2 days ago". */
export function ago(then: Date, now: Date): string {
  const h = Math.floor((now.getTime() - then.getTime()) / HOUR);
  if (h < 1) return 'under an hour ago';
  if (h < 48) return `${h} hour${h === 1 ? '' : 's'} ago`;
  return `${Math.floor(h / 24)} days ago`;
}
