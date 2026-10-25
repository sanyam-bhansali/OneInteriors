import 'server-only';

/**
 * The studio office's Projects list and project workspace (studio workspace
 * Phase 1, designs studio/StudioProjects.dc.html and StudioProject.dc.html),
 * read from the customer's own project record (`HomeProject`). Read-only in
 * this phase, except the team's own notes.
 *
 * Every read goes through studio/access.ts: the list is
 * `projectsVisibleTo(member)` (owner: the studio's projects; PM and
 * supervisor: the ones they are on; accounts: none — they read payments),
 * the workspace is `memberOnProject(id, 'project.read')`, and the notes are
 * written with `plan.edit`. Money is left out for a role without
 * `payment.read` (supervisors).
 *
 * The "What {customer} sees right now" panel is the customer projection
 * itself (portal/customer-project.ts `customerViewOf`), so it shows the same
 * truth the app does.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { fromDb } from '@/lib/money';
import { customerViewOf } from '@/modules/portal/customer-project';
import type { CustomerProject } from '@/modules/portal/customer-project-view';
import { planStageView, projectStages, type PlanKind, type StageView } from '@/modules/portal/tracker';
import { projectWork, type StaffWork } from '@/modules/portal/project-store';
import { can, currentMember, memberOnProject, projectsVisibleTo, type StudioMemberRef } from './access';
import { attentionToday, bhkLabel, firstName, homeLabel, sortRows, workspaceRow, type Attention, type WorkspaceRow } from './workspace-view';
import { planName, type PlanName } from '@/modules/portal/plans';
import { inviteForProject, type InviteState } from '@/modules/project/own-project';
import { isOwnClient } from './introduction-source';

const BRIEF_SELECT = {
  select: {
    society: true,
    locality: true,
    propertyType: true,
    tier: true,
    contactName: true,
    userId: true,
    user: { select: { name: true, phoneVerified: true } },
  },
} as const;

const STAGE_SELECT = {
  orderBy: { sortOrder: 'asc' },
  select: { kind: true, name: true, plannedEnd: true, actualEnd: true, id: true, plannedStart: true },
} as const;

/* Phase 3: what "Overall" needs besides the stages — every moved date (never its note here) and the studio's calendar. */
const DATE_CHANGES_SELECT = {
  orderBy: [{ at: 'asc' }, { id: 'asc' }],
  select: { stageId: true, field: true, fromDate: true, toDate: true, reason: true, decisionId: true, at: true },
} satisfies Prisma.HomeProject$dateChangesArgs;
const CALENDAR_SELECT = { select: { workingDays: true, holidays: { select: { day: true } } } } as const;

const customerName = (b: { contactName: string | null; user: { name: string | null } | null }) => b.contactName?.trim() || b.user?.name?.trim() || 'Your customer';

/** Supervisors see no money (studio/roles.ts); PMs on their projects, owners and accounts do. */
const seesMoney = (member: StudioMemberRef) => can(member, 'payment.read', { assigned: true });

export interface ProjectsOverview {
  rows: WorkspaceRow[];
  attention: Attention[];
  seesMoney: boolean;
  /** The studio's own clients' projects (docs/studio-workspace/OWN-CLIENTS.md), for the "Your own client" chip. */
  ownClientIds: string[];
  /** Owner or PM: may start a project for an own client. */
  canStart: boolean;
}

/** The Projects page: every customer project this member may read, and what needs them today. Null when not a studio member. */
export async function studioProjects(now = new Date()): Promise<ProjectsOverview | null> {
  const member = await currentMember();
  if (!member) return null;
  const money = seesMoney(member);
  const projects = await prisma.homeProject.findMany({
    where: { ...projectsVisibleTo(member), cancelledAt: null },
    orderBy: { startOn: 'desc' },
    select: {
      id: true,
      startOn: true,
      totalDays: true,
      doneStages: true,
      plan: true,
      contractPaise: true,
      paymentPhases: true,
      paidPhases: true,
      introduction: { select: { source: true, brief: BRIEF_SELECT, studio: CALENDAR_SELECT } },
      stages: STAGE_SELECT,
      dateChanges: DATE_CHANGES_SELECT,
      updates: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
      /* Phase 2: the latest post from site mode counts as today's update too. */
      siteLogs: { orderBy: { postedAt: 'desc' }, take: 1, select: { postedAt: true } },
      snags: { where: { status: 'OPEN' }, select: { title: true, room: true, status: true, fixBy: true } },
      decisions: { where: { chosenIndex: null }, orderBy: { dueOn: 'asc' }, select: { title: true, dueOn: true, chosenIndex: true } },
    },
  });
  const rows = sortRows(
    projects.map((p) => {
      const b = p.introduction.brief;
      return workspaceRow(
        {
          id: p.id,
          home: homeLabel(b),
          customer: firstName(customerName(b)),
          startOn: p.startOn,
          totalDays: p.totalDays,
          doneStages: p.doneStages,
          stages: p.stages,
          plan: p.plan,
          contractPaise: money && p.contractPaise !== null ? fromDb(p.contractPaise) : null,
          paymentPhases: money ? p.paymentPhases : null,
          paidPhases: money ? p.paidPhases : null,
          lastUpdateAt: latestPost(p.updates[0]?.createdAt, (p.siteLogs ?? [])[0]?.postedAt),
          snags: p.snags,
          decisions: p.decisions,
          planStages: p.stages,
          dateChanges: p.dateChanges,
          calendar: p.introduction.studio,
        },
        now,
      );
    }),
  );
  return {
    rows,
    attention: attentionToday(rows),
    seesMoney: money,
    ownClientIds: projects.filter((p) => isOwnClient(p.introduction.source)).map((p) => p.id),
    canStart: can(member, 'project.create'),
  };
}

