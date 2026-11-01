import 'server-only';
import { opensFullSoftware, planOf } from './software-plan';

/**
 * My work — the reads (owner, 15 Oct 2026). The lists are built by the pure
 * my-work-rules.ts; this file fetches, for one member, exactly what they may
 * see — the same scopes as every other screen:
 *
 * - projects: `projectsVisibleTo(member)` (owner: the studio; PM and
 *   supervisor: their sites; designer: narrowed to the projects they are THE
 *   designer on); accounts: `projectsVisibleTo(member, 'payments')`, money
 *   only. Cancelled projects are left out. One query, with only the open,
 *   dated rows nested (steps from MISSED_LOOKBACK_DAYS ago to three days out).
 * - leads: `leadsVisibleTo(member)` (a salesperson's own leads, the owner's
 *   studio-wide as on Today; a PM only the leads given to them), follow-ups,
 *   meetings and tasks (tasksVisibleTo: given to them, or the owner's all).
 * - change orders and sign-offs waiting on someone.
 *
 * And the reminders, run by the existing once-a-day crons (Vercel Hobby):
 * `runMorningDigest` from /api/cron/today-email (08:00 IST: in-app + email,
 * with the leads Today list in the same email; WhatsApp/SMS through the
 * studio MessageSender only for someone with no email), and
 * `runEveningNotices` from /api/cron/site-reminders at 18:00 IST (in-app:
 * due tomorrow, and steps someone else completed today). Each goes once a
 * day per person, checked against the `notifications` rows already written.
 * Never to a customer.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { formatINR, fromDb } from '@/lib/money';
import { resolveSiteUrl } from '@/lib/site';
import { sendNotice } from '@/modules/auth/email';
import { send } from '@/modules/messaging/sender';
import { notify } from '@/modules/notify/service';
import { dueDates } from '@/modules/project/payment-ledger';
import { activeSinceOf, needsDailyPost } from '@/modules/project/reminder-rules';
import { ledgerFromRows } from '@/modules/project/snag-window-store';
import { eventsOrLegacy, snagStatus } from '@/modules/project/snag-status';
import { addDays, calendarOf, dayFromDb, dayToDb, isWorkingDay, istDay, istMinutesOfDay } from '@/modules/project/working-days';
import { chainLocks } from '@/modules/studio-design/rules';
import { meetingLabel } from '@/modules/studio-sales/lead-rules';
import { openTasksDue } from '@/modules/studio-sales/tasks';
import { buildToday, istDayBounds, type TodaySection } from '@/modules/studio-sales/today-rules';
import { seesEveryLead, todayInput } from '@/modules/studio-sales/today';
import { LIVE } from '@/modules/studio-practice/demo-lead';
import { currentMember, memberFor } from './access';
import {
  buildMyWork,
  doneByOthers,
  dueTomorrow,
  leadSources,
  MISSED_LOOKBACK_DAYS,
  projectSources,
  shortList,
  MONTH_DAYS,
  SOON_DAYS,
  workDigest,
  type Bucket,
  type DoneStep,
  type Me,
  type MyWork,
  type ProjectFacts,
  type WorkRole,
  type WorkSource,
} from './my-work-rules';
import { waitingForFullSoftware } from './pilot';
import { can, leadsVisibleTo, projectsVisibleTo, type MemberRole } from './roles';
import { siteLabel } from './team-rules';

export interface WorkMember extends MemberRole {
  id: string;
  studioId: string;
  userId: string;
}

const ROLES: readonly WorkRole[] = ['OWNER', 'PM', 'DESIGNER', 'SUPERVISOR', 'ACCOUNTS', 'SALES'];
const asRole = (r: string): WorkRole | null => ((ROLES as readonly string[]).includes(r) ? (r as WorkRole) : null);

/** How many leads rows each section reads; the rest is counted in SQL. */
const LEAD_TAKE = 60;
const PROJECT_TAKE = 300;

const meOf = (m: WorkMember, role: WorkRole): Me => ({ role, memberId: m.id, recordsPayments: can(m, 'payment.record', { assigned: true }) });

