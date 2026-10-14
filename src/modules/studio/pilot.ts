/**
 * The per-studio pilot switch (owner, 14 Oct 2026).
 *
 * The full Studio OS (projects, design, site mode, the payments desk, crews,
 * the team) goes live only for pilot studios, Hauspire first. Every other
 * studio gets Leads (board, list, pool, a lead, import, numbers, bin,
 * analytics), Quotations (every tab), the product master, the settings those
 * need, Today and Calendar. `Studio.fullSoftware`, switched by ops on the
 * studio's page (audited).
 *
 * ## Where it is enforced
 *
 * - **The door**: `surfaces.ts mayOpen` reads `member.fullSoftware` (set by
 *   `access.ts memberFor`), so the apps menu, the home tiles and the studio
 *   layout all agree; a closed path typed by hand shows "coming soon" for an
 *   owner or a salesperson (`doorFor` below) and sends the full-software
 *   roles home, where they are told the software is not on yet.
 * - **The lock**: `roles.ts can()` refuses every full-software action and
 *   every action of a full-software role in such a studio, and
 *   `tenancy.ts myStudioId` finds no studio for a project manager there. The
 *   gated screens' own layouts (`app/studio/PilotGate.tsx`) check again on
 *   every navigation into them.
 *
 * Pure (CONTRIBUTING §9.5); tests/studio-pilot.test.ts pins it both ways.
 */

import type { MemberRole } from './roles';
import {
  CREWS_HOME,
  CREW_SETTINGS_PATH,
  DESIGN_HOME,
  DESIGN_STEPS_PATH,
  PAYMENTS_HOME,
  SITE_CREW_PATH,
  SITE_HOME,
  TEAM_PATH,
  homeFor,
  isFullSoftwarePath,
  mayOpen,
  needsFullSoftware,
} from './surfaces';

/** The closed areas, each with its own "coming soon". */
export type PilotArea = 'projects' | 'design' | 'site' | 'money' | 'vendors' | 'team' | 'listing';

/** What each closed area says for itself (the COMING_SOON shape, features.ts). */
export const PILOT_SOON: Record<PilotArea, { title: string; what: string; meanwhile: string | null }> = {
  projects: {
    title: 'Projects',
    what: 'Every job you have won: its plan, the daily site log, decisions, snags and the client’s view of it.',
    meanwhile: 'A booked client stays on your board with the figure you agreed. Nothing is lost by waiting.',
  },
  design: {
    title: 'Design',
    what: 'Your designers’ projects, their design steps, drawings, mood boards and site visits.',
    meanwhile: null,
  },
  site: {
    title: 'Site mode',
    what: 'The supervisor’s phone screen: the daily update, the checklist and snags for every running site.',
    meanwhile: null,
  },
  money: {
    title: 'Payments desk',
    what: 'Every project’s payment stages, what is due, and receipts recorded by your accounts team.',
    meanwhile: 'Booking advances on your quotations are recorded as before.',
  },
  vendors: {
    title: 'Crews',
    what: 'Your site crews, their work orders, what each is owed and what you have paid them.',
    meanwhile: null,
  },
  team: {
    title: 'Team',
    what: 'Invite your salespeople, designers, project managers, supervisors and accounts, each with their own app.',
    meanwhile: 'Tell us who should have access and we will set them up for you.',
  },
  listing: {
    title: 'Your listing',
    what: 'Your public profile, your portfolio and the rate card customers are matched against.',
    meanwhile: 'Your listing is live and unchanged. Tell us what you want edited and we will do it.',
  },
};

const AREA_PATHS: readonly [string, PilotArea][] = [
  ['/studio/projects', 'projects'],
  ['/studio/updates', 'projects'],
  [DESIGN_HOME, 'design'],
  [DESIGN_STEPS_PATH, 'design'],
  [SITE_HOME, 'site'],
  [SITE_CREW_PATH, 'site'],
  [PAYMENTS_HOME, 'money'],
  [CREWS_HOME, 'vendors'],
  [CREW_SETTINGS_PATH, 'vendors'],
  [TEAM_PATH, 'team'],
  ['/studio/listing', 'listing'],
];

/** The closed area a path belongs to, or null for a screen every studio opens. */
export function pilotAreaFor(path: string): PilotArea | null {
  if (!isFullSoftwarePath(path)) return null;
  for (const [p, area] of AREA_PATHS) if (path === p || path.startsWith(`${p}/`)) return area;
  return null;
}

/**
 * What the studio's door does with this member on this path:
 * - `open`: render the screen;
 * - `soon`: closed only because the studio is not on the full software, and
 *   this member's role works without it (owner, sales) — render the area's
 *   "coming soon" in the studio frame;
 * - `home`: send them to `homeFor` (any other refusal, and the full-software
 *   roles in a studio without it).
 */
export function doorFor(member: MemberRole, path: string): { kind: 'open' } | { kind: 'soon'; area: PilotArea } | { kind: 'home'; to: string } {
  if (mayOpen(member, path)) return { kind: 'open' };
  const area = member.fullSoftware === false && !needsFullSoftware(member.role) ? pilotAreaFor(path) : null;
  if (area && mayOpen({ ...member, fullSoftware: true }, path)) return { kind: 'soon', area };
  return { kind: 'home', to: homeFor(member.role, member.fullSoftware) };
}

/** Whether this member's studio runs without the full software and their role needs it (their home says so). */
export function waitingForFullSoftware(member: MemberRole): boolean {
  return member.status === 'ACTIVE' && member.fullSoftware === false && needsFullSoftware(member.role);
}
