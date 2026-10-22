import { describe, expect, it } from 'vitest';
import {
  STUDIO_POOL_ONLY,
  analyticsMembers,
  ancestorsOf,
  assignableTo,
  buildSalesContext,
  buildersOf,
  checkReportsTo,
  combinedReach,
  inPool,
  leadInReach,
  mayAssignTo,
  poolAccessOf,
  poolTabs,
  poolWhere,
  reachOf,
  reachWhere,
  subtreeOf,
  type SalesContext,
  type TreeMember,
} from '@/modules/studio/sales-access';
import { BUILT_IN_SALES_ROLES, type SalesPermissionMap, type SalesReach } from '@/modules/studio/sales-permissions';
import { can, leadsVisibleTo, leadsWhereFor, poolVisibleTo, quotesVisibleTo, type MemberRole, type StudioRoleName } from '@/modules/studio/roles';
import { seesFullLead } from '@/modules/studio-sales/lead-view';
import { scopedLeadWhere, type ScopeLike } from '@/modules/studio-sales/lead-where';
import { mayAssignTaskTo, mayChangeTask, seesAllTasks, tasksVisibleTo } from '@/modules/studio-sales/task-rules';
import { mayOpen } from '@/modules/studio/surfaces';
import { mayBulk } from '@/modules/studio-sales/bulk-rules';

/**
 * Sales roles and teams (owner, 22 Oct 2026; docs/studio-os/SALES-ROLES.md):
 * the resolver (sales-access.ts) and how roles.ts `can()` and every `where`
 * builder use it. A fake Postgres (`matches`) applies each `where` to rows
 * the way Prisma would, so "the rule" and "the query" are checked to agree.
 *
 * The studio, as the owner's example: Admin → two Sales heads, each with a
 * team lead and reps under them; another studio's people never mix in.
 *
 *   admin
 *   headA ── leadA ── repA1
 *         └─ repA2
 *   headB ── repB1
 *   loner (no reporting line: reports to the owner)
 */

const TREE: TreeMember[] = [
  { id: 'admin', reportsToId: null },
  { id: 'headA', reportsToId: null },
  { id: 'leadA', reportsToId: 'headA' },
  { id: 'repA1', reportsToId: 'leadA' },
  { id: 'repA2', reportsToId: 'headA' },
  { id: 'headB', reportsToId: null },
  { id: 'repB1', reportsToId: 'headB' },
  { id: 'loner', reportsToId: null },
];

const ROLE = Object.fromEntries(BUILT_IN_SALES_ROLES.map((r) => [r.system, { id: `role-${r.system}`, name: r.name, permissions: r.permissions }]));

const ctxOf = (id: string, role: { id: string; name: string; permissions: unknown }, tree: TreeMember[] = TREE): SalesContext =>
  buildSalesContext(tree.find((m) => m.id === id) ?? { id, reportsToId: null }, role, tree)!;

const custom = (permissions: SalesPermissionMap) => ({ id: 'role-x', name: 'Custom', permissions });

type Member = MemberRole & { id: string; studioId: string };
const salesMember = (id: string, role: { id: string; name: string; permissions: unknown } | null, tree: TreeMember[] = TREE): Member => ({
  id,
  studioId: 's1',
  role: 'SALES',
  status: 'ACTIVE',
  sales: role ? ctxOf(id, role, tree) : null,
});
const fixed = (role: StudioRoleName, id = `m-${role}`): Member => ({ id, studioId: 's1', role, status: 'ACTIVE' });

// ── A fake Postgres for the keys these `where`s use ─────────────────

type Row = { id: string; studioId: string; assignedToId: string | null; poolTeamId: string | null; deletedAt: null };
type W = Record<string, unknown>;

function cell(value: unknown, cond: unknown): boolean {
  if (cond === null) return value === null;
  if (typeof cond === 'object' && cond !== null && 'in' in cond) return (cond as { in: unknown[] }).in.includes(value);
  if (typeof cond === 'object' && cond !== null && 'not' in cond) return value !== (cond as { not: unknown }).not;
  return value === cond;
}

function matches(row: Row, w: W): boolean {
  for (const [k, v] of Object.entries(w)) {
    if (k === 'AND') {
      if (!(v as W[]).every((x) => matches(row, x))) return false;
    } else if (k === 'OR') {
      if (!(v as W[]).some((x) => matches(row, x))) return false;
    } else if (k === 'client') {
      if (!matches(row, v as W)) return false;
    } else if (!cell((row as Record<string, unknown>)[k], v)) return false;
  }
  return true;
}

