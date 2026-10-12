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
 *
 * ## Sales (Studio OS Phase 1)
 *
 * A salesperson works in the office frame (the rail, search) but opens only
 * Today, the leads board and a lead, and quotations. They are NOT in
 * `OFFICE_ROLES`: every older office module keeps finding no studio for
 * them, and the screens they do open read through `studio/lead-scope.ts`,
 * which narrows every query to the leads assigned to them.
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
export const TODAY_HOME = '/studio/today';
export const PAYMENTS_HOME = '/studio/payments';
export const TEAM_PATH = '/studio/settings/team';
export const PAYMENT_STAGES_PATH = '/studio/settings/payments';
/** Studio OS Phase 2: a designer's home, and the owner's and PM's designers' workload. */
export const DESIGN_HOME = '/studio/design';
export const DESIGN_STEPS_PATH = '/studio/settings/design';

/** Where a member lands after signing in, and where the layout sends them back to. */
export function homeFor(role: StudioRoleName): string {
  if (role === 'SUPERVISOR') return SITE_HOME;
  if (role === 'ACCOUNTS') return PAYMENTS_HOME;
  if (role === 'DESIGNER') return DESIGN_HOME;
  return TODAY_HOME;
}

/**
 * A designer (Phase 2) opens their design page and one project's workspace
 * (`/studio/projects/<id>`, its tabs and nothing under it). Not the projects
 * list, not starting a project, not a new decision: the module layer
 * (`memberOnProject`) still decides which project, by the team row the
 * designer pick writes.
 */
function designerMayOpen(path: string): boolean {
  if (under(path, DESIGN_HOME)) return true;
  const m = path.match(/^\/studio\/projects\/([^/?#]+)\/?$/);
  return Boolean(m && m[1] !== 'start');
}

/** Who gets the office frame (the rail and search): the office roles, and sales. */
export function usesOfficeShell(member: MemberRole): boolean {
  return usesOffice(member) || (member.status === 'ACTIVE' && member.role === 'SALES');
}

/** What a salesperson may open: Today, the board and a lead, quotations; the dashboard and calendar (leads at scale); the pool, to claim from (owner, 12 Oct 2026). */
const SALES_OPEN = [TODAY_HOME, '/studio/clients', '/studio/quotations', '/studio/dashboard', '/studio/calendar'];
/** Inside the leads section, the owner's and PM's screens. */
const SALES_CLOSED = ['/studio/clients/import', '/studio/clients/bin', '/studio/clients/analytics', '/studio/calendar/appointments'];

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
  if (member.role === 'SALES') return SALES_OPEN.some((p) => under(path, p)) && !SALES_CLOSED.some((p) => under(path, p));
  if (member.role === 'DESIGNER') return designerMayOpen(path);
  if (under(path, TEAM_PATH)) return can(member, 'team.manage');
  if (under(path, PAYMENT_STAGES_PATH)) return can(member, 'payments.template');
  if (under(path, DESIGN_STEPS_PATH)) return can(member, 'design.template');
  if (under(path, '/studio/vendors')) return can(member, 'vendor.rates');
  return usesOffice(member);
}
