/**
 * What an introduction is waiting on us for.
 *
 * Pure, and in its own file with no `server-only`, per CONTRIBUTING §9.5 —
 * `introduction-ops.ts` is Prisma and auth, and a test cannot import that.
 *
 * This is the single definition read by both the /ops/introductions list and
 * the counter on the ops overview. Inlining it twice is how a badge comes to
 * say 3 over a page showing 5, and a queue that disagrees with its own count
 * stops being believed within a week.
 */

import { hasPassed, type AppointmentStatusName } from './appointment-rules';

export type IntroductionNeed =
  | 'no_meeting'        // introduced, and nothing has been arranged
  | 'unconfirmed'       // a time was proposed and nobody confirmed it
  | 'outcome_missing';  // the meeting has passed and nobody said how it went

export const NEED_LABEL: Record<IntroductionNeed, string> = {
  no_meeting: 'No meeting arranged',
  unconfirmed: 'Waiting on confirmation',
  outcome_missing: 'Did this happen?',
};

export interface AppointmentFacts {
  status: AppointmentStatusName;
  startsAt: Date;
  durationMins: number;
}

/**
 * Null means nothing is waiting on us.
 *
 * A withdrawn introduction always returns null: it is over, and putting a
 * finished relationship on a to-do list is how the to-do list stops being read.
 */
export function whatItNeeds(
  withdrawnAt: Date | null,
  appointments: AppointmentFacts[],
  now: Date = new Date(),
): IntroductionNeed | null {
  if (withdrawnAt) return null;

  const live = appointments.filter((a) => a.status === 'PROPOSED' || a.status === 'CONFIRMED');

  if (live.length === 0) {
    // A completed meeting means the relationship is running and we are not the
    // bottleneck. A cancellation or a no-show leaves it live with nothing
    // arranged, which is the same situation as never having arranged anything.
    const settled = appointments.some((a) => a.status === 'COMPLETED');
    return settled ? null : 'no_meeting';
  }

  /**
   * A passed meeting outranks an unconfirmed future one.
   *
   * Including a PROPOSED slot that has now lapsed — that is worse than an
   * unconfirmed future time and must not be reported as one. Nobody confirmed,
   * the slot is gone, and somebody has to find out what happened rather than
   * wait for a confirmation that can no longer arrive.
   */
  if (live.some((a) => hasPassed(a, now))) return 'outcome_missing';

  if (live.every((a) => a.status === 'PROPOSED')) return 'unconfirmed';
  return null;
}
