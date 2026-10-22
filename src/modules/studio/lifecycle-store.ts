import 'server-only';

/**
 * The project lifecycle board (owner, 13 Oct 2026; docs/studio-os/PROJECT-LIFECYCLE.md):
 * a designer's three tabs — My Design, My Execution, My Snags — and the
 * same phase information for the owner and the PM (their projects), with
 * "N project closures remaining". Reads only; the moves are in
 * project/lifecycle.ts, the closure in project/closure.ts.
 *
 * Who sees what: `projectsVisibleTo(member)` (a designer only projects they
 * are on), narrowed for a designer to the projects they are THE designer on.
 * Cancelled projects are left out.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { currentMember, memberOnProject, projectsVisibleTo } from './access';
import { siteLabel } from './team-rules';
import { readSignedStages } from '@/modules/portal/payments';
import { GATE_SELECT, gateStagesOf } from '@/modules/studio-design/store';
import { drawingsOf, gateOf } from '@/modules/studio-design/rules';
import { execGate } from '@/modules/studio-crews/exec-gates';
import { readCrewSettings } from '@/modules/studio-crews/settings';
import { effectivePhase, isPhase, PHASE_LABEL, type Phase } from '@/modules/project/lifecycle-rules';
import { lifecycleCard, type CardBlocker, type CardStep } from '@/modules/project/lifecycle-card';
import { eventsOrLegacy, snagStatus } from '@/modules/project/snag-status';
import { dayFromDb, istDay } from '@/modules/project/working-days';
import { fromDb } from '@/lib/money';

export interface BoardSnag {
  id: string;
  title: string;
  room: string | null;
  warranty: boolean;
  state: string;
  fixBy: string | null;
}

export interface BoardCard {
  id: string;
  client: string;
  flat: string;
  designer: string | null;
  phase: Phase;
  phaseLabel: string;
  current: string;
  next: string | null;
  blocker: CardBlocker | null;
  lateDays: number;
  warrantyEndsOn: string | null;
  provisionalOn: string | null;
  /** Open snags (and, during the warranty, open warranty snags) for My Snags. */
  snags: BoardSnag[];
  /** The fixed final payment, once closed out (money: owner, accounts, PM and designer on it). */
  finalDuePaise: number | null;
  /** Change orders (15 Oct 2026): extra work with the client, approved and not paid, paid and ready to release. */
  extras: { withClient: number; toPay: number; toRelease: number };
}

export interface LifecycleBoard {
  /** A designer's own projects, or the studio's (owner) / the PM's. */
  scope: 'designer' | 'studio';
  design: BoardCard[];
  /** Execution and the closure (the closure sits in My Execution). */
  execution: BoardCard[];
  /** Snags and the warranty. */
  snags: BoardCard[];
  closed: BoardCard[];
  /** Past provisional handover, not closed out yet. */
  closures: BoardCard[];
}

const SELECT = {
  id: true,
  phase: true,
  warrantyEndsOn: true,
  provisionalHandoverAt: true,
  designerId: true,
  designer: { select: { user: { select: { name: true } } } },
  ...GATE_SELECT,
  introduction: {
    select: {
      studio: { select: { crewSettings: true } },
      brief: { select: { society: true, locality: true, propertyType: true, contactName: true, user: { select: { name: true } } } },
    },
  },
  stages: {
    orderBy: { sortOrder: 'asc' },
    select: {
      kind: true,
      name: true,
      items: { orderBy: { sortOrder: 'asc' }, select: { label: true, doneAt: true, inScope: true, plannedOn: true, responsible: true, gatePayment: true } },
    },
  },
  snags: {
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
      events: { select: { id: true, kind: true, at: true, fixBy: true, assigneeId: true, photoPaths: true, customerText: true, note: true } },
    },
  },
  documents: {
    where: { deletedAt: null, sharedAt: { not: null }, designKind: { not: null } },
    select: { id: true, title: true, designKind: true, room: true, version: true, supersedesId: true, sharedAt: true, deletedAt: true, createdAt: true },
  },
  designReviews: { select: { documentId: true, verdict: true, comment: true, at: true } },
  closures: { orderBy: { version: 'desc' }, take: 1, select: { final: true, finalDuePaise: true } },
  changeOrders: { where: { status: { in: ['SENT_TO_CLIENT', 'APPROVED', 'PAID'] } }, select: { status: true } },
} as const satisfies Prisma.HomeProjectSelect;

