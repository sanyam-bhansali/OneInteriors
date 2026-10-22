/**
 * Settings → Team, the rules (design: StudioTeam.dc.html). Pure
 * (CONTRIBUTING §9.5): what an invite must contain, how each role is
 * explained, and how seats are counted. `team.ts` does the writes; tests/
 * studio-team.test.ts reads both.
 */

import { normalisePhone } from './phone';
import { localityLabel } from '@/modules/brief/types';
import { isValidName, cleanName } from '@/modules/auth/otp-code';
import {
  FREE_SEATS,
  STUDIO_ACTIONS,
  STUDIO_ROLES,
  can,
  isSeat,
  PICKS_SITES,
  type StudioAction,
  type StudioMemberStatusName,
  type StudioRoleName,
} from './roles';

export const ROLE_NAMES: Record<StudioRoleName, string> = {
  OWNER: 'Owner',
  PM: 'Project manager',
  SUPERVISOR: 'Site supervisor',
  ACCOUNTS: 'Accounts',
  SALES: 'Sales',
  DESIGNER: 'Designer',
};

/** The one-line explanation on each role card, in the order the card list shows them. */
export const ROLE_LINES: Record<StudioRoleName, string> = {
  PM: 'Runs the plan, decisions, snags and crews’ work orders for the projects you pick. Sees quantities, never crew rates or payments, and cannot change the team.',
  SUPERVISOR: 'Phone only. Posts the daily update, ticks the checklist and fixes snags on the sites you pick. Nothing else.',
  ACCOUNTS: 'Records payments and receipts across all projects and the booking advance; keeps the crews, their rates, and pays them. Sees nothing else.',
  SALES: 'Works the leads you give them: calls, floor plans, quotations, the sales final. Sees their own leads and the pool, and claims leads from it; never a colleague’s.',
  DESIGNER: 'Runs the design of the projects you make them the designer on: steps, drawings, mood board, site visits. Sees no money.',
  OWNER: 'Everything, including the team, prices and margins.',
};

export const ROLE_ORDER: readonly StudioRoleName[] = ['SALES', 'DESIGNER', 'PM', 'SUPERVISOR', 'ACCOUNTS', 'OWNER'];

const ACTION_LABELS: Record<StudioAction, string> = {
  'team.manage': 'Add and remove people',
  'project.create': 'Start projects',
  'plan.edit': 'Edit the plan',
  'update.post': 'Post site updates',
  'checklist.tick': 'Tick the checklist',
  'decision.create': 'Ask the client to decide',
  'snag.accept': 'Accept snags',
  'snag.fix': 'Fix snags',
  'payment.record': 'Record payments',
  'payment.read': 'See payments',
  'document.upload': 'Upload drawings',
  'vendor.rates': 'Vendor rates and margins',
  'project.read': 'See the project',
  'crew.manage': 'Keep the crew list',
  'calendar.edit': 'Set working days and holidays',
  'lead.read': 'See leads',
  'lead.edit': 'Work leads: calls, notes, floor plans',
  'lead.add': 'Add leads',
  'lead.assign': 'Give leads to people',
  'lead.merge': 'Merge duplicate leads',
  'lead.delete': 'Delete leads',
  'lead.import': 'Import a list of leads',
  'lead.export': 'Download the leads list',
  'lead.pool': 'See leads nobody has',
  'lead.claim': 'Claim a lead from the pool',
  'quote.write': 'Write and send quotations',
  'quote.salesFinal': 'Mark the sales final',
  'booking.record': 'Record the booking advance',
  'booking.refund': 'Refund a booking',
  'payments.template': 'Set the payment stages',
  'design.work': 'Design steps, drawings and site visits',
  'design.assign': 'Pick the designer',
  'design.template': 'Set the design steps',
  'design.workload': "See designers' workload",
  'crew.list': 'See the crews, to pick one',
  'crew.edit': 'Keep crews, their KYC and rate cards',
  'crew.settings': 'Set trades and routing',
  'workorder.read': 'See which crew is on which job',
  'workorder.build': 'Make work orders, enter quantities, mark work done',
  'workorder.money': 'Crew rates, bills and balances',
  'crew.pay': 'Pay crews',
  'design.close': 'Sign off the design',
  'project.closure': 'Project closure (final payment)',
  'extras.write': 'Add extra work and send it to the client',
  'signoff.request': 'Ask the client to sign a quotation',
  'project.bringIn': 'Bring a running project onto One Interiors',
};

