import 'server-only';

/**
 * Settings → Team, the sales side (owner, 22 Oct 2026; docs/studio-os/
 * SALES-ROLES.md): the studio's sales roles (the Roles tab's permission
 * matrix), each salesperson's role, and who reports to whom.
 *
 * Who may: the owner (`team.manage`), and a salesperson whose sales role has
 * "Manage the sales team" (`team.sales`). Every function checks it here, so a
 * server action cannot forget it. Pro Solo has no team, so nothing here opens
 * there. Every read and write is scoped by the signed-in member's studio, and
 * every id from a form is looked up inside it first: a role or a person from
 * another studio is simply "not found".
 *
 * Three guards beyond the permission:
 *
 *  - Reporting lines are checked by sales-access.ts `checkReportsTo` against
 *    the studio's own team (same studio, salespeople only, no loops).
 *  - A role is not deleted while anyone is on it, and the three built-ins are
 *    never deleted (they can be renamed and edited).
 *  - Someone managing the sales team who is not the owner cannot change their
 *    own role or reporting line: they would be granting themselves rights.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { currentMember, type StudioMemberRef } from './access';
import { can } from './roles';
import { checkReportsTo } from './sales-access';
import { MAX_SALES_ROLES, builtInSalesRoleRows, checkSalesRole, readSalesPermissions, type SalesPermissionMap } from './sales-permissions';

export type SalesTeamResult = { ok: true; message: string } | { ok: false; error: string };

const NOT_ALLOWED = 'Only the studio owner, or someone whose role manages the sales team, can change this.';

/** The signed-in member when they may manage the sales team (owner or `team.sales`), not on Pro Solo. */
export async function salesTeamLead(): Promise<StudioMemberRef | null> {
  const member = await currentMember();
  if (!member || member.solo === true) return null;
  return can(member, 'team.manage') || can(member, 'team.sales') ? member : null;
}

/** The built-in roles, made if this studio predates them (provision.ts writes them for new studios). */
export async function ensureBuiltInSalesRoles(studioId: string): Promise<void> {
  try {
    await prisma.studioSalesRole.createMany({ data: builtInSalesRoleRows(studioId), skipDuplicates: true });
  } catch (error) {
    console.error('[sales-team] built-in roles failed', error instanceof Error ? error.message : 'unknown');
  }
}

export interface SalesRoleRow {
  id: string;
  name: string;
  description: string | null;
  system: string | null;
  permissions: SalesPermissionMap;
  /** Salespeople on it. */
  people: number;
}

/** The studio's sales roles, built-ins first. Anyone who manages the team (or the owner) reads them. */
export async function salesRoles(): Promise<SalesRoleRow[] | null> {
  const lead = await salesTeamLead();
  if (!lead) return null;
  return rolesOf(lead.studioId);
}

/** A render-path read: an unreadable table is an empty list (the page still draws), never a throw. */
export async function rolesOf(studioId: string): Promise<SalesRoleRow[]> {
  try {
    await ensureBuiltInSalesRoles(studioId);
    const rows = await prisma.studioSalesRole.findMany({
      where: { studioId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, description: true, system: true, permissions: true, _count: { select: { members: true } } },
    });
    return rows.map((r) => ({ id: r.id, name: r.name, description: r.description, system: r.system, permissions: readSalesPermissions(r.permissions), people: r._count.members }));
  } catch (error) {
    console.error('[sales-team] roles read failed', error instanceof Error ? error.message : 'unknown');
    return [];
  }
}

async function audit(lead: StudioMemberRef, action: string, entityType: string, entityId: string, after: object | null) {
  await prisma.auditLog
    .create({ data: { actorId: lead.userId, action, entityType, entityId, ...(after ? { after } : {}) } })
    .catch((error: unknown) => console.error('[sales-team] audit write failed', action, error));
}

/** Make a role. Names are unique in the studio; at most MAX_SALES_ROLES. */
export async function createSalesRole(raw: { name?: unknown; description?: unknown; permissions?: unknown }): Promise<SalesTeamResult> {
  const lead = await salesTeamLead();
  if (!lead) return { ok: false, error: NOT_ALLOWED };
  const check = checkSalesRole(raw);
  if (!check.ok) return check;
  const count = await prisma.studioSalesRole.count({ where: { studioId: lead.studioId } });
  if (count >= MAX_SALES_ROLES) return { ok: false, error: `${MAX_SALES_ROLES} roles is the most. Edit one you have.` };
  try {
    const made = await prisma.studioSalesRole.create({
      data: { studioId: lead.studioId, name: check.role.name, description: check.role.description, permissions: check.role.permissions as Prisma.InputJsonValue, sortOrder: 10 + count },
      select: { id: true },
    });
    await audit(lead, 'studio.salesRole.create', 'StudioSalesRole', made.id, { name: check.role.name, permissions: check.role.permissions });
    return { ok: true, message: `${check.role.name} made.` };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return { ok: false, error: 'You already have a role with that name.' };
    throw error;
  }
}

