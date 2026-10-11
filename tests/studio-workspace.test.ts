import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The studio office's Projects list and project workspace (studio
 * workspace Phase 1): who may open what (through studio/access.ts), the
 * team's notes, and the pure rows and "Needs attention today" strip
 * (studio/workspace-view.ts). Prisma and the session are mocked.
 *
 * Studio s1: an owner, a PM and a supervisor on p1, the same supervisor
 * not on p2, an accounts member. p9 is another studio's.
 */

type Role = 'OWNER' | 'PM' | 'SUPERVISOR' | 'ACCOUNTS';

const db = vi.hoisted(() => {
  const members: Record<string, { id: string; studioId: string; userId: string; role: Role; status: 'ACTIVE' }> = {
    'u-owner': { id: 'm-owner', studioId: 's1', userId: 'u-owner', role: 'OWNER', status: 'ACTIVE' },
    'u-pm': { id: 'm-pm', studioId: 's1', userId: 'u-pm', role: 'PM', status: 'ACTIVE' },
    'u-sup': { id: 'm-sup', studioId: 's1', userId: 'u-sup', role: 'SUPERVISOR', status: 'ACTIVE' },
    'u-acc': { id: 'm-acc', studioId: 's1', userId: 'u-acc', role: 'ACCOUNTS', status: 'ACTIVE' },
  };
  const studios: Record<string, string> = { p1: 's1', p2: 's1', p9: 's2' };
  const assigned = new Set(['p1:m-pm', 'p1:m-sup']);
  const D = (s: string) => new Date(s);
  /** One row carrying every field any of the reads selects. */
  const row = (id: string) => ({
    id,
    startOn: D('2026-09-01T00:00:00Z'),
    totalDays: 100,
    doneStages: [],
    plan: 'BASIC',
    assuredRequestedAt: null,
    signedAt: D('2026-09-01T00:00:00Z'),
    contractPaise: BigInt(10_00_000_00),
    paymentPhases: [
      { label: 'Booking', pct: 40, amountPaise: 4_00_000_00 },
      { label: 'Handover', pct: 60, amountPaise: 6_00_000_00 },
    ],
    paidPhases: [],
    teamNotes: 'Parent at home: keep the site clean by 6 pm.',
    introduction: {
      studioId: studios[id],
      studio: { tradeName: 'Studio One', paymentPhases: null },
      brief: { userId: 'u-customer', society: 'Ivy Towers', locality: 'baner', propertyType: 'BHK_2', tier: 'PREMIUM', contactName: 'Priya Rao', user: { name: 'Priya' } },
    },
    stages: [
      { kind: 'DESIGN', name: 'Design', plannedEnd: D('2026-09-21T00:00:00Z'), actualEnd: D('2026-09-20T00:00:00Z'), items: [{ room: 'Whole home', label: 'Design signed off', doneAt: D('2026-09-20T00:00:00Z') }] },
      { kind: 'CIVIL', name: 'Civil', plannedEnd: D('2026-10-11T00:00:00Z'), actualEnd: null, items: [{ room: 'Kitchen', label: 'Dado tiling', doneAt: null }] },
      { kind: 'CARPENTRY', name: 'Carpentry', plannedEnd: D('2026-11-25T00:00:00Z'), actualEnd: null, items: [] },
      { kind: 'FINISH', name: 'Finishing', plannedEnd: D('2026-12-05T00:00:00Z'), actualEnd: null, items: [] },
      { kind: 'HANDOVER', name: 'Handover', plannedEnd: D('2026-12-10T00:00:00Z'), actualEnd: null, items: [] },
    ],
    updates: [],
    snags: [],
    decisions: [],
    documents: [],
    family: [],
    _count: { materials: 3 },
  });
  const client = {
    studioMember: { findUnique: vi.fn(async (a: { where: { userId: string } }) => members[a.where.userId] ?? null) },
    studioProjectMember: {
      findUnique: vi.fn(async (a: { where: { homeProjectId_memberId: { homeProjectId: string; memberId: string } } }) => {
        const k = a.where.homeProjectId_memberId;
        return assigned.has(`${k.homeProjectId}:${k.memberId}`) ? { id: 'spm' } : null;
      }),
    },
    homeProject: {
      findUnique: vi.fn(async (a: { where: { id: string } }) => (studios[a.where.id] ? row(a.where.id) : null)),
      findMany: vi.fn(async (_a: unknown) => [row('p1')]),
      update: vi.fn(async (_a: unknown) => ({})),
    },
    homeDecision: { findMany: vi.fn(async () => []) },
    homeSnag: { findMany: vi.fn(async () => []) },
    homeDocument: { findMany: vi.fn(async () => []) },
    dreamPin: { findMany: vi.fn(async () => []) },
    pushDevice: { count: vi.fn(async () => 1) },
  };
  return { client };
});
vi.mock('@/lib/prisma', () => ({ prisma: db.client }));

