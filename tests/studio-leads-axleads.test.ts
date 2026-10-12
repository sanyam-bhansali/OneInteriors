import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { clockAt, istInputs, laterToday, nextWorkingDay, quickAt, tomorrowCall, whenLabel } from '@/modules/studio-sales/call-schedule';
import { CALL_OUTCOMES, OUTCOME_FOLLOWUP, contactSummary, followupDue, isCallOutcome } from '@/modules/studio-practice/event-copy';
import { LOST_LABELS } from '@/modules/studio-practice/vocabulary';
import {
  NOT_SET,
  describeFilters,
  leadFiltersToQuery,
  parseLeadFilters,
  withCustom,
  withoutChip,
} from '@/modules/studio-sales/lead-filters';
import { leadWhere } from '@/modules/studio-sales/lead-where';
import { cleanFilters } from '@/modules/studio-practice/view-filters';

/** The AxLeads items (owner, 12 Oct 2026): docs/studio-os/LEADS-SCALE-BUILT.md. */

const ist = (day: string, hm: string) => new Date(Date.parse(`${day}T${hm}:00Z`) - 330 * 60_000);

describe('when to call — quick choices in India time', () => {
  it('later today is 5:30 pm until 3:30 pm, then two hours from now', () => {
    expect(laterToday(ist('2026-10-12', '10:00'))).toEqual(ist('2026-10-12', '17:30'));
    expect(laterToday(ist('2026-10-12', '15:29'))).toEqual(ist('2026-10-12', '17:30'));
    expect(laterToday(ist('2026-10-12', '15:30'))).toEqual(ist('2026-10-12', '17:30'));
    expect(laterToday(ist('2026-10-12', '15:31'))).toEqual(ist('2026-10-12', '17:31'));
    expect(laterToday(ist('2026-10-12', '21:00'))).toEqual(ist('2026-10-12', '23:00'));
  });

  it('tomorrow is the next working day (Mon–Sat) at 3:30 pm', () => {
    expect(tomorrowCall(ist('2026-10-12', '10:00'))).toEqual(ist('2026-10-13', '15:30')); // Mon → Tue
    expect(tomorrowCall(ist('2026-10-17', '10:00'))).toEqual(ist('2026-10-19', '15:30')); // Sat → Mon
    expect(tomorrowCall(ist('2026-10-18', '10:00'))).toEqual(ist('2026-10-19', '15:30')); // Sun → Mon
    expect(nextWorkingDay('2026-10-16')).toBe('2026-10-17'); // Fri → Sat
    // 11 pm UTC on Monday is already Tuesday in India.
    expect(tomorrowCall(new Date('2026-10-12T20:00:00Z'))).toEqual(ist('2026-10-14', '15:30'));
  });

  it('quick choices, labels and inputs', () => {
    const now = ist('2026-10-12', '10:00');
    expect(quickAt('pick', now)).toBeNull();
    expect(quickAt('tomorrow', now)).toEqual(ist('2026-10-13', '15:30'));
    expect(istInputs(ist('2026-10-13', '15:30'))).toEqual({ day: '2026-10-13', time: '15:30' });
    expect(whenLabel(ist('2026-10-12', '17:30'), now)).toBe('Today 5:30 pm');
    expect(whenLabel(ist('2026-10-13', '15:30'), now)).toBe('Tomorrow 3:30 pm');
    expect(whenLabel(ist('2026-10-19', '10:00'), now)).toBe('Mon 19 Oct, 10 am');
  });

  it('the voicemail clock is 4 pm today, or later today once past 4', () => {
    expect(clockAt('today-16', ist('2026-10-12', '11:00'))).toEqual(ist('2026-10-12', '16:00'));
    expect(clockAt('today-16', ist('2026-10-12', '16:30'))).toEqual(ist('2026-10-12', '18:30'));
    expect(clockAt('in2h', ist('2026-10-12', '11:00'))).toEqual(ist('2026-10-12', '13:00'));
  });
});

describe('call outcomes: Busy, Switched off, Voicemail, Wrong number', () => {
  it('are on the list, each with a next action (or a cleared one)', () => {
    const ids = CALL_OUTCOMES.map((o) => o.id);
    for (const id of ['line_busy', 'switched_off', 'voicemail', 'wrong_number']) {
      expect(ids).toContain(id);
      expect(isCallOutcome(id)).toBe(true);
      expect(OUTCOME_FOLLOWUP).toHaveProperty(id);
    }
    expect(CALL_OUTCOMES.find((o) => o.id === 'line_busy')?.label).toBe('Busy');
    expect(contactSummary('voicemail')).toBe('Called — left a voicemail');
    // The old "busy" still means they asked us to ring back.
    expect(CALL_OUTCOMES.find((o) => o.id === 'busy')?.label).toBe('Asked to call back');
  });

  it('Busy → two hours; Switched off → tomorrow 3:30 pm; Voicemail → 4 pm; Wrong number → nothing', () => {
    const now = ist('2026-10-12', '11:00');
    expect(followupDue('line_busy', now)).toEqual(ist('2026-10-12', '13:00'));
    expect(followupDue('switched_off', now)).toEqual(ist('2026-10-13', '15:30'));
    expect(followupDue('voicemail', now)).toEqual(ist('2026-10-12', '16:00'));
    expect(OUTCOME_FOLLOWUP.wrong_number).toBe('clear');
    expect(followupDue('wrong_number', now)).toBeNull();
  });

  it('never lands in the past, at any hour', () => {
    for (const id of ['line_busy', 'switched_off', 'voicemail'] as const) {
      for (let h = 0; h < 24; h += 1) {
        const now = ist('2026-10-12', `${String(h).padStart(2, '0')}:45`);
        expect(followupDue(id, now)!.getTime(), `${id} at ${h}:45`).toBeGreaterThan(now.getTime());
      }
    }
  });

  it('has a lost reason for a wrong number, added by its own migration', () => {
    expect(LOST_LABELS.WRONG_NUMBER).toBe('Wrong number');
    const sql = readFileSync('prisma/migrations/20261012150000_studio_leads_axleads/migration.sql', 'utf8');
    expect(sql).toContain(`ALTER TYPE "LostReason" ADD VALUE IF NOT EXISTS 'WRONG_NUMBER'`);
    expect(readFileSync('prisma/schema.prisma', 'utf8')).toMatch(/enum LostReason \{[\s\S]*WRONG_NUMBER[\s\S]*\}/);
  });
});

