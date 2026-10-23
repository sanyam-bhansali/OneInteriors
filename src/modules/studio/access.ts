import 'server-only';
import { opensFullSoftware, planOf } from './software-plan';

/**
 * The studio workspace's permission check against the database: who this
 * member is, whether they are on this project, and so what `roles.ts` says
 * they may do. Every studio-side read and write of a customer's project
 * (`HomeProject` and its tables) goes through here — project-store.ts
 * `staffFor`, tracker-store.ts, and whatever the workspace adds next.
 *
 * ## Why the project's studio is checked here, not left to the caller
 *
 * `can()` knows roles, not tenancy. An owner may do everything — on their
 * own studio's projects. So `accessTo` first proves the project was
 * introduced to the member's studio, and only then asks the table. A caller
 * cannot forget the tenancy half, because there is no way to ask without it.
 *
 * ## Owners
 *
 * Today's studios are one owner each; for them nothing changes: an ACTIVE
 * OWNER may do everything on every project of their studio, with no
 * `StudioProjectMember` rows needed.
 */

import { cache } from 'react';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { getCurrentUser, hasRole } from '@/modules/auth/session';
import { can, isReadAction, needsAssignment, type MemberRole, type StudioAction } from './roles';
import { buildSalesContext, type TreeMember } from './sales-access';
import { isWriteRequest, staffViewFor } from './view-as';

export { can, projectsVisibleTo, type StudioAction } from './roles';

export interface StudioMemberRef extends MemberRole {
  id: string;
  studioId: string;
  userId: string;
}

const MEMBER_SELECT = {
  id: true,
  studioId: true,
  userId: true,
  role: true,
  status: true,
  reportsToId: true,
  salesRole: { select: { id: true, name: true, permissions: true } },
  studio: { select: { fullSoftware: true, softwarePlan: true } },
} as const;

/**
 * The studio's reporting lines (sales roles, owner 22 Oct 2026), read once
 * per request per studio (React `cache`): a studio's team is a handful of
 * rows, and every lead read of a SALES member needs their subtree.
 */
const studioTree = cache(async (studioId: string): Promise<TreeMember[]> =>
  prisma.studioMember.findMany({ where: { studioId }, select: { id: true, reportsToId: true } }),
);

/**
 * The membership of this user, or null when they belong to no studio. `userId` is unique: one person, one studio.
 * Carries the studio's pilot switch (`fullSoftware`), so `can()` and `mayOpen` narrow a studio without the full software (studio/pilot.ts).
 */
export async function memberFor(userId: string): Promise<StudioMemberRef | null> {
  return refFor(await prisma.studioMember.findUnique({ where: { userId }, select: MEMBER_SELECT }));
}

/** The same membership, found by its own id: the member a staff view is looking as (VIEW-AS.md). */
export async function memberById(memberId: string): Promise<StudioMemberRef | null> {
  return refFor(await prisma.studioMember.findUnique({ where: { id: memberId }, select: MEMBER_SELECT }));
}

type MemberRow = Prisma.StudioMemberGetPayload<{ select: typeof MEMBER_SELECT }>;

async function refFor(row: MemberRow | null): Promise<StudioMemberRef | null> {
  if (!row) return null;
  const { studio, salesRole, reportsToId, ...member } = row;
  /* Sales roles (owner, 22 Oct 2026): a SALES member with a sales role is
     governed by it (roles.ts `can`), reaching their subtree of the reporting
     tree. No role keeps the Phase 1 rule. Never read for any other role. A
     failure to read the tree throws, and `currentMember` returns null:
     closed, never wider. */
  const sales =
    member.role === 'SALES' && salesRole
      ? buildSalesContext({ id: member.id, reportsToId: reportsToId ?? null }, salesRole, await studioTree(member.studioId))
      : null;
  const base = sales ? { ...member, sales } : member;
  /* The relation is required; a test double without it narrows nothing. */
  return studio ? { ...base, fullSoftware: opensFullSoftware(planOf(studio)), solo: planOf(studio) === 'SOLO' } : base;
}

/**
 * The signed-in person's membership, when they are signed in with the
 * STUDIO role. Null otherwise, including when the database is not there —
 * same render-path rule as `myStudioId()`: never throws.
 */
export async function currentMember(): Promise<StudioMemberRef | null> {
  const user = await getCurrentUser();
  if (!user || !hasRole(user, 'STUDIO') || !hasDatabase()) return null;
  try {
    /* Developer access (owner, 22 Oct 2026; docs/studio-os/VIEW-AS.md): OPS
       or ADMIN with a live view is that member, `viewOnly`, so `can()` lets
       them read and nothing else. On a write request (a server action, or
       any method but GET/HEAD) they are nobody at all: every write helper
       that starts here finds no member to write as. Not viewing: as before. */
    const view = await viewAsFor(user);
    if (view !== undefined) return view;
    return await memberFor(user.id);
  } catch (error) {
    console.error('[studio] currentMember failed', error);
    return null;
  }
}

