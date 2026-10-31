import 'server-only';

/**
 * Snags, read for the studio (Phase 4): the office's Snags tab (a calm inbox)
 * and site mode's *Fix a snag*. Everything is gated in here, not only in the
 * screens: the office tab needs `project.read` on the project, the site
 * screens list only projects the member may see (`projectsVisibleTo`), and
 * each snag says what this member may do with it (`snag.accept`, `snag.fix`).
 *
 * These are studio views: the PM's internal note and who it is assigned to
 * are here on purpose. The customer's view is portal/snag-view.ts.
 */

import { prisma } from '@/lib/prisma';
import { getCurrentUser, hasRole } from '@/modules/auth/session';
import { currentMember, memberOnProject } from '@/modules/studio/access';
import { projectsVisibleTo } from '@/modules/studio/roles';
import { firstName, homeLabel } from '@/modules/studio/workspace-view';
import { signedPhotoMap } from './site-log-storage';
import { istDay } from './working-days';
import { assigneesFor } from './snag-flow';
import { eventsOrLegacy, snagStatus, type SnagEventLike, type SnagState } from './snag-status';

const EVENT_SELECT = {
  id: true,
  kind: true,
  at: true,
  fixBy: true,
  assigneeId: true,
  photoPaths: true,
  customerText: true,
  note: true,
  internalNote: true,
  actorType: true,
} as const;

const SNAG_SELECT = {
  id: true,
  projectId: true,
  title: true,
  room: true,
  note: true,
  status: true,
  createdAt: true,
  raisedByStudio: true,
  photoPaths: true,
  fixBy: true,
  fixedAt: true,
  fixedNote: true,
  fixedPhotoPaths: true,
  assigneeId: true,
  assignee: { select: { user: { select: { name: true } } } },
  events: { orderBy: { at: 'asc' as const }, select: EVENT_SELECT },
} as const;

/** Where a snag sits in the office inbox, in the order the tab shows them. */
export type SnagLane = 'needs-you' | 'being-fixed' | 'waiting-customer' | 'closed';

export const LANE_OF: Record<SnagState, SnagLane> = {
  raised: 'needs-you',
  reopened: 'needs-you',
  accepted: 'being-fixed',
  disputed: 'being-fixed',
  fixed: 'waiting-customer',
  closed: 'closed',
};

export interface StudioSnag {
  id: string;
  projectId: string;
  title: string;
  room: string | null;
  /** The customer's (or the team's) own words when raising. */
  raisedNote: string | null;
  raisedBy: 'customer' | 'studio';
  raisedAt: Date;
  state: SnagState;
  lane: SnagLane;
  fixBy: Date | null;
  /** "YYYY-MM-DD" for a date field, or "". */
  fixByDay: string;
  overdue: boolean;
  assigneeId: string | null;
  assigneeName: string | null;
  /** The latest note to the fixer — only your team. */
  internalNote: string | null;
  disputeReason: string | null;
  notFixedReason: string | null;
  fixSentence: string | null;
  fixedAt: Date | null;
  autoClosesAt: Date | null;
  closedAt: Date | null;
  closedBy: 'customer' | 'auto' | null;
  before: string[];
  after: string[];
  /** Times the customer said "not fixed". */
  reopenCount: number;
}

type Row = {
  id: string;
  projectId: string;
  title: string;
  room: string | null;
  note: string | null;
  status: string;
  createdAt: Date;
  raisedByStudio: boolean;
  photoPaths: string[];
  fixBy: Date | null;
  fixedAt: Date | null;
  fixedNote: string | null;
  fixedPhotoPaths: string[];
  assigneeId: string | null;
  assignee: { user: { name: string | null } } | null;
  events: (SnagEventLike & { internalNote: string | null })[];
};

function toStudioSnag(r: Row, links: Map<string, string>, now: Date): StudioSnag {
  const events = eventsOrLegacy(r.events, r) as (SnagEventLike & { internalNote?: string | null })[];
  const s = snagStatus(events, now);
  const lastAccept = [...events].reverse().find((e) => e.kind === 'ACCEPTED');
  const raised = events.find((e) => e.kind === 'RAISED');
  const before = (raised?.photoPaths?.length ? raised.photoPaths : r.photoPaths).map((p) => links.get(p)).filter((u): u is string => Boolean(u));
  const after = (s.fix?.photoPaths ?? []).map((p) => links.get(p)).filter((u): u is string => Boolean(u));
  const today = istDay(now);
  const fixByDay = s.fixBy ? s.fixBy.toISOString().slice(0, 10) : '';
  return {
    id: r.id,
    projectId: r.projectId,
    title: r.title,
    room: r.room,
    raisedNote: r.note,
    raisedBy: r.raisedByStudio ? 'studio' : 'customer',
    raisedAt: r.createdAt,
    state: s.state,
    lane: LANE_OF[s.state],
    fixBy: s.fixBy,
    fixByDay,
    overdue: Boolean(fixByDay) && (s.state === 'accepted' || s.state === 'reopened') && fixByDay < today,
    assigneeId: s.assigneeId ?? r.assigneeId,
    assigneeName: r.assignee?.user.name ?? null,
    internalNote: lastAccept?.internalNote ?? null,
    disputeReason: s.disputeReason,
    notFixedReason: s.notFixedReason,
    fixSentence: s.fix?.customerText ?? null,
    fixedAt: s.fixedAt,
    autoClosesAt: s.autoClosesAt,
    closedAt: s.closedAt,
    closedBy: s.closedBy,
    before,
    after,
    reopenCount: s.reopenCount,
  };
}

