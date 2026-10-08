import { describe, expect, it } from 'vitest';
import { EMPTY_BRIEF, type Brief } from '@/modules/brief/types';
import { rankStudios } from '@/modules/matching/score';
import { budgetPosition } from '@/modules/matching/signals';
import { googleCalendarUrl } from '@/modules/consultation/slots';
import { STUDIOS } from '@/data/studios';
import { filedRatesFor } from '@/data/filed-rates';

/**
 * The changes from the fifty-app research (docs/UX-PRINCIPLES-PLAN.md) that
 * are rules rather than layout: a claim said once, a quote below the range
 * called below, and the calendar link the confirmation offers.
 */

const TODAY = new Date('2026-09-20T00:00:00Z');
const opts = { today: TODAY, ratesFor: filedRatesFor };

const brief: Brief = {
  ...EMPTY_BRIEF,
  propertyType: 'BHK_2',
  carpetAreaSqft: 960,
  locality: 'baner',
  possessionStatus: 'HAVE_KEYS',
  scope: 'FULL_HOME',
  tier: 'ESSENTIAL',
  budgetMinPaise: 1200 * 960 * 100,
  budgetMaxPaise: 1800 * 960 * 100,
  styleLikes: ['contemporary-minimal', 'indian-contemporary'],
  priorityRanking: ['BUDGET', 'SPEED', 'DESIGN_AMBITION', 'MATERIAL_QUALITY'],
  involvement: 'COLLABORATE',
  completedAt: '2026-09-20T00:00:00Z',
};

describe('one claim, said once', () => {
  it('does not repeat the first priority in the reasons below it', () => {
    for (const m of rankStudios(brief, STUDIOS, 6, opts)) {
      const budget = m.reasoning.filter((r) => /your range/i.test(r));
      expect(budget.length, m.studioId).toBeLessThanOrEqual(1);
    }
  });
});

describe('where a quote sits against the range', () => {
  it('says "below" when the quote is under the floor, not "at the bottom"', () => {
    // Luxury's floor is far above an archive-rate quote for any studio.
    const luxury: Brief = { ...brief, tier: 'LUXURY', budgetMinPaise: 2500 * 960 * 100, budgetMaxPaise: null };
    const studio = STUDIOS.find((s) => Object.keys(filedRatesFor(s.slug)).length > 0)!;
    const signal = budgetPosition(luxury, studio, { today: TODAY, ratesFor: filedRatesFor });
    expect(signal?.evidence).toBe('Their quote for your home comes in below your range');
  });
});

describe('add to calendar', () => {
  it('is a thirty-minute Google Calendar event at the booked time', () => {
    const url = new URL(
      googleCalendarUrl({ startsAt: '2026-10-10T05:30:00.000Z', title: 'Call', details: 'Agenda' }),
    );
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('dates')).toBe('20261010T053000Z/20261010T060000Z');
    expect(url.searchParams.get('text')).toBe('Call');
  });
});
