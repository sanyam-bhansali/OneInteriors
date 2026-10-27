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
 *
 * ## Sales roles and teams (owner, 22 Oct 2026)
 *
 * docs/studio-os/SALES-ROLES.md. A salesperson whose sales role grants it
 * also opens: Import (`lead.import`), the Bin (`lead.delete`), lead
 * Analytics and Calling (`lead.analytics`), Settings → Pipeline, Fields and
 * Lead sources (`lead.settings`), and Settings → Team (`team.sales`, the
 * sales side only). Each of those screens' modules checks the same right
 * again. Terms and appointments stay the owner's and PM's.
 */

import type { Prisma } from '@prisma/client';
import { asSeenBy, can, FULL_SOFTWARE_ROLES, type MemberRole, type StudioRoleName } from './roles';

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
/** Every role's home (the app launcher, UI handoff 12 Oct 2026), except the supervisor's, which is site mode. */
export const STUDIO_HOME = '/studio/home';
export const TODAY_HOME = '/studio/today';
export const PAYMENTS_HOME = '/studio/payments';
export const TEAM_PATH = '/studio/settings/team';
/** The unassigned leads (closed on Pro Solo). */
export const POOL_PATH = '/studio/clients/pool';
export const PAYMENT_STAGES_PATH = '/studio/settings/payments';
/** Studio OS Phase 2: a designer's home, and the owner's and PM's designers' workload. */
export const DESIGN_HOME = '/studio/design';
export const DESIGN_STEPS_PATH = '/studio/settings/design';
/** Project documents (24 Oct 2026; DESIGN-PROCESS-PLAN.md §3.4): a folder per project. Owner, PM, designer. */
export const DOCUMENTS_HOME = '/studio/documents';
/** Studio OS Phase 3: the crews (owner, accounts), the owner's labour page, and Settings → Crews and trades (owner). */
export const CREWS_HOME = '/studio/vendors';
export const LABOUR_PATH = '/studio/vendors/labour';
export const CREW_SETTINGS_PATH = '/studio/settings/trades';
/** Settings → Crew: the faces site mode taps (`crew.manage`). */
export const SITE_CREW_PATH = '/studio/settings/crew';
/** "Add an existing project" (docs/studio-os/BRING-IN-PROJECTS.md): owner, PM and designer, Max only (under /studio/projects). */
export const BRING_IN_PATH = '/studio/projects/bring-in';
/** The owner's "Set up your studio" quiz (studio/setup-quiz.ts). Owner only. */
export const SETUP_PATH = '/studio/setup';

/**
 * The screens only a studio with the full software opens (owner, 14 Oct
 * 2026; studio/pilot.ts says which "coming soon" each one shows). Everything
 * else (leads, quotations, the product master, the remaining settings,
 * Today, Calendar, the overview and setup) stays open to every studio.
 */
export const FULL_SOFTWARE_PATHS: readonly string[] = [
  '/studio/projects',
  '/studio/updates',
  DESIGN_HOME,
  DESIGN_STEPS_PATH,
  DOCUMENTS_HOME,
  SITE_HOME,
  SITE_CREW_PATH,
  PAYMENTS_HOME,
  CREWS_HOME,
  CREW_SETTINGS_PATH,
  '/studio/listing',
];

/** Whether a role only makes sense with the full software (designer, PM, supervisor, accounts). */
export function needsFullSoftware(role: StudioRoleName): boolean {
  return FULL_SOFTWARE_ROLES.includes(role);
}

/** Whether a path is one of the full software's screens. */
export function isFullSoftwarePath(path: string): boolean {
  return FULL_SOFTWARE_PATHS.some((p) => under(path, p));
}

/**
 * Where a member lands after signing in, and where the layout sends them back
 * to. In a studio without the full software everyone's is the home (site mode
 * is closed there, so a supervisor's home says the software is not on yet).
 */
export function homeFor(role: StudioRoleName, fullSoftware?: boolean): string {
  if (fullSoftware === false) return STUDIO_HOME;
  if (role === 'SUPERVISOR') return SITE_HOME;
  return STUDIO_HOME;
}

/**
 * A designer (Phase 2) opens their design page and one project's workspace
 * (`/studio/projects/<id>`, its tabs and nothing under it). Not the projects
 * list, not starting a project, not a new decision: the module layer
 * (`memberOnProject`) still decides which project, by the team row the
 * designer pick writes.
 */