type Row = Prisma.HomeProjectGetPayload<{ select: typeof SELECT }>;

const day = (d: Date | null) => (d ? dayFromDb(d) : null);

function cardOf(p: Row, now: Date, seesMoney: boolean): BoardCard {
  const today = istDay(now);
  const warrantyEndsOn = day(p.warrantyEndsOn);
  const phase = isPhase(p.phase) ? effectivePhase(p.phase, warrantyEndsOn, now) : 'DESIGN';
  const gates = gateStagesOf(p);
  const payments = readSignedStages(p.paymentPhases) ?? [];
  const rules = readCrewSettings(p.introduction.studio.crewSettings).execGates;
  const designStage = p.stages.find((s) => s.kind === 'DESIGN');
  const designSteps: CardStep[] = (designStage?.items ?? []).map((i) => {
    const g = gateOf(i.gatePayment, gates);
    return { label: i.label, done: i.doneAt !== null, inScope: i.inScope, plannedOn: day(i.plannedOn), responsible: i.responsible, lockedBy: g.open ? null : g.payment };
  });
  const execSteps: CardStep[] = p.stages
    .filter((s) => s.kind !== 'DESIGN')
    .flatMap((s) =>
      s.items.map((i) => {
        const g = i.doneAt ? ({ open: true } as const) : execGate({ label: i.label, gatePayment: i.gatePayment }, rules, payments, gates);
        return { label: i.label, done: i.doneAt !== null, inScope: i.inScope, plannedOn: day(i.plannedOn), responsible: null, lockedBy: g.open ? null : g.payment, stage: s.name };
      }),
    );
  const snags = p.snags.map((s) => ({ s, st: snagStatus(eventsOrLegacy(s.events, s), now) }));
  const open = snags.filter((x) => x.st.open);
  const answers = p.designReviews.map((r) => ({ documentId: r.documentId, verdict: r.verdict === 'APPROVED' ? ('APPROVED' as const) : ('CHANGES' as const), comment: r.comment, at: r.at }));
  const drawingsWaiting = drawingsOf(p.documents, answers).filter((d) => d.state === 'waiting').length;
  const view = lifecycleCard({
    phase,
    today,
    designSteps,
    execSteps,
    drawingsWaiting,
    openSnags: open.length,
    snagsWithClient: open.filter((x) => x.st.state === 'fixed').length,
    warrantyOpen: open.filter((x) => x.s.warranty).length,
    closureSaved: p.closures.length > 0,
    warrantyEndsOn,
  });
  const b = p.introduction.brief;
  const shown = phase === 'WARRANTY' || phase === 'CLOSED' ? open.filter((x) => x.s.warranty) : open;
  return {
    id: p.id,
    client: b.contactName?.trim() || b.user?.name?.trim() || 'Client',
    flat: siteLabel(b),
    designer: p.designer?.user.name ?? null,
    phase,
    phaseLabel: PHASE_LABEL[phase],
    ...view,
    warrantyEndsOn,
    provisionalOn: p.provisionalHandoverAt ? istDay(p.provisionalHandoverAt) : null,
    snags: shown.map(({ s, st }) => ({ id: s.id, title: s.title, room: s.room, warranty: s.warranty, state: st.state, fixBy: s.fixBy ? istDay(s.fixBy) : null })),
    finalDuePaise: seesMoney && p.closures[0]?.final ? fromDb(p.closures[0].finalDuePaise) : null,
    extras: {
      withClient: p.changeOrders.filter((c) => c.status === 'SENT_TO_CLIENT').length,
      toPay: p.changeOrders.filter((c) => c.status === 'APPROVED').length,
      toRelease: p.changeOrders.filter((c) => c.status === 'PAID').length,
    },
  };
}

/**
 * The board for the signed-in member: a designer's own projects (as the
 * designer), else every project they may read (owner: the studio; PM: theirs).
 * Null for a member who reads no projects (accounts, sales, supervisor).
 */
