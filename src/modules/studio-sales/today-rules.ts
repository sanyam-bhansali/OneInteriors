/**
 * Today: the list a salesperson (and the owner) opens the studio to
 * (Studio OS Phase 1, docs/studio-os/PHASE-1-SALES.md §7). Pure, and tested
 * (tests/studio-sales-today.test.ts). The reads are in studio-sales/today.ts.
 *
 * Every row has its one button. The sections, in the order of a working day:
 *
 * - Calls due and late — a follow-up date today or before.
 * - Meetings today — the lead's meeting falls on today (India time).
 * - Floor plans not in yet — spoken to, no floor plan, no quotation.
 * - Quotes sent and waiting — sent, not won or lost, not booked.
 * - Bookings this week — booking advances recorded in the last seven days.
 * - Owner and PM only: leads in the pool to assign, and leads nobody has
 *   called yet.
 *
 * The sample lead is never on it: it is listed on the board and counted
 * nowhere (demo-lead.ts).
 */

import { formatINR } from '@/lib/money';
import { IST_OFFSET_MS } from '@/modules/project/working-days';
import { meetingLabel } from './lead-rules';
import { revisionLabel } from './revision-rules';

export type LeadKind = 'OPEN' | 'WON' | 'DONE' | 'LOST';

export interface TodayLead {
  id: string;
  name: string;
  phone: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  stageKind: LeadKind;
  nextAction: string | null;
  nextActionOn: Date | null;
  lastContactedAt: Date | null;
  meetingAt: Date | null;
  meetingNote: string | null;
  hasFloorPlan: boolean;
  quoteCount: number;
  isDemo: boolean;
  booked: boolean;
}

export interface TodayQuote {
  id: string;
  number: string;
  clientId: string | null;
  clientName: string;
  status: 'DRAFT' | 'ISSUED' | 'ACCEPTED' | 'DECLINED';
  /** The latest revision sent, and when. */
  latestRevision: number | null;
  lastSentAt: Date | null;
  hasSalesFinal: boolean;
  booked: boolean;
}

export interface TodayBooking {
  clientId: string;
  name: string;
  bookedAt: Date;
  amountPaise: number | null;
}

export type SectionId = 'calls' | 'meetings' | 'floor-plans' | 'quotes' | 'bookings' | 'pool' | 'never-called';

export interface TodayRow {
  key: string;
  leadId: string | null;
  title: string;
  detail: string;
  late: boolean;
  /** The one button. `assign` draws the assign control instead of a link. */
  action: { label: string; href: string; kind: 'link' | 'call' | 'assign' };
}

export interface TodaySection {
  id: SectionId;
  title: string;
  rows: TodayRow[];
  /** Rows left off the screen. */
  more: number;
}

export interface TodayInput {
  leads: readonly TodayLead[];
  quotes: readonly TodayQuote[];
  bookings: readonly TodayBooking[];
  now: Date;
  /** Owner or PM: adds the pool and the never-called sections. */
  seesAll: boolean;
  /** Rows per section on screen. */
  limit?: number;
}

const DAY = 86_400_000;

/** Start and end of the India day `now` falls in, as instants. */
export function istDayBounds(now: Date): { start: Date; end: Date } {
  const shifted = now.getTime() + IST_OFFSET_MS;
  const start = shifted - (((shifted % DAY) + DAY) % DAY) - IST_OFFSET_MS;
  return { start: new Date(start), end: new Date(start + DAY - 1) };
}

const OPEN_KINDS: readonly LeadKind[] = ['OPEN', 'WON'];

const leadHref = (id: string, hash = '') => `/studio/clients/${id}${hash}`;

