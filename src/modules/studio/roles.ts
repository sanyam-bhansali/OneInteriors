/**
 * Who on a studio's team may do what (docs/studio-workspace/STUDIO-WORKSPACE-
 * BUILD.md §3). Pure: the table, as one function, tested cell by cell in
 * tests/studio-roles.test.ts.
 *
 * ## Why one function
 *
 * The brief's rule is "enforce in the module layer on every read and write,
 * not only in the UI". A permission written out at each call site drifts the
 * first time somebody adds a role; a table read through `can()` cannot. The
 * server side (`access.ts`) works out the one fact this file cannot know —
 * whether this member is on this project — and asks here.
 *
 * ## The shape of the table
 *
 * - The owner can do everything, on every project.
 * - A project manager and a site supervisor act only on projects they are
 *   assigned to (`StudioProjectMember`). Unassigned, they cannot even read
 *   one. Creating a project is the exception: it does not exist yet.
 * - Accounts sees and records payments across every project, and nothing else.
 * - Anyone not ACTIVE (invited and not yet signed in, or suspended) can do
 *   nothing. A suspended supervisor whose session is still alive is exactly
 *   the case this has to stop.
 *
 * Two readings of the brief worth knowing:
 * - "PMs and supervisors see only projects assigned to them" says nothing on
 *   payments. A PM reads them on their own projects (they chase the next
 *   payment); a supervisor does not (site mode has no use for the money).
 * - Setting when a payment stage is DUE is part of the schedule, so
 *   `plan.edit` covers it as well as `payment.record`. Marking it RECEIVED is
 *   `payment.record` only.
 */

import type { Prisma } from '@prisma/client';

export type StudioRoleName = 'OWNER' | 'PM' | 'SUPERVISOR' | 'ACCOUNTS';
export type StudioMemberStatusName = 'INVITED' | 'ACTIVE' | 'SUSPENDED';

export const STUDIO_ROLES: readonly StudioRoleName[] = ['OWNER', 'PM', 'SUPERVISOR', 'ACCOUNTS'];

/** One per row of the brief's table, plus reading a project and its payments. */
export type StudioAction =
  /** Invite or remove team, set roles, sign a member out everywhere. */
  | 'team.manage'
  /** Create a project from a signed quote. */
  | 'project.create'
  /** Edit plan dates and stage names; set when a payment is due. */
  | 'plan.edit'
  /** Post today's update, mark nobody on site. */
  | 'update.post'
  /** Tick checklist items (and, until stages come from items, a stage done). */
  | 'checklist.tick'
  /** Create a decision for the customer. */
  | 'decision.create'
  /** Accept a snag, set its fix-by date, assign it; raise one from the studio side. */
  | 'snag.accept'
  /** Mark a snag fixed, with the after photo. */
  | 'snag.fix'
  /** Mark a payment received, attach the receipt. */
  | 'payment.record'
  /** See a project's payment stages and what is paid. */
  | 'payment.read'
  /** Upload, share, supersede or remove drawings and documents. */
  | 'document.upload'
  /** See vendor rates, work orders, vendor payments and margins. */
  | 'vendor.rates'
  /** Read a project at all: its plan, updates, decisions, snags, documents. */
  | 'project.read';

export const STUDIO_ACTIONS: readonly StudioAction[] = [
  'team.manage',
  'project.create',
  'plan.edit',
  'update.post',
  'checklist.tick',
  'decision.create',
  'snag.accept',
  'snag.fix',
  'payment.record',
  'payment.read',
  'document.upload',
  'vendor.rates',
  'project.read',
];

/** What each role may do. The owner is not listed: the owner may do everything. */
const GRANTS: Record<Exclude<StudioRoleName, 'OWNER'>, readonly StudioAction[]> = {
  PM: [
    'project.create',
    'plan.edit',
    'update.post',
    'checklist.tick',
    'decision.create',
    'snag.accept',
    'snag.fix',
    'payment.read',
    'document.upload',
    'project.read',
  ],
  SUPERVISOR: ['update.post', 'checklist.tick', 'snag.fix', 'project.read'],
  ACCOUNTS: ['payment.read', 'payment.record'],
};

/** Actions on one project, which a PM or supervisor may take only when assigned to it. */
const NEEDS_ASSIGNMENT: ReadonlySet<StudioAction> = new Set<StudioAction>([
  'plan.edit',
  'update.post',
  'checklist.tick',
  'decision.create',
  'snag.accept',
  'snag.fix',
  'payment.read',
  'payment.record',
  'document.upload',
  'project.read',
]);

/** Accounts works across every project, so assignment never applies to it. */
const STUDIO_WIDE_ROLES: ReadonlySet<StudioRoleName> = new Set(['OWNER', 'ACCOUNTS']);

export interface MemberRole {
  role: StudioRoleName;
  status: StudioMemberStatusName;
}

/**
 * Whether this member may take this action.
 *
 * `ctx.assigned` is whether they are on the project in question. Leave it
 * out for an action with no project (inviting, creating a project, vendor
 * rates); for a project action a PM or supervisor then gets `false`, which is
 * the safe answer to a question asked without the facts.
 */
export function can(member: MemberRole, action: StudioAction, ctx: { assigned?: boolean } = {}): boolean {
  if (member.status !== 'ACTIVE') return false;
  if (member.role === 'OWNER') return true;
  if (!GRANTS[member.role]?.includes(action)) return false;
  if (STUDIO_WIDE_ROLES.has(member.role) || !NEEDS_ASSIGNMENT.has(action)) return true;
  return ctx.assigned === true;
}

/** Whether this role needs a `StudioProjectMember` row to act on a project. */
export const needsAssignment = (role: StudioRoleName): boolean => !STUDIO_WIDE_ROLES.has(role);

/**
 * The customer projects a member may see, as a `where` for
 * `prisma.homeProject.findMany` — for the office Projects list, site mode's
 * "My sites today", accounts' payments list.
 *
 * `purpose: 'payments'` is the accounts view: every project's money. For
 * anything else accounts sees none. Always scoped to the member's own studio
 * through the introduction, so no role can reach another studio's project.
 */
export function projectsVisibleTo(
  member: MemberRole & { id: string; studioId: string },
  purpose: 'project' | 'payments' = 'project',
): Prisma.HomeProjectWhereInput {
  const action: StudioAction = purpose === 'payments' ? 'payment.read' : 'project.read';
  const studio: Prisma.HomeProjectWhereInput = { introduction: { studioId: member.studioId } };
  if (!can(member, action, { assigned: true })) return { id: { in: [] } };
  if (!needsAssignment(member.role)) return studio;
  return { ...studio, team: { some: { memberId: member.id } } };
}

/** Free seats before a studio pays (Settings → Team). */
export const FREE_SEATS = 5;

/** A seat: signed in at least once (INVITED becomes ACTIVE on first sign-in) and not suspended. */
export const isSeat = (m: { status: StudioMemberStatusName }): boolean => m.status === 'ACTIVE';

/**
 * How long a studio sign-in lasts. Supervisors 90 days: they sign in on a
 * site phone, often a shared one, and being asked for a code on a ladder is
 * how site mode stops being used. Everyone else keeps the usual 30. Computed
 * from the role when the session is made, so nothing is stored.
 */
export const sessionDaysFor = (role: StudioRoleName): number => (role === 'SUPERVISOR' ? 90 : 30);