/** The projects this member's list reads, or null for none. */
function projectWhere(m: WorkMember, role: WorkRole): Prisma.HomeProjectWhereInput | null {
  const sees = can(m, 'project.read', { assigned: true });
  const pays = can(m, 'payment.record', { assigned: true });
  if (!sees && !pays) return null;
  const scope = sees ? projectsVisibleTo(m) : projectsVisibleTo(m, 'payments');
  return { ...scope, cancelledAt: null, ...(role === 'DESIGNER' ? { designerId: m.id } : {}) };
}

function projectSelect(from: string, to: string, sinceSite: string) {
  const fromD = dayToDb(from);
  const toD = dayToDb(to);
  return {
    id: true,
    phase: true,
    designerId: true,
    provisionalHandoverAt: true,
    startOn: true,
    doneStages: true,
    paidPhases: true,
    paymentPhases: true,
    payments: {
      select: { id: true, stageIndex: true, amountPaise: true, receivedOn: true, mode: true, receiptDocumentId: true, correctsId: true, recordedById: true, beforeJoining: true, recordedAt: true, customerConfirmedAt: true, disputedAt: true },
    },
    quoteChanges: { select: { deltaPaise: true, stageIndex: true } },
    introduction: {
      select: {
        brief: { select: { society: true, locality: true, propertyType: true, contactName: true, user: { select: { name: true } } } },
        studio: { select: { workingDays: true, holidays: { where: { day: { gte: dayToDb(sinceSite) } }, select: { day: true } } } },
      },
    },
    stages: {
      orderBy: { sortOrder: 'asc' },
      select: {
        kind: true,
        name: true,
        actualEnd: true,
        items: {
          // The window's steps, and every open step with a payment gate wherever its day is: a gate earlier in the plan makes the window's steps wait (DESIGN-PROCESS-PLAN.md Decision 5).
          where: { doneAt: null, inScope: true, OR: [{ plannedOn: { gte: fromD, lte: toD } }, { gatePayment: { not: null } }] },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, label: true, plannedOn: true, responsible: true, gatePayment: true },
        },
      },
    },
    decisions: {
      where: { chosenIndex: null, pickedOptionId: null, dueOn: { gte: fromD, lte: new Date(toD.getTime() + 86_400_000) } },
      select: { id: true, title: true, dueOn: true },
    },
    snags: {
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        title: true,
        room: true,
        warranty: true,
        createdAt: true,
        status: true,
        fixBy: true,
        fixedAt: true,
        assigneeId: true,
        events: { select: { id: true, kind: true, at: true, fixBy: true, assigneeId: true, photoPaths: true, customerText: true, note: true } },
      },
    },
    siteLogs: { where: { date: { gte: dayToDb(sinceSite) }, kind: { in: ['UPDATE', 'NOBODY'] } }, select: { date: true } },
  } as const satisfies Prisma.HomeProjectSelect;
}

type ProjectRow = Prisma.HomeProjectGetPayload<{ select: ReturnType<typeof projectSelect> }>;

/** How many past working days the site item looks back for missed updates. */
const SITE_LOOKBACK = 7;