const LEADS: Row[] = [
  { id: 'L-admin', studioId: 's1', assignedToId: 'admin', poolTeamId: null, deletedAt: null },
  { id: 'L-headA', studioId: 's1', assignedToId: 'headA', poolTeamId: null, deletedAt: null },
  { id: 'L-leadA', studioId: 's1', assignedToId: 'leadA', poolTeamId: null, deletedAt: null },
  { id: 'L-repA1', studioId: 's1', assignedToId: 'repA1', poolTeamId: 'headA', deletedAt: null },
  { id: 'L-repA2', studioId: 's1', assignedToId: 'repA2', poolTeamId: null, deletedAt: null },
  { id: 'L-headB', studioId: 's1', assignedToId: 'headB', poolTeamId: null, deletedAt: null },
  { id: 'L-repB1', studioId: 's1', assignedToId: 'repB1', poolTeamId: null, deletedAt: null },
  { id: 'L-loner', studioId: 's1', assignedToId: 'loner', poolTeamId: null, deletedAt: null },
  { id: 'P-studio', studioId: 's1', assignedToId: null, poolTeamId: null, deletedAt: null },
  { id: 'P-headA', studioId: 's1', assignedToId: null, poolTeamId: 'headA', deletedAt: null },
  { id: 'P-leadA', studioId: 's1', assignedToId: null, poolTeamId: 'leadA', deletedAt: null },
  { id: 'P-headB', studioId: 's1', assignedToId: null, poolTeamId: 'headB', deletedAt: null },
  { id: 'X-other', studioId: 's2', assignedToId: 'repA1', poolTeamId: 'headA', deletedAt: null },
  { id: 'X-pool', studioId: 's2', assignedToId: null, poolTeamId: null, deletedAt: null },
];

const ids = (w: W) => LEADS.filter((l) => matches(l, w)).map((l) => l.id);

// ── The tree ─────────────────────────────────────────────────────────

describe('the reporting tree', () => {
  it('a team is everyone below, at any depth, themselves first', () => {
    expect(subtreeOf('headA', TREE)).toEqual(['headA', 'leadA', 'repA2', 'repA1']);
    expect(subtreeOf('leadA', TREE)).toEqual(['leadA', 'repA1']);
    expect(subtreeOf('repA1', TREE)).toEqual(['repA1']);
    expect(subtreeOf('headB', TREE)).toEqual(['headB', 'repB1']);
    expect(subtreeOf('nobody', TREE)).toEqual(['nobody']);
  });

  it('ancestors are the heads above, nearest first', () => {
    expect(ancestorsOf('repA1', TREE)).toEqual(['leadA', 'headA']);
    expect(ancestorsOf('headA', TREE)).toEqual([]);
  });

  it('a cycle that reached the data ends the walk, and never adds anyone outside it', () => {
    const loop: TreeMember[] = [
      { id: 'a', reportsToId: 'b' },
      { id: 'b', reportsToId: 'a' },
      { id: 'c', reportsToId: 'a' },
      { id: 'self', reportsToId: 'self' },
      { id: 'out', reportsToId: null },
    ];
    expect(new Set(subtreeOf('a', loop))).toEqual(new Set(['a', 'b', 'c']));
    expect(ancestorsOf('a', loop)).toEqual(['b']);
    expect(subtreeOf('self', loop)).toEqual(['self']);
    expect(ancestorsOf('self', loop)).toEqual([]);
    expect(subtreeOf('a', loop)).not.toContain('out');
  });
});

describe('who may report to whom', () => {
  const team = [
    ...TREE.map((m) => ({ ...m, studioId: 's1', role: 'SALES' })),
    { id: 'pm', reportsToId: null, studioId: 's1', role: 'PM' },
    { id: 'owner', reportsToId: null, studioId: 's1', role: 'OWNER' },
    { id: 'alien', reportsToId: null, studioId: 's2', role: 'SALES' },
  ];

  it('to another salesperson of the studio, or the owner (null)', () => {
    expect(checkReportsTo('loner', 'headB', team)).toEqual({ ok: true, reportsToId: 'headB' });
    expect(checkReportsTo('repA1', null, team)).toEqual({ ok: true, reportsToId: null });
    expect(checkReportsTo('repA1', '', team)).toEqual({ ok: true, reportsToId: null });
  });

  it('refuses loops: yourself, or anyone already below you', () => {
    expect(checkReportsTo('headA', 'headA', team).ok).toBe(false);
    expect(checkReportsTo('headA', 'repA1', team)).toEqual({ ok: false, error: 'That would make a loop: that person already reports to them.' });
    expect(checkReportsTo('leadA', 'repA1', team).ok).toBe(false);
  });

  it('refuses another studio, someone unknown, and the fixed roles', () => {
    expect(checkReportsTo('repA1', 'alien', team).ok).toBe(false);
    expect(checkReportsTo('repA1', 'ghost', team).ok).toBe(false);
    expect(checkReportsTo('repA1', 'pm', team).ok).toBe(false);
    expect(checkReportsTo('repA1', 'owner', team).ok).toBe(false);
    expect(checkReportsTo('pm', 'headA', team).ok).toBe(false);
    expect(checkReportsTo('ghost', null, team).ok).toBe(false);
  });
});

