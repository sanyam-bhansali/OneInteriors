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

export type SectionId = 'calls' | 'tasks' | 'meetings' | 'floor-plans' | 'quotes' | 'bookings' | 'pool' | 'never-called';

export interface TodayRow {
  key: string;
  leadId: string | null;
  title: string;
  detail: string;
  late: boolean;
  /**
   * The one button. `assign` draws the assign control instead of a link;
   * `task` draws "Done" for the task `taskId` (leads at scale).
   */
  action: { label: string; href: string; kind: 'link' | 'call' | 'assign' | 'task' | 'claim'; taskId?: string; leadId?: string };
}

export interface TodaySection {
  id: SectionId;
  title: string;
  rows: TodayRow[];
  /** Rows left off the screen. */
  more: number;
  /** Where "see them all" goes: the leads list filtered to this section (leads at scale). */
  seeAll?: string;
}

/** A task due today or late (leads at scale, `StudioTask`). */
export interface TodayTask {
  id: string;
  title: string;
  dueAt: Date;
  leadId: string | null;
  leadName: string | null;
  assignedToName: string | null;
}

export interface TodayInput {
  leads: readonly TodayLead[];
  quotes: readonly TodayQuote[];
  bookings: readonly TodayBooking[];
  /** Open tasks due today or before. */
  tasks?: readonly TodayTask[];
  now: Date;
  /** Salesperson who may claim: adds the pool, to claim from (owner, 12 Oct 2026). */
  showPool?: boolean;
  /** Owner or PM: adds the pool and the never-called sections. */
  seesAll: boolean;
  /** Rows per section on screen. */
  limit?: number;
  /**
   * How many there really are, per section, counted in SQL (leads at
   * scale): the reads fetch only the first rows of each section, so "and N
   * more" comes from here when it is given.
   */
  totals?: Partial<Record<SectionId, number>>;
}

/** The leads list (or calendar) for each section's "see them all". */
export const SEE_ALL: Partial<Record<SectionId, string>> = {
  calls: '/studio/clients?view=list&due=due&sort=followup',
  tasks: '/studio/calendar?view=day',
  meetings: '/studio/calendar?view=day',
  quotes: '/studio/quotations',
  bookings: '/studio/clients?view=list&booked=7d',
  pool: '/studio/clients?view=list&owner=pool&kind=open&sort=oldest',
  'never-called': '/studio/clients?view=list&never=1&owner=anyone&sort=oldest',
};

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

function section(id: SectionId, title: string, rows: TodayRow[], limit: number, totals?: Partial<Record<SectionId, number>>): TodaySection {
  const shown = rows.slice(0, limit);
  const total = Math.max(rows.length, totals?.[id] ?? 0);
  return { id, title, rows: shown, more: Math.max(0, total - shown.length), ...(SEE_ALL[id] ? { seeAll: SEE_ALL[id] } : {}) };
}

export function buildToday(input: TodayInput): TodaySection[] {
  const { now, seesAll } = input;
  const limit = input.limit ?? 25;
  const { start, end } = istDayBounds(now);
  /* A salesperson's list is their own leads; pool leads come in only for
     the pool section, to claim (owner, 12 Oct 2026). */
  const all = input.leads.filter((l) => !l.isDemo);
  const leads = seesAll ? all : all.filter((l) => l.assignedToId !== null);
  const open = leads.filter((l) => OPEN_KINDS.includes(l.stageKind));
  const openPool = all.filter((l) => OPEN_KINDS.includes(l.stageKind) && l.assignedToId === null && !l.booked);

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

  const tasks: TodayRow[] = (input.tasks ?? [])
    .filter((t) => t.dueAt <= end)
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
    .map((t) => {
      const late = t.dueAt < start;
      const days = late ? lateBy(t.dueAt, start) : 0;
      return {
        key: `task:${t.id}`,
        leadId: t.leadId,
        title: t.title,
        detail: [t.leadName, late ? (days <= 1 ? 'due yesterday' : `${days} days late`) : 'due today', seesAll ? t.assignedToName : null].filter(Boolean).join(' · '),
        late,
        action: { label: 'Done', href: t.leadId ? leadHref(t.leadId) : '/studio/calendar?view=day', kind: 'task' as const, taskId: t.id },
      };
    });

  const totals = input.totals;
  const sections = [
    section('calls', 'Calls due', calls, limit, totals),
    section('tasks', 'Tasks due', tasks, limit, totals),
    section('meetings', 'Meetings today', meetings, limit, totals),
    section('floor-plans', 'Floor plans not in yet', floorPlans, limit, totals),
    section('quotes', 'Quotes sent and waiting', quotes, limit, totals),
    section('bookings', 'Bookings this week', bookings, limit, totals),
  ];

  /* A salesperson sees the pool to claim from (owner, 12 Oct 2026): the
     lead's name and a Claim button; its page opens once it is theirs. */
  if (!seesAll && input.showPool) {
    const pool: TodayRow[] = openPool.map((l) => ({
      key: `pool:${l.id}`,
      leadId: null,
      title: l.name,
      detail: 'In the pool · nobody has this lead yet',
      late: false,
      action: { label: 'Claim', href: SEE_ALL.pool!, kind: 'claim' as const, leadId: l.id },
    }));
    sections.push(section('pool', 'In the pool — claim one', pool, limit, totals));
  }

  if (seesAll) {
    const pool: TodayRow[] = openPool.map((l) => ({
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
    sections.push(section('pool', 'Leads to assign', pool, limit, totals), section('never-called', 'Nobody has called', neverCalled, limit, totals));
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
