/**
 * The sales resolver (owner, 22 Oct 2026; docs/studio-os/SALES-ROLES.md):
 * given a SALES member's sales role and where they sit in the reporting tree,
 * whether they may take a sales action on a lead, and the `where` every lead
 * read and write carries. Pure (CONTRIBUTING §9.5) — Prisma for types only —
 * and tested case by case in tests/studio-sales-access.test.ts.
 *
 * roles.ts `can()` hands a SALES member with a sales role here; the server
 * side (access.ts `memberFor`) builds the `SalesContext` once per request
 * from the role row and the studio's `reportsToId` column.
 *
 * ## The tree
 *
 * Each member has an optional `reportsToId` (another member of the same
 * studio; null = the owner). A person's TEAM is everyone below them at any
 * depth, themselves included (`subtreeOf`). Every walk here keeps a visited
 * set, so a cycle that somehow reached the database (team-store.ts refuses
 * them) ends the walk instead of looping, and can never widen a reach: a
 * cycle only ever contains people who were already in it.
 *
 * ## Reach, as a lead test and as a `where`
 *
 *  - own:  assignedToId = me
 *  - team: assignedToId ∈ my subtree, OR (unassigned AND poolTeamId ∈ my subtree)
 *  - all:  the studio
 *
 * `leadInReach` and `reachWhere` are the same rule twice; the tests run both
 * over the same rows.
 *
 * ## Pools
 *
 * An unassigned lead sits in a pool: a head's team pool (`poolTeamId`) or the
 * studio pool (null). Which pools someone may see and claim from is
 * `leads.pool`:
 *
 *  - all:  every pool, and the studio pool.
 *  - team: the team pools of the heads ABOVE them (the teams they are in),
 *    their own, and those of heads below them; and the studio pool only when
 *    they report to the owner directly (the studio pool is, in effect, the
 *    owner's own team pool). So a rep with nobody above them but the owner
 *    claims from the studio pool exactly as in Phase 1, and a rep under a
 *    head claims from that head's pool.
 *
 * ## No sales role = Phase 1
 *
 * A SALES member with no sales role gets no `SalesContext` and roles.ts keeps
 * the Phase 1 rule exactly: their own leads and the studio pool.
 */

import type { Prisma } from '@prisma/client';
import { narrower, readSalesPermissions, type SalesPermissionKey, type SalesPermissionMap, type SalesReach } from './sales-permissions';

export interface TreeMember {
  id: string;
  reportsToId: string | null;
}

/** Everyone below `memberId` at any depth, themselves first. Cycle-safe. */
export function subtreeOf(memberId: string, members: readonly TreeMember[]): string[] {
  const below = new Map<string, string[]>();
  for (const m of members) {
    if (!m.reportsToId || m.reportsToId === m.id) continue;
    const list = below.get(m.reportsToId) ?? [];
    list.push(m.id);
    below.set(m.reportsToId, list);
  }
  const out: string[] = [memberId];
  const seen = new Set(out);
  for (let i = 0; i < out.length; i++) {
    for (const child of below.get(out[i]!) ?? []) {
      if (seen.has(child)) continue;
      seen.add(child);
      out.push(child);
    }
  }
  return out;
}

/** Everyone above `memberId`, nearest first (not themselves). Stops at a cycle or an unknown id. */
export function ancestorsOf(memberId: string, members: readonly TreeMember[]): string[] {
  const byId = new Map(members.map((m) => [m.id, m]));
  const out: string[] = [];
  const seen = new Set([memberId]);
  let next = byId.get(memberId)?.reportsToId ?? null;
  while (next && !seen.has(next) && byId.has(next)) {
    out.push(next);
    seen.add(next);
    next = byId.get(next)?.reportsToId ?? null;
  }
  return out;
}

export interface ReportsToMember extends TreeMember {
  studioId: string;
  role: string;
}

export type ReportsToCheck = { ok: true; reportsToId: string | null } | { ok: false; error: string };

/**
 * Whether `memberId` may report to `bossId` (null = the owner): both
 * salespeople of the same studio, not themselves, and not somebody already
 * below them (that would make a loop). `members` is the studio's team as
 * read by the server; an id that is not in it is refused, so a form cannot
 * link two studios.
 */