// ── Reach: the rule and the query agree ─────────────────────────────

describe('reach as a lead test and as a where', () => {
  const cases: [string, SalesReach, string[]][] = [
    ['repA1', 'own', ['L-repA1']],
    ['headA', 'own', ['L-headA']],
    ['headA', 'team', ['L-headA', 'L-leadA', 'L-repA1', 'L-repA2', 'P-headA', 'P-leadA']],
    ['leadA', 'team', ['L-leadA', 'L-repA1', 'P-leadA']],
    ['headB', 'team', ['L-headB', 'L-repB1', 'P-headB']],
    ['repA1', 'team', ['L-repA1']],
    ['admin', 'all', LEADS.filter((l) => l.studioId === 's1').map((l) => l.id)],
  ];
  for (const [who, reach, expected] of cases) {
    it(`${who} with ${reach} reach`, () => {
      const ctx = ctxOf(who, ROLE.HEAD!);
      expect(ids(reachWhere(ctx, reach, 's1') as W)).toEqual(expected);
      const byRule = LEADS.filter((l) => l.studioId === 's1' && leadInReach(ctx, reach, l)).map((l) => l.id);
      expect(byRule).toEqual(expected);
    });
  }

  it('head A never reaches head B’s team, and nobody reaches another studio', () => {
    const a = ctxOf('headA', ROLE.HEAD!);
    const seen = ids(reachWhere(a, 'team', 's1') as W);
    for (const id of ['L-headB', 'L-repB1', 'P-headB', 'P-studio', 'L-admin', 'X-other', 'X-pool']) expect(seen).not.toContain(id);
    expect(ids(reachWhere(ctxOf('admin', ROLE.ADMIN!), 'all', 's1') as W)).not.toContain('X-other');
  });

  it('no reach is nothing', () => {
    expect(ids(reachWhere(ctxOf('headA', ROLE.HEAD!), null, 's1') as W)).toEqual([]);
  });

  it('an unassigned lead with no pool facts reads as the studio pool (the narrow answer)', () => {
    expect(leadInReach(ctxOf('headA', ROLE.HEAD!), 'team', { assignedToId: null })).toBe(false);
  });
});

// ── Pools ────────────────────────────────────────────────────────────

describe('the pools someone may claim from', () => {
  it('team reach: the pools of the teams they are in and below; the studio pool only reporting to the owner', () => {
    const rep = poolAccessOf(ctxOf('repA1', ROLE.REP!));
    expect(rep).toEqual({ kind: 'some', heads: ['leadA', 'headA', 'repA1'], studio: false });
    expect(ids(poolWhere(rep, 's1') as W)).toEqual(['P-headA', 'P-leadA']);
    const head = poolAccessOf(ctxOf('headA', ROLE.HEAD!));
    expect(ids(poolWhere(head, 's1') as W)).toEqual(['P-studio', 'P-headA', 'P-leadA']);
    const loner = poolAccessOf(ctxOf('loner', ROLE.REP!));
    expect(ids(poolWhere(loner, 's1') as W)).toEqual(['P-studio']);
    const b = poolAccessOf(ctxOf('repB1', ROLE.REP!));
    expect(ids(poolWhere(b, 's1') as W)).toEqual(['P-headB']);
  });

  it('all reach: every pool of the studio, never another studio’s', () => {
    const all = poolAccessOf(ctxOf('admin', ROLE.ADMIN!));
    expect(ids(poolWhere(all, 's1') as W)).toEqual(['P-studio', 'P-headA', 'P-leadA', 'P-headB']);
  });

  it('no pool permission: no pool; a Phase 1 salesperson: the studio pool', () => {
    const none = poolAccessOf(ctxOf('headA', custom({ 'leads.view': 'own' })));
    expect(none).toEqual({ kind: 'none' });
    expect(ids(poolWhere(none, 's1') as W)).toEqual([]);
    expect(ids(poolWhere(STUDIO_POOL_ONLY, 's1') as W)).toEqual(['P-studio']);
  });

  it('inPool and poolWhere agree, and an assigned lead is in no pool', () => {
    for (const who of ['repA1', 'headA', 'loner', 'repB1', 'admin']) {
      const pools = poolAccessOf(ctxOf(who, who === 'admin' ? ROLE.ADMIN! : ROLE.REP!));
      const byRule = LEADS.filter((l) => l.studioId === 's1' && inPool(pools, l)).map((l) => l.id);
      expect(byRule, who).toEqual(ids(poolWhere(pools, 's1') as W));
    }
    expect(inPool({ kind: 'all' }, { assignedToId: 'repA1', poolTeamId: 'headA' })).toBe(false);
  });

  it('pool tabs: the studio pool and the heads they may see', () => {
    expect(poolTabs({ kind: 'all' })).toEqual({ studio: true, heads: null });
    expect(poolTabs({ kind: 'none' })).toEqual({ studio: false, heads: [] });
    expect(poolTabs(poolAccessOf(ctxOf('repA1', ROLE.REP!)))).toEqual({ studio: false, heads: ['leadA', 'headA', 'repA1'] });
  });
});

