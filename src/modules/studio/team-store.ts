import 'server-only';

/**
 * Settings → Team (PHASE-1-PLAN §3): who is on the studio's team, which
 * sites each of them sees, and the owner's controls — invite, resend,
 * suspend, reinstate, sign out of every device, change sites.
 *
 * Every function here starts by checking `team.manage` through
 * `assertCan`, in this module, so a server action cannot forget it and a
 * project manager who calls one directly is refused. Today `team.manage` is
 * the owner's alone (roles.ts).
 *
 * ## One person, one account, one studio
 *
 * An invite finds or creates the `User` by phone. It never turns an existing
 * customer's account into a studio member: that would put a homeowner's
 * briefs, quotes and project on the same login as a studio's office, and the
 * customer would find themselves signed in to a studio. So a number that
 * already has a customer account is refused, with the reason. So is a number
 * already on another studio's team (`StudioMember.userId` is unique).
 *
 * ## The sales team (owner, 22 Oct 2026)
 *
 * docs/studio-os/SALES-ROLES.md. A salesperson whose sales role has "Manage
 * the sales team" (`team.sales`) opens this screen too, sees the salespeople
 * only, invites salespeople (with a sales role and a reporting line) and
 * resends their invites. Suspending, signing out and sites stay the owner's.
 * Roles and reporting lines are written by sales-team-store.ts.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { revokeAllSessions } from '@/modules/auth/session';
import { send } from '@/modules/messaging/sender';
import { bucketFor, consume } from '@/modules/rate-limit/store';
import { STUDIO_SIGN_IN } from '@/lib/host';
import { FULL_SOFTWARE_ROLES } from './roles';
import { assertCan, currentMember, StudioAccessError, type StudioMemberRef } from './access';
import { rolesOf, salesTeamLead, type SalesRoleRow } from './sales-team-store';
import { FREE_SEATS, type StudioMemberStatusName, type StudioRoleName } from './roles';
import {
  checkInvite,
  isStudioRole,
  lastActive,
  languageName,
  pickSites,
  seatsUsed,
  siteLabel,
} from './team-rules';

export type TeamResult = { ok: true; message: string } | { ok: false; error: string };

const NOT_ALLOWED = 'Only the studio owner can change the team.';
const PRO_ROLES = 'On Pro you can add salespeople. Designers, project managers, supervisors and accounts come with the Max plan.';
const SOLO_SEAT = 'Pro Solo is for one person. Ask One Interiors to move your studio to Pro to add your team.';

/** The signed-in member when they may manage the team; null otherwise. */
async function teamLead(): Promise<StudioMemberRef | null> {
  const member = await currentMember();
  try {
    await assertCan(member, 'team.manage');
    return member;
  } catch (error) {
    if (error instanceof StudioAccessError) return null;
    throw error;
  }
}

/**
 * Who may open the screen: the owner (everything: `full`), or a salesperson
 * whose role manages the sales team (the salespeople only).
 */
async function teamAccess(): Promise<{ lead: StudioMemberRef; full: boolean } | null> {
  const full = await teamLead();
  if (full) return { lead: full, full: true };
  const sales = await salesTeamLead();
  return sales ? { lead: sales, full: false } : null;
}

// ── Reading ────────────────────────────────────────────────────

export interface TeamPerson {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: StudioRoleName;
  status: StudioMemberStatusName;
  /** Site labels; "Everything" / "Payments on all projects" are the page's words. */
  sites: { id: string; label: string }[];
  lastActive: string | null;
  language: string;
  isYou: boolean;
  /** Sales roles (owner, 22 Oct 2026): a salesperson's sales role, and who they report to (null: the owner). */
  salesRoleId: string | null;
  salesRoleName: string | null;
  reportsToId: string | null;
}

export interface TeamView {
  people: TeamPerson[];
  /** The owner's whole screen; false for someone who manages the sales team only (salespeople, invites). */
  full: boolean;
  /** The studio's sales roles, for the Roles tab and every role picker. */
  roles: SalesRoleRow[];
  /** The studio's customer projects, for the site chips. */
  sites: { id: string; label: string }[];
  seatsUsed: number;
  freeSeats: number;
}

const SITE_SELECT = {
  id: true,
  introduction: { select: { brief: { select: { society: true, locality: true, propertyType: true } } } },
} as const;

