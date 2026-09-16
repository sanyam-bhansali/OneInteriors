import { describe, it, expect } from 'vitest';
// The PURE half. `introduction-ops` carries `server-only`, whose package throws
// on import outside a react-server condition — importing it here would kill the
// whole file before a single case ran. CONTRIBUTING §9.5.
import { whatItNeeds, NEED_LABEL } from '@/modules/studio/introduction-needs';
import type { AppointmentStatusName } from '@/modules/studio/appointment-rules';

/**
 * `whatItNeeds` is the single definition of "this introduction is waiting on
 * us", read by both the /ops/introductions list and the counter on the
 * overview. If the two ever disagree the badge says 3 and the page shows 5,
 * and the queue stops being believed — so the definition is pure and tested
 * rather than inlined twice.
 */

const NOW = new Date('2026-09-14T12:00:00+05:30');

function appt(
  status: AppointmentStatusName,
  when: string,
  durationMins = 60,
): { status: AppointmentStatusName; startsAt: Date; durationMins: number } {
  return { status, startsAt: new Date(when), durationMins };
}

const PAST = '2026-09-13T15:00:00+05:30';
const FUTURE = '2026-09-20T15:00:00+05:30';

describe('whatItNeeds', () => {
  it('wants a meeting when an introduction has none', () => {
    expect(whatItNeeds(null, [], NOW)).toBe('no_meeting');
  });

  it('wants confirmation while the only time is proposed', () => {
    expect(whatItNeeds(null, [appt('PROPOSED', FUTURE)], NOW)).toBe('unconfirmed');
  });

  it('is satisfied by a confirmed future meeting', () => {
    expect(whatItNeeds(null, [appt('CONFIRMED', FUTURE)], NOW)).toBeNull();
  });

  it('asks for an outcome once a live meeting has passed', () => {
    expect(whatItNeeds(null, [appt('CONFIRMED', PAST)], NOW)).toBe('outcome_missing');
  });

  it('asks for an outcome on a proposal that lapsed unconfirmed', () => {
    // Worse than an unconfirmed future time, and it must not be reported as
    // one: nobody confirmed and the slot is gone, so somebody has to find out
    // what happened rather than wait for a confirmation that cannot arrive.
    expect(whatItNeeds(null, [appt('PROPOSED', PAST)], NOW)).toBe('outcome_missing');
  });

  it('stays quiet once the meeting has been recorded as happened', () => {
    expect(whatItNeeds(null, [appt('COMPLETED', PAST)], NOW)).toBeNull();
  });

  it('asks for a new meeting when the only one was cancelled', () => {
    // A cancellation leaves the relationship live and nothing arranged, which
    // is the same situation as never having arranged anything.
    expect(whatItNeeds(null, [appt('CANCELLED', PAST)], NOW)).toBe('no_meeting');
  });

  it('treats a no-show as needing a new meeting, not an outcome', () => {
    expect(whatItNeeds(null, [appt('NO_SHOW', PAST)], NOW)).toBe('no_meeting');
  });

  it('prefers the passed meeting when one of several has lapsed', () => {
    expect(
      whatItNeeds(null, [appt('CONFIRMED', PAST), appt('PROPOSED', FUTURE)], NOW),
    ).toBe('outcome_missing');
  });

  it('wants nothing from a withdrawn introduction', () => {
    // Withdrawn is over. Putting a finished relationship on a to-do list is
    // how the to-do list stops being read.
    expect(whatItNeeds(new Date('2026-09-12'), [], NOW)).toBeNull();
    expect(whatItNeeds(new Date('2026-09-12'), [appt('CONFIRMED', PAST)], NOW)).toBeNull();
  });

  it('has a label for every need it can return', () => {
    const returned = new Set(
      [
        whatItNeeds(null, [], NOW),
        whatItNeeds(null, [appt('PROPOSED', FUTURE)], NOW),
        whatItNeeds(null, [appt('CONFIRMED', PAST)], NOW),
      ].filter((n): n is NonNullable<typeof n> => n !== null),
    );

    expect(returned.size).toBe(3);
    for (const need of returned) expect(NEED_LABEL[need]).toBeTruthy();
  });
});
