import { describe, it, expect } from 'vitest';
import {
  canSeeContact,
  contactState,
  redactContact,
} from '@/modules/studio/introduction-access';
import {
  canTransition,
  validateTransition,
  isTerminal,
  hasPassed,
  needsOutcome,
  upcoming,
  groupByDay,
  formatDayKey,
  KIND_LABELS,
  STATUS_LABELS,
  type AppointmentStatusName,
} from '@/modules/studio/appointment-rules';
import {
  buildFunnel,
  diagnose,
  FUNNEL_STAGES,
  STAGE_LABELS,
  MIN_FOR_RATE,
  type FunnelCounts,
} from '@/modules/studio/dashboard-funnel';

/**
 * The studio dashboard's pure half.
 *
 * One test here matters more than all the others: a withdrawn introduction must
 * never show a customer's details. Everything else is a correctness check; that
 * one is the difference between keeping a promise made on the landing page and
 * breaking it silently, in a place only the customer would ever notice.
 */

// ═══════════════════════════════════════════════════════════════
// Contact release
// ═══════════════════════════════════════════════════════════════

const DAY = new Date('2026-09-01T10:00:00Z');

describe('canSeeContact', () => {
  it('shows details once contact has been released', () => {
    expect(canSeeContact({ contactReleasedAt: DAY, withdrawnAt: null })).toBe(true);
  });

  it('hides details before release', () => {
    expect(canSeeContact({ contactReleasedAt: null, withdrawnAt: null })).toBe(false);
  });

  /**
   * THE test.
   *
   * A withdrawn introduction that was previously released must come back false.
   * Reading the two fields in the other order — or with an `||` — leaves a
   * customer who asked to be removed still visible to the studio they asked to
   * be removed from. Nothing throws, nothing logs, and the only person who
   * finds out is the one who asked.
   */
  it('hides details after withdrawal, even though they were released', () => {
    expect(
      canSeeContact({ contactReleasedAt: DAY, withdrawnAt: new Date('2026-09-05T10:00:00Z') }),
    ).toBe(false);
  });

  it('hides details when withdrawn and never released', () => {
    expect(canSeeContact({ contactReleasedAt: null, withdrawnAt: DAY })).toBe(false);
  });
});

describe('contactState', () => {
  it('explains a withdrawal without implying it is temporary', () => {
    const state = contactState({ contactReleasedAt: DAY, withdrawnAt: DAY });
    expect(state.visible).toBe(false);
    if (state.visible) throw new Error('unreachable');
    expect(state.reason).toBe('withdrawn');
    expect(state.message.toLowerCase()).not.toContain('yet');
    expect(state.message.toLowerCase()).not.toContain('soon');
  });

  it('explains an unreleased introduction as pending', () => {
    const state = contactState({ contactReleasedAt: null, withdrawnAt: null });
    expect(state.visible).toBe(false);
    if (state.visible) throw new Error('unreachable');
    expect(state.reason).toBe('not_released');
    expect(state.message).toBeTruthy();
  });

  it('agrees with canSeeContact in every combination', () => {
    for (const released of [null, DAY]) {
      for (const withdrawn of [null, DAY]) {
        const intro = { contactReleasedAt: released, withdrawnAt: withdrawn };
        expect(contactState(intro).visible).toBe(canSeeContact(intro));
      }
    }
  });
});