/** The Team page, or null when the signed-in person may not manage the team. */
export async function teamView(now = new Date()): Promise<TeamView | null> {
  const access = await teamAccess();
  if (!access) return null;
  const { lead, full } = access;

  const [all, projects, roles] = await Promise.all([
    prisma.studioMember.findMany({
      where: { studioId: lead.studioId },
      orderBy: [{ createdAt: 'asc' }],
      select: {
        id: true,
        role: true,
        status: true,
        lastSeenAt: true,
        salesRoleId: true,
        reportsToId: true,
        salesRole: { select: { name: true } },
        user: { select: { name: true, phone: true, email: true, locale: true } },
        projects: { select: { homeProjectId: true } },
      },
    }),
    full
      ? prisma.homeProject.findMany({
          where: { introduction: { studioId: lead.studioId } },
          orderBy: { startOn: 'desc' },
          select: SITE_SELECT,
        })
      : Promise.resolve([]),
    rolesOf(lead.studioId),
  ]);
  /* Someone managing the sales team sees the salespeople, and themselves. */
  const members = full ? all : all.filter((m) => m.role === 'SALES' || m.id === lead.id);

  const sites = projects.map((p) => ({ id: p.id, label: siteLabel(p.introduction.brief) }));
  const labels = new Map(sites.map((s) => [s.id, s.label]));
  const order: Record<StudioRoleName, number> = { OWNER: 0, PM: 1, SALES: 2, DESIGNER: 3, SUPERVISOR: 4, ACCOUNTS: 5 };

  const people = members
    .map((m) => ({
      id: m.id,
      name: m.user.name || m.user.email || m.user.phone || 'Someone',
      phone: m.user.phone,
      email: m.user.email,
      role: m.role,
      status: m.status,
      sites: m.projects.map((p) => ({ id: p.homeProjectId, label: labels.get(p.homeProjectId) ?? 'A home' })),
      lastActive: lastActive(m.lastSeenAt, now),
      language: languageName(m.user.locale),
      isYou: m.id === lead.id,
      salesRoleId: m.role === 'SALES' ? m.salesRoleId : null,
      salesRoleName: m.role === 'SALES' ? (m.salesRole?.name ?? null) : null,
      reportsToId: m.role === 'SALES' ? m.reportsToId : null,
    }))
    .sort((a, b) => order[a.role] - order[b.role]);

  return { people, full, roles, sites, seatsUsed: seatsUsed(all), freeSeats: FREE_SEATS };
}

// ── Writing ────────────────────────────────────────────────────

/** A member of the lead's own studio, or null — an id from a form proves nothing. */
async function teammate(lead: StudioMemberRef, memberId: string) {
  return prisma.studioMember.findFirst({
    where: { id: memberId, studioId: lead.studioId },
    select: { id: true, userId: true, role: true, status: true, lastSeenAt: true, user: { select: { name: true, phone: true } } },
  });
}

/** The ids that are this studio's customer projects; refuses the lot if any is not. */
async function ownSites(studioId: string, ids: string[]): Promise<string[] | null> {
  if (ids.length === 0) return [];
  const found = await prisma.homeProject.findMany({
    where: { id: { in: ids }, introduction: { studioId } },
    select: { id: true },
  });
  return found.length === ids.length ? found.map((f) => f.id) : null;
}

