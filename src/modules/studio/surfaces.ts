/**
 * Which part of `/studio` each role works in, and which screens it may open.
 * Pure (CONTRIBUTING §9.5); `app/studio/layout.tsx` and `tenancy.ts` read it,
 * tests/studio-surfaces.test.ts pins it.
 *
 * Three surfaces:
 *
 * - **Office** (`/studio` and everything under it): owners and project
 *   managers. Leads, quotations, the product master, pipeline, settings.
 * - **Site** (`/studio/site`): site supervisors. A phone screen with their
 *   sites and nothing else (STUDIO-WORKSPACE-BUILD §2: "a supervisor lands
 *   there and never sees the office menu").
 * - **Payments** (`/studio/payments`): accounts. Every project's payment
 *   stages, and nothing else (§3).
 *
 * ## Enforced twice, on purpose
 *
 * The layout sends anyone who opens a screen outside their surface to their
 * own (`mayOpen`). But a layout is not re-run on every in-app navigation, so
 * that alone is a sign on the door, not a lock. The lock is in the module
 * layer: `OFFICE_MEMBER` is in the `where` of `myStudioId()` and the other
 * studio lookups the office modules start from, so for a supervisor or an
 * accounts member every one of them finds no studio and returns nothing.
 *
 * A project manager keeps today's office except the two owner-only rows of
 * the permission table: the team (`team.manage`) and vendor rates
 * (`vendor.rates`).
 */

import type { Prisma } from '@prisma/client';
import { can, type MemberRole, type StudioRoleName } from './roles';

/** The roles that work in the office. */
export const OFFICE_ROLES: readonly StudioRoleName[] = ['OWNER', 'PM'];

/**
 * Add to the `where` of any studio-membership lookup an office module starts
 * from: only an ACTIVE owner or project manager is found.
 */
export const OFFICE_MEMBER = {
  status: 'ACTIVE' as const,
  role: { in: [...OFFICE_ROLES] },
} satisfies Prisma.StudioMemberWhereInput;

export function usesOffice(member: MemberRole): boolean {
  return member.status === 'ACTIVE' && OFFICE_ROLES.includes(member.role);
}

export const SITE_HOME = '/studio/site';
export const PAYMENTS_HOME = '/studio/payments';
export const TEAM_PATH = '/studio/settings/team';

/** Where a member lands after signing in, and where the layout sends them back to. */
export function homeFor(role: StudioRoleName): string {
  if (role === 'SUPERVISOR') return SITE_HOME;
  if (role === 'ACCOUNTS') return PAYMENTS_HOME;
  return '/studio';
}

function under(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/**
 * Whether this member may open this `/studio` path. Inactive members may
 * open nothing (the layout tells them why). Unknown paths fall to the
 * office rule, so a new office screen is closed to the other roles by
 * default rather than by remembering to list it.
 */
export function mayOpen(member: MemberRole, path: string): boolean {
  if (member.status !== 'ACTIVE') return false;
  if (member.role === 'SUPERVISOR') return under(path, SITE_HOME);
  if (member.role === 'ACCOUNTS') return under(path, PAYMENTS_HOME);
  if (under(path, TEAM_PATH)) return can(member, 'team.manage');
  if (under(path, '/studio/vendors')) return can(member, 'vendor.rates');
  return usesOffice(member);
}