/** Rename or re-permission a role. Changes everyone on it at once (their next page load). */
export async function updateSalesRole(roleId: unknown, raw: { name?: unknown; description?: unknown; permissions?: unknown }): Promise<SalesTeamResult> {
  const lead = await salesTeamLead();
  if (!lead) return { ok: false, error: NOT_ALLOWED };
  if (typeof roleId !== 'string' || roleId.length > 64) return { ok: false, error: 'That role is not yours.' };
  const check = checkSalesRole(raw);
  if (!check.ok) return check;
  const role = await prisma.studioSalesRole.findFirst({ where: { id: roleId, studioId: lead.studioId }, select: { id: true, permissions: true } });
  if (!role) return { ok: false, error: 'That role is not yours.' };
  /* Someone who is not the owner must not lock the studio out of its own
     team screen through the role they are on, nor widen their own role. */
  if (lead.role !== 'OWNER' && lead.sales?.roleId === role.id) return { ok: false, error: 'Your own role is changed by the studio owner, or by someone else who manages the team.' };
  try {
    await prisma.studioSalesRole.updateMany({
      where: { id: role.id, studioId: lead.studioId },
      data: { name: check.role.name, description: check.role.description, permissions: check.role.permissions as Prisma.InputJsonValue },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return { ok: false, error: 'You already have a role with that name.' };
    throw error;
  }
  await audit(lead, 'studio.salesRole.update', 'StudioSalesRole', role.id, { before: readSalesPermissions(role.permissions), after: check.role.permissions, name: check.role.name });
  return { ok: true, message: 'Role saved. Everyone on it has the new rights from their next page.' };
}

/** Delete a role: never a built-in, never one somebody is on. */
export async function deleteSalesRole(roleId: unknown): Promise<SalesTeamResult> {
  const lead = await salesTeamLead();
  if (!lead) return { ok: false, error: NOT_ALLOWED };
  if (typeof roleId !== 'string' || roleId.length > 64) return { ok: false, error: 'That role is not yours.' };
  const role = await prisma.studioSalesRole.findFirst({ where: { id: roleId, studioId: lead.studioId }, select: { id: true, name: true, system: true, _count: { select: { members: true } } } });
  if (!role) return { ok: false, error: 'That role is not yours.' };
  if (role.system) return { ok: false, error: `${role.name} is one of the three built-in roles. Rename or edit it instead.` };
  if (role._count.members > 0) return { ok: false, error: `${role._count.members} ${role._count.members === 1 ? 'person is' : 'people are'} on ${role.name}. Give them another role first.` };
  /* Conditional on still nobody being on it: a role given to somebody in the same instant stays. */
  const { count } = await prisma.studioSalesRole.deleteMany({ where: { id: role.id, studioId: lead.studioId, members: { none: {} } } });
  if (count === 0) return { ok: false, error: 'Somebody was just given this role. Refresh and try again.' };
  await audit(lead, 'studio.salesRole.delete', 'StudioSalesRole', role.id, { name: role.name });
  return { ok: true, message: `${role.name} deleted.` };
}

/** A salesperson of the lead's own studio, or null. */
async function salesperson(lead: StudioMemberRef, memberId: unknown) {
  if (typeof memberId !== 'string' || memberId.length > 64) return null;
  return prisma.studioMember.findFirst({ where: { id: memberId, studioId: lead.studioId }, select: { id: true, role: true, salesRoleId: true, reportsToId: true, user: { select: { name: true } } } });
}

/** Give a salesperson a sales role (null: none, the Phase 1 rule). */
export async function setMemberSalesRole(memberId: unknown, roleId: unknown): Promise<SalesTeamResult> {
  const lead = await salesTeamLead();
  if (!lead) return { ok: false, error: NOT_ALLOWED };
  const m = await salesperson(lead, memberId);
  if (!m) return { ok: false, error: 'That person is not on your team.' };
  if (m.role !== 'SALES') return { ok: false, error: 'Sales roles are for salespeople. The owner, project managers and the others keep their own role.' };
  if (lead.role !== 'OWNER' && m.id === lead.id) return { ok: false, error: 'Your own role is changed by the studio owner.' };
  let id: string | null = null;
  if (typeof roleId === 'string' && roleId) {
    const role = await prisma.studioSalesRole.findFirst({ where: { id: roleId, studioId: lead.studioId }, select: { id: true } });
    if (!role) return { ok: false, error: 'That role is not yours.' };
    id = role.id;
  }
  await prisma.studioMember.updateMany({ where: { id: m.id, studioId: lead.studioId, role: 'SALES' }, data: { salesRoleId: id } });
  await audit(lead, 'studio.member.salesRole', 'StudioMember', m.id, { from: m.salesRoleId, to: id });
  return { ok: true, message: `${m.user.name ?? 'Their'} role saved.` };
}

/** Who a salesperson reports to (null: the owner). Same studio, salespeople only, no loops. */
export async function setReportsTo(memberId: unknown, bossId: unknown): Promise<SalesTeamResult> {
  const lead = await salesTeamLead();
  if (!lead) return { ok: false, error: NOT_ALLOWED };
  const m = await salesperson(lead, memberId);
  if (!m) return { ok: false, error: 'That person is not on your team.' };
  if (lead.role !== 'OWNER' && m.id === lead.id) return { ok: false, error: 'Who you report to is set by the studio owner.' };
  const wanted = typeof bossId === 'string' && bossId ? bossId : null;
  /* Read the tree and write in one serializable transaction: two lines saved
     at the same moment (A under B, B under A) cannot both pass the loop check. */
  const check = await prisma.$transaction(
    async (tx) => {
      const team = await tx.studioMember.findMany({ where: { studioId: lead.studioId }, select: { id: true, studioId: true, role: true, reportsToId: true } });
      const c = checkReportsTo(m.id, wanted, team);
      if (c.ok) await tx.studioMember.updateMany({ where: { id: m.id, studioId: lead.studioId }, data: { reportsToId: c.reportsToId } });
      return c;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  if (!check.ok) return check;
  await audit(lead, 'studio.member.reportsTo', 'StudioMember', m.id, { from: m.reportsToId, to: check.reportsToId });
  return { ok: true, message: 'Reporting line saved.' };
}