function signInLink(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${STUDIO_SIGN_IN}`;
}

async function sendInvite(lead: StudioMemberRef, to: string, name: string, baseUrl: string) {
  const studio = await prisma.studio.findUnique({ where: { id: lead.studioId }, select: { tradeName: true } });
  return send(to, { kind: 'invite', name: name.split(' ')[0] || name, studioName: studio?.tradeName ?? 'Your studio', link: signInLink(baseUrl) });
}

function sentLine(delivered: boolean, via: string): string {
  return delivered
    ? `Invite sent on ${via === 'sms' ? 'SMS' : 'WhatsApp'}.`
    : 'Added, but the invite message could not be sent yet. Tell them to sign in at /studio/sign-in with this number.';
}

/**
 * Add someone. Creates the `User` (role STUDIO) when the number is new, the
 * `StudioMember` as INVITED, and their site rows; then sends the invite.
 * The seat is used only once they sign in.
 */
export async function inviteMember(
  raw: { name?: unknown; phone?: unknown; role?: unknown; sites?: unknown; salesRoleId?: unknown; reportsToId?: unknown },
  baseUrl: string,
): Promise<TeamResult> {
  const access = await teamAccess();
  if (!access) return { ok: false, error: NOT_ALLOWED };
  const { lead } = access;
  if (lead.solo === true) return { ok: false, error: SOLO_SEAT };

  const check = checkInvite(raw);
  if (!check.ok) return check;
  const { name, phone, role, sites } = check.invite;
  if (lead.fullSoftware === false && FULL_SOFTWARE_ROLES.includes(role)) return { ok: false, error: PRO_ROLES };
  /* Sales roles (owner, 22 Oct 2026): managing the sales team adds salespeople only. */
  if (!access.full && role !== 'SALES') return { ok: false, error: 'You can add salespeople. Ask the studio owner to add anyone else.' };

  const siteIds = await ownSites(lead.studioId, sites);
  if (!siteIds) return { ok: false, error: 'One of those sites is not your studio’s.' };

  /* A salesperson is invited with a sales role (required) and who they report to (optional: the owner). Both from this studio. */
  let salesRoleId: string | null = null;
  let reportsToId: string | null = null;
  if (role === 'SALES') {
    const roleId = typeof raw.salesRoleId === 'string' ? raw.salesRoleId : '';
    const salesRole = roleId ? await prisma.studioSalesRole.findFirst({ where: { id: roleId, studioId: lead.studioId }, select: { id: true } }) : null;
    if (!salesRole) return { ok: false, error: 'Pick their sales role.' };
    salesRoleId = salesRole.id;
    const bossId = typeof raw.reportsToId === 'string' ? raw.reportsToId : '';
    if (bossId) {
      const boss = await prisma.studioMember.findFirst({ where: { id: bossId, studioId: lead.studioId, role: 'SALES' }, select: { id: true } });
      if (!boss) return { ok: false, error: 'They can report to a salesperson on your team, or to the owner.' };
      reportsToId = boss.id;
    }
  }

  const existing = await prisma.user.findUnique({
    where: { phone },
    select: { id: true, role: true, deletedAt: true, studioMember: { select: { studioId: true } } },
  });
  if (existing) {
    if (existing.deletedAt) return { ok: false, error: 'That number belonged to an account that was closed. Contact One Interiors to reuse it.' };
    if (existing.role === 'CUSTOMER') {
      return {
        ok: false,
        error:
          'That number already has a One Interiors customer account. One person has one account, so it cannot also join a studio team. Ask them for another number, or contact One Interiors.',
      };
    }
    if (existing.role === 'OPS' || existing.role === 'ADMIN') return { ok: false, error: 'That number belongs to the One Interiors team.' };
    if (existing.studioMember) {
      return {
        ok: false,
        error:
          existing.studioMember.studioId === lead.studioId
            ? 'That number is already on your team.'
            : 'That number is already on another studio’s team. One person can be on one studio’s team.',
      };
    }
  }

  const now = new Date();
  try {
    await prisma.$transaction(async (tx) => {
      const userId = existing?.id ?? (await tx.user.create({ data: { phone, name, role: 'STUDIO' }, select: { id: true } })).id;
      const member = await tx.studioMember.create({
        data: {
          studioId: lead.studioId,
          userId,
          role,
          status: 'INVITED',
          // Kept in step until the contract migration drops it (PHASE-1-FOUNDATION).
          isOwner: role === 'OWNER',
          invitedById: lead.id,
          invitedAt: now,
          salesRoleId,
          reportsToId,
        },
        select: { id: true },
      });
      if (siteIds.length) {
        await tx.studioProjectMember.createMany({
          data: siteIds.map((homeProjectId) => ({ homeProjectId, memberId: member.id })),
          skipDuplicates: true,
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: lead.userId,
          action: 'studio.member.invite',
          entityType: 'StudioMember',
          entityId: member.id,
          after: { role, sites: siteIds.length, salesRoleId, reportsToId },
        },
      });
    });
  } catch (error) {
    // Two owners adding the same number at once: the unique phone or member catches it.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { ok: false, error: 'That number was just added. Refresh the page.' };
    }
    throw error;
  }

  const sent = await sendInvite(lead, phone, name, baseUrl);
  return { ok: true, message: sentLine(sent.delivered, sent.via) };
}

/** Send the invite again, to someone who has not signed in yet. Three an hour per person. */
export async function resendInvite(memberId: string, baseUrl: string): Promise<TeamResult> {
  const access = await teamAccess();
  if (!access) return { ok: false, error: NOT_ALLOWED };
  const { lead } = access;
  const m = await teammate(lead, memberId);
  if (!m) return { ok: false, error: 'That person is not on your team.' };
  if (!access.full && m.role !== 'SALES') return { ok: false, error: 'That person is not on your team.' };
  if (m.status !== 'INVITED' || !m.user.phone) return { ok: false, error: 'They have already signed in.' };
  const verdict = await consume(bucketFor('team-invite', m.id), { max: 3, windowMs: 60 * 60_000 });
  if (!verdict.allowed) return { ok: false, error: 'Sent three times this hour already. Try again later.' };
  const sent = await sendInvite(lead, m.user.phone, m.user.name ?? '', baseUrl);
  return sent.delivered ? { ok: true, message: sentLine(true, sent.via) } : { ok: false, error: sentLine(false, sent.via) };
}

/**
 * Suspend: they can do nothing (`can()` refuses anyone not ACTIVE), and every
 * session they hold ends now. Not yourself, and never the last active owner
 * — a studio with no owner has nobody who can undo it.
 */
export async function suspendMember(memberId: string): Promise<TeamResult> {
  const lead = await teamLead();
  if (!lead) return { ok: false, error: NOT_ALLOWED };
  const m = await teammate(lead, memberId);
  if (!m) return { ok: false, error: 'That person is not on your team.' };
  if (m.id === lead.id) return { ok: false, error: 'You cannot suspend yourself.' };
  if (m.status === 'SUSPENDED') return { ok: true, message: 'Already suspended.' };
  if (m.role === 'OWNER' && m.status === 'ACTIVE') {
    const owners = await prisma.studioMember.count({ where: { studioId: lead.studioId, role: 'OWNER', status: 'ACTIVE' } });
    if (owners <= 1) return { ok: false, error: 'A studio needs at least one active owner.' };
  }
  await prisma.studioMember.update({ where: { id: m.id }, data: { status: 'SUSPENDED' } });
  await revokeAllSessions(m.userId);
  await audit(lead, 'studio.member.suspend', m.id, { status: m.status }, { status: 'SUSPENDED' });
  return { ok: true, message: `${m.user.name ?? 'They'} can no longer sign in, and is signed out everywhere.` };
}

/** Undo a suspension. Someone who never signed in goes back to INVITED, not ACTIVE: a seat is a sign-in. */
export async function reinstateMember(memberId: string): Promise<TeamResult> {
  const lead = await teamLead();
  if (!lead) return { ok: false, error: NOT_ALLOWED };
  const m = await teammate(lead, memberId);
  if (!m) return { ok: false, error: 'That person is not on your team.' };
  if (m.status !== 'SUSPENDED') return { ok: true, message: 'They are not suspended.' };
  const status = m.lastSeenAt ? 'ACTIVE' : 'INVITED';
  await prisma.studioMember.update({ where: { id: m.id }, data: { status } });
  await audit(lead, 'studio.member.reinstate', m.id, { status: 'SUSPENDED' }, { status });
  return { ok: true, message: `${m.user.name ?? 'They'} can sign in again.` };
}

/** End every session they hold — a lost phone, a shared one. They can sign in again with their number. */
export async function signOutEverywhere(memberId: string): Promise<TeamResult> {
  const lead = await teamLead();
  if (!lead) return { ok: false, error: NOT_ALLOWED };
  const m = await teammate(lead, memberId);
  if (!m) return { ok: false, error: 'That person is not on your team.' };
  await revokeAllSessions(m.userId);
  await audit(lead, 'studio.member.signout', m.id, null, null);
  return { ok: true, message: `${m.user.name ?? 'They'} is signed out of every device.` };
}

/** Which sites a project manager or supervisor sees. Owners and accounts see across the studio and have none. */
export async function setMemberSites(memberId: string, rawSites: unknown): Promise<TeamResult> {
  const lead = await teamLead();
  if (!lead) return { ok: false, error: NOT_ALLOWED };
  const m = await teammate(lead, memberId);
  if (!m) return { ok: false, error: 'That person is not on your team.' };
  if (!isStudioRole(m.role) || !pickSites(m.role)) return { ok: false, error: 'This role sees every project; there are no sites to pick.' };
  const wanted = Array.isArray(rawSites) ? [...new Set(rawSites.filter((s): s is string => typeof s === 'string'))].slice(0, 200) : [];
  const siteIds = await ownSites(lead.studioId, wanted);
  if (!siteIds) return { ok: false, error: 'One of those sites is not your studio’s.' };
  await prisma.$transaction([
    prisma.studioProjectMember.deleteMany({ where: { memberId: m.id, homeProjectId: { notIn: siteIds } } }),
    prisma.studioProjectMember.createMany({ data: siteIds.map((homeProjectId) => ({ homeProjectId, memberId: m.id })), skipDuplicates: true }),
  ]);
  await audit(lead, 'studio.member.sites', m.id, null, { sites: siteIds.length });
  return { ok: true, message: 'Sites saved.' };
}

async function audit(lead: StudioMemberRef, action: string, entityId: string, before: object | null, after: object | null) {
  await prisma.auditLog
    .create({
      data: {
        actorId: lead.userId,
        action,
        entityType: 'StudioMember',
        entityId,
        ...(before ? { before } : {}),
        ...(after ? { after } : {}),
      },
    })
    .catch((error: unknown) => console.error('[team] audit write failed', action, error));
}
