/**
 * The studio office's view of its customers' projects (studio workspace
 * Phase 1, design studio/StudioProjects.dc.html): one row per project and the
 * "Needs attention today" strip. Pure, and tested
 * (tests/studio-workspace.test.ts); the reads are in workspace.ts.
 *
 * Everything is worked out from what the project records, never typed:
 *
 * - **Stage** — the stage happening now (tracker.ts `projectStages`: the plan
 *   when there is one, else the old fixed stages), with "day N of M" of the
 *   whole project. Null once every stage is done: handed over.
 * - **Today on site** — the time of today's latest update, in India time.
 * - **Overall** — days late, the customer app's own rule
 *   (app/project-view.ts `daysLate`): the latest stage past its date and
 *   not done. 0 is on track.
 * - **Snags** — open ones, and those past their fix-by date.
 * - **Waiting on the customer** — decisions they have not made. A delay
 *   from these is not the studio's, and the strip says so.
 * - **Next payment** — the first unpaid stage as signed; "to record" once
 *   its due date has come and it is not marked received.
 */

import { formatINR } from '@/lib/money';
import { localityLabel } from '@/modules/brief/types';
import { daysLate, dayOf } from '@/modules/app/project-view';
import { projectStages, type PlanStageRow, type StageView } from '@/modules/portal/tracker';
import { moneyView } from '@/modules/portal/payments';
import { decisionState } from '@/modules/portal/decisions';
import { planName, type DbPlan, type PlanName } from '@/modules/portal/plans';

const IST = 'Asia/Kolkata';

/** "YYYY-MM-DD" of a moment in India time. */
export const istDay = (d: Date): string => d.toLocaleDateString('en-CA', { timeZone: IST });
export const shortDay = (d: Date): string => d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: IST }).replace(',', '');
export const clock = (d: Date): string =>
  d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: IST }).toLowerCase();

const BHK: Record<string, string> = { BHK_1: '1 BHK', BHK_2: '2 BHK', BHK_3: '3 BHK', BHK_4_PLUS: '4+ BHK', VILLA: 'Villa' };
export const bhkLabel = (t: string | null | undefined): string | null => (t ? (BHK[t] ?? null) : null);

/** "Ivy Towers, Baner, 2 BHK" — what the studio calls the home. */
export function homeLabel(b: { society: string | null; locality: string | null; propertyType: string | null }): string {
  return [b.society?.trim() || null, localityLabel(b.locality), bhkLabel(b.propertyType)].filter(Boolean).join(', ') || 'A home';
}

export const firstName = (name: string | null | undefined): string => name?.trim().split(/\s+/)[0] || 'Your customer';

export interface WorkspaceInput {
  id: string;
  home: string;
  customer: string;
  startOn: Date;
  totalDays: number;
  doneStages: string[];
  stages: PlanStageRow[];
  plan: DbPlan;
  contractPaise: number | null;
  paymentPhases: unknown;
  paidPhases: unknown;
  lastUpdateAt: Date | null;
  snags: { title: string; room: string | null; status: string; fixBy: Date | null }[];
  decisions: { title: string; dueOn: Date; chosenIndex: number | null }[];
}

export interface WorkspaceRow {
  id: string;
  home: string;
  customer: string;
  plan: PlanName;
  stages: StageView[];
  /** Null once every stage is done. */
  stage: { label: string; day: number; of: number } | null;
  started: boolean;
  /** Today's latest update, or null when nothing is posted yet today. */
  postedToday: Date | null;
  lateDays: number;
  snags: { open: number; overdue: { title: string; room: string | null; fixBy: Date }[] };
  waiting: { title: string; dueOn: Date; overdue: boolean }[];
  nextPayment: { label: string; amountPaise: number; dueOn: string | null; toRecord: boolean } | null;
}