export function checkReportsTo(memberId: string, bossId: string | null, members: readonly ReportsToMember[]): ReportsToCheck {
  const me = members.find((m) => m.id === memberId);
  if (!me) return { ok: false, error: 'That person is not on your team.' };
  if (me.role !== 'SALES') return { ok: false, error: 'Only salespeople have a reporting line here.' };
  if (bossId === null || bossId === '') return { ok: true, reportsToId: null };
  const boss = members.find((m) => m.id === bossId);
  if (!boss || boss.studioId !== me.studioId) return { ok: false, error: 'Pick someone on your own team.' };
  if (boss.role !== 'SALES') return { ok: false, error: 'A salesperson reports to another salesperson, or to the owner.' };
  if (boss.id === me.id) return { ok: false, error: 'Nobody reports to themselves.' };
  if (subtreeOf(me.id, members).includes(boss.id)) return { ok: false, error: 'That would make a loop: that person already reports to them.' };
  return { ok: true, reportsToId: boss.id };
}

/** Everything the resolver needs about one SALES member with a sales role. Built per request (access.ts). */
export interface SalesContext {
  memberId: string;
  roleId: string;
  roleName: string;
  permissions: SalesPermissionMap;
  /** Their team: them and everyone below them. */
  subtree: readonly string[];
  /** The heads above them, nearest first. */
  ancestors: readonly string[];
  /** Nobody above them but the owner (reportsToId null). */
  reportsToOwner: boolean;
}

/** The context, or null when they have no sales role (Phase 1 rules apply). */
export function buildSalesContext(
  member: TreeMember,
  role: { id: string; name: string; permissions: unknown } | null | undefined,
  members: readonly TreeMember[],
): SalesContext | null {
  if (!role) return null;
  const all = members.some((m) => m.id === member.id) ? members : [...members, member];
  const ancestors = ancestorsOf(member.id, all);
  return {
    memberId: member.id,
    roleId: role.id,
    roleName: role.name,
    permissions: readSalesPermissions(role.permissions),
    subtree: subtreeOf(member.id, all),
    ancestors,
    reportsToOwner: !member.reportsToId || ancestors.length === 0,
  };
}

/** The reach of a permission (an on/off permission reads as `all`), or null when it is off. */
export function reachOf(ctx: SalesContext, key: SalesPermissionKey): SalesReach | null {
  const v = ctx.permissions[key];
  if (v === undefined) return null;
  return v === true ? 'all' : v;
}

export const hasSales = (ctx: SalesContext, key: SalesPermissionKey): boolean => ctx.permissions[key] !== undefined;

export interface LeadFacts {
  assignedToId: string | null;
  /** Missing reads as the studio pool — the narrowest answer for team reach. */
  poolTeamId?: string | null;
}

/** Whether this lead is within `reach` for this member. */
export function leadInReach(ctx: SalesContext, reach: SalesReach, lead: LeadFacts): boolean {
  if (reach === 'all') return true;
  if (reach === 'own') return lead.assignedToId !== null && lead.assignedToId === ctx.memberId;
  if (lead.assignedToId !== null) return ctx.subtree.includes(lead.assignedToId);
  return typeof lead.poolTeamId === 'string' && ctx.subtree.includes(lead.poolTeamId);
}

const NONE: Prisma.StudioClientWhereInput = { id: { in: [] } };

/** `leadInReach` as a `where` for `prisma.studioClient`, always inside the studio. */
export function reachWhere(ctx: SalesContext, reach: SalesReach | null, studioId: string): Prisma.StudioClientWhereInput {
  if (reach === null) return { studioId, ...NONE };
  if (reach === 'all') return { studioId };
  if (reach === 'own') return { studioId, assignedToId: ctx.memberId };
  const team = [...ctx.subtree];
  return { studioId, OR: [{ assignedToId: { in: team } }, { assignedToId: null, poolTeamId: { in: team } }] };
}

/** The pools someone may see and claim from. */
export type PoolAccess = { kind: 'none' } | { kind: 'all' } | { kind: 'some'; heads: readonly string[]; studio: boolean };

/** Phase 1 (a SALES member with no sales role, or the legacy pool): the studio pool only. */
export const STUDIO_POOL_ONLY: PoolAccess = { kind: 'some', heads: [], studio: true };

export function poolAccessOf(ctx: SalesContext): PoolAccess {
  const reach = reachOf(ctx, 'leads.pool');
  if (reach === null) return { kind: 'none' };
  if (reach === 'all') return { kind: 'all' };
  return { kind: 'some', heads: [...new Set([...ctx.ancestors, ...ctx.subtree])], studio: ctx.reportsToOwner };
}