/**
 * What the role may do, read off the permission table itself (`can`) so a
 * card can never promise what `roles.ts` refuses. Asked as an active member
 * assigned to the project: the card says "on the sites you pick" for that.
 */
export function roleCan(role: StudioRoleName): string[] {
  return STUDIO_ACTIONS.filter((a) => can({ role, status: 'ACTIVE' }, a, { assigned: true })).map((a) => ACTION_LABELS[a]);
}

/** Roles that see only the sites picked for them, so the invite asks which. */
export const pickSites = (role: StudioRoleName): boolean => PICKS_SITES.includes(role);

export const isStudioRole = (v: unknown): v is StudioRoleName => typeof v === 'string' && (STUDIO_ROLES as readonly string[]).includes(v);

export interface InviteInput {
  name: string;
  phone: string;
  role: StudioRoleName;
  /** HomeProject ids; empty for owner and accounts. */
  sites: string[];
}

export type InviteCheck = { ok: true; invite: InviteInput } | { ok: false; error: string };

/** Clean and check what the "Add someone" panel sent. Ids are checked against the studio by `team.ts`. */
export function checkInvite(raw: { name?: unknown; phone?: unknown; role?: unknown; sites?: unknown }): InviteCheck {
  const name = typeof raw.name === 'string' ? raw.name : '';
  if (!isValidName(name)) return { ok: false, error: 'Add their name.' };
  const phone = normalisePhone(typeof raw.phone === 'string' ? raw.phone : '');
  if (!phone) return { ok: false, error: 'That does not look like an Indian mobile number.' };
  if (!isStudioRole(raw.role)) return { ok: false, error: 'Pick a role.' };
  const sites = Array.isArray(raw.sites) ? [...new Set(raw.sites.filter((s): s is string => typeof s === 'string' && s.length > 0 && s.length < 64))] : [];
  return { ok: true, invite: { name: cleanName(name), phone, role: raw.role, sites: pickSites(raw.role) ? sites.slice(0, 200) : [] } };
}

/** Seats in use: signed in at least once and not suspended (`isSeat`). */
export function seatsUsed(members: { status: StudioMemberStatusName }[]): number {
  return members.filter(isSeat).length;
}

export function seatLine(used: number): string {
  return used <= FREE_SEATS ? `${used} of ${FREE_SEATS} free seats used` : `${used} seats, ${FREE_SEATS} of them free`;
}

export const STATUS_LINES: Record<StudioMemberStatusName, string> = {
  INVITED: 'Invite sent, not signed in yet',
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
};

/** "Now", "Today, 11:02 am", "Yesterday", "3 Oct" — or null when they have never been seen. */
export function lastActive(at: Date | null, now = new Date()): string | null {
  if (!at) return null;
  const mins = (now.getTime() - at.getTime()) / 60_000;
  if (mins < 60) return 'Now';
  const ist = (d: Date) => d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
  if (ist(at) === ist(now)) {
    return `Today, ${at.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }).toLowerCase()}`;
  }
  if (ist(at) === ist(new Date(now.getTime() - 86_400_000))) return 'Yesterday';
  return at.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
}

/** The language a person picked on the studio sign-in, from `User.locale`. */
export function languageName(locale: string | null | undefined): string {
  const l = (locale ?? '').slice(0, 2).toLowerCase();
  return l === 'hi' ? 'हिंदी' : l === 'mr' ? 'मराठी' : 'English';
}

/** A customer project as a site chip: "Skyline Towers · Baner · 3 BHK". Same shape as the tracker's label. */
export function siteLabel(brief: { society: string | null; locality: string | null; propertyType: string | null } | null): string {
  if (!brief) return 'A home';
  const bhk = brief.propertyType ? `${brief.propertyType.replace('BHK_', '').replace('_PLUS', '+')} BHK` : null;
  return [brief.society, localityLabel(brief.locality), bhk].filter(Boolean).join(' · ') || 'A home';
}