export async function lifecycleBoard(now = new Date()): Promise<LifecycleBoard | null> {
  const member = await currentMember();
  if (!member || !['OWNER', 'PM', 'DESIGNER'].includes(member.role)) return null;
  const where: Prisma.HomeProjectWhereInput = {
    ...projectsVisibleTo(member),
    cancelledAt: null,
    ...(member.role === 'DESIGNER' ? { designerId: member.id } : {}),
  };
  const rows = await prisma.homeProject.findMany({ where, orderBy: { startOn: 'desc' }, take: 300, select: SELECT });
  // Money on the board: the owner, and the PM or designer on the project (all of these rows are theirs).
  const cards = rows.map((r) => cardOf(r, now, true));
  const byLate = (a: BoardCard, b: BoardCard) => b.lateDays - a.lateDays || a.client.localeCompare(b.client);
  return {
    scope: member.role === 'DESIGNER' ? 'designer' : 'studio',
    design: cards.filter((c) => c.phase === 'DESIGN').sort(byLate),
    execution: cards.filter((c) => c.phase === 'EXECUTION' || c.phase === 'CLOSURE').sort((a, b) => Number(b.phase === 'CLOSURE') - Number(a.phase === 'CLOSURE') || byLate(a, b)),
    snags: cards.filter((c) => c.phase === 'SNAGS' || c.phase === 'WARRANTY').sort((a, b) => b.snags.length - a.snags.length),
    closed: cards.filter((c) => c.phase === 'CLOSED'),
    closures: cards.filter((c) => c.phase === 'CLOSURE'),
  };
}

/** The studio-wide "closures remaining" for the owner's Today / home (the PM: their projects). Null for other roles. */
export async function closuresRemainingFor(): Promise<{ count: number; projects: { id: string; client: string; flat: string; since: string | null }[] } | null> {
  const member = await currentMember();
  if (!member || !['OWNER', 'PM', 'DESIGNER'].includes(member.role)) return null;
  const rows = await prisma.homeProject.findMany({
    where: { ...projectsVisibleTo(member), cancelledAt: null, phase: 'CLOSURE', ...(member.role === 'DESIGNER' ? { designerId: member.id } : {}) },
    orderBy: { provisionalHandoverAt: 'asc' },
    take: 100,
    select: { id: true, provisionalHandoverAt: true, introduction: { select: { brief: { select: { society: true, locality: true, propertyType: true, contactName: true, user: { select: { name: true } } } } } } },
  });
  return {
    count: rows.length,
    projects: rows.map((r) => ({
      id: r.id,
      client: r.introduction.brief.contactName?.trim() || r.introduction.brief.user?.name?.trim() || 'Client',
      flat: siteLabel(r.introduction.brief),
      since: r.provisionalHandoverAt ? istDay(r.provisionalHandoverAt) : null,
    })),
  };
}

/** One project's phase for its workspace header (anyone who may see the project). */
export async function projectPhaseFor(projectId: string, now = new Date()): Promise<{ phase: Phase; label: string; warrantyEndsOn: string | null; provisionalOn: string | null; closedOutOn: string | null; signedOffOn: string | null } | null> {
  const check = await memberOnProject(projectId);
  if (!check.ok) return null;
  const p = await prisma.homeProject.findUnique({
    where: { id: projectId },
    select: { phase: true, warrantyEndsOn: true, provisionalHandoverAt: true, closedOutAt: true, handoverSignedAt: true },
  });
  if (!p || !isPhase(p.phase)) return null;
  const warrantyEndsOn = day(p.warrantyEndsOn);
  const phase = effectivePhase(p.phase, warrantyEndsOn, now);
  return {
    phase,
    label: PHASE_LABEL[phase],
    warrantyEndsOn,
    provisionalOn: p.provisionalHandoverAt ? istDay(p.provisionalHandoverAt) : null,
    closedOutOn: p.closedOutAt ? istDay(p.closedOutAt) : null,
    signedOffOn: p.handoverSignedAt ? istDay(p.handoverSignedAt) : null,
  };
}