/** "today", "yesterday", "3 days ago" — in India calendar days, as people count them. */
function ago(at: Date, now: Date): string {
  const days = Math.round((istDayBounds(now).start.getTime() - istDayBounds(at).start.getTime()) / DAY);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

function lateBy(due: Date, start: Date): number {
  return Math.ceil((start.getTime() - due.getTime()) / DAY);
}

function section(id: SectionId, title: string, rows: TodayRow[], limit: number): TodaySection {
  return { id, title, rows: rows.slice(0, limit), more: Math.max(0, rows.length - limit) };
}

export function buildToday(input: TodayInput): TodaySection[] {
  const { now, seesAll } = input;
  const limit = input.limit ?? 25;
  const { start, end } = istDayBounds(now);
  const leads = input.leads.filter((l) => !l.isDemo);
  const open = leads.filter((l) => OPEN_KINDS.includes(l.stageKind));

  const calls: TodayRow[] = open
    .filter((l) => l.nextActionOn !== null && l.nextActionOn <= end)
    .sort((a, b) => a.nextActionOn!.getTime() - b.nextActionOn!.getTime())
    .map((l) => {
      const late = l.nextActionOn! < start;
      const days = late ? lateBy(l.nextActionOn!, start) : 0;
      return {
        key: `call:${l.id}`,
        leadId: l.id,
        title: l.name,
        detail: [l.nextAction ?? 'Follow up', late ? (days <= 1 ? 'due yesterday' : `${days} days late`) : 'due today'].join(' · '),
        late,
        action: l.phone ? { label: 'Call', href: `tel:${l.phone}`, kind: 'call' as const } : { label: 'Open', href: leadHref(l.id), kind: 'link' as const },
      };
    });

  const meetings: TodayRow[] = leads
    .filter((l) => l.meetingAt !== null && l.meetingAt >= start && l.meetingAt <= end)
    .sort((a, b) => a.meetingAt!.getTime() - b.meetingAt!.getTime())
    .map((l) => ({
      key: `meeting:${l.id}`,
      leadId: l.id,
      title: l.name,
      detail: [meetingLabel(l.meetingAt!).split(', ').pop()!, l.meetingNote].filter(Boolean).join(' · '),
      late: false,
      action: { label: 'Open', href: leadHref(l.id), kind: 'link' as const },
    }));

  const floorPlans: TodayRow[] = open
    .filter((l) => l.stageKind === 'OPEN' && l.lastContactedAt !== null && !l.hasFloorPlan && l.quoteCount === 0 && !l.booked)
    .map((l) => ({
      key: `plan:${l.id}`,
      leadId: l.id,
      title: l.name,
      detail: `Spoke ${ago(l.lastContactedAt!, now)} · no floor plan yet`,
      late: false,
      action: { label: 'Attach floor plan', href: leadHref(l.id, '#files'), kind: 'link' as const },
    }));

  const quotes: TodayRow[] = input.quotes
    .filter((q) => q.status === 'ISSUED' && q.lastSentAt !== null && !q.booked)
    .sort((a, b) => a.lastSentAt!.getTime() - b.lastSentAt!.getTime())
    .map((q) => ({
      key: `quote:${q.id}`,
      leadId: q.clientId,
      title: q.clientName,
      detail: [
        `${q.number}${q.latestRevision ? ` ${revisionLabel(q.latestRevision)}` : ''} sent ${ago(q.lastSentAt!, now)}`,
        q.hasSalesFinal ? 'sales final marked, waiting for the booking' : null,
      ]
        .filter(Boolean)
        .join(' · '),
      late: false,
      action: { label: 'Open quotation', href: `/studio/quotations/${q.id}`, kind: 'link' as const },
    }));

  const weekAgo = new Date(start.getTime() - 6 * DAY);
  const bookings: TodayRow[] = input.bookings
    .filter((b) => b.bookedAt >= weekAgo)
    .sort((a, b) => b.bookedAt.getTime() - a.bookedAt.getTime())
    .map((b) => ({
      key: `booked:${b.clientId}`,
      leadId: b.clientId,
      title: b.name,
      detail: [`Booked ${ago(b.bookedAt, now)}`, b.amountPaise ? formatINR(b.amountPaise) : null].filter(Boolean).join(' · '),
      late: false,
      action: { label: 'Open', href: leadHref(b.clientId), kind: 'link' as const },
    }));

  const sections = [
    section('calls', 'Calls due', calls, limit),
    section('meetings', 'Meetings today', meetings, limit),
    section('floor-plans', 'Floor plans not in yet', floorPlans, limit),
    section('quotes', 'Quotes sent and waiting', quotes, limit),
    section('bookings', 'Bookings this week', bookings, limit),
  ];

  if (seesAll) {
    const pool: TodayRow[] = open
      .filter((l) => l.assignedToId === null && !l.booked)
      .map((l) => ({
        key: `pool:${l.id}`,
        leadId: l.id,
        title: l.name,
        detail: 'Nobody has this lead yet',
        late: false,
        action: { label: 'Assign', href: leadHref(l.id), kind: 'assign' as const },
      }));
    const neverCalled: TodayRow[] = open
      .filter((l) => l.stageKind === 'OPEN' && l.lastContactedAt === null && l.assignedToId !== null && !l.booked)
      .map((l) => ({
        key: `never:${l.id}`,
        leadId: l.id,
        title: l.name,
        detail: `${l.assignedToName ?? 'Somebody'} has it · nobody has called yet`,
        late: true,
        action: { label: 'Open', href: leadHref(l.id), kind: 'link' as const },
      }));
    sections.push(section('pool', 'Leads to assign', pool, limit), section('never-called', 'Nobody has called', neverCalled, limit));
  }

  return sections;
}

/** How many rows need somebody, across every section. */
export const todayCount = (sections: readonly TodaySection[]): number => sections.reduce((n, s) => n + s.rows.length + s.more, 0);

/**
 * The morning email: the same list, as plain text. Null when there is
 * nothing on it, so nobody gets an email that says "nothing today".
 */
export function todayEmail(sections: readonly TodaySection[], firstName: string, studio: string): { title: string; body: string } | null {
  const filled = sections.filter((s) => s.rows.length > 0);
  if (filled.length === 0) return null;
  const lines: string[] = [`Good morning ${firstName}. Here is your list for today at ${studio}.`, ''];
  for (const s of filled) {
    lines.push(`${s.title} (${s.rows.length + s.more})`);
    for (const r of s.rows.slice(0, 10)) lines.push(`- ${r.title}: ${r.detail}`);
    const left = s.rows.length - Math.min(s.rows.length, 10) + s.more;
    if (left > 0) lines.push(`- and ${left} more`);
    lines.push('');
  }
  lines.push('Open Today to work through it:');
  const n = todayCount(sections);
  return { title: `Today: ${n} thing${n === 1 ? '' : 's'} for you`, body: lines.join('\n') };
}