function factsOf(p: ProjectRow, now: Date, today: string): ProjectFacts {
  const b = p.introduction.brief;
  const client = b.contactName?.trim() || b.user?.name?.trim() || 'Client';
  const ledgerRow = ledgerFromRows(p);
  const gates = ledgerRow ? ledgerRow.stages.map((s) => ({ index: s.index, label: s.label, state: s.state })) : null;
  const due = dueDates(p.paidPhases);
  const design = p.stages.find((s) => s.kind === 'DESIGN');
  const day = (d: Date | null) => (d ? dayFromDb(d) : null);

  let site: ProjectFacts['site'] = null;
  if (needsDailyPost({ startOn: p.startOn, now, stages: p.stages, doneStages: p.doneStages })) {
    const calendar = calendarOf(p.introduction.studio);
    const posted = new Set(p.siteLogs.map((l) => dayFromDb(l.date)));
    const firstPostDay = [...posted].sort()[0] ?? null;
    const since = activeSinceOf({ startOn: p.startOn, stages: p.stages, firstPostDay });
    const missedDays: string[] = [];
    for (let i = 1; i <= SITE_LOOKBACK; i += 1) {
      const d = addDays(today, -i);
      if (d >= since && isWorkingDay(d, calendar) && !posted.has(d)) missedDays.push(d);
    }
    site = { postedToday: posted.has(today), todayIsWorkingDay: today >= since && isWorkingDay(today, calendar), missedDays };
  }

  return {
    id: p.id,
    place: `${client} · ${siteLabel(b)}`,
    client,
    designerId: p.designerId,
    phase: p.phase,
    provisionalOn: p.provisionalHandoverAt ? istDay(p.provisionalHandoverAt) : null,
    designSteps: (() => {
      const items = design?.items ?? [];
      const locks = chainLocks(items.map((i) => ({ gatePayment: i.gatePayment, done: false })), gates);
      return items
        .map((i, k) => ({ id: i.id, label: i.label, plannedOn: day(i.plannedOn), responsible: i.responsible, lockedBy: locks[k] ?? null }))
        .filter((s) => s.plannedOn !== null && s.plannedOn >= addDays(today, -MISSED_LOOKBACK_DAYS));
    })(),
    execSteps: p.stages
      .filter((s) => s.kind !== 'DESIGN')
      .flatMap((s) => s.items.filter((i) => i.gatePayment === null || (day(i.plannedOn) ?? '') >= addDays(today, -MISSED_LOOKBACK_DAYS)).map((i) => ({ id: i.id, label: i.label, plannedOn: day(i.plannedOn), stage: s.name }))),
    decisions: p.decisions.map((d) => ({ id: d.id, title: d.title, dueOn: istDay(d.dueOn) })),
    snags: p.snags.map((s) => {
      const st = snagStatus(eventsOrLegacy(s.events, s), now);
      return {
        id: s.id,
        title: s.title,
        room: s.room,
        state: st.state,
        fixBy: st.fixBy ? istDay(st.fixBy) : s.fixBy ? istDay(s.fixBy) : null,
        raisedOn: istDay(s.createdAt),
        assigneeId: st.assigneeId ?? s.assigneeId,
        warranty: s.warranty,
      };
    }),
    payments: (ledgerRow?.stages ?? [])
      .filter((s) => s.openPaise > 0)
      .map((s) => ({ index: s.index, label: s.label, dueOn: due.get(s.index) ?? null, openPaise: s.openPaise, amountLabel: formatINR(s.openPaise) })),
    site,
  };
}

async function projectWork(m: WorkMember, me: Me, now: Date, today: string): Promise<WorkSource[]> {
  const where = projectWhere(m, me.role);
  if (!where) return [];
  const rows = await prisma.homeProject.findMany({
    where,
    orderBy: { startOn: 'desc' },
    take: PROJECT_TAKE,
    select: projectSelect(addDays(today, -MISSED_LOOKBACK_DAYS), addDays(today, MONTH_DAYS), addDays(today, -14)),
  });
  return rows.flatMap((p) => projectSources(factsOf(p, now, today), me, today));
}

const timeOf = (at: Date) => meetingLabel(at).split(', ').pop() ?? '';