// ── Assigning ────────────────────────────────────────────────────────

describe('who a lead may be given to', () => {
  const people = TREE.map((m) => ({ id: m.id }));

  it('team reach: only their team; from a head’s pool, only that head’s team', () => {
    const head = ctxOf('headA', ROLE.HEAD!);
    expect(assignableTo('team', head, people, TREE).map((p) => p.id)).toEqual(['headA', 'leadA', 'repA1', 'repA2']);
    expect(assignableTo('team', head, people, TREE, 'leadA').map((p) => p.id)).toEqual(['leadA', 'repA1']);
    expect(mayAssignTo(head, 'repA1')).toBe(true);
    expect(mayAssignTo(head, 'repB1')).toBe(false);
    expect(mayAssignTo(head, 'admin')).toBe(false);
  });

  it('all reach: anyone; no assign permission: nobody', () => {
    const admin = ctxOf('admin', ROLE.ADMIN!);
    expect(assignableTo('all', admin, people, TREE)).toHaveLength(TREE.length);
    expect(mayAssignTo(admin, 'repB1')).toBe(true);
    expect(assignableTo(null, admin, people, TREE)).toEqual([]);
    expect(mayAssignTo(ctxOf('repA1', ROLE.REP!), 'repA1')).toBe(false);
  });

  it('bulk is the narrower of the bulk reach and the action’s', () => {
    const c = ctxOf('headA', custom({ 'leads.view': 'team', 'leads.bulk': 'own', 'leads.edit': 'team' }));
    expect(combinedReach(c, 'leads.bulk', 'leads.edit')).toBe('own');
    expect(combinedReach(c, 'leads.bulk', 'leads.assign')).toBeNull();
  });
});

describe('whose numbers', () => {
  it('team: their subtree; all: the studio; none: their own', () => {
    expect(analyticsMembers(ctxOf('headB', ROLE.HEAD!))).toEqual(['headB', 'repB1']);
    expect(analyticsMembers(ctxOf('admin', ROLE.ADMIN!))).toBeNull();
    expect(analyticsMembers(ctxOf('repA1', ROLE.REP!))).toEqual(['repA1']);
  });
});

describe('who builds quotations (quotes.build)', () => {
  it('active owners, and active salespeople whose role has it; nobody else', () => {
    const list = [
      { id: 'o', role: 'OWNER', status: 'ACTIVE', salesPermissions: null },
      { id: 'h', role: 'SALES', status: 'ACTIVE', salesPermissions: ROLE.HEAD!.permissions },
      { id: 'r', role: 'SALES', status: 'ACTIVE', salesPermissions: ROLE.REP!.permissions },
      { id: 'a', role: 'SALES', status: 'SUSPENDED', salesPermissions: ROLE.ADMIN!.permissions },
      { id: 'n', role: 'SALES', status: 'ACTIVE', salesPermissions: null },
      { id: 'pm', role: 'PM', status: 'ACTIVE', salesPermissions: ROLE.ADMIN!.permissions },
      { id: 'bad', role: 'SALES', status: 'ACTIVE', salesPermissions: { 'quotes.build': 'yes' } },
    ];
    expect(buildersOf(list).map((m) => m.id)).toEqual(['o', 'h']);
  });
});

// ── can() and the where builders ─────────────────────────────────────

