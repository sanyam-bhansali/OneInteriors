/**
 * My work (owner, team meeting 15 Oct 2026): the first thing every studio
 * member sees when they sign in — what is theirs **today**, what is coming
 * in the **next 3 days** on any project or lead, and what they have already
 * **missed** — each item one tap from the exact place it is done.
 *
 * Pure (CONTRIBUTING §9.5), tested in tests/studio-my-work.test.ts. The reads
 * are in my-work.ts, which turns rows into `WorkSource`s through the
 * functions below and never decides anything itself:
 *
 * - `projectSources`: one project's design steps, execution steps, client
 *   decisions, snags, payment stages, today's site update and the closure,
 *   narrowed to what is this member's (`isMine…` below — the same people the
 *   lifecycle doc names for each action).
 * - `leadSources`: follow-ups, tasks and meetings (the sales Today list's
 *   lines, studio-sales/today-rules.ts, over three more days).
 * - `buildMyWork`: the four lists. Missed = due before today and not done,
 *   oldest first, "x days late"; Today grouped by kind; Next 3 days grouped
 *   by day; Next month (the walkthrough, 27 Oct 2026; owner, 1 Nov 2026: the
 *   30 days after those three) grouped by week.
 * - `workDigest`, `dueTomorrow`: what the morning digest and the evening
 *   "due tomorrow" notice say (notify/messages.ts carries them).
 *
 * Change orders and sign-offs: when their tables exist, their reads add
 * `WorkSource`s of kind `change-order` / `sign-off` (my-work.ts
 * `changeOrderSources`); nothing here needs to change.
 */

import { addDays, daysBetween, isDay } from '@/modules/project/working-days';

export type WorkKind =
  | 'design'
  | 'step'
  | 'payment'
  | 'decision'
  | 'snag'
  | 'site'
  | 'closure'
  | 'change-order'
  | 'sign-off'
  | 'follow-up'
  | 'task'
  | 'meeting';

/** Group titles, in the order a working day reads them. */
export const KIND_TITLE: Record<WorkKind, string> = {
  site: 'Site updates',
  step: 'Site steps',
  design: 'Design steps',
  snag: 'Snags',
  decision: 'Client decisions',
  payment: 'Payments',
  closure: 'Project closures',
  'change-order': 'Change orders',
  'sign-off': 'Sign-offs',
  meeting: 'Meetings',
  'follow-up': 'Follow-ups',
  task: 'Tasks',
};

export const KIND_ORDER: readonly WorkKind[] = ['design', 'site', 'step', 'snag', 'decision', 'payment', 'closure', 'change-order', 'sign-off', 'meeting', 'follow-up', 'task'];

/** One thing to do, before it is placed in a list. */
export interface WorkSource {
  /** Unique across the lists ("step:<id>"). */
  key: string;
  kind: WorkKind;
  /** What. */
  title: string;
  /** Which project or lead. */
  place: string;
  /** The IST day it is due, YYYY-MM-DD. */
  due: string;
  /** A time on that day ("3:30 pm"), for meetings and tasks. */
  time?: string | null;
  /** One more line: whose step, what is locked, the amount. */
  detail?: string | null;
  /** The exact place it is done. */
  href: string;
  /**
   * The payment it waits on (a design step after an unrecorded design
   * advance or closure): never late, never in Today or Missed; listed apart
   * (DESIGN-PROCESS-PLAN.md Decision 5).
   */
  waitingOn?: string | null;
}

/** A step waiting on a payment, as the "Waiting on payment" line lists it. */
export interface WaitingItem {
  key: string;
  title: string;
  place: string;
  payment: string;
  href: string;
}

export type Bucket = 'today' | 'soon' | 'month' | 'missed';

export interface WorkItem extends WorkSource {
  bucket: Bucket;
  /** Days past its day (Missed only); 0 otherwise. */
  lateDays: number;
  /** "3 days late", "Today, 3:30 pm", "Tomorrow", "Sat 17 Oct". */
  when: string;
}