export interface WorkspaceStage extends StageView {
  kind: PlanKind | null;
  rooms: { room: string; items: { label: string; done: boolean }[] }[];
}

export interface ProjectWorkspace {
  id: string;
  home: string;
  customer: string;
  customerFirst: string;
  bhk: string | null;
  tier: string | null;
  /** 1 to 5 stars, the studio's one priority; null = not set (DESIGN-PROCESS-PLAN.md §2.4). */
  priority: number | null;
  /** Null for a role that sees no money. */
  contractPaise: number | null;
  signedAt: Date | null;
  plan: PlanName;
  assuredRequested: boolean;
  /** The customer has the phone app on a phone (a registered push device). */
  appConnected: boolean;
  /** The customer has signed in with their number at least once (app or website). */
  customerJoined: boolean;
  /** The studio's own client, not introduced by One Interiors (docs/studio-workspace/OWN-CLIENTS.md). */
  ownClient: boolean;
  /** An own client's invite to the app: the link to share and whether they joined. Null otherwise. */
  invite: InviteState | null;
  /** May send the own client a new invite link (owner or PM: `project.create`). */
  canInvite: boolean;
  row: WorkspaceRow;
  /** True when the plan was built from the signed quote; false for the old fixed stages. */
  hasPlan: boolean;
  stages: WorkspaceStage[];
  materials: number;
  updates: { id: string; note: string; stage: string | null; at: Date; byStudio: boolean; photos: number }[];
  /** Exactly what the customer's app shows; null if the project could not be read. */
  customerView: CustomerProject | null;
  /** The studio's snags, documents (drafts included) and payments, as /studio/updates reads them. */
  work: StaffWork | null;
  teamNotes: string;
  canEditNotes: boolean;
}

const TIER: Record<string, string> = { ESSENTIAL: 'Essential', PREMIUM: 'Premium', LUXURY: 'Luxe' };

export type WorkspaceResult = { ok: true; workspace: ProjectWorkspace } | { ok: false; error: string };