describe('can() for a salesperson with a sales role', () => {
  const head = salesMember('headA', ROLE.HEAD!);
  const rep = salesMember('repA1', ROLE.REP!);
  const admin = salesMember('admin', ROLE.ADMIN!);

  it('reads and works leads as far as the role reaches', () => {
    const teamLead = { assignedToId: 'repA1', poolTeamId: null };
    const otherTeam = { assignedToId: 'repB1', poolTeamId: null };
    const teamPool = { assignedToId: null, poolTeamId: 'leadA' };
    expect(can(head, 'lead.read', { lead: teamLead })).toBe(true);
    expect(can(head, 'lead.edit', { lead: teamLead })).toBe(true);
    expect(can(head, 'lead.read', { lead: teamPool })).toBe(true);
    expect(can(head, 'lead.read', { lead: otherTeam })).toBe(false);
    expect(can(head, 'quote.salesFinal', { lead: otherTeam })).toBe(false);
    expect(can(rep, 'lead.read', { lead: teamLead })).toBe(true);
    expect(can(rep, 'lead.read', { lead: { assignedToId: 'repA2', poolTeamId: null } })).toBe(false);
    expect(can(admin, 'lead.edit', { lead: otherTeam })).toBe(true);
  });

  it('a question without the lead gets the safe answer: own leads only', () => {
    expect(can(head, 'lead.edit', { assigned: true })).toBe(true);
    expect(can(head, 'lead.edit')).toBe(false);
    expect(can(head, 'lead.edit', { assigned: false })).toBe(false);
  });

  it('separates seeing from changing: view team, edit own', () => {
    const viewer = salesMember('headA', custom({ 'leads.view': 'team', 'leads.edit': 'own', 'calls.log': 'team' }));
    const lead = { assignedToId: 'repA1', poolTeamId: null };
    expect(can(viewer, 'lead.read', { lead })).toBe(true);
    expect(can(viewer, 'lead.edit', { lead })).toBe(false);
    expect(can(viewer, 'lead.call', { lead })).toBe(true);
  });

  it('on/off permissions follow the role', () => {
    expect(can(head, 'lead.add')).toBe(true);
    expect(can(head, 'lead.assign')).toBe(true);
    expect(can(rep, 'lead.assign')).toBe(false);
    expect(can(head, 'lead.delete')).toBe(false);
    expect(can(admin, 'lead.delete')).toBe(true);
    expect(can(admin, 'lead.export')).toBe(false);
    expect(can(admin, 'team.sales')).toBe(true);
    expect(can(head, 'team.sales')).toBe(false);
    expect(can(admin, 'lead.settings')).toBe(true);
    expect(can(head, 'lead.analytics')).toBe(true);
    expect(can(rep, 'lead.analytics')).toBe(false);
    expect(can(head, 'quote.build')).toBe(true);
    expect(can(rep, 'quote.build')).toBe(false);
  });

  it('claims only from pools they may see', () => {
    expect(can(rep, 'lead.claim')).toBe(true);
    expect(can(rep, 'lead.claim', { lead: { assignedToId: null, poolTeamId: 'headA' } })).toBe(true);
    expect(can(rep, 'lead.claim', { lead: { assignedToId: null, poolTeamId: 'headB' } })).toBe(false);
    expect(can(rep, 'lead.claim', { lead: { assignedToId: null, poolTeamId: null } })).toBe(false);
    expect(can(rep, 'lead.claim', { lead: { assignedToId: 'repA2', poolTeamId: 'headA' } })).toBe(false);
  });

  it('assigns only leads within reach', () => {
    expect(can(head, 'lead.assign', { lead: { assignedToId: null, poolTeamId: 'headA' } })).toBe(true);
    expect(can(head, 'lead.assign', { lead: { assignedToId: null, poolTeamId: null } })).toBe(false);
    expect(can(head, 'lead.assign', { lead: { assignedToId: 'repB1', poolTeamId: null } })).toBe(false);
  });

  it('never reaches project, payment, crew or design actions', () => {
    for (const a of ['project.read', 'payment.read', 'payment.record', 'booking.record', 'design.work', 'crew.list', 'workorder.read', 'team.manage', 'vendor.rates'] as const) {
      expect(can(admin, a, { assigned: true }), a).toBe(false);
    }
  });

  it('nothing at all when not active', () => {
    expect(can({ ...admin, status: 'SUSPENDED' }, 'lead.read', { assigned: true })).toBe(false);
  });
});