/** Whether this unassigned lead is in a pool they may see. An assigned lead is in no pool. */
export function inPool(pools: PoolAccess, lead: LeadFacts): boolean {
  if (lead.assignedToId !== null) return false;
  if (pools.kind === 'none') return false;
  if (pools.kind === 'all') return true;
  const team = lead.poolTeamId ?? null;
  return team === null ? pools.studio : pools.heads.includes(team);
}

/** `inPool` as a `where`, always inside the studio and unassigned. */
export function poolWhere(pools: PoolAccess, studioId: string): Prisma.StudioClientWhereInput {
  if (pools.kind === 'none') return { studioId, ...NONE };
  if (pools.kind === 'all') return { studioId, assignedToId: null };
  if (pools.heads.length === 0) return pools.studio ? { studioId, assignedToId: null, poolTeamId: null } : { studioId, ...NONE };
  if (!pools.studio) return { studioId, assignedToId: null, poolTeamId: { in: [...pools.heads] } };
  return { studioId, assignedToId: null, OR: [{ poolTeamId: { in: [...pools.heads] } }, { poolTeamId: null }] };
}

/** Which pools, for the pool screen's tabs: 'studio' and/or head ids. Null heads list = every head. */
export function poolTabs(pools: PoolAccess): { studio: boolean; heads: readonly string[] | null } {
  if (pools.kind === 'none') return { studio: false, heads: [] };
  if (pools.kind === 'all') return { studio: true, heads: null };
  return { studio: pools.studio, heads: pools.heads };
}

/**
 * Who this member may give a lead to, out of `candidates` (people who can
 * take leads, already read by the server): with team reach, only their team;
 * when the lead sits in a head's team pool, only that head's team as well
 * ("assigning from a team pool offers only that head's team").
 */
export function assignableTo<T extends { id: string }>(
  reach: SalesReach | null,
  ctx: SalesContext | null,
  candidates: readonly T[],
  members: readonly TreeMember[],
  poolTeamId: string | null = null,
): T[] {
  if (reach === null) return [];
  let list = [...candidates];
  if (reach !== 'all' && ctx) list = list.filter((c) => ctx.subtree.includes(c.id));
  if (reach === 'own' && ctx) list = list.filter((c) => c.id === ctx.memberId);
  if (poolTeamId) {
    const team = new Set(subtreeOf(poolTeamId, members));
    list = list.filter((c) => team.has(c.id));
  }
  return list;
}

/** Whether `targetId` is someone this member may give leads to. */
export function mayAssignTo(ctx: SalesContext, targetId: string): boolean {
  const reach = reachOf(ctx, 'leads.assign');
  if (reach === null) return false;
  if (reach === 'all') return true;
  return ctx.subtree.includes(targetId);
}

/** The narrower of two permissions' reaches (bulk ∩ the action's own), or null when either is off. */
export function combinedReach(ctx: SalesContext, a: SalesPermissionKey, b: SalesPermissionKey): SalesReach | null {
  const ra = reachOf(ctx, a);
  const rb = reachOf(ctx, b);
  return ra && rb ? narrower(ra, rb) : null;
}

/** Whose numbers this member sees on analytics: null = the whole studio; else these member ids. */
export function analyticsMembers(ctx: SalesContext): readonly string[] | null {
  const reach = reachOf(ctx, 'analytics.view');
  if (reach === 'all') return null;
  if (reach === 'team') return ctx.subtree;
  return [ctx.memberId];
}

export interface BuilderCandidate {
  id: string;
  role: string;
  status: string;
  /** The member's sales role permissions (stored JSON), or null when they have none. */
  salesPermissions: unknown;
}

/**
 * The people who build quotations (`quotes.build`, owner 22 Oct 2026), for
 * the request queue that hands quotation requests out in turns. Active only.
 * An owner has every permission, so counts; a SALES member counts when their
 * sales role has the key. Nobody else (a PM writes quotations on any lead
 * already and is not in the turns). Order kept, so turns are stable.
 */
export function buildersOf<T extends BuilderCandidate>(members: readonly T[]): T[] {
  return members.filter((m) => {
    if (m.status !== 'ACTIVE') return false;
    if (m.role === 'OWNER') return true;
    if (m.role !== 'SALES') return false;
    return readSalesPermissions(m.salesPermissions)['quotes.build'] === true;
  });
}
