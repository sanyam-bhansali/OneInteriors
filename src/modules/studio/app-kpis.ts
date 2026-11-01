/**
 * The KPI row at the top of every studio app (owner, 1 Nov 2026: "while
 * opening any tab like projects, quotations etc. there should first be a
 * section of KPIs, like we have in Clients"). Clients keeps its own cards
 * (clients/LeadsControls.tsx); every other app's are worked out here, from
 * what its page has already read, so a number never disagrees with the list
 * under it and no page reads more than it did.
 *
 * Money follows the page: an amount shows only where the page already shows
 * money to this person (`money: true`); otherwise the card counts.
 *
 * Pure, tested in tests/studio-app-kpis.test.ts. The row is ui/KpiRow.tsx.
 */

import { formatINR, formatINRCompact } from '@/lib/money';

export type KpiTone = 'good' | 'warn' | 'bad' | 'acc';

export interface Kpi {
  label: string;
  value: number | string;
  note?: string;
  tone?: KpiTone;
  href?: string;
  active?: boolean;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`;
const rupees = (paise: number) => (paise >= 10_000_000 ? formatINRCompact(paise) : formatINR(paise));

// ── Projects (and its Design tab) ─────────────────────────────

export interface ProjectCardFacts {
  lateDays: number;
  blocker: { side: 'client' | 'studio' } | null;
  snags: readonly unknown[];
}

export interface ProjectKpiInput {
  board: { design: readonly ProjectCardFacts[]; execution: readonly ProjectCardFacts[]; snags: readonly ProjectCardFacts[]; closures: readonly unknown[] } | null;
  /** The Projects page's rows: the studio's late days of them, the customer's share, decisions waiting, the next payment. */
  rows: readonly { lateDays: number; customerLateDays: number; waiting: readonly { overdue: boolean }[]; nextPayment: { amountPaise: number; toRecord: boolean } | null }[];
  money: boolean;
  /** Which lifecycle tab is on screen. */
  tab?: 'design' | 'execution' | 'snags';
  base?: string;
}

export function projectKpis(i: ProjectKpiInput): Kpi[] {
  const base = i.base ?? '/studio/projects';
  const b = i.board;
  const late = i.rows.filter((r) => r.lateDays > 0);
  const ours = late.filter((r) => r.lateDays > r.customerLateDays).length;
  const waiting = i.rows.filter((r) => r.waiting.length > 0);
  const overdueDecisions = i.rows.reduce((n, r) => n + r.waiting.filter((w) => w.overdue).length, 0);
  const due = i.rows.filter((r) => r.nextPayment?.toRecord);
  const duePaise = due.reduce((n, r) => n + (r.nextPayment?.amountPaise ?? 0), 0);
  const out: Kpi[] = [];
  if (b) {
    const designLate = b.design.filter((c) => c.lateDays > 0).length;
    out.push(
      { label: 'In design', value: b.design.length, note: designLate ? `${designLate} running late` : 'all on their days', tone: designLate ? 'bad' : 'good', href: `${base}?tab=design`, active: i.tab === 'design' },
      {
        label: 'In execution',
        value: b.execution.length,
        note: b.closures.length ? `${plural(b.closures.length, 'closure')} to do` : 'on site',
        tone: b.closures.length ? 'warn' : undefined,
        href: `${base}?tab=execution`,
        active: i.tab === 'execution',
      },
      {
        label: 'Snags',
        value: b.snags.length,
        note: `${b.snags.reduce((n, c) => n + c.snags.length, 0).toLocaleString('en-IN')} open snags`,
        href: `${base}?tab=snags`,
        active: i.tab === 'snags',
      },
    );
  }
  out.push(
    { label: 'Running late', value: late.length, note: late.length ? (ours ? `${ours} on us` : 'all on the clients') : 'nothing late', tone: ours ? 'bad' : late.length ? 'warn' : 'good' },
    { label: 'Waiting on clients', value: waiting.length, note: overdueDecisions ? `${plural(overdueDecisions, 'decision')} past the date` : 'decisions open', tone: overdueDecisions ? 'warn' : undefined },
    {
      label: 'Payments due',
      value: i.money ? rupees(duePaise) : due.length,
      note: i.money ? `on ${plural(due.length, 'project')}` : 'stages to collect',
      tone: due.length ? 'acc' : undefined,
      href: due.length ? '/studio/payments' : undefined,
    },
  );
  return out;
}

/** The Design tab: the design phase only, from the lifecycle board and the designers' load. */
export function designKpis(i: {
  board: { design: readonly ProjectCardFacts[]; closures: readonly unknown[] } | null;
  designers: readonly { projects: readonly unknown[] }[] | null;
  unassigned: number;
  tab?: 'design' | 'execution' | 'snags';
}): Kpi[] {
  const d = i.board?.design ?? [];
  const late = d.filter((c) => c.lateDays > 0).length;
  const onClient = d.filter((c) => c.blocker?.side === 'client').length;
  const onUs = d.filter((c) => c.blocker?.side === 'studio').length;
  const out: Kpi[] = [
    { label: 'In design', value: d.length, note: 'projects', href: '/studio/design?tab=design', active: i.tab === 'design' },
    { label: 'Running late', value: late, note: late ? 'a step past its day' : 'all on their days', tone: late ? 'bad' : 'good' },
    { label: 'Waiting on clients', value: onClient, note: 'an approval, a payment, an answer', tone: onClient ? 'warn' : undefined },
    { label: 'On us', value: onUs, note: 'the next move is the studio’s', tone: onUs ? 'acc' : undefined },
  ];
  if (i.designers) out.push({ label: 'Designers', value: i.designers.length, note: i.unassigned ? `${plural(i.unassigned, 'project')} with no designer` : 'every project has one', tone: i.unassigned ? 'warn' : undefined });
  return out;
}

// ── Quotations ────────────────────────────────────────────────

export function quoteKpis(
  quotes: readonly { status: 'DRAFT' | 'ISSUED' | 'ACCEPTED' | 'DECLINED'; stage: string; totalPaise: number; updatedAt: Date }[],
  now: Date,
  status: string,
): Kpi[] {
  const by = (s: string) => quotes.filter((q) => q.status === s);
  const sent = by('ISSUED');
  const won = by('ACCEPTED');
  const lost = by('DECLINED');
  const decided = won.length + lost.length;
  const week = quotes.filter((q) => now.getTime() - q.updatedAt.getTime() < 7 * 86_400_000).length;
  const sum = (l: readonly { totalPaise: number }[]) => l.reduce((n, q) => n + q.totalPaise, 0);
  return [
    { label: 'Quotations', value: quotes.length, note: `${week.toLocaleString('en-IN')} worked on this week`, href: '/studio/quotations', active: status === 'ALL' },
    { label: 'Drafts', value: by('DRAFT').length, note: 'not sent yet', href: '/studio/quotations?status=DRAFT', active: status === 'DRAFT' },
    { label: 'Sent', value: sent.length, note: `${rupees(sum(sent))} waiting`, tone: sent.length ? 'warn' : undefined, href: '/studio/quotations?status=ISSUED', active: status === 'ISSUED' },
    { label: 'Won', value: won.length, note: rupees(sum(won)), tone: 'good', href: '/studio/quotations?status=ACCEPTED', active: status === 'ACCEPTED' },
    { label: 'Lost', value: lost.length, note: 'declined', href: '/studio/quotations?status=DECLINED', active: status === 'DECLINED' },
    { label: 'Win rate', value: decided ? `${Math.round((won.length / decided) * 100)}%` : '—', note: decided ? `of ${plural(decided, 'decided quotation')}` : 'nothing decided yet' },
  ];
}

// ── Documents ─────────────────────────────────────────────────

export function documentKpis(folders: readonly { documents: number; approved: number; waiting: number; changes: number; finals: number }[]): Kpi[] {
  const sum = (k: 'documents' | 'approved' | 'waiting' | 'changes' | 'finals') => folders.reduce((n, f) => n + f[k], 0);
  const withDocs = folders.filter((f) => f.documents > 0).length;
  return [
    { label: 'Projects', value: folders.length, note: `${withDocs.toLocaleString('en-IN')} with documents` },
    { label: 'Documents', value: sum('documents'), note: 'every version kept' },
    { label: 'Waiting for approval', value: sum('waiting'), note: 'shared with clients', tone: sum('waiting') ? 'warn' : undefined },
    { label: 'Changes asked', value: sum('changes'), note: 'by clients', tone: sum('changes') ? 'bad' : undefined },
    { label: 'Approved', value: sum('approved'), note: 'by clients', tone: 'good' },
    { label: 'Marked final', value: sum('finals'), note: 'in the handover packs', tone: 'acc' },
  ];
}

// ── Money ─────────────────────────────────────────────────────

export function moneyKpis(i: { owedPaise: number; waitingPaise: number; disputed: number; projects: number; receivedThisMonthPaise: number; bookings: number; finals: number }): Kpi[] {
  return [
    { label: 'Still to come in', value: rupees(i.owedPaise), note: `across ${plural(i.projects, 'project')}`, tone: i.owedPaise ? 'acc' : undefined },
    { label: 'Received this month', value: rupees(i.receivedThisMonthPaise), note: 'recorded', tone: 'good' },
    { label: 'Waiting to confirm', value: rupees(i.waitingPaise), note: 'the client confirms in the app', tone: i.waitingPaise ? 'warn' : undefined },
    { label: 'Client says not paid', value: i.disputed, note: i.disputed ? 'One Interiors calls you' : 'none', tone: i.disputed ? 'bad' : 'good' },
    { label: 'Bookings to record', value: i.bookings, note: 'booking advances', tone: i.bookings ? 'warn' : undefined },
    { label: 'Final payments', value: i.finals, note: 'closures to collect', tone: i.finals ? 'acc' : undefined },
  ];
}

// ── Calendar ──────────────────────────────────────────────────

export function calendarKpis(items: readonly { kind: string; day: string; overdue: boolean; done: boolean }[], today: string, waiting: number): Kpi[] {
  const open = items.filter((i) => !i.done);
  const todays = open.filter((i) => i.day === today);
  const meetings = open.filter((i) => i.kind === 'meeting' || i.kind === 'office' || i.kind === 'appointment');
  const tasks = open.filter((i) => i.kind === 'task');
  const late = open.filter((i) => i.overdue).length;
  return [
    { label: 'Today', value: todays.length, note: 'meetings, tasks, follow-ups', href: `/studio/calendar?view=day&day=${today}` },
    { label: 'This week', value: open.length, note: 'still to do', href: `/studio/calendar?view=week&day=${today}` },
    { label: 'Meetings', value: meetings.length, note: 'this week' },
    { label: 'Tasks', value: tasks.length, note: late ? `${late.toLocaleString('en-IN')} overdue` : 'this week', tone: late ? 'bad' : undefined },
    { label: 'To answer', value: waiting, note: 'meetings asked of you', tone: waiting ? 'warn' : undefined, href: '/studio/calendar/meetings' },
  ];
}

// ── Chats ─────────────────────────────────────────────────────

export function chatKpis(rows: readonly { unread: number; last: { at: string; mine: boolean } | null }[], today: string): Kpi[] {
  const unread = rows.reduce((n, r) => n + r.unread, 0);
  const withUnread = rows.filter((r) => r.unread > 0).length;
  const toReply = rows.filter((r) => r.last && !r.last.mine).length;
  const istDayOf = (iso: string) => new Date(new Date(iso).getTime() + 330 * 60_000).toISOString().slice(0, 10);
  const active = rows.filter((r) => r.last && istDayOf(r.last.at) === today).length;
  return [
    { label: 'Conversations', value: rows.length, note: 'with your clients' },
    { label: 'Unread', value: unread, note: withUnread ? `in ${plural(withUnread, 'conversation')}` : 'all read', tone: unread ? 'bad' : 'good' },
    { label: 'Waiting for a reply', value: toReply, note: 'the client wrote last', tone: toReply ? 'warn' : undefined },
    { label: 'Active today', value: active, note: 'conversations' },
  ];
}

// ── Vendors ───────────────────────────────────────────────────

export function vendorKpis(i: { crews: number; trades: number; kycMissing: number; openOrders: number; billedPaise: number; owedPaise: number }): Kpi[] {
  return [
    { label: 'Crews', value: i.crews, note: `${plural(i.trades, 'trade')}` },
    { label: 'Open work orders', value: i.openOrders, note: 'on live projects', tone: i.openOrders ? 'acc' : undefined, href: '/studio/vendors/price' },
    { label: 'Billed', value: rupees(i.billedPaise), note: 'by your crews' },
    { label: 'To pay', value: rupees(i.owedPaise), note: 'still due to crews', tone: i.owedPaise ? 'warn' : 'good', href: '/studio/vendors/pay' },
    { label: 'KYC missing', value: i.kycMissing, note: i.kycMissing ? 'crews to complete' : 'every crew done', tone: i.kycMissing ? 'bad' : 'good' },
  ];
}