describe('a salesperson with no sales role keeps Phase 1 exactly', () => {
  const legacy = salesMember('repA1', null);

  it('own leads only, claims from the studio pool, no assigning', () => {
    expect(can(legacy, 'lead.read', { assigned: true })).toBe(true);
    expect(can(legacy, 'lead.read', { lead: { assignedToId: 'repA1', poolTeamId: null } })).toBe(true);
    expect(can(legacy, 'lead.read', { lead: { assignedToId: 'repA2', poolTeamId: null } })).toBe(false);
    expect(can(legacy, 'lead.claim', { lead: { assignedToId: null, poolTeamId: null } })).toBe(true);
    expect(can(legacy, 'lead.claim', { lead: { assignedToId: null, poolTeamId: 'headA' } })).toBe(false);
    expect(can(legacy, 'lead.assign')).toBe(false);
    expect(can(legacy, 'lead.call', { assigned: true })).toBe(true);
    expect(can(legacy, 'lead.bulk')).toBe(true);
    expect(leadsVisibleTo(legacy)).toEqual({ studioId: 's1', assignedToId: 'repA1' });
    expect(poolVisibleTo(legacy)).toEqual({ studioId: 's1', assignedToId: null, poolTeamId: null });
    expect(quotesVisibleTo(legacy)).toEqual({ studioId: 's1', client: { assignedToId: 'repA1', deletedAt: null } });
    expect(leadsWhereFor(legacy, 'lead.edit')).toEqual({ studioId: 's1', assignedToId: 'repA1' });
    expect(leadsWhereFor(legacy, 'lead.assign')).toEqual({ studioId: 's1', id: { in: [] } });
  });
});

describe('the fixed roles are untouched, even if a sales context were attached', () => {
  it('owner and PM: the studio; supervisor, accounts, designer: no leads', () => {
    const stray = ctxOf('repA1', ROLE.REP!);
    const owner = { ...fixed('OWNER'), sales: stray };
    const pm = { ...fixed('PM'), sales: stray };
    expect(can(owner, 'lead.read', { lead: { assignedToId: 'repB1', poolTeamId: null } })).toBe(true);
    expect(can(pm, 'lead.assign')).toBe(true);
    expect(leadsVisibleTo(pm)).toEqual({ studioId: 's1' });
    expect(leadsWhereFor(pm, 'lead.edit')).toEqual({ studioId: 's1' });
    expect(can(pm, 'lead.export')).toBe(false);
    expect(can(pm, 'lead.settings')).toBe(true);
    expect(can(pm, 'team.sales')).toBe(false);
    for (const r of ['SUPERVISOR', 'ACCOUNTS', 'DESIGNER'] as const) {
      const m = { ...fixed(r), sales: stray };
      expect(can(m, 'lead.read', { assigned: true }), r).toBe(false);
      expect(ids(leadsVisibleTo(m) as W), r).toEqual([]);
    }
  });
});

describe('the where builders for sales roles', () => {
  it('leadsVisibleTo / poolVisibleTo / leadsWhereFor reach as the role says', () => {
    const head = salesMember('headA', ROLE.HEAD!);
    expect(ids(leadsVisibleTo(head) as W)).toEqual(['L-headA', 'L-leadA', 'L-repA1', 'L-repA2', 'P-headA', 'P-leadA']);
    expect(ids(poolVisibleTo(head) as W)).toEqual(['P-studio', 'P-headA', 'P-leadA']);
    const viewer = salesMember('headA', custom({ 'leads.view': 'team', 'leads.edit': 'own', 'leads.assign': 'team' }));
    expect(ids(leadsWhereFor(viewer, 'lead.edit') as W)).toEqual(['L-headA']);
    expect(ids(leadsWhereFor(viewer, 'lead.assign') as W)).toEqual(['L-headA', 'L-leadA', 'L-repA1', 'L-repA2', 'P-headA', 'P-leadA']);
    expect(ids(leadsWhereFor(viewer, 'lead.call') as W)).toEqual([]);
    const admin = salesMember('admin', ROLE.ADMIN!);
    expect(leadsVisibleTo(admin)).toEqual({ studioId: 's1' });
    expect(ids(poolVisibleTo(admin) as W)).toEqual(['P-studio', 'P-headA', 'P-leadA', 'P-headB']);
  });

  it('quotations: those of the leads they may see', () => {
    const head = salesMember('headB', ROLE.HEAD!);
    const q = quotesVisibleTo(head) as W;
    expect(ids(q)).toEqual(['L-headB', 'L-repB1', 'P-headB']);
    expect(quotesVisibleTo(salesMember('admin', ROLE.ADMIN!))).toEqual({ studioId: 's1' });
  });

  it('a role without "See leads" sees nothing', () => {
    const blind = salesMember('headA', custom({ 'leads.add': true }));
    expect(can(blind, 'lead.read', { assigned: true })).toBe(false);
    expect(ids(leadsVisibleTo(blind) as W)).toEqual([]);
  });
});