describe('redactContact', () => {
  const person = { name: 'Asha', phone: '9876543210', email: 'a@example.com', other: 'kept' };

  it('passes the record through when contact is visible', () => {
    expect(redactContact(person, { contactReleasedAt: DAY, withdrawnAt: null })).toEqual(person);
  });

  it('nulls every identifying field when it is not', () => {
    const out = redactContact(person, { contactReleasedAt: null, withdrawnAt: null });
    expect(out.name).toBeNull();
    expect(out.phone).toBeNull();
    expect(out.email).toBeNull();
    // Non-identifying fields survive — this redacts a person, not a record.
    expect(out.other).toBe('kept');
  });

  it('redacts after a withdrawal', () => {
    const out = redactContact(person, { contactReleasedAt: DAY, withdrawnAt: DAY });
    expect(out.phone).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// Appointment rules
// ═══════════════════════════════════════════════════════════════

describe('appointment transitions', () => {
  it('lets a studio confirm, complete and cancel', () => {
    expect(canTransition('PROPOSED', 'CONFIRMED', 'STUDIO')).toBe(true);
    expect(canTransition('CONFIRMED', 'COMPLETED', 'STUDIO')).toBe(true);
    expect(canTransition('CONFIRMED', 'CANCELLED', 'STUDIO')).toBe(true);
  });

  /**
   * A studio cannot write the other party's absence into a permanent record.
   * Both sides will have a view of what happened, and letting whoever clicks
   * first decide is how a marketplace earns a reputation for being unfair.
   */
  it('does not let a studio mark a no-show', () => {
    expect(canTransition('CONFIRMED', 'NO_SHOW', 'STUDIO')).toBe(false);
    expect(canTransition('CONFIRMED', 'NO_SHOW', 'OPS')).toBe(true);
  });

  it('refuses to reopen anything terminal', () => {
    for (const terminal of ['COMPLETED', 'NO_SHOW', 'CANCELLED'] as AppointmentStatusName[]) {
      expect(isTerminal(terminal)).toBe(true);
      for (const to of ['PROPOSED', 'CONFIRMED', 'COMPLETED'] as AppointmentStatusName[]) {
        expect(canTransition(terminal, to, 'OPS')).toBe(false);
      }
    }
  });

  it('will not complete an appointment nobody confirmed', () => {
    expect(canTransition('PROPOSED', 'COMPLETED', 'OPS')).toBe(false);
  });

  it('labels every kind and status', () => {
    for (const label of Object.values(KIND_LABELS)) expect(label).toBeTruthy();
    for (const label of Object.values(STATUS_LABELS)) expect(label).toBeTruthy();
  });
});

describe('validateTransition', () => {
  it('refuses a no-show with nobody named', () => {
    const result = validateTransition('NO_SHOW', null);
    expect(result.ok).toBe(false);
  });

  it('accepts a no-show with a party', () => {
    expect(validateTransition('NO_SHOW', 'STUDIO').ok).toBe(true);
    expect(validateTransition('NO_SHOW', 'CUSTOMER').ok).toBe(true);
  });

  it('refuses a missing party on anything that is not a no-show', () => {
    expect(validateTransition('COMPLETED', 'CUSTOMER').ok).toBe(false);
  });

  it('accepts an ordinary transition', () => {
    expect(validateTransition('COMPLETED', null).ok).toBe(true);
  });
});

describe('time helpers', () => {
  const now = new Date('2026-09-15T12:00:00Z');

  const at = (iso: string, status: AppointmentStatusName = 'CONFIRMED') => ({
    startsAt: new Date(iso),
    durationMins: 60,
    status,
  });

  it('knows what has passed, accounting for duration', () => {
    // Starts at 11:30, runs an hour, so at 12:00 it is still going.
    expect(hasPassed(at('2026-09-15T11:30:00Z'), now)).toBe(false);
    expect(hasPassed(at('2026-09-15T10:00:00Z'), now)).toBe(true);
    expect(hasPassed(at('2026-09-16T10:00:00Z'), now)).toBe(false);
  });

  it('lists only future, non-terminal appointments, soonest first', () => {
    const list = [
      at('2026-09-20T10:00:00Z'),
      at('2026-09-16T10:00:00Z'),
      at('2026-09-01T10:00:00Z'),
      at('2026-09-18T10:00:00Z', 'CANCELLED'),
    ];

    const result = upcoming(list, now);
    expect(result).toHaveLength(2);
    expect(result[0]?.startsAt.toISOString()).toBe('2026-09-16T10:00:00.000Z');
  });

  it('flags past appointments that still have no outcome', () => {
    const list = [
      at('2026-09-01T10:00:00Z'),
      at('2026-09-02T10:00:00Z', 'COMPLETED'),
      at('2026-09-20T10:00:00Z'),
    ];

    const result = needsOutcome(list, now);
    expect(result).toHaveLength(1);
    expect(result[0]?.startsAt.toISOString()).toBe('2026-09-01T10:00:00.000Z');
  });

  /**
   * The database stores UTC and Pune is UTC+5:30, so an evening appointment
   * belongs to the NEXT day in UTC and the current one in IST. A calendar that
   * groups by the server's idea of a day puts a 9pm meeting under tomorrow.
   */
  it('groups by the Indian day, not the UTC one', () => {
    // 20:00 IST on 15 September is 14:30 UTC on 15 September.
    expect(formatDayKey(new Date('2026-09-15T14:30:00Z'))).toBe('2026-09-15');
    // 00:30 IST on 16 September is 19:00 UTC on 15 September.
    expect(formatDayKey(new Date('2026-09-15T19:00:00Z'))).toBe('2026-09-16');
  });

  it('groups into days in chronological order', () => {
    const days = groupByDay([
      { startsAt: new Date('2026-09-20T05:00:00Z') },
      { startsAt: new Date('2026-09-18T05:00:00Z') },
      { startsAt: new Date('2026-09-18T09:00:00Z') },
    ]);

    expect(days).toHaveLength(2);
    expect(days[0]?.key).toBe('2026-09-18');
    expect(days[0]?.items).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════
// The funnel
// ═══════════════════════════════════════════════════════════════

const HEALTHY: FunnelCounts = {
  shown: 40,
  opened: 30,
  compared: 24,
  namedInCall: 18,
  introduced: 14,
  signed: 10,
};

describe('buildFunnel', () => {
  it('returns every stage, in order', () => {
    const steps = buildFunnel(HEALTHY);
    expect(steps.map((s) => s.stage)).toEqual([...FUNNEL_STAGES]);
    for (const step of steps) expect(step.label).toBe(STAGE_LABELS[step.stage]);
  });

  it('computes the share of the previous stage', () => {
    const steps = buildFunnel(HEALTHY);
    expect(steps[1]?.rateFromPrevious).toBe(75); // 30 of 40
  });

  it('gives the first stage no incoming rate', () => {
    expect(buildFunnel(HEALTHY)[0]?.rateFromPrevious).toBeNull();
  });

  /**
   * Two of three is not a 67% conversion rate, it is three data points — and a
   * studio shown that number will plan against it.
   */
  it('says nothing rather than computing a rate from too little', () => {
    const thin: FunnelCounts = {
      shown: 3,
      opened: 2,
      compared: 1,
      namedInCall: 1,
      introduced: 1,
      signed: 0,
    };

    for (const step of buildFunnel(thin)) {
      expect(step.rateFromPrevious).toBeNull();
      expect(step.rateFromShown).toBeNull();
    }
  });

  it('still reports the raw counts when rates are suppressed', () => {
    const thin: FunnelCounts = { ...HEALTHY, shown: 2, opened: 1 };
    expect(buildFunnel(thin)[0]?.count).toBe(2);
  });

  /**
   * These stages are a journey, not a strict nesting — the comparison page is
   * reachable from the match list without opening a profile first, so
   * `compared` can honestly exceed `opened`. The shape is still useful; a
   * studio reading "126% of the step before" would conclude the page is broken.
   */
  it('never reports a rate above 100%, even when a later stage is larger', () => {
    const wide: FunnelCounts = {
      shown: 40,
      opened: 10,
      compared: 20,
      namedInCall: 8,
      introduced: 5,
      signed: 2,
    };

    for (const step of buildFunnel(wide)) {
      if (step.rateFromPrevious !== null) expect(step.rateFromPrevious).toBeLessThanOrEqual(100);
      if (step.rateFromShown !== null) expect(step.rateFromShown).toBeLessThanOrEqual(100);
    }
  });

  it('does not divide by zero on an empty funnel', () => {
    const empty: FunnelCounts = {
      shown: 0,
      opened: 0,
      compared: 0,
      namedInCall: 0,
      introduced: 0,
      signed: 0,
    };

    for (const step of buildFunnel(empty)) {
      expect(step.count).toBe(0);
      expect(step.rateFromPrevious).toBeNull();
      expect(Number.isNaN(step.rateFromShown ?? 0)).toBe(false);
    }
  });
});

describe('diagnose', () => {
  it('says nothing useful when there is nothing to go on', () => {
    const result = diagnose({ ...HEALTHY, shown: MIN_FOR_RATE - 1 });
    expect(result.stage).toBeNull();
    expect(result.message).toBeTruthy();
  });

  /** A drop at every stage is normal. Calling it out manufactures a problem. */
  it('stays quiet on a healthy funnel', () => {
    expect(diagnose(HEALTHY).stage).toBeNull();
    expect(diagnose(HEALTHY).message).toBeNull();
  });

  it('finds a profile problem when people see and do not open', () => {
    const result = diagnose({ ...HEALTHY, opened: 6, compared: 5, namedInCall: 4, introduced: 4, signed: 3 });
    expect(result.stage).toBe('opened');
    expect(result.message).toContain('profile');
  });

  it('finds a sales problem when introductions do not sign', () => {
    const result = diagnose({ ...HEALTHY, signed: 1 });
    expect(result.stage).toBe('signed');
  });

  it('names only one stage, even when several are weak', () => {
    const result = diagnose({
      shown: 40,
      opened: 10,
      compared: 3,
      namedInCall: 1,
      introduced: 1,
      signed: 0,
    });
    expect(FUNNEL_STAGES).toContain(result.stage);
  });

  /**
   * The messages must be usable, not encouraging. A studio told to try harder
   * and given nothing to do concludes we are managing them.
   */
  it('never scolds', () => {
    const messages = [
      diagnose({ ...HEALTHY, opened: 6, compared: 5, namedInCall: 4, introduced: 4, signed: 3 }).message,
      diagnose({ ...HEALTHY, signed: 1 }).message,
    ];

    for (const message of messages) {
      const lower = (message ?? '').toLowerCase();
      expect(lower).not.toContain('you should');
      expect(lower).not.toContain('poor');
      expect(lower).not.toContain('failing');
    }
  });
});