/** Follow-ups, meetings and tasks over the window, with the counts the reads did not fetch. */
async function leadWork(m: WorkMember, now: Date): Promise<{ sources: WorkSource[]; hidden: Partial<Record<Bucket, number>> }> {
  if (!can(m, 'lead.read', { assigned: true })) return { sources: [], hidden: {} };
  const { start, end } = istDayBounds(now);
  const end3 = new Date(end.getTime() + SOON_DAYS * 86_400_000);
  /* Next month (owner, 1 Nov 2026). */
  const endMonth = new Date(end.getTime() + MONTH_DAYS * 86_400_000);
  /* Whose leads: a salesperson's own (leadsVisibleTo); the owner the studio's; a PM only the leads given to them —
     their work is their projects (owner, 15 Oct 2026), and the studio's follow-ups stay on Today. Sales roles
     (owner, 22 Oct 2026): "my work" stays a salesperson's OWN leads, whatever their team reach; their team's
     follow-ups are on Today. AND, never a spread: a team reach is an OR of its own. */
  const mine = m.role === 'PM' || m.role === 'SALES' ? { assignedToId: m.id } : {};
  const base = { AND: [leadsVisibleTo(m), mine], studioId: m.studioId, deletedAt: null, isDemo: false } satisfies Prisma.StudioClientWhereInput;
  const open = { ...base, stage: { kind: { in: ['OPEN' as const, 'WON' as const] } } };
  const lateW = { ...open, nextActionOn: { lt: start } };
  const todayW = { ...open, nextActionOn: { gte: start, lte: end } };
  const soonW = { ...open, nextActionOn: { gt: end, lte: end3 } };
  const monthW = { ...open, nextActionOn: { gt: end3, lte: endMonth } };
  const sel = { id: true, name: true, nextAction: true, nextActionOn: true } as const;
  const [late, todays, soon, month, nLate, nToday, nSoon, nMonth, meetings, tasks] = await Promise.all([
    prisma.studioClient.findMany({ where: lateW, orderBy: [{ nextActionOn: 'asc' }, { id: 'asc' }], take: LEAD_TAKE, select: sel }),
    prisma.studioClient.findMany({ where: todayW, orderBy: [{ nextActionOn: 'asc' }, { id: 'asc' }], take: LEAD_TAKE, select: sel }),
    prisma.studioClient.findMany({ where: soonW, orderBy: [{ nextActionOn: 'asc' }, { id: 'asc' }], take: LEAD_TAKE, select: sel }),
    prisma.studioClient.findMany({ where: monthW, orderBy: [{ nextActionOn: 'asc' }, { id: 'asc' }], take: LEAD_TAKE, select: sel }),
    prisma.studioClient.count({ where: { ...LIVE, ...lateW } }),
    prisma.studioClient.count({ where: { ...LIVE, ...todayW } }),
    prisma.studioClient.count({ where: { ...LIVE, ...soonW } }),
    prisma.studioClient.count({ where: { ...LIVE, ...monthW } }),
    prisma.studioClient.findMany({ where: { ...base, meetingAt: { gte: start, lte: endMonth } }, orderBy: { meetingAt: 'asc' }, take: LEAD_TAKE, select: { id: true, name: true, meetingAt: true, meetingNote: true } }),
    openTasksDue(m, endMonth, LEAD_TAKE),
  ]);
  const follow = [...late, ...todays, ...soon, ...month];
  /* A PM sees every task (task-rules.ts); their own work is the ones given to them. */
  const myTasks = m.role === 'PM' ? tasks.rows.filter((t) => t.assignedToId === m.id) : tasks.rows;
  const tasksHidden = m.role === 'PM' ? 0 : Math.max(0, tasks.total - tasks.rows.length);
  const sources = leadSources({
    followUps: follow.map((l) => ({ id: l.id, name: l.name, nextAction: l.nextAction, due: istDay(l.nextActionOn!) })),
    meetings: meetings.map((l) => ({ id: l.id, name: l.name, due: istDay(l.meetingAt!), time: timeOf(l.meetingAt!), note: l.meetingNote })),
    tasks: myTasks.map((t) => ({ id: t.id, title: t.title, due: istDay(t.dueAt), time: timeOf(t.dueAt), leadId: t.leadId, leadName: t.leadName })),
  });
  return {
    sources,
    hidden: {
      missed: Math.max(0, nLate - late.length),
      today: Math.max(0, nToday - todays.length),
      soon: Math.max(0, nSoon - soon.length) + tasksHidden,
      month: Math.max(0, nMonth - month.length),
    },
  };
}

/**
 * Change orders and sign-offs (project/change-orders.ts, project/signoffs.ts):
 * a change order sent and not answered, approved and not paid (accounts),
 * paid and not released; a sign-off asked and not signed. None has a due day
 * of its own, so each is due two days after it started waiting (Missed after).
 * A read failure (an older database) leaves them out rather than the list.
 */
export const WAITING_DAYS = 2;