const NOW = ist('2026-10-12', '10:00');

describe('needs attention (the stale-lead review)', () => {
  it('is open, no follow-up still ahead, and quiet 7+ days — or never called and 7+ days old', () => {
    expect(parseLeadFilters(new URLSearchParams('stale=1'))).toEqual({ stale: true });
    expect(leadFiltersToQuery({ stale: true })).toBe('stale=1');
    /* AxLeads' rule (the look, 12 Oct): open, not snoozed into the future,
       and nothing at all for 7 days — created before, no timeline line since. */
    const w = leadWhere({ stale: true }, NOW) as { AND: { AND: unknown[] }[] };
    const line = new Date(NOW.getTime() - 7 * 86_400_000);
    const rule = w.AND[0]!.AND;
    expect(rule).toContainEqual({ stage: { kind: { in: ['OPEN', 'WON'] } } });
    expect(rule).toContainEqual({ OR: [{ nextActionOn: null }, { nextActionOn: { lte: NOW } }] });
    expect(rule).toContainEqual({ createdAt: { lt: line } });
    expect(rule).toContainEqual({ events: { none: { createdAt: { gte: line } } } });
    expect(describeFilters({ stale: true }).map((c) => c.label)).toEqual(['Cold 7d+']);
  });
});

describe('custom list fields as filters, with "Not set"', () => {
  it('round-trips cf.<key> in the URL, dropping bad keys and long values', () => {
    const f = parseLeadFilters(new URLSearchParams(`cf.tower=B&cf.bad-key=x&cf.flat=${'x'.repeat(81)}&cf.bhk=${NOT_SET}`));
    expect(f.custom).toEqual({ tower: ['B'], bhk: [NOT_SET] });
    expect(leadFiltersToQuery(f)).toBe(`cf.bhk=${NOT_SET}&cf.tower=B`);
    expect(parseLeadFilters({ 'cf.tower': 'A' }).custom).toEqual({ tower: ['A'] });
    // Several values of one field: any of them.
    expect(parseLeadFilters(new URLSearchParams('cf.wing=A&cf.wing=B')).custom).toEqual({ wing: ['A', 'B'] });
  });

  it('filters on the JSON field, and "Not set" matches empty or missing', () => {
    const w = leadWhere({ custom: { tower: ['B'] } }, NOW) as { AND: unknown[] };
    expect(w.AND).toContainEqual({ fields: { path: ['tower'], equals: 'B' } });
    const none = JSON.stringify(leadWhere({ custom: { tower: [NOT_SET] } }, NOW));
    expect(none).toContain('"equals":""');
    expect(none).toContain('"path":["tower"]');
    const two = leadWhere({ custom: { wing: ['A', 'B'] } }, NOW) as { AND: unknown[] };
    expect(two.AND).toContainEqual({ OR: [{ fields: { path: ['wing'], equals: 'A' } }, { fields: { path: ['wing'], equals: 'B' } }] });
  });

  it('chips name the field and remove only that value', () => {
    const f = { custom: { tower: ['B'], bhk: [NOT_SET] }, due: ['today' as const] };
    const chips = describeFilters(f, { field: (k) => (k === 'tower' ? 'Tower' : null) });
    expect(chips.filter((c) => c.key === 'custom').map((c) => c.label)).toEqual(['Tower: B', 'bhk: Not set']);
    expect(withoutChip(f, { key: 'custom', field: 'tower', value: 'B' })).toEqual({ custom: { bhk: [NOT_SET] }, due: ['today'] });
    expect(withoutChip({ custom: { tower: ['B'] } }, { key: 'custom', field: 'tower', value: 'B' })).toEqual({});
    expect(withoutChip({ stage: ['a', 'b'] }, { key: 'stage', value: 'a' })).toEqual({ stage: ['b'] });
    expect(withCustom({}, 'tower', 'A')).toEqual({ custom: { tower: ['A'] } });
    expect(withCustom({ custom: { tower: ['A'] } }, 'tower', '')).toEqual({});
  });

  it('saved views keep them', () => {
    expect(cleanFilters({ query: 'cf.tower=B&stale=1' })).toEqual({ query: 'stale=1&cf.tower=B' });
  });
});
