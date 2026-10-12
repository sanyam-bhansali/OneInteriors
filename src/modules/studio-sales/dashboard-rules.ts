/**
 * The sales dashboard — what each number means (leads at scale, 12 Oct
 * 2026). Pure, tested in tests/studio-leads-scale.test.ts; `dashboard.ts`
 * counts them.
 *
 * Every number is a set of lead filters (`lead-filters.ts`). The page counts
 * `where(filters)` in SQL and links the number to the leads list with the
 * same filters, so clicking "12 missed follow-ups" opens exactly those 12.
 *
 * Two kinds of number:
 * - **Right now** — the state of the list today (in the pool, due today,
 *   missed…). The date range does not change them.
 * - **In the range** — what happened in the chosen days (new leads,
 *   contacted, quotations sent, sales finals, bookings).
 */

import type { LeadFilters } from './lead-filters';
import type { RangeToken } from './ist-range';
import { QUIET_AFTER_DAYS } from '@/modules/studio-practice/vocabulary';

export interface KpiSpec {
  key: string;
  label: string;
  /** One line under the number. */
  note?: string;
  filters: LeadFilters;
  /** Shown red when above zero. */
  bad?: boolean;
  /** Owner and PM only (a salesperson has no pool). */
  seesAllOnly?: boolean;
}

/** The "right now" numbers. */
export function nowKpis(): KpiSpec[] {
  return [
    { key: 'total', label: 'Total leads', note: 'every lead, open or closed', filters: {} },
    { key: 'pool', label: 'In the pool', note: 'open, nobody has it', filters: { owner: 'pool', kind: 'open' }, bad: true },
    { key: 'dueToday', label: 'Follow-ups due today', filters: { due: ['today'] } },
    { key: 'missed', label: 'Missed follow-ups', note: 'date has passed', filters: { due: ['missed'] }, bad: true },
    { key: 'never', label: 'Not contacted yet', note: 'open, nobody has called', filters: { never: true }, bad: true },
    { key: 'quiet', label: 'Gone quiet', note: `spoken to, nothing for ${QUIET_AFTER_DAYS}+ days`, filters: { quiet: true } },
    { key: 'meetToday', label: 'Meetings today', filters: { meeting: 'today' } },
    { key: 'meetWeek', label: 'Meetings this week', filters: { meeting: 'week' } },
  ];
}

/** New leads: today, the last 7 days, this month — fixed, whatever the range. */
export function newLeadKpis(): KpiSpec[] {
  return [
    { key: 'newToday', label: 'New today', filters: { added: 'today' } },
    { key: 'new7', label: 'Last 7 days', filters: { added: '7d' } },
    { key: 'newMonth', label: 'This month', filters: { added: 'month' } },
  ];
}

/** What happened in the chosen range. */
export function rangeKpis(range: RangeToken): KpiSpec[] {
  return [
    { key: 'added', label: 'New leads', filters: { added: range } },
    { key: 'contacted', label: 'Contacted', note: 'last call in these days', filters: { contacted: range } },
    { key: 'quoted', label: 'Quotations sent', note: 'leads sent a quotation', filters: { quoted: range } },
    { key: 'final', label: 'Sales finals', note: 'leads with a sales final marked', filters: { final: range } },
    { key: 'booked', label: 'Bookings', note: 'booking advance recorded', filters: { booked: range } },
  ];
}

/** Lost leads (all time), and why: one link per reason. */
export const LOST_FILTERS: LeadFilters = { kind: 'lost' };

/**
 * Conversion: of the leads added in the range, how many have booked. Null
 * when no lead was added (no verdict on nothing). Whole percent, but never
 * rounded up to 100 or down to 0 when it is not exactly that.
 */
export function conversion(booked: number, added: number): number | null {
  if (added <= 0) return null;
  const pct = (booked / added) * 100;
  if (booked > 0 && pct < 1) return 1;
  if (booked < added && pct > 99) return 99;
  return Math.round(pct);
}

/** "12%", or "—" when there is nothing to divide. */
export const pctText = (n: number | null): string => (n === null ? '—' : `${n}%`);

/** The filters for "booked, of the leads added in the range". */
export function convertedFilters(range: RangeToken): LeadFilters {
  return { added: range, booked: 'any' };
}

/** The per-salesperson table's columns: a label and the filters (plus `owner`). */
export function personColumns(range: RangeToken): { key: string; label: string; filters: LeadFilters }[] {
  return [
    { key: 'assigned', label: 'Open leads', filters: { kind: 'open' } },
    { key: 'contactedToday', label: 'Contacted today', filters: { contacted: 'today' } },
    { key: 'dueToday', label: 'Due today', filters: { due: ['today'] } },
    { key: 'missed', label: 'Missed', filters: { due: ['missed'] } },
    { key: 'quoted', label: 'Quotes sent', filters: { quoted: range } },
    { key: 'booked', label: 'Bookings', filters: { booked: range } },
  ];
}