const state = vi.hoisted(() => ({ user: null as null | { id: string; role: 'STUDIO' | 'CUSTOMER' } }));
vi.mock('@/modules/auth/session', () => {
  const RANK = { CUSTOMER: 0, STUDIO: 1, OPS: 2, ADMIN: 3 } as const;
  return {
    getCurrentUser: vi.fn(async () => state.user),
    hasRole: (user: { role: keyof typeof RANK } | null, role: keyof typeof RANK) => !!user && RANK[user.role] >= RANK[role],
    requireRole: vi.fn(async () => {
      throw new Error('UNAUTHORISED');
    }),
  };
});
vi.mock('@/modules/notify/service', () => ({ notify: vi.fn(), notifyStudio: vi.fn() }));
vi.mock('@/modules/storage/site-photos', () => ({ MAX_PHOTOS_PER_UPDATE: 6, signedSitePhotoUrls: vi.fn(async () => []), storeSitePhoto: vi.fn() }));
vi.mock('@/modules/storage/project-docs', () => ({ signedDocUrls: vi.fn(async () => []), storeProjectDoc: vi.fn() }));

import { projectWorkspace, saveTeamNotes, studioProjects } from '@/modules/studio/workspace';
import { attentionToday, homeLabel, sortRows, workspaceRow, type WorkspaceInput } from '@/modules/studio/workspace-view';

const as = (userId: string, role: 'STUDIO' | 'CUSTOMER' = 'STUDIO') => {
  state.user = { id: userId, role };
};
const NOW = new Date('2026-10-14T06:30:00Z'); // 12:00 in Pune

beforeEach(() => {
  vi.stubEnv('DATABASE_URL', 'postgres://test');
  state.user = null;
  db.client.homeProject.update.mockClear();
  db.client.homeProject.findMany.mockClear();
});

describe('who may open a project’s workspace', () => {
  it('a supervisor cannot open a project they are not on', async () => {
    as('u-sup');
    expect(await projectWorkspace('p2', NOW)).toEqual({ ok: false, error: 'That project is not one of yours.' });
  });

  it('nobody opens another studio’s project, not even its owner', async () => {
    as('u-owner');
    expect(await projectWorkspace('p9', NOW)).toEqual({ ok: false, error: 'That project is not one of yours.' });
  });

  it('accounts reads payments, not the project workspace', async () => {
    as('u-acc');
    expect((await projectWorkspace('p1', NOW)).ok).toBe(false);
  });

  it('a customer, or nobody signed in, is turned away', async () => {
    expect(await projectWorkspace('p1', NOW)).toEqual({ ok: false, error: 'Sign in as your studio first.' });
    as('u-customer', 'CUSTOMER');
    expect((await projectWorkspace('p1', NOW)).ok).toBe(false);
  });

  it('the owner, and the PM and supervisor on it, open it', async () => {
    for (const u of ['u-owner', 'u-pm', 'u-sup']) {
      as(u);
      const r = await projectWorkspace('p1', NOW);
      expect(r.ok, u).toBe(true);
    }
  });

  it('shows a supervisor no money and no notes editor', async () => {
    as('u-sup');
    const r = await projectWorkspace('p1', NOW);
    if (!r.ok) throw new Error(r.error);
    expect(r.workspace.contractPaise).toBeNull();
    expect(r.workspace.row.nextPayment).toBeNull();
    expect(r.workspace.canEditNotes).toBe(false);
  });

  it('builds the workspace from the record: header, plan, and the customer’s own view', async () => {
    as('u-owner');
    const r = await projectWorkspace('p1', NOW);
    if (!r.ok) throw new Error(r.error);
    const w = r.workspace;
    expect(w).toMatchObject({ home: 'Ivy Towers, Baner, 2 BHK', customer: 'Priya Rao', customerFirst: 'Priya', tier: 'Premium', bhk: '2 BHK', contractPaise: 10_00_000_00, plan: 'basic', appConnected: true, hasPlan: true, materials: 3, canEditNotes: true });
    expect(w.stages.map((s) => [s.label, s.state])).toEqual([
      ['Design', 'done'],
      ['Civil', 'now'],
      ['Carpentry', 'next'],
      ['Finishing', 'later'],
      ['Handover', 'later'],
    ]);
    expect(w.stages[1]!.rooms).toEqual([{ room: 'Kitchen', items: [{ label: 'Dado tiling', done: false }] }]);
    // The panel is the customer projection: the same stages the app gets, and no team notes.
    expect(w.customerView!.stages.map((s) => s.key)).toEqual(['DESIGN', 'SITE', 'INSTALL', 'FINISH', 'HANDOVER']);
    expect(JSON.stringify(w.customerView)).not.toContain('keep the site clean');
  });
});

describe('the team’s notes', () => {
  it('are written by the owner or the PM on the project (plan.edit)', async () => {
    for (const u of ['u-owner', 'u-pm']) {
      as(u);
      expect(await saveTeamNotes('p1', '  Call before 10 am.  ')).toEqual({ ok: true });
    }
    expect(db.client.homeProject.update).toHaveBeenLastCalledWith({ where: { id: 'p1' }, data: { teamNotes: 'Call before 10 am.' } });
  });

  it('are not written by a supervisor, even on their own site, nor by anyone off the project', async () => {
    as('u-sup');
    expect((await saveTeamNotes('p1', 'x')).ok).toBe(false);
    as('u-pm');
    expect(await saveTeamNotes('p2', 'x')).toEqual({ ok: false, error: 'That project is not one of yours.' });
    expect(db.client.homeProject.update).not.toHaveBeenCalled();
  });
});