export function workspaceRow(p: WorkspaceInput, now: Date): WorkspaceRow {
  const stages = projectStages(p, now);
  const wire = stages.map((s) => ({ ...s, targetOn: s.targetOn.toISOString() }));
  const current = stages.find((s) => s.state === 'now') ?? null;
  const { day, of } = dayOf(p.startOn.toISOString(), wire, now);
  const money = moneyView(p.contractPaise, p.paymentPhases, p.paidPhases);
  const next = money?.next ?? null;
  const today = istDay(now);
  const open = p.snags.filter((s) => s.status !== 'FIXED');
  return {
    id: p.id,
    home: p.home,
    customer: p.customer,
    plan: planName(p.plan),
    stages,
    stage: current ? { label: current.label, day, of } : null,
    started: p.startOn.getTime() <= now.getTime(),
    postedToday: p.lastUpdateAt && istDay(p.lastUpdateAt) === today ? p.lastUpdateAt : null,
    lateDays: daysLate(wire, now),
    snags: {
      open: open.length,
      overdue: open
        .filter((s): s is typeof s & { fixBy: Date } => s.fixBy !== null && s.fixBy.getTime() < now.getTime())
        .map((s) => ({ title: s.title, room: s.room, fixBy: s.fixBy })),
    },
    waiting: p.decisions
      .filter((d) => decisionState(d, now) !== 'chosen')
      .map((d) => ({ title: d.title, dueOn: d.dueOn, overdue: d.dueOn.getTime() < now.getTime() })),
    nextPayment: next
      ? { label: next.label, amountPaise: next.amountPaise, dueOn: next.dueOn, toRecord: next.dueOn !== null && next.dueOn <= today }
      : null,
  };
}

export type AttentionKind = 'no-update' | 'snag-overdue' | 'payment' | 'waiting';

export const ATTENTION_TITLES: Record<AttentionKind, string> = {
  'no-update': 'No update yet today',
  'snag-overdue': 'Snag past its fix-by date',
  payment: 'Payment to record',
  waiting: 'Waiting on the customer · not your delay',
};

export interface Attention {
  kind: AttentionKind;
  projectId: string;
  home: string;
  text: string;
}

const dayOfIso = (iso: string) => shortDay(new Date(`${iso}T12:00:00Z`));

/** What needs the studio today, in the design's order: updates, snags, payments, then the customer's own waits. */
export function attentionToday(rows: WorkspaceRow[]): Attention[] {
  const out: Attention[] = [];
  for (const r of rows) {
    if (r.started && r.stage && !r.postedToday) {
      out.push({ kind: 'no-update', projectId: r.id, home: r.home, text: `Nothing posted for ${r.stage.label.toLowerCase()} today. ${r.customer} sees today's update in their app.` });
    }
  }
  for (const r of rows) {
    for (const s of r.snags.overdue) {
      out.push({ kind: 'snag-overdue', projectId: r.id, home: r.home, text: `${s.title}${s.room ? ` (${s.room})` : ''}. Was due ${shortDay(s.fixBy)}. ${r.customer} sees it as overdue.` });
    }
  }
  for (const r of rows) {
    const p = r.nextPayment;
    if (p?.toRecord && p.dueOn) {
      out.push({ kind: 'payment', projectId: r.id, home: r.home, text: `${p.label}, ${formatINR(p.amountPaise)}, due ${dayOfIso(p.dueOn)}. Mark it received once it is in.` });
    }
  }
  for (const r of rows) {
    for (const d of r.waiting) {
      out.push({
        kind: 'waiting',
        projectId: r.id,
        home: r.home,
        text: `${r.customer} hasn't decided: ${d.title}. ${d.overdue ? 'Was due' : 'Due'} ${shortDay(d.dueOn)}. A delay from this is not counted against you.`,
      });
    }
  }
  return out;
}

/** Live projects first (by how late they run), then the handed-over ones. */
export function sortRows(rows: WorkspaceRow[]): WorkspaceRow[] {
  return [...rows].sort((a, b) => Number(a.stage === null) - Number(b.stage === null) || b.lateDays - a.lateDays);
}