/**
 * The member a staff session is viewing as (VIEW-AS.md): `undefined` when
 * this user is not staff or has no live view (so everything is as before);
 * null when viewing but refused (a write request, or the member is gone);
 * else the member, marked `viewOnly`. Also for the studio layout.
 */
export async function viewAsFor(user: { id: string; role: string }): Promise<StudioMemberRef | null | undefined> {
  const view = await staffViewFor(user);
  if (!view) return undefined;
  if (await isWriteRequest()) return null;
  const member = await memberById(view.memberId);
  if (!member || member.studioId !== view.studioId) return null;
  /* Someone invited but not yet signed in is seen as they will be once they
     do (owner, 23 Oct 2026: check each person's screens before the team logs
     in). Read only either way; a suspended member is still seen as suspended. */
  return { ...member, status: member.status === 'INVITED' ? 'ACTIVE' : member.status, viewOnly: true };
}

/** What a member may do on one project; `may` is `can()` with the assignment already looked up. */
export interface ProjectAccess {
  assigned: boolean;
  may: (action: StudioAction) => boolean;
}

/**
 * This member's access to one customer project, or null when the project is
 * not their studio's (or is gone). The assignment is read only for roles that
 * need it, so an owner costs one query.
 */
export async function accessTo(member: StudioMemberRef, homeProjectId: string): Promise<ProjectAccess | null> {
  const project = await prisma.homeProject.findUnique({
    where: { id: homeProjectId },
    select: { introduction: { select: { studioId: true } } },
  });
  if (!project || project.introduction.studioId !== member.studioId) return null;
  const assigned = needsAssignment(member.role)
    ? (await prisma.studioProjectMember.findUnique({
        where: { homeProjectId_memberId: { homeProjectId, memberId: member.id } },
        select: { id: true },
      })) !== null
    : false;
  return { assigned, may: (action) => can(member, action, { assigned }) };
}

export const ACCESS_ERRORS = {
  signIn: 'Sign in as your studio first.',
  notYours: 'That project is not one of yours.',
  notYourRole: 'Your role in the studio does not include that. Ask your studio owner.',
} as const;

export type MemberOnProject =
  | { ok: true; member: StudioMemberRef; access: ProjectAccess }
  | { ok: false; error: (typeof ACCESS_ERRORS)[keyof typeof ACCESS_ERRORS] };

/**
 * The signed-in member, checked against one project — the entry point for a
 * studio-side read or write of a customer's project.
 *
 * With an action, refuses unless they may take it. Without one, refuses
 * unless they may see the project at all (read it, or read its payments).
 * Somebody who may not even see it is told it is not theirs rather than
 * that their role is too small, so the answer gives nothing away.
 */
export async function memberOnProject(homeProjectId: string, action?: StudioAction): Promise<MemberOnProject> {
  const member = await currentMember();
  if (!member) return { ok: false, error: ACCESS_ERRORS.signIn };
  const access = await accessTo(member, homeProjectId);
  if (!access || !(access.may('project.read') || access.may('payment.read'))) return { ok: false, error: ACCESS_ERRORS.notYours };
  if (action && !access.may(action)) return { ok: false, error: ACCESS_ERRORS.notYourRole };
  return { ok: true, member, access };
}

/** Whether the member may take the action — on this project when one is named. */
export async function mayDo(member: StudioMemberRef, action: StudioAction, homeProjectId?: string): Promise<boolean> {
  if (homeProjectId === undefined) return can(member, action);
  const access = await accessTo(member, homeProjectId);
  return access?.may(action) ?? false;
}

/** Thrown by `assertCan`. Server actions catch it and say "not allowed"; render paths use `mayDo` instead. */
export class StudioAccessError extends Error {
  constructor(readonly action: StudioAction) {
    super(`Not allowed: ${action}`);
    this.name = 'StudioAccessError';
  }
}

/**
 * Throws `StudioAccessError` unless the member may take the action. For
 * server actions and route handlers only — like `requireRole`, a throw in a
 * page or layout races the layout's redirect (HANDOVER: "requireRole throws").
 */
export async function assertCan(member: StudioMemberRef | null, action: StudioAction, homeProjectId?: string): Promise<void> {
  /* Developer access: said here too, not only inside `can()`, so a viewing member is refused every write before any lookup. */
  if (member?.viewOnly === true && !isReadAction(action)) throw new StudioAccessError(action);
  if (!member || !(await mayDo(member, action, homeProjectId))) throw new StudioAccessError(action);
}

/**
 * The signed-in member's studio id when they may take a studio-wide action
 * (vendor rates, team), else null. For modules that scope by studio id and
 * now also need the role: `studio-practice/vendors.ts`.
 */
export async function studioIdFor(action: StudioAction): Promise<string | null> {
  const member = await currentMember();
  return member && can(member, action) ? member.studioId : null;
}
