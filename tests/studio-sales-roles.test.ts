import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { can, leadsVisibleTo, quotesVisibleTo, projectsVisibleTo, type StudioRoleName } from '@/modules/studio/roles';
import { pickSites, roleCan } from '@/modules/studio/team-rules';

/**
 * Studio OS Phase 1: the SALES role (docs/studio-os/PHASE-1-SALES.md §7,
 * "Answered by Sanyam" 2: a salesperson sees only their own leads). The
 * permission cells, the `where` every lead and quotation read carries, and
 * a fake database applying those filters the way Postgres would, so a
 * salesperson provably cannot read another studio's lead or a colleague's.
 */

const m = (role: StudioRoleName, id = 'm-me', studioId = 's1') => ({ id, studioId, role, status: 'ACTIVE' as const });

describe('what a salesperson may do', () => {
  const sales = m('SALES');

  it('works their own leads and quotations, and nothing of anyone else’s', () => {
    for (const a of ['lead.read', 'lead.edit', 'quote.write', 'quote.salesFinal'] as const) {
      expect(can(sales, a, { assigned: true }), a).toBe(true);
      expect(can(sales, a, { assigned: false }), a).toBe(false);
      expect(can(sales, a), a).toBe(false);
    }
  });

  it('cannot assign, merge, delete, import, see the pool, book or set payment stages', () => {
    for (const a of ['lead.assign', 'lead.merge', 'lead.delete', 'lead.import', 'lead.pool', 'booking.record', 'booking.refund', 'payments.template'] as const) {
      expect(can(sales, a, { assigned: true }), a).toBe(false);
    }
  });

  it('may add a lead (theirs) and nothing of projects, payments or rates', () => {
    expect(can(sales, 'lead.add')).toBe(true);
    for (const a of ['project.read', 'project.create', 'payment.read', 'payment.record', 'vendor.rates', 'team.manage'] as const) {
      expect(can(sales, a, { assigned: true }), a).toBe(false);
    }
    expect(projectsVisibleTo(sales)).toEqual({ id: { in: [] } });
    expect(projectsVisibleTo(sales, 'payments')).toEqual({ id: { in: [] } });
  });

  it('picks no sites on the team screen, and its role card reads off the table', () => {
    expect(pickSites('SALES')).toBe(false);
    expect(roleCan('SALES')).toEqual(['See leads', 'Work leads: calls, notes, floor plans', 'Add leads', 'Claim a lead from the pool', 'Write and send quotations', 'Mark the sales final', 'Log calls', 'Act on many leads at once']);
  });

  it('owner and PM see every lead and may assign, merge and delete', () => {
    for (const role of ['OWNER', 'PM'] as const) {
      for (const a of ['lead.read', 'lead.assign', 'lead.merge', 'lead.delete', 'booking.record'] as const) expect(can(m(role), a), `${role} ${a}`).toBe(true);
    }
    expect(can(m('PM'), 'payments.template')).toBe(false);
  });
});

describe('the where every read carries', () => {
  it('a salesperson: their own leads in their own studio', () => {
    expect(leadsVisibleTo(m('SALES'))).toEqual({ studioId: 's1', assignedToId: 'm-me' });
    expect(quotesVisibleTo(m('SALES'))).toEqual({ studioId: 's1', client: { assignedToId: 'm-me', deletedAt: null } });
  });

  it('owner and PM: the studio', () => {
    expect(leadsVisibleTo(m('OWNER'))).toEqual({ studioId: 's1' });
    expect(leadsVisibleTo(m('PM'))).toEqual({ studioId: 's1' });
    expect(quotesVisibleTo(m('PM'))).toEqual({ studioId: 's1' });
  });

  it('supervisor and accounts: nothing', () => {
    for (const role of ['SUPERVISOR', 'ACCOUNTS'] as const) {
      expect(leadsVisibleTo(m(role))).toEqual({ studioId: 's1', id: { in: [] } });
      expect(quotesVisibleTo(m(role))).toEqual({ studioId: 's1', id: { in: [] } });
    }
  });
});

// ── Against a fake database ────────────────────────────────────

type Lead = { id: string; studioId: string; assignedToId: string | null; deletedAt: Date | null; name: string };

