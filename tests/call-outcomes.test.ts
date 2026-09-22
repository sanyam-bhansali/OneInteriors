import { describe, expect, it } from 'vitest';
import {
  CALL_OUTCOMES,
  OUTCOME_FOLLOWUP,
  contactSummary,
  followupDue,
} from '@/modules/studio-practice/event-copy';

/**
 * Logging a call writes a task. So the interesting cases are the ones where
 * the task would be wrong: a deadline in the past, a promise to ring somebody
 * who just said no, an outcome nobody thought about.
 */

describe('OUTCOME_FOLLOWUP', () => {
  it('covers every outcome the buttons offer', () => {
    /* A missing key renders as `undefined` and silently sets no task, which
       looks exactly like a working button. */
    for (const o of CALL_OUTCOMES) {
      expect(OUTCOME_FOLLOWUP, o.id).toHaveProperty(o.id);
    }
  });

  it('clears rather than skips when they said no', () => {
    /**
     * The difference matters. Skipping leaves "Try them again" due tomorrow
     * against somebody who has just declined — a task that is now a promise
     * to annoy them.
     */
    expect(OUTCOME_FOLLOWUP.not_interested).toBe('clear');
    expect(followupDue('not_interested')).toBeNull();
  });

  it('varies the deadline with what was promised', () => {
    /* Not a uniform 24 hours. Somebody waiting on a quotation after a site
       visit is comparing studios this week; somebody who just picked up is
       not expecting a call tomorrow. */
    const noon = new Date('2026-09-22T12:00:00');
    expect(followupDue('no_answer', noon)?.getDate()).toBe(23);
    expect(followupDue('site_visit', noon)?.getDate()).toBe(24);
    expect(followupDue('spoke', noon)?.getDate()).toBe(25);
  });
});

describe('followupDue', () => {
  it('lands at 10am, not the hour of the call', () => {
    /* A task due at 19:40 sorts into the evening of a day nobody is working,
       and the board orders on exactly this column. */
    const due = followupDue('no_answer', new Date('2026-09-22T19:40:00'));
    expect(due?.getHours()).toBe(10);
    expect(due?.getMinutes()).toBe(0);
  });

  it('is never in the past, whatever time the call happened', () => {
    /**
     * Flooring to 10am can pull a deadline backwards. A task created already
     * overdue puts a red badge on the board a second after somebody did the
     * right thing, which teaches them to stop logging calls.
     */
    for (const outcome of CALL_OUTCOMES) {
      for (const hour of [0, 6, 9, 10, 11, 18, 23]) {
        const now = new Date('2026-09-22T00:00:00');
        now.setHours(hour, 45, 0, 0);

        const due = followupDue(outcome.id, now);
        if (due) {
          expect(due.getTime(), `${outcome.id} at ${hour}:45`).toBeGreaterThan(now.getTime());
        }
      }
    }
  });
});

describe('contactSummary', () => {
  it('keeps the note, because that is the part worth reading', () => {
    expect(contactSummary('spoke', 'wants a quote for the kitchen')).toContain(
      'wants a quote for the kitchen',
    );
  });

  it('stands alone without one', () => {
    expect(contactSummary('no_answer')).toBe('Called — no answer');
  });
});