describe('the Projects list', () => {
  it('lists only what the member may see', async () => {
    as('u-sup');
    const r = await studioProjects(NOW);
    const where = (db.client.homeProject.findMany.mock.calls[0]![0] as { where: unknown }).where;
    expect(JSON.stringify(where)).toContain('m-sup');
    expect(r!.seesMoney).toBe(false);
    expect(r!.rows[0]!.nextPayment).toBeNull();
  });

  it('is nothing for someone who is not a studio member', async () => {
    as('u-customer', 'CUSTOMER');
    expect(await studioProjects(NOW)).toBeNull();
  });
});

describe('workspace rows and the attention strip', () => {
  const base: WorkspaceInput = {
    id: 'p1',
    home: 'Ivy Towers, Baner, 2 BHK',
    customer: 'Priya',
    startOn: new Date('2026-08-01T00:00:00Z'),
    totalDays: 100,
    doneStages: ['DESIGN'],
    stages: [],
    plan: 'ASSURED',
    contractPaise: 10_00_000_00,
    paymentPhases: [
      { label: 'Booking', pct: 40, amountPaise: 4_00_000_00 },
      { label: 'Handover', pct: 60, amountPaise: 6_00_000_00 },
    ],
    paidPhases: [{ index: 0, dueOn: '2026-10-10' }],
    lastUpdateAt: null,
    snags: [
      { title: 'Chipped shutter', room: 'Kitchen', status: 'OPEN', fixBy: new Date('2026-10-12T12:00:00Z') },
      { title: 'Switch off-centre', room: null, status: 'OPEN', fixBy: new Date('2026-10-20T12:00:00Z') },
    ],
    decisions: [{ title: 'Shutter finish', dueOn: new Date('2026-10-16T18:29:00Z'), chosenIndex: null }],
  };

  it('works out the row from the record', () => {
    const r = workspaceRow(base, NOW);
    expect(r.plan).toBe('assured');
    expect(r.stage).toMatchObject({ label: 'Factory production' });
    expect(r.postedToday).toBeNull();
    expect(r.lateDays).toBe(29); // factory production was due 15 Sep
    expect(r.snags.open).toBe(2);
    expect(r.snags.overdue.map((s) => s.title)).toEqual(['Chipped shutter']);
    expect(r.waiting).toEqual([{ title: 'Shutter finish', dueOn: base.decisions[0]!.dueOn, overdue: false }]);
    expect(r.nextPayment).toEqual({ label: 'Booking', amountPaise: 4_00_000_00, dueOn: '2026-10-10', toRecord: true });
  });

  it('counts an update posted today in India time, not UTC', () => {
    expect(workspaceRow({ ...base, lastUpdateAt: new Date('2026-10-13T20:00:00Z') }, NOW).postedToday).not.toBeNull(); // 1:30 am IST on the 14th
    expect(workspaceRow({ ...base, lastUpdateAt: new Date('2026-10-13T18:00:00Z') }, NOW).postedToday).toBeNull(); // 11:30 pm IST on the 13th
  });

  it('puts every kind of attention in the strip, the customer’s waits marked as not the studio’s delay', () => {
    const a = attentionToday([workspaceRow(base, NOW)]);
    expect(a.map((x) => x.kind)).toEqual(['no-update', 'snag-overdue', 'payment', 'waiting']);
    expect(a[3]!.text).toContain('not counted against you');
    expect(a[2]!.text).toContain('₹4,00,000');
  });

  it('asks nothing of a site that posted today, owes nothing and waits on nobody', () => {
    const calm = workspaceRow({ ...base, lastUpdateAt: new Date('2026-10-14T04:00:00Z'), snags: [], decisions: [], paidPhases: [] }, NOW);
    expect(attentionToday([calm])).toEqual([]);
  });

  it('asks for no update from a handed-over home', () => {
    const done = workspaceRow({ ...base, doneStages: ['DESIGN', 'PRODUCTION', 'SITE', 'INSTALL', 'FINISH', 'HANDOVER'], snags: [], decisions: [], paidPhases: [] }, NOW);
    expect(done.stage).toBeNull();
    expect(attentionToday([done])).toEqual([]);
    expect(sortRows([done, workspaceRow(base, NOW)]).map((r) => r.stage === null)).toEqual([false, true]);
  });

  it('names the home from the brief', () => {
    expect(homeLabel({ society: null, locality: null, propertyType: null })).toBe('A home');
    expect(homeLabel({ society: 'Rohan Leher', locality: 'balewadi', propertyType: 'BHK_4_PLUS' })).toBe('Rohan Leher, Balewadi, 4+ BHK');
  });
});