describe('the list and board fence (scopedLeadWhere)', () => {
  const scope = (m: Member): ScopeLike => ({
    studioId: 's1',
    member: { id: m.id },
    leads: leadsVisibleTo(m),
    pool: poolVisibleTo(m),
    seesAll: false,
    team: m.sales && reachOf(m.sales, 'leads.view') === 'team' ? m.sales.subtree : null,
  });
  const LIVE = { deletedAt: null } as const;
  const NOW = new Date('2026-10-22T06:00:00Z');
  const strip = (w: unknown): W => w as W;

  it('team: the team by default, one person inside it, never outside it', () => {
    const s = scope(salesMember('headA', ROLE.HEAD!));
    const fence = (owner?: string) => ids({ AND: [(strip(scopedLeadWhere(s, owner ? { owner } : {}, NOW, LIVE)).AND as W[])[0]!] });
    expect(fence()).toEqual(['L-headA', 'L-leadA', 'L-repA1', 'L-repA2', 'P-headA', 'P-leadA']);
    expect(fence('pool')).toEqual(['P-studio', 'P-headA', 'P-leadA']);
  });

  it('a Phase 1 salesperson: their own, or the studio pool', () => {
    const s = scope(salesMember('repA1', null));
    const w = strip(scopedLeadWhere(s, { owner: 'repB1' }, NOW, LIVE));
    expect(ids((w.AND as W[])[0]!)).toEqual(['L-repA1']);
  });
});

describe('seeing a lead in full', () => {
  it('team reach opens the team’s leads and team pools; a pool above them stays a row to claim', () => {
    const viewer = { seesAll: false, member: { id: 'leadA' }, team: ['leadA', 'repA1'] };
    expect(seesFullLead(viewer, { assignedToId: 'repA1' })).toBe(true);
    expect(seesFullLead(viewer, { assignedToId: null, poolTeamId: 'leadA' })).toBe(true);
    expect(seesFullLead(viewer, { assignedToId: null, poolTeamId: 'headA' })).toBe(false);
    expect(seesFullLead(viewer, { assignedToId: 'repA2' })).toBe(false);
    expect(seesFullLead({ seesAll: false, member: { id: 'repA1' } }, { assignedToId: 'repA1' })).toBe(true);
    expect(seesFullLead({ seesAll: true, member: { id: 'x' } }, { assignedToId: 'anyone' })).toBe(true);
  });
});

describe('tasks under sales roles', () => {
  it('see their team’s tasks, change those within edit reach, give tasks within assign reach', () => {
    const head = salesMember('headA', ROLE.HEAD!);
    expect(seesAllTasks(head)).toBe(false);
    expect(tasksVisibleTo(head)).toEqual({ studioId: 's1', assignedToId: { in: ['headA', 'leadA', 'repA2', 'repA1'] } });
    expect(mayChangeTask(head, { studioId: 's1', assignedToId: 'repA1' })).toBe(true);
    expect(mayChangeTask(head, { studioId: 's1', assignedToId: 'repB1' })).toBe(false);
    expect(mayChangeTask(head, { studioId: 's2', assignedToId: 'repA1' })).toBe(false);
    expect(mayAssignTaskTo(head, 'repA2')).toBe(true);
    expect(mayAssignTaskTo(head, 'repB1')).toBe(false);
    const rep = salesMember('repA1', ROLE.REP!);
    expect(tasksVisibleTo(rep)).toEqual({ studioId: 's1', assignedToId: 'repA1' });
    expect(mayAssignTaskTo(rep, 'repA1')).toBe(true);
    expect(mayAssignTaskTo(rep, 'leadA')).toBe(false);
    const admin = salesMember('admin', ROLE.ADMIN!);
    expect(seesAllTasks(admin)).toBe(true);
    expect(mayAssignTaskTo(admin, 'repB1')).toBe(true);
  });
});

