import { describe, it, expect } from 'vitest';
import { FREE_CALLS, SHOW_REMAINING_AT, offerState } from '@/modules/consultation/offer';
import { BENEFITS, showcase } from '@/modules/portal/benefits';
import { MAX_TRIES, isOverdue, needsFollowUp } from '@/modules/consultation/follow-up';
import { callRate, journeyStages } from '@/modules/analytics/journey';

describe('the expert-call offer', () => {
  it('is ₹5,000, free for the first 1,000', () => {
    const o = offerState(0);
    expect(o.price).toBe('₹5,000');
    expect(o.free).toBe(true);
    expect(o.headline).toBe('Free for the first 1,000 customers');
    expect(o.remaining).toBeNull();
  });

  it('shows how many are left only once it is few enough to matter — and it is the real count', () => {
    expect(offerState(FREE_CALLS - SHOW_REMAINING_AT - 1).remaining).toBeNull();
    expect(offerState(FREE_CALLS - 184).remaining).toBe('184 free calls left');
    expect(offerState(FREE_CALLS - 1).remaining).toBe('1 free call left');
  });

  it('stops saying free when the free calls run out', () => {
    const o = offerState(FREE_CALLS);
    expect(o.free).toBe(false);
    expect(o.headline).not.toMatch(/free/i);
  });
});

describe('the benefits showcase', () => {
  it('leads with money and shows only benefits with terms', () => {
    const items = showcase();
    expect(items[0]!.short).toContain('₹50,000');
    expect(items.every((b) => b.terms.length > 0)).toBe(true);
  });

  it('drops a benefit whose terms are withdrawn', () => {
    const without = BENEFITS.map((b) => (b.id === 'cashback' ? { ...b, terms: null } : b));
    expect(showcase(without).some((b) => b.id === 'cashback')).toBe(false);
  });
});

describe('the follow-up call list', () => {
  const now = new Date('2026-10-02T10:00:00Z');
  const base = {
    completedAt: new Date('2026-10-01T08:00:00Z'),
    hasPhone: true,
    hasCall: false,
    outcome: null,
    followedUpAt: null,
    tries: 0,
  };

  it('lists a finished brief with a number and no call', () => {
    expect(needsFollowUp(base, now)).toBe(true);
    expect(isOverdue(base, now)).toBe(true);
  });

  it('leaves out anyone with a call, no number, or an old brief', () => {
    expect(needsFollowUp({ ...base, hasCall: true }, now)).toBe(false);
    expect(needsFollowUp({ ...base, hasPhone: false }, now)).toBe(false);
    expect(needsFollowUp({ ...base, completedAt: new Date('2026-09-10T08:00:00Z') }, now)).toBe(false);
  });

  it('brings back a no-answer the next day, and stops after three tries', () => {
    const tried = { ...base, outcome: 'NO_ANSWER', tries: 1 };
    expect(needsFollowUp({ ...tried, followedUpAt: new Date('2026-10-02T06:00:00Z') }, now)).toBe(false);
    expect(needsFollowUp({ ...tried, followedUpAt: new Date('2026-10-01T09:00:00Z') }, now)).toBe(true);
    expect(needsFollowUp({ ...tried, tries: MAX_TRIES, followedUpAt: new Date('2026-10-01T09:00:00Z') }, now)).toBe(false);
  });

  it('never calls again after "not interested"', () => {
    expect(needsFollowUp({ ...base, outcome: 'NOT_INTERESTED', followedUpAt: new Date('2026-09-30T00:00:00Z') }, now)).toBe(false);
  });
});

describe('the journey funnel', () => {
  const counts = { started: 100, finished: 60, leftNumber: 50, matched: 58, callBooked: 21, callDone: 18, introduced: 15, signed: 4 };

  it('measures finished → booked call against the 40–50% target', () => {
    expect(callRate(counts)).toEqual({ rate: 0.35, verdict: 'below' });
    expect(callRate({ ...counts, callBooked: 27 })!.verdict).toBe('on');
    expect(callRate({ ...counts, finished: 0 })).toBeNull();
  });

  it('gives each stage its share of the one before', () => {
    const stages = journeyStages(counts);
    expect(stages[0]!.fromPrevious).toBeNull();
    expect(stages[1]!.fromPrevious).toBe(0.6);
  });
});

describe('what the benefits are worth', () => {
  it('adds up to ₹76,000 for the customer — cashback, cab, shoot and hamper; a referral pays someone else', async () => {
    const { showcaseWorthPaise, unlockedWorthPaise } = await import('@/modules/portal/benefits');
    expect(showcaseWorthPaise()).toBe(7_600_000);
    expect(unlockedWorthPaise('START')).toBe(0);
    expect(unlockedWorthPaise('INTRODUCED')).toBe(100_000);
    expect(unlockedWorthPaise('SIGNED')).toBe(5_100_000);
    expect(unlockedWorthPaise('HANDOVER')).toBe(7_600_000);
  });
});