/** One project's workspace, for a member who may read the project (`project.read`). */
export async function projectWorkspace(projectId: string, now = new Date()): Promise<WorkspaceResult> {
  const check = await memberOnProject(projectId, 'project.read');
  if (!check.ok) return check;
  const money = check.access.may('payment.read');

  const p = await prisma.homeProject.findUnique({
    where: { id: projectId },
    select: {
      priority: true,
      category: true,
      id: true,
      startOn: true,
      totalDays: true,
      doneStages: true,
      plan: true,
      assuredRequestedAt: true,
      signedAt: true,
      contractPaise: true,
      paymentPhases: true,
      paidPhases: true,
      teamNotes: true,
      introduction: { select: { source: true, brief: BRIEF_SELECT, studio: CALENDAR_SELECT } },
      dateChanges: DATE_CHANGES_SELECT,
      stages: {
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          plannedStart: true,
          kind: true,
          name: true,
          plannedEnd: true,
          actualEnd: true,
          // In-scope steps only (the step tracker): a step marked not in scope is not part of the plan the customer sees.
          items: { where: { inScope: true }, orderBy: { sortOrder: 'asc' }, select: { room: true, label: true, doneAt: true } },
        },
      },
      updates: { orderBy: { createdAt: 'desc' }, take: 30, select: { id: true, note: true, stage: true, createdAt: true, byStudio: true, photoPaths: true } },
      siteLogs: { orderBy: { postedAt: 'desc' }, take: 1, select: { postedAt: true } }, // Phase 2
      snags: { where: { status: 'OPEN' }, select: { title: true, room: true, status: true, fixBy: true } },
      decisions: { where: { chosenIndex: null }, orderBy: { dueOn: 'asc' }, select: { title: true, dueOn: true, chosenIndex: true } },
      _count: { select: { materials: true } },
    },
  });
  if (!p) return { ok: false, error: 'That project is not one of yours.' };

  const b = p.introduction.brief;
  const name = customerName(b);
  const ownClient = isOwnClient(p.introduction.source);
  const [customerView, work, devices, invite] = await Promise.all([
    customerViewOf(projectId, now),
    projectWork(projectId, now),
    b.userId ? prisma.pushDevice.count({ where: { userId: b.userId } }) : Promise.resolve(0),
    ownClient ? inviteForProject(projectId) : Promise.resolve(null),
  ]);

  const row = workspaceRow(
    {
      id: p.id,
      home: homeLabel(b),
      customer: firstName(name),
      startOn: p.startOn,
      totalDays: p.totalDays,
      doneStages: p.doneStages,
      stages: p.stages,
      plan: p.plan,
      contractPaise: money && p.contractPaise !== null ? fromDb(p.contractPaise) : null,
      paymentPhases: money ? p.paymentPhases : null,
      paidPhases: money ? p.paidPhases : null,
      lastUpdateAt: latestPost(p.updates[0]?.createdAt, (p.siteLogs ?? [])[0]?.postedAt),
      snags: p.snags,
      decisions: p.decisions,
      planStages: p.stages,
      dateChanges: p.dateChanges,
      calendar: p.introduction.studio,
    },
    now,
  );

  const hasPlan = p.stages.length > 0;
  const views = hasPlan ? planStageView(p.stages, now) : projectStages(p, now);
  const stages: WorkspaceStage[] = views.map((v, i) => {
    const stored = hasPlan ? p.stages[i]! : null;
    const rooms = new Map<string, { label: string; done: boolean }[]>();
    for (const it of stored?.items ?? []) {
      const list = rooms.get(it.room) ?? [];
      list.push({ label: it.label, done: it.doneAt !== null });
      rooms.set(it.room, list);
    }
    return { ...v, kind: stored?.kind ?? null, rooms: [...rooms.entries()].map(([room, items]) => ({ room, items })) };
  });

  return {
    ok: true,
    workspace: {
      id: p.id,
      home: row.home,
      customer: name,
      customerFirst: firstName(name),
      bhk: bhkLabel(b.propertyType),
      // The quotation's category (DESIGN-PROCESS-PLAN.md §4.3), else the brief's tier.
      tier: (p.category ?? b.tier) ? (TIER[(p.category ?? b.tier)!] ?? null) : null,
      priority: p.priority,
      contractPaise: money && p.contractPaise !== null ? fromDb(p.contractPaise) : null,
      signedAt: p.signedAt,
      plan: planName(p.plan),
      assuredRequested: p.plan === 'BASIC' && p.assuredRequestedAt !== null,
      appConnected: devices > 0,
      customerJoined: devices > 0 || b.user?.phoneVerified != null || invite?.joined === true,
      ownClient,
      invite,
      canInvite: check.access.may('project.create'),
      row,
      hasPlan,
      stages,
      materials: p._count.materials,
      updates: p.updates.map((u) => ({ id: u.id, note: u.note, stage: u.stage, at: u.createdAt, byStudio: u.byStudio, photos: u.photoPaths.length })),
      customerView,
      work,
      teamNotes: p.teamNotes ?? '',
      canEditNotes: check.access.may('plan.edit'),
    },
  };
}

export const TEAM_NOTES_MAX = 4000;

/** The "Only your team" notes. Never shown to the customer (the projection does not select them). */
export async function saveTeamNotes(projectId: string, text: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const check = await memberOnProject(projectId, 'plan.edit');
  if (!check.ok) return check;
  const notes = text.replace(/\r\n/g, '\n').trim();
  if (notes.length > TEAM_NOTES_MAX) return { ok: false, error: `At most ${TEAM_NOTES_MAX} characters.` };
  await prisma.homeProject.update({ where: { id: projectId }, data: { teamNotes: notes || null } });
  return { ok: true };
}

/** Phase 2: the later of the last legacy update and the last site-mode post. */
function latestPost(update: Date | undefined, siteLog: Date | undefined): Date | null {
  if (!update) return siteLog ?? null;
  if (!siteLog) return update;
  return update.getTime() > siteLog.getTime() ? update : siteLog;
}