async function changeOrderWork(m: WorkMember, me: Me): Promise<WorkSource[]> {
  const where = projectWhere(m, me.role);
  if (!where) return [];
  const office = me.role === 'OWNER' || me.role === 'PM' || me.role === 'DESIGNER';
  try {
    const [orders, signoffs] = await Promise.all([
      prisma.homeChangeOrder.findMany({
        where: { project: where, status: { in: ['SENT_TO_CLIENT', 'APPROVED', 'PAID'] }, cancelledAt: null },
        orderBy: { createdAt: 'asc' },
        take: 100,
        select: {
          id: true,
          number: true,
          title: true,
          status: true,
          sentAt: true,
          decidedAt: true,
          paidAt: true,
          totalPaise: true,
          projectId: true,
          project: { select: { introduction: { select: { brief: { select: { society: true, locality: true, propertyType: true, contactName: true, user: { select: { name: true } } } } } } } },
        },
      }),
      office
        ? prisma.homeQuoteSignoff.findMany({
            where: { project: where, signedAt: null, withdrawnAt: null },
            orderBy: { requestedAt: 'asc' },
            take: 100,
            select: { id: true, kind: true, quoteNumber: true, revisionN: true, requestedAt: true, projectId: true, project: { select: { introduction: { select: { brief: { select: { society: true, locality: true, propertyType: true, contactName: true, user: { select: { name: true } } } } } } } } },
          })
        : Promise.resolve([]),
    ]);
    const placeOf = (b: { society: string | null; locality: string | null; propertyType: string | null; contactName: string | null; user: { name: string | null } | null }) =>
      `${b.contactName?.trim() || b.user?.name?.trim() || 'Client'} · ${siteLabel(b)}`;
    const out: WorkSource[] = [];
    for (const o of orders) {
      const place = placeOf(o.project.introduction.brief);
      const href = `/studio/projects/${o.projectId}?tab=extras`;
      const name = `Extra work ${o.number}: ${o.title}`;
      if (o.status === 'SENT_TO_CLIENT' && office && o.sentAt) {
        out.push({ key: `extra:${o.id}`, kind: 'change-order', title: name, place, due: addDays(istDay(o.sentAt), WAITING_DAYS), detail: 'Waiting for the client to approve', href });
      } else if (o.status === 'APPROVED' && me.recordsPayments && o.decidedAt) {
        out.push({ key: `extra:${o.id}`, kind: 'change-order', title: name, place, due: addDays(istDay(o.decidedAt), WAITING_DAYS), detail: `Approved · record ${formatINR(fromDb(o.totalPaise))}`, href });
      } else if (o.status === 'PAID' && office && o.paidAt) {
        out.push({ key: `extra:${o.id}`, kind: 'change-order', title: name, place, due: addDays(istDay(o.paidAt), WAITING_DAYS), detail: 'Paid · release it to the work', href });
      }
    }
    for (const s of signoffs) {
      out.push({
        key: `signoff:${s.id}`,
        kind: 'sign-off',
        title: `${s.kind === 'DESIGN_FINAL' ? 'Design final' : 'Sales final'} ${s.quoteNumber} R${s.revisionN}`,
        place: placeOf(s.project.introduction.brief),
        due: addDays(istDay(s.requestedAt), WAITING_DAYS),
        detail: 'Waiting for the client to sign',
        href: `/studio/projects/${s.projectId}`,
      });
    }
    return out;
  } catch (error) {
    console.error('[my-work] change orders read failed', error instanceof Error ? error.name : 'unknown');
    return [];
  }
}

export interface WorkRun {
  work: MyWork;
  /** Every source before the lists were cut (the reminders read these). */
  sources: WorkSource[];
}

/** One member's work. Never throws: a failed read leaves that part out. */
export async function workFor(m: WorkMember, now = new Date()): Promise<WorkRun | null> {
  const role = asRole(m.role);
  if (!role || m.status !== 'ACTIVE' || waitingForFullSoftware(m)) return null;
  const today = istDay(now);
  const me = meOf(m, role);
  const safe = <T,>(p: Promise<T>, empty: T, what: string): Promise<T> =>
    p.catch((error: unknown) => {
      console.error(`[my-work] ${what} read failed`, error instanceof Error ? error.name : 'unknown');
      return empty;
    });
  const [projects, leads, extras] = await Promise.all([
    safe(projectWork(m, me, now, today), [] as WorkSource[], 'projects'),
    safe(leadWork(m, now), { sources: [] as WorkSource[], hidden: {} }, 'leads'),
    changeOrderWork(m, me),
  ]);
  const sources = [...projects, ...extras, ...leads.sources];
  return { work: buildMyWork(sources, today, { hidden: leads.hidden }), sources };
}