function allPaths(rows: Row[]): string[] {
  return rows.flatMap((r) => [...r.photoPaths, ...r.fixedPhotoPaths, ...r.events.flatMap((e) => e.photoPaths ?? [])]);
}

const LANE_ORDER: SnagLane[] = ['needs-you', 'being-fixed', 'waiting-customer', 'closed'];

/** Inbox order: lane, then the most pressing first (overdue, earliest fix-by, oldest raised); closed newest first. */
export function inboxOrder(a: StudioSnag, b: StudioSnag): number {
  const lane = LANE_ORDER.indexOf(a.lane) - LANE_ORDER.indexOf(b.lane);
  if (lane !== 0) return lane;
  if (a.lane === 'closed') return (b.closedAt?.getTime() ?? 0) - (a.closedAt?.getTime() ?? 0);
  if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
  const fa = a.fixBy?.getTime() ?? Infinity;
  const fb = b.fixBy?.getTime() ?? Infinity;
  if (fa !== fb) return fa - fb;
  return a.raisedAt.getTime() - b.raisedAt.getTime();
}

export interface OfficeSnags {
  projectId: string;
  customerFirst: string;
  canAccept: boolean;
  canFix: boolean;
  assignees: { id: string; name: string; role: string }[];
  snags: StudioSnag[];
}

/** The office Snags tab. Null when the signed-in person may not see this project. */
export async function officeSnags(projectId: string, now = new Date()): Promise<OfficeSnags | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  let canAccept = true;
  let canFix = true;
  if (!hasRole(user, 'OPS')) {
    const check = await memberOnProject(projectId, 'project.read');
    if (!check.ok) return null;
    canAccept = check.access.may('snag.accept');
    canFix = check.access.may('snag.fix');
  }
  const project = await prisma.homeProject.findUnique({
    where: { id: projectId },
    select: {
      introduction: { select: { studioId: true, brief: { select: { user: { select: { name: true } } } } } },
      snags: { orderBy: { createdAt: 'desc' }, take: 200, select: SNAG_SELECT },
    },
  });
  if (!project) return null;
  const rows = project.snags as unknown as Row[];
  const [links, assignees] = await Promise.all([signedPhotoMap(allPaths(rows)), canAccept ? assigneesFor(projectId, project.introduction.studioId) : Promise.resolve([])]);
  return {
    projectId,
    customerFirst: firstName(project.introduction.brief.user?.name),
    canAccept,
    canFix,
    assignees,
    snags: rows.map((r) => toStudioSnag(r, links, now)).sort(inboxOrder),
  };
}

export interface SiteSnag extends StudioSnag {
  home: string;
  customerFirst: string;
  mine: boolean;
  canFix: boolean;
}

const PROJECT_FOR_SITE = {
  id: true,
  introduction: { select: { brief: { select: { society: true, locality: true, propertyType: true, user: { select: { name: true } } } } } },
} as const;

/**
 * Site mode's snag list: the open snags on the sites this member may see that
 * are waiting for a fix (new, accepted or reopened) — theirs first. Fixes
 * waiting for the customer and closed snags are not the site's to do.
 */
export async function siteSnagList(now = new Date()): Promise<SiteSnag[]> {
  const member = await currentMember();
  if (!member) return [];
  const projects = await prisma.homeProject.findMany({
    where: { AND: [projectsVisibleTo(member), { cancelledAt: null, snags: { some: { status: 'OPEN' } } }] },
    select: { ...PROJECT_FOR_SITE, snags: { where: { status: 'OPEN' }, take: 100, select: SNAG_SELECT } },
    take: 50,
  });
  const rows = projects.flatMap((p) => p.snags as unknown as Row[]);
  const links = await signedPhotoMap(rows.flatMap((r) => r.photoPaths));
  const out: SiteSnag[] = [];
  for (const p of projects) {
    const brief = p.introduction.brief;
    for (const r of p.snags as unknown as Row[]) {
      const s = toStudioSnag(r, links, now);
      if (!['raised', 'accepted', 'reopened'].includes(s.state)) continue;
      out.push({ ...s, home: homeLabel(brief), customerFirst: firstName(brief.user?.name), mine: s.assigneeId === member.id, canFix: true });
    }
  }
  return out.sort((a, b) => (a.mine !== b.mine ? (a.mine ? -1 : 1) : inboxOrder(a, b)));
}

/** One snag for *Fix a snag*. Null when this member may not see its project. */
export async function siteSnag(snagId: string, now = new Date()): Promise<SiteSnag | null> {
  const row = await prisma.homeSnag.findUnique({ where: { id: snagId.slice(0, 64) }, select: { ...SNAG_SELECT, project: { select: PROJECT_FOR_SITE } } });
  if (!row) return null;
  const check = await memberOnProject(row.projectId, 'project.read');
  if (!check.ok) return null;
  const r = row as unknown as Row & { project: { introduction: { brief: { society: string | null; locality: string | null; propertyType: string | null; user: { name: string | null } | null } } } };
  const links = await signedPhotoMap(allPaths([r]));
  const s = toStudioSnag(r, links, now);
  const brief = r.project.introduction.brief;
  return { ...s, home: homeLabel(brief), customerFirst: firstName(brief.user?.name), mine: s.assigneeId === check.member.id, canFix: check.access.may('snag.fix') };
}