const db = vi.hoisted(() => {
  const members: Record<string, { id: string; studioId: string; userId: string; role: string; status: string }> = {};
  const leads: Lead[] = [];
  /** A `where` as Postgres would apply it, for the keys the lead scope uses. */
  const matches = (l: Lead, w: Record<string, unknown>): boolean => {
    for (const [k, v] of Object.entries(w)) {
      if (k === 'id' && typeof v === 'object' && v !== null && 'in' in v) {
        if (!(v as { in: string[] }).in.includes(l.id)) return false;
      } else if ((l as Record<string, unknown>)[k] !== v) return false;
    }
    return true;
  };
  const client = {
    studioMember: {
      findUnique: vi.fn(async (a: { where: { userId: string } }) => members[a.where.userId] ?? null),
    },
    studioClient: {
      findFirst: vi.fn(async (a: { where: Record<string, unknown> }) => leads.find((l) => matches(l, a.where)) ?? null),
    },
  };
  return { client, members, leads };
});
vi.mock('@/lib/prisma', () => ({ prisma: db.client }));
const session = vi.hoisted(() => ({ userId: 'u-asha' }));
vi.mock('@/modules/auth/session', () => ({
  getCurrentUser: vi.fn(async () => ({ id: session.userId, role: 'STUDIO', email: null, phone: null, name: null })),
  hasRole: () => true,
}));

import { leadInScope, myLeadScope } from '@/modules/studio/lead-scope';

describe('a salesperson against the database', () => {
  beforeEach(() => {
    vi.stubEnv('DATABASE_URL', 'postgres://test');
    vi.stubEnv('SAMPLE_DATA_ONLY', '');
    Object.assign(db.members, {
      'u-asha': { id: 'm-asha', studioId: 's1', userId: 'u-asha', role: 'SALES', status: 'ACTIVE' },
      'u-ravi': { id: 'm-ravi', studioId: 's1', userId: 'u-ravi', role: 'SALES', status: 'ACTIVE' },
      'u-owner': { id: 'm-owner', studioId: 's1', userId: 'u-owner', role: 'OWNER', status: 'ACTIVE' },
      'u-gone': { id: 'm-gone', studioId: 's1', userId: 'u-gone', role: 'SALES', status: 'SUSPENDED' },
      'u-site': { id: 'm-site', studioId: 's1', userId: 'u-site', role: 'SUPERVISOR', status: 'ACTIVE' },
    });
    db.leads.length = 0;
    db.leads.push(
      { id: 'mine', studioId: 's1', assignedToId: 'm-asha', deletedAt: null, name: 'Asha’s lead' },
      { id: 'ravis', studioId: 's1', assignedToId: 'm-ravi', deletedAt: null, name: 'Ravi’s lead' },
      { id: 'pool', studioId: 's1', assignedToId: null, deletedAt: null, name: 'In the pool' },
      { id: 'other-studio', studioId: 's2', assignedToId: 'm-asha', deletedAt: null, name: 'Another studio’s lead' },
      { id: 'binned', studioId: 's1', assignedToId: 'm-asha', deletedAt: new Date(), name: 'Binned' },
    );
  });
  afterEach(() => vi.unstubAllEnvs());

  const asUser = async (user: string, leadId: string) => {
    session.userId = user;
    const scope = await myLeadScope();
    return scope ? leadInScope(scope, leadId) : null;
  };

  it('reads their own lead', async () => {
    expect(await asUser('u-asha', 'mine')).toMatchObject({ id: 'mine' });
  });

  it('never a colleague’s, the pool, another studio’s, or the bin', async () => {
    for (const id of ['ravis', 'pool', 'other-studio', 'binned']) expect(await asUser('u-asha', id), id).toBeNull();
  });

  it('the owner reads every lead of their studio, and still not another studio’s', async () => {
    for (const id of ['mine', 'ravis', 'pool']) expect(await asUser('u-owner', id), id).not.toBeNull();
    expect(await asUser('u-owner', 'other-studio')).toBeNull();
  });

  it('a suspended salesperson and a site supervisor get no lead scope at all', async () => {
    session.userId = 'u-gone';
    expect(await myLeadScope()).toBeNull();
    session.userId = 'u-site';
    expect(await myLeadScope()).toBeNull();
  });
});