/** The signed-in member's work, for their home (and site mode). Null when they are not a studio member. */
export async function myWork(now = new Date()): Promise<MyWork | null> {
  const m = await currentMember();
  if (!m) return null;
  return (await workFor(m, now))?.work ?? null;
}

// ── Reminders ─────────────────────────────────────────────────

/** Every active member of a live studio, each read and sent to on their own studio's scope (workFor). The cron's job, like the Today email's. */
async function people() {
  const rows = await prisma.studioMember.findMany({
    where: { status: 'ACTIVE', studio: { status: { in: ['ACTIVE', 'ONBOARDING', 'PAUSED'] } } },
    select: {
      id: true,
      studioId: true,
      userId: true,
      role: true,
      status: true,
      studio: { select: { tradeName: true, fullSoftware: true, softwarePlan: true } },
      user: { select: { email: true, name: true, phone: true } },
    },
    take: 2000,
  });
  return rows.map((r) => ({ ...r, fullSoftware: opensFullSoftware(planOf(r.studio)) }));
}

/** Whether this person already got this notice today (IST): each goes once a day. */
async function sentToday(userId: string, template: string, now: Date): Promise<boolean> {
  const { start } = istDayBounds(now);
  const row = await prisma.notification.findFirst({ where: { userId, template, createdAt: { gte: start } }, select: { id: true } });
  return row !== null;
}

/** The leads Today sections that My work does not already list (floor plans, quotes, bookings, the pool). */
const TODAY_EXTRA: readonly TodaySection['id'][] = ['floor-plans', 'quotes', 'bookings', 'pool', 'never-called'];

function todayExtra(sections: readonly TodaySection[]): string | null {
  const filled = sections.filter((s) => TODAY_EXTRA.includes(s.id) && s.rows.length > 0);
  if (!filled.length) return null;
  const lines: string[] = ['Also on your leads list:'];
  for (const s of filled) {
    lines.push(`${s.title} (${s.rows.length + s.more})`);
    for (const r of s.rows.slice(0, 5)) lines.push(`- ${r.title}: ${r.detail}`);
  }
  return lines.join('\n');
}

export interface DigestRun {
  people: number;
  sent: number;
  emailed: number;
  skipped: number;
}

/**
 * The morning digest (08:00 IST, /api/cron/today-email): each active studio
 * member's Today and Missed, in the app and by email, and for the owner, a
 * PM and sales the rest of their leads Today list in the same email (one
 * email, not two). Nobody gets one with nothing in it. Someone with no email
 * (a site supervisor) gets it through the studio MessageSender, which uses
 * WhatsApp only when the approved template is set.
 */
export async function runMorningDigest(now = new Date()): Promise<DigestRun> {
  const list = await people();
  const url = `${resolveSiteUrl()}/studio/home`;
  let sent = 0;
  let emailed = 0;
  let skipped = 0;
  for (const p of list) {
    try {
      if (await sentToday(p.userId, 'studio.my_work', now)) {
        skipped += 1;
        continue;
      }
      const run = await workFor(p, now);
      const first = p.user.name?.trim().split(/\s+/)[0] || 'there';
      const digest = run ? workDigest(run.work, first, p.studio.tradeName) : null;
      let extra: string | null = null;
      if (['OWNER', 'PM', 'SALES'].includes(p.role)) {
        /* A salesperson's list with their sales role and team, as on screen (sales roles, owner 22 Oct 2026). */
        const who = p.role === 'SALES' ? await memberFor(p.userId) : p;
        if (who && who.status === 'ACTIVE') {
          const input = await todayInput(who, now);
          extra = todayExtra(buildToday({ ...input, now, seesAll: seesEveryLead(who) }));
        }
      }
      if (!digest && !extra) {
        skipped += 1;
        continue;
      }
      const w = run?.work;
      const firstItem = w ? (w.missed[0] ?? w.todayGroups[0]?.items[0] ?? null) : null;
      await notify(
        p.userId,
        { kind: 'my-work', today: w?.counts.today ?? 0, missed: w?.counts.missed ?? 0, soon: w?.counts.soon ?? 0, first: firstItem ? `${firstItem.title} (${firstItem.place})` : '' },
        { email: false },
      );
      sent += 1;
      const title = digest?.title ?? 'Your leads list for today';
      const body = [digest?.body ?? `Good morning ${first}.`, extra].filter(Boolean).join('\n\n');
      if (p.user.email) {
        const r = await sendNotice(p.user.email, { title, body, url });
        if (r.delivered) emailed += 1;
      } else if (p.user.phone && w && (w.counts.today > 0 || w.counts.missed > 0)) {
        await send(p.user.phone, { kind: 'my-work', name: first, today: w.counts.today, missed: w.counts.missed, link: url });
      }
    } catch (error) {
      skipped += 1;
      console.error('[my-work] digest failed', error instanceof Error ? error.name : 'unknown');
    }
  }
  return { people: list.length, sent, emailed, skipped };
}