describe('screens and bulk', () => {
  it('a sales role opens the screens its rights allow, and nothing of the office', () => {
    const admin = salesMember('admin', ROLE.ADMIN!);
    const head = salesMember('headA', ROLE.HEAD!);
    const rep = salesMember('repA1', ROLE.REP!);
    for (const p of ['/studio/clients/import', '/studio/clients/bin', '/studio/clients/analytics', '/studio/clients/analytics/calling', '/studio/settings/team', '/studio/settings/pipeline', '/studio/settings/fields', '/studio/settings/sources']) {
      expect(mayOpen(admin, p), p).toBe(true);
      expect(mayOpen(rep, p), p).toBe(false);
    }
    expect(mayOpen(head, '/studio/clients/analytics')).toBe(true);
    expect(mayOpen(head, '/studio/settings/team')).toBe(false);
    for (const p of ['/studio/settings', '/studio/quotations/terms', '/studio/calendar/appointments', '/studio/projects', '/studio/vendors', '/studio/settings/payments']) {
      expect(mayOpen(admin, p), p).toBe(false);
    }
    expect(mayOpen({ ...admin, solo: true }, '/studio/settings/team')).toBe(false);
    expect(mayOpen(salesMember('repA1', null), '/studio/clients/bin')).toBe(false);
  });

  it('bulk needs "Act on many leads" and each action’s own right', () => {
    const noBulk = salesMember('headA', custom({ 'leads.view': 'team', 'leads.assign': 'team', 'leads.edit': 'team' }));
    expect(mayBulk(noBulk, 'assign')).toBe(false);
    const head = salesMember('headA', ROLE.HEAD!);
    expect(mayBulk(head, 'assign')).toBe(true);
    expect(mayBulk(head, 'move')).toBe(true);
    expect(mayBulk(head, 'bin')).toBe(false);
    expect(mayBulk(salesMember('repA1', ROLE.REP!), 'assign')).toBe(false);
    expect(mayBulk(salesMember('repA1', ROLE.REP!), 'claim')).toBe(true);
  });
});

describe('"New leads go to: a team’s pool" (routing TEAM)', () => {
  const people = [
    { id: 'headA', role: 'SALES' as const, status: 'ACTIVE' as const, name: 'Asha' },
    { id: 'gone', role: 'SALES' as const, status: 'SUSPENDED' as const, name: 'Gone' },
    { id: 'pm', role: 'PM' as const, status: 'ACTIVE' as const, name: 'Priya' },
  ];

  it('lands unassigned in the head’s team pool, with a timeline line', async () => {
    const { effectiveRule, readRouting, routeLead, routedLine, describeRouting } = await import('@/modules/studio-sales/lead-routing');
    const rule = effectiveRule(readRouting({ leadRouteMode: 'TEAM', leadRouteMemberId: 'headA' }), null);
    const d = routeLead(rule, people, true);
    expect(d).toEqual({ kind: 'team', headId: 'headA', name: 'Asha', from: 'studio', label: null });
    expect(routedLine(d)).toEqual({ kind: 'NOTE', summary: 'In Asha’s team pool (new leads go to Asha’s team)' });
    expect(describeRouting({ mode: 'TEAM', personId: 'headA', turnIds: [] }, people, true)).toMatch(/Asha’s team pool/);
  });

  it('a head who cannot have a pool (suspended, not sales) falls to the studio pool', async () => {
    const { effectiveRule, routeLead } = await import('@/modules/studio-sales/lead-routing');
    for (const head of ['gone', 'pm', 'nobody']) {
      const d = routeLead(effectiveRule({ mode: 'TEAM', personId: head, turnIds: [] }, null), people, true);
      expect(d.kind, head).toBe('pool');
    }
  });

  it('a door may send its leads to a team pool; the checks refuse a non-salesperson', async () => {
    const { checkOverride, checkRouting, effectiveRule } = await import('@/modules/studio-sales/lead-routing');
    expect(checkRouting({ mode: 'TEAM', personId: 'headA' }, people, true)).toEqual({ ok: true, routing: { mode: 'TEAM', personId: 'headA', turnIds: [] } });
    expect(checkRouting({ mode: 'TEAM', personId: 'pm' }, people, true).ok).toBe(false);
    expect(checkOverride({ mode: 'TEAM', personId: 'headA' }, people, true)).toEqual({ ok: true, mode: 'TEAM', personId: 'headA' });
    expect(checkOverride({ mode: 'TEAM', personId: 'gone' }, people, true).ok).toBe(false);
    const rule = effectiveRule({ mode: 'POOL', personId: null, turnIds: [] }, { mode: 'TEAM', personId: 'headA', label: '99acres' });
    expect(rule).toMatchObject({ mode: 'TEAM', personId: 'headA', from: 'connection' });
  });
});

describe('the pool filter (found on the test site, 22 Oct 2026)', () => {
  it('"pool" is nobody: it never becomes assignedToId = "pool"', async () => {
    const { leadWhere } = await import('@/modules/studio-sales/lead-where');
    const text = JSON.stringify(leadWhere({ owner: 'pool' } as never, new Date('2026-10-22T06:00:00Z')));
    expect(text).toContain('"assignedToId":null');
    expect(text).not.toContain('"assignedToId":"pool"');
    const tab = JSON.stringify(leadWhere({ owner: 'pool', poolTeam: 'head1' } as never, new Date('2026-10-22T06:00:00Z')));
    expect(tab).toContain('"poolTeamId":"head1"');
    expect(tab).not.toContain('"assignedToId":"pool"');
  });
});