function designerMayOpen(path: string): boolean {
  if (under(path, DESIGN_HOME) || under(path, DOCUMENTS_HOME) || path === BRING_IN_PATH) return true;
  /* A Design Final quotation, its comparison and print (the design meeting, 24 Oct 2026): which quotation is checked on the page (quotes.ts `designerQuoteScope`). */
  const q = path.match(/^\/studio\/quotations\/([A-Za-z0-9_-]+)(?:\/(?:compare|print))?\/?$/);
  if (q && !['first', 'builder', 'requests', 'terms', 'new', 'import'].includes(q[1]!)) return true;
  /* A project page, and its documents (all versions, the handover pack); which project is checked on the page. */
  const m = path.match(/^\/studio\/projects\/([^/?#]+)(?:\/documents(?:\/handover)?)?\/?$/);
  return Boolean(m && m[1] !== 'start');
}

/**
 * The calendar every role opens (owner, 27 Oct 2026: office meetings): their
 * calendar and their meetings. One Interiors visits stay the owner's and PM's.
 */
export const CALENDAR_HOME = '/studio/calendar';
const APPOINTMENTS_PATH = '/studio/calendar/appointments';
function calendarForAll(path: string): boolean {
  return under(path, CALENDAR_HOME) && !under(path, APPOINTMENTS_PATH);
}

/** Who gets the office frame (the rail and search): the office roles, and sales. */
export function usesOfficeShell(member: MemberRole): boolean {
  return usesOffice(member) || (member.status === 'ACTIVE' && member.role === 'SALES');
}

/** What a salesperson may open: Today, the board and a lead, quotations; the dashboard and calendar (leads at scale); the pool, to claim from (owner, 12 Oct 2026). */
const SALES_OPEN = [TODAY_HOME, '/studio/clients', '/studio/quotations', '/studio/dashboard', '/studio/calendar'];
/** Inside the leads section, the owner's and PM's screens. */
const SALES_CLOSED = [
  '/studio/clients/import',
  '/studio/clients/bin',
  '/studio/clients/analytics',
  '/studio/calendar/appointments',
  /* The studio's terms (Quotations → Terms): only the owner and a project manager change them (13 Oct 2026). */
  '/studio/quotations/terms',
];

function under(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/** The lead settings a sales role with "Change lead settings" opens (`lead.settings`). */
export const LEAD_SETTINGS_PATHS: readonly string[] = ['/studio/settings/pipeline', '/studio/settings/fields', '/studio/settings/sources'];

/**
 * The extra screens a salesperson's sales role may open (owner, 22 Oct
 * 2026), and which right opens each. A Phase 1 salesperson has none of
 * these rights, so for them nothing changes.
 */
const SALES_ROLE_SCREENS: readonly { path: string; action: Parameters<typeof can>[1] }[] = [
  { path: '/studio/clients/import', action: 'lead.import' },
  { path: '/studio/clients/bin', action: 'lead.delete' },
  { path: '/studio/clients/analytics', action: 'lead.analytics' },
  { path: TEAM_PATH, action: 'team.sales' },
  ...LEAD_SETTINGS_PATHS.map((path) => ({ path, action: 'lead.settings' as const })),
];

function salesMayOpen(member: MemberRole, path: string): boolean {
  const screen = SALES_ROLE_SCREENS.find((s) => under(path, s.path));
  if (screen) return can(member, screen.action);
  return SALES_OPEN.some((p) => under(path, p)) && !SALES_CLOSED.some((p) => under(path, p));
}

/**
 * Whether this member may open this `/studio` path. Inactive members may
 * open nothing (the layout tells them why). Unknown paths fall to the
 * office rule, so a new office screen is closed to the other roles by
 * default rather than by remembering to list it.
 */
export function mayOpen(viewer: MemberRole, path: string): boolean {
  /* Opening a screen is a read: staff viewing as this member (VIEW-AS.md) open exactly what they open. Writes on it still ask `can()`. */
  const member = asSeenBy(viewer);
  if (member.status !== 'ACTIVE') return false;
  /* Pro Solo (owner, 21 Oct 2026): one person, so no team to manage and no pool to hand leads out from. */
  if (member.solo === true && (under(path, TEAM_PATH) || under(path, POOL_PATH))) return false;
  /* The pilot switch (owner, 14 Oct 2026): a studio without the full
     software opens only the home to the roles that need it, and none of its
     screens to anyone. Explicitly false only: undefined is "not known here". */
  if (member.fullSoftware === false) {
    if (needsFullSoftware(member.role)) return path === STUDIO_HOME;
    if (isFullSoftwarePath(path)) return false;
  }
  /* The setup quiz sets the studio's settings up: the owner's alone. */
  if (under(path, SETUP_PATH)) return member.role === 'OWNER';
  if (member.role === 'SUPERVISOR') return under(path, SITE_HOME) || calendarForAll(path);
  /* Every other role's home: the launcher, which shows only the apps below. */
  if (path === STUDIO_HOME) return true;
  /* Phase 3: accounts keeps the crews and pays them; labour against the contract is the owner's. */
  if (member.role === 'ACCOUNTS') return under(path, PAYMENTS_HOME) || (under(path, CREWS_HOME) && !under(path, LABOUR_PATH)) || calendarForAll(path);
  if (member.role === 'SALES') return salesMayOpen(member, path);
  if (member.role === 'DESIGNER') return designerMayOpen(path) || calendarForAll(path);
  if (under(path, TEAM_PATH)) return can(member, 'team.manage');
  if (under(path, PAYMENT_STAGES_PATH)) return can(member, 'payments.template');
  if (under(path, DESIGN_STEPS_PATH)) return can(member, 'design.template');
  if (under(path, CREW_SETTINGS_PATH)) return can(member, 'crew.settings');
  if (under(path, '/studio/vendors')) return can(member, 'vendor.rates');
  return usesOffice(member);
}