/** Steps ticked since `since` on the projects this member's list reads. */
async function stepsDoneSince(m: WorkMember, role: WorkRole, since: Date): Promise<DoneStep[]> {
  const where = projectWhere(m, role);
  if (!where || role === 'ACCOUNTS') return [];
  const rows = await prisma.homeChecklistItem.findMany({
    where: { doneAt: { gte: since }, inScope: true, stage: { project: where } },
    orderBy: { doneAt: 'asc' },
    take: 200,
    select: {
      id: true,
      label: true,
      responsible: true,
      doneById: true,
      stage: { select: { kind: true, project: { select: { id: true, designerId: true, introduction: { select: { brief: { select: { society: true, locality: true, propertyType: true, contactName: true, user: { select: { name: true } } } } } } } } } },
    },
  });
  const ids = [...new Set(rows.map((r) => r.doneById).filter((x): x is string => Boolean(x)))];
  const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
  const nameOf = new Map(users.map((u) => [u.id, u.name?.trim().split(/\s+/)[0] ?? null]));
  return rows.map((r) => {
    const b = r.stage.project.introduction.brief;
    return {
      stepId: r.id,
      label: r.label,
      place: `${b.contactName?.trim() || b.user?.name?.trim() || 'Client'} · ${siteLabel(b)}`,
      projectId: r.stage.project.id,
      design: r.stage.kind === 'DESIGN',
      responsible: r.responsible,
      designerId: r.stage.project.designerId,
      doneById: r.doneById,
      doneByName: r.doneById ? (nameOf.get(r.doneById) ?? null) : null,
    };
  });
}

export interface EveningRun {
  people: number;
  dueTomorrow: number;
  done: number;
}

/** 17:00 to 20:59 IST: the 18:00 run of the site-reminders cron; the 21:00 run sends nothing here. */
export const isEveningRun = (now: Date): boolean => {
  const m = istMinutesOfDay(now);
  return m >= 17 * 60 && m < 21 * 60;
};

/**
 * The evening notices (18:00 IST, folded into /api/cron/site-reminders):
 * in the app only, to studio staff — what is due tomorrow, and the steps
 * someone else completed today on the projects that are theirs.
 */
export async function runEveningNotices(now = new Date()): Promise<EveningRun> {
  const run: EveningRun = { people: 0, dueTomorrow: 0, done: 0 };
  if (!isEveningRun(now)) return run;
  const list = await people();
  run.people = list.length;
  const today = istDay(now);
  const { start } = istDayBounds(now);
  for (const p of list) {
    try {
      const role = asRole(p.role);
      if (!role) continue;
      const w = await workFor(p, now);
      if (!w) continue;
      const tomorrow = dueTomorrow(w.sources, today);
      if (tomorrow.length && !(await sentToday(p.userId, 'studio.work_due_tomorrow', now))) {
        await notify(p.userId, { kind: 'work-due-tomorrow', count: tomorrow.length, list: shortList(tomorrow) }, { email: false });
        run.dueTomorrow += 1;
      }
      const done = doneByOthers(await stepsDoneSince(p, role, start), { ...meOf(p, role), userId: p.userId });
      if (done.length && !(await sentToday(p.userId, 'studio.work_done', now))) {
        const items = done.map((d) => ({ title: d.doneByName ? `${d.label} by ${d.doneByName}` : d.label, place: d.place }));
        await notify(p.userId, { kind: 'work-done', count: done.length, list: shortList(items) }, { email: false });
        run.done += 1;
      }
    } catch (error) {
      console.error('[my-work] evening notice failed', error instanceof Error ? error.name : 'unknown');
    }
  }
  return run;
}