export interface WorkGroup {
  id: string;
  title: string;
  items: WorkItem[];
}

export interface MyWork {
  today: string;
  /** Today, grouped by kind. */
  todayGroups: WorkGroup[];
  /** The next three days, grouped by day. */
  soonGroups: WorkGroup[];
  /** The rest of the next month, grouped by week. */
  monthGroups: WorkGroup[];
  /** Oldest first. */
  missed: WorkItem[];
  /** True totals, for the section headers (rows not shown included). */
  counts: Record<Bucket, number>;
  /** Rows left off the screen, per section. */
  more: Record<Bucket, number>;
  /** Steps waiting on a payment: one grey line, not late. */
  waiting: WaitingItem[];
}

/** How far ahead "Next 3 days" looks. */
export const SOON_DAYS = 3;
/** How far ahead "Next month" looks, from today (owner, 1 Nov 2026). */
export const MONTH_DAYS = 30;
/** How far back Missed looks for project steps (older plans predate the step tracker). */
export const MISSED_LOOKBACK_DAYS = 45;
/** Rows shown per section; the rest is counted. */
export const ROWS_PER_SECTION = 40;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Sat 17 Oct". */
export function dayLabel(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "1 day late", "12 days late". */
export const lateLabel = (n: number): string => (n === 1 ? '1 day late' : `${n} days late`);

/** Which list a day falls in, seen from `today`; null when it is further out. */
export function bucketOf(due: string, today: string): Bucket | null {
  if (!isDay(due)) return null;
  const d = daysBetween(today, due);
  if (d < 0) return 'missed';
  if (d === 0) return 'today';
  if (d <= SOON_DAYS) return 'soon';
  return d <= MONTH_DAYS ? 'month' : null;
}

/** The Monday of a day's week, "2026-11-09". */
export function weekOf(day: string): string {
  const wd = new Date(`${day}T00:00:00Z`).getUTCDay();
  return addDays(day, -((wd + 6) % 7));
}

function itemOf(s: WorkSource, today: string): WorkItem | null {
  const bucket = bucketOf(s.due, today);
  if (!bucket) return null;
  const lateDays = bucket === 'missed' ? daysBetween(s.due, today) : 0;
  const d = daysBetween(today, s.due);
  const when =
    bucket === 'missed'
      ? lateLabel(lateDays)
      : [bucket === 'today' ? 'Today' : d === 1 ? 'Tomorrow' : dayLabel(s.due), s.time ?? null].filter(Boolean).join(', ');
  return { ...s, bucket, lateDays, when };
}

const kindRank = (k: WorkKind) => KIND_ORDER.indexOf(k);

/**
 * The three lists from every source. Duplicate keys are kept once. `hidden`
 * adds rows the reads counted but did not fetch (thousands of late
 * follow-ups on an owner's leads), so the headers stay true.
 */
export function buildMyWork(
  sources: readonly WorkSource[],
  today: string,
  opts: { limit?: number; hidden?: Partial<Record<Bucket, number>> } = {},
): MyWork {
  const limit = opts.limit ?? ROWS_PER_SECTION;
  const seen = new Set<string>();
  const items: WorkItem[] = [];
  const waiting: WaitingItem[] = [];
  for (const s of sources) {
    if (seen.has(s.key)) continue;
    seen.add(s.key);
    if (s.waitingOn) {
      waiting.push({ key: s.key, title: s.title, place: s.place, payment: s.waitingOn, href: s.href });
      continue;
    }
    const it = itemOf(s, today);
    if (it) items.push(it);
  }
  const byOrder = (a: WorkItem, b: WorkItem) =>
    a.due.localeCompare(b.due) || kindRank(a.kind) - kindRank(b.kind) || (a.time ?? '').localeCompare(b.time ?? '') || a.place.localeCompare(b.place) || a.key.localeCompare(b.key);

  const missedAll = items.filter((i) => i.bucket === 'missed').sort(byOrder);
  const todayAll = items.filter((i) => i.bucket === 'today').sort((a, b) => kindRank(a.kind) - kindRank(b.kind) || byOrder(a, b));
  const soonAll = items.filter((i) => i.bucket === 'soon').sort(byOrder);
  const monthAll = items.filter((i) => i.bucket === 'month').sort(byOrder);

  const hidden = opts.hidden ?? {};
  const counts: Record<Bucket, number> = {
    today: todayAll.length + (hidden.today ?? 0),
    soon: soonAll.length + (hidden.soon ?? 0),
    month: monthAll.length + (hidden.month ?? 0),
    missed: missedAll.length + (hidden.missed ?? 0),
  };
  const todayShown = todayAll.slice(0, limit);
  const soonShown = soonAll.slice(0, limit);
  const monthShown = monthAll.slice(0, limit);
  const missed = missedAll.slice(0, limit);

  const todayGroups: WorkGroup[] = [];
  for (const k of KIND_ORDER) {
    const its = todayShown.filter((i) => i.kind === k);
    if (its.length) todayGroups.push({ id: k, title: KIND_TITLE[k], items: its });
  }
  const soonGroups: WorkGroup[] = [];
  for (let d = 1; d <= SOON_DAYS; d += 1) {
    const day = addDays(today, d);
    const its = soonShown.filter((i) => i.due === day);
    if (its.length) soonGroups.push({ id: day, title: d === 1 ? `Tomorrow, ${dayLabel(day)}` : dayLabel(day), items: its });
  }
  const monthGroups: WorkGroup[] = [];
  for (const i of monthShown) {
    const w = weekOf(i.due);
    const g = monthGroups.find((x) => x.id === w);
    if (g) g.items.push(i);
    else monthGroups.push({ id: w, title: `Week of ${dayLabel(w)}`, items: [i] });
  }

  return {
    today,
    todayGroups,
    soonGroups,
    monthGroups,
    missed,
    counts,
    more: {
      today: Math.max(0, counts.today - todayShown.length),
      soon: Math.max(0, counts.soon - soonShown.length),
      month: Math.max(0, counts.month - monthShown.length),
      missed: Math.max(0, counts.missed - missed.length),
    },
    waiting,
  };
}

/** Nothing anywhere. */
export const isEmptyWork = (w: MyWork): boolean => w.counts.today + w.counts.soon + w.counts.month + w.counts.missed === 0;

/** What each section says when it is empty. */
export const EMPTY_LINE: Record<Bucket, string> = {
  today: 'Nothing is due today.',
  soon: 'Nothing is coming up in the next 3 days.',
  month: 'Nothing else in the next month.',
  missed: 'Nothing missed. Everything due so far is done.',
};

// ── Whose is it ────────────────────────────────────────────────

export type WorkRole = 'OWNER' | 'PM' | 'DESIGNER' | 'SUPERVISOR' | 'ACCOUNTS' | 'SALES';

export interface Me {
  role: WorkRole;
  /** StudioMember id. */
  memberId: string;
  /** May record payments (owner, accounts). */
  recordsPayments: boolean;
}

/** Whose design step (studio-design/template.ts `responsible`) is in this member's list. */
export function isMineDesignStep(me: Me, responsible: string | null, isDesigner: boolean): boolean {
  switch (me.role) {
    case 'OWNER':
      return true;
    case 'DESIGNER':
      return isDesigner && (responsible === null || responsible === 'DESIGNER' || responsible === 'CLIENT');
    case 'PM':
      return responsible === 'PM';
    case 'ACCOUNTS':
      return responsible === 'ACCOUNTS';
    default:
      return false;
  }
}

/** Execution steps: the owner, the PM and supervisor on the site, the designer on their project (both tick, owner 13 Oct 2026). */
export function isMineExecStep(me: Me, isDesigner: boolean): boolean {
  return me.role === 'OWNER' || me.role === 'PM' || me.role === 'SUPERVISOR' || (me.role === 'DESIGNER' && isDesigner);
}

/** Snags: the one it is given to, else the office and the project's designer, and the supervisor on the site. */
export function isMineSnag(me: Me, assigneeId: string | null, isDesigner: boolean): boolean {
  if (assigneeId && assigneeId === me.memberId) return true;
  if (me.role === 'OWNER' || me.role === 'PM') return true;
  if (me.role === 'DESIGNER') return isDesigner;
  if (me.role === 'SUPERVISOR') return assigneeId === null;
  return false;
}

const office = (me: Me, isDesigner: boolean) => me.role === 'OWNER' || me.role === 'PM' || (me.role === 'DESIGNER' && isDesigner);

// ── One project ───────────────────────────────────────────────

export interface ProjectFacts {
  id: string;
  /** "Mehta · Kumar Primrose · 3 BHK". */
  place: string;
  client: string;
  designerId: string | null;
  phase: string;
  /** The provisional handover day (CLOSURE phase). */
  provisionalOn: string | null;
  /** Open (not ticked), in-scope design steps with a planned day. */
  designSteps: readonly { id: string; label: string; plannedOn: string | null; responsible: string | null; lockedBy: string | null }[];
  /** Open, in-scope execution steps with a planned day. */
  execSteps: readonly { id: string; label: string; plannedOn: string | null; stage: string }[];
  /** Unpicked client decisions. */
  decisions: readonly { id: string; title: string; dueOn: string }[];
  /** Open snags (not closed); `state` from snag-status.ts. */
  snags: readonly { id: string; title: string; room: string | null; state: string; fixBy: string | null; raisedOn: string; assigneeId: string | null; warranty: boolean }[];
  /** Payment stages with money still to record, and their due day. */
  payments: readonly { index: number; label: string; dueOn: string | null; openPaise: number; amountLabel: string }[];
  /** The daily site update; null when the project needs none now. */
  site: { postedToday: boolean; todayIsWorkingDay: boolean; missedDays: readonly string[] } | null;
}

/** Days a raised snag may wait for its answer (accept with a fix-by date, or dispute). */
export const SNAG_ANSWER_DAYS = 1;
/** Days after the provisional handover the closure is expected. */
export const CLOSURE_DAYS = 2;

const RESPONSIBLE_WORD: Record<string, string> = { DESIGNER: 'Designer', SALES: 'Sales', ACCOUNTS: 'Accounts', PM: 'Project manager', CLIENT: 'Client' };

/**
 * One project's items for this member. `siteHref` is where a supervisor
 * posts (site mode); the office posts from the project's Site log tab.
 */
export function projectSources(p: ProjectFacts, me: Me, today: string, opts: { siteHref?: string } = {}): WorkSource[] {
  const out: WorkSource[] = [];
  const isDesigner = p.designerId !== null && p.designerId === me.memberId;
  const base = `/studio/projects/${p.id}`;
  const seesProject = me.role !== 'ACCOUNTS' && me.role !== 'SALES';

  for (const s of p.designSteps) {
    if (!s.plannedOn || !isMineDesignStep(me, s.responsible, isDesigner)) continue;
    const who = s.responsible && s.responsible !== 'DESIGNER' ? `${RESPONSIBLE_WORD[s.responsible] ?? s.responsible}'s step` : null;
    out.push({
      key: `design:${s.id}`,
      kind: 'design',
      title: s.label,
      place: p.place,
      due: s.plannedOn,
      detail: [who, s.lockedBy ? `opens when the ${s.lockedBy} is recorded` : null].filter(Boolean).join(' · ') || null,
      waitingOn: s.lockedBy,
      href: me.role === 'ACCOUNTS' ? `${base}?tab=payments` : `${base}?tab=design#step-${s.id}`,
    });
  }

  if (seesProject && isMineExecStep(me, isDesigner)) {
    for (const s of p.execSteps) {
      if (!s.plannedOn) continue;
      out.push({ key: `step:${s.id}`, kind: 'step', title: s.label, place: p.place, due: s.plannedOn, detail: s.stage, href: `${base}?tab=plan#step-${s.id}` });
    }
  }

  if (seesProject && office(me, isDesigner)) {
    for (const d of p.decisions) {
      out.push({ key: `decision:${d.id}`, kind: 'decision', title: d.title, place: p.place, due: d.dueOn, detail: `Waiting for ${p.client} to choose`, href: `${base}#decision-${d.id}` });
    }
  }

  if (seesProject) {
    for (const s of p.snags) {
      // A fix waiting for the client's yes, or a dispute, is the client's to answer.
      if (s.state === 'fixed' || s.state === 'disputed' || s.state === 'closed') continue;
      if (!isMineSnag(me, s.assigneeId, isDesigner)) continue;
      const answered = s.fixBy !== null && s.state !== 'raised';
      out.push({
        key: `snag:${s.id}`,
        kind: 'snag',
        title: s.title,
        place: p.place,
        due: answered ? s.fixBy! : addDays(s.raisedOn, SNAG_ANSWER_DAYS),
        detail: [s.warranty ? 'Warranty snag' : null, s.room, answered ? (s.state === 'reopened' ? 'Client says not fixed' : 'Fix by this day') : 'Accept it with a fix-by date, or dispute it'].filter(Boolean).join(' · '),
        href: `${base}?tab=snags#snag-${s.id}`,
      });
    }
  }

  if (me.recordsPayments) {
    for (const s of p.payments) {
      if (!s.dueOn || s.openPaise <= 0) continue;
      out.push({ key: `payment:${p.id}:${s.index}`, kind: 'payment', title: `${s.label}: ${s.amountLabel}`, place: p.place, due: s.dueOn, detail: 'Record it when it arrives', href: `${base}?tab=payments#pay-${s.index}` });
    }
  }

  if (p.site && (me.role === 'OWNER' || me.role === 'PM' || me.role === 'SUPERVISOR')) {
    const href = me.role === 'SUPERVISOR' ? (opts.siteHref ?? '/studio/site') : `${base}?tab=log`;
    const missed = [...p.site.missedDays].sort();
    if (missed.length) {
      out.push({
        key: `site-missed:${p.id}`,
        kind: 'site',
        title: missed.length === 1 ? 'No site update that day' : `No site update on ${missed.length} working days`,
        place: p.place,
        due: missed[0]!,
        detail: 'The client sees the gap',
        href,
      });
    }
    if (p.site.todayIsWorkingDay && !p.site.postedToday) {
      out.push({ key: `site:${p.id}`, kind: 'site', title: 'Post today’s site update', place: p.place, due: today, href, detail: 'Photos and a line, by 6 pm' });
    }
  }

  if (p.phase === 'CLOSURE' && p.provisionalOn && office(me, isDesigner)) {
    out.push({ key: `closure:${p.id}`, kind: 'closure', title: 'Close the project: fix the final account', place: p.place, due: addDays(p.provisionalOn, CLOSURE_DAYS), detail: 'Past the provisional handover', href: `${base}?tab=closure` });
  }

  return out;
}

// ── Leads ─────────────────────────────────────────────────────

export interface LeadFacts {
  followUps: readonly { id: string; name: string; nextAction: string | null; due: string }[];
  tasks: readonly { id: string; title: string; due: string; time: string; leadId: string | null; leadName: string | null }[];
  meetings: readonly { id: string; name: string; due: string; time: string; note: string | null }[];
}

export function leadSources(l: LeadFacts): WorkSource[] {
  const lead = (id: string) => `/studio/clients/${id}`;
  return [
    ...l.followUps.map((f) => ({ key: `follow:${f.id}`, kind: 'follow-up' as const, title: f.nextAction?.trim() || 'Follow up', place: f.name, due: f.due, href: lead(f.id) })),
    ...l.tasks.map((t) => ({
      key: `task:${t.id}`,
      kind: 'task' as const,
      title: t.title,
      place: t.leadName ?? 'No lead',
      due: t.due,
      time: t.time,
      href: t.leadId ? lead(t.leadId) : '/studio/calendar?view=day',
    })),
    ...l.meetings.map((m) => ({ key: `meeting:${m.id}`, kind: 'meeting' as const, title: m.note?.trim() || 'Meeting', place: m.name, due: m.due, time: m.time, href: lead(m.id) })),
  ];
}

// ── Reminders ─────────────────────────────────────────────────

/** What is due tomorrow, from the sources (the evening notice). */
export function dueTomorrow(sources: readonly WorkSource[], today: string): WorkSource[] {
  const tomorrow = addDays(today, 1);
  return sources.filter((s) => s.due === tomorrow).sort((a, b) => kindRank(a.kind) - kindRank(b.kind) || a.place.localeCompare(b.place));
}

const line = (i: Pick<WorkItem, 'title' | 'place' | 'when'>, withWhen: boolean) => `- ${i.title} · ${i.place}${withWhen ? ` · ${i.when}` : ''}`;

/**
 * The morning digest: Today and Missed, then how much is coming. Null when
 * there is nothing today and nothing missed, so nobody is woken for nothing.
 */
export function workDigest(w: MyWork, firstName: string, studio: string, max = 10): { title: string; body: string } | null {
  if (w.counts.today === 0 && w.counts.missed === 0) return null;
  const lines: string[] = [`Good morning ${firstName}. Your work at ${studio}.`, ''];
  if (w.counts.today > 0) {
    lines.push(`Today (${w.counts.today})`);
    const its = w.todayGroups.flatMap((g) => g.items);
    for (const i of its.slice(0, max)) lines.push(line(i, Boolean(i.time)));
    if (w.counts.today > Math.min(its.length, max)) lines.push(`- and ${w.counts.today - Math.min(its.length, max)} more`);
    lines.push('');
  }
  if (w.counts.missed > 0) {
    lines.push(`Missed (${w.counts.missed})`);
    for (const i of w.missed.slice(0, max)) lines.push(line(i, true));
    if (w.counts.missed > Math.min(w.missed.length, max)) lines.push(`- and ${w.counts.missed - Math.min(w.missed.length, max)} more`);
    lines.push('');
  }
  if (w.counts.soon > 0) lines.push(`Next 3 days: ${w.counts.soon} thing${w.counts.soon === 1 ? '' : 's'} coming up.`, '');
  lines.push('Open your home to work through it:');
  const title =
    w.counts.missed > 0
      ? `Today: ${w.counts.today} to do, ${w.counts.missed} missed`
      : `Today: ${w.counts.today} thing${w.counts.today === 1 ? '' : 's'} to do`;
  return { title, body: lines.join('\n') };
}

/** One line naming the first few things ("Plumbing rough-in at Mehta, and 2 more"). */
export function shortList(items: readonly Pick<WorkSource, 'title' | 'place'>[], show = 2): string {
  const head = items.slice(0, show).map((i) => `${i.title} (${i.place})`);
  const rest = items.length - head.length;
  return rest > 0 ? `${head.join('; ')}; and ${rest} more` : head.join('; ');
}

// ── Done by someone else ──────────────────────────────────────

export interface DoneStep {
  stepId: string;
  label: string;
  place: string;
  projectId: string;
  /** Design or execution. */
  design: boolean;
  responsible: string | null;
  designerId: string | null;
  /** The user who ticked it. */
  doneById: string | null;
  doneByName: string | null;
}

/**
 * Steps someone else ticked that are this member's (the same rule as their
 * list): what the evening notice says was completed.
 */
export function doneByOthers(steps: readonly DoneStep[], me: Me & { userId: string }): DoneStep[] {
  return steps.filter((s) => {
    if (s.doneById === me.userId) return false;
    const isDesigner = s.designerId !== null && s.designerId === me.memberId;
    return s.design ? isMineDesignStep(me, s.responsible, isDesigner) : isMineExecStep(me, isDesigner);
  });
}
