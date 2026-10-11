import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The permission table, enforced against the database (modules/studio/
 * access.ts) and in the studio-side writers of a customer's project
 * (portal/project-store.ts, portal/tracker-store.ts) and vendor reads
 * (studio-practice/vendors.ts). Prisma and the session are mocked; no
 * database. The pure table itself is tests/studio-roles.test.ts.
 *
 * One studio (s1) with an owner, a PM, a supervisor, an accounts member and
 * a suspended member; two of its projects (p1, on which the PM and the
 * supervisor are assigned, and p2, on which nobody is); and p9, another
 * studio's project.
 */

type Role = 'OWNER' | 'PM' | 'SUPERVISOR' | 'ACCOUNTS';
type Status = 'INVITED' | 'ACTIVE' | 'SUSPENDED';
type User = { id: string; role: 'CUSTOMER' | 'STUDIO' | 'OPS' | 'ADMIN' };

const db = vi.hoisted(() => {
  const members: Record<string, { id: string; studioId: string; userId: string; role: Role; status: Status }> = {
    'u-owner': { id: 'm-owner', studioId: 's1', userId: 'u-owner', role: 'OWNER', status: 'ACTIVE' },
    'u-pm': { id: 'm-pm', studioId: 's1', userId: 'u-pm', role: 'PM', status: 'ACTIVE' },
    'u-sup': { id: 'm-sup', studioId: 's1', userId: 'u-sup', role: 'SUPERVISOR', status: 'ACTIVE' },
    'u-acc': { id: 'm-acc', studioId: 's1', userId: 'u-acc', role: 'ACCOUNTS', status: 'ACTIVE' },
    'u-gone': { id: 'm-gone', studioId: 's1', userId: 'u-gone', role: 'OWNER', status: 'SUSPENDED' },
  };
  const projects: Record<string, string> = { p1: 's1', p2: 's1', p9: 's2' };
  const assigned = new Set(['p1:m-pm', 'p1:m-sup']);
  const calls: { op: string; args: unknown }[] = [];
  const rec = (op: string, fn: (args: never) => unknown) =>
    vi.fn(async (args: never) => {
      calls.push({ op, args });
      return fn(args);
    });
  const project = (id: string) =>
    projects[id]
      ? {
          introduction: { studioId: projects[id], studio: { tradeName: 'Studio One' }, brief: { userId: 'u-customer' } },
          contractPaise: BigInt(1_00_000_00),
          paymentPhases: [
            { label: 'Booking', pct: 50, amountPaise: 50_000_00 },
            { label: 'Handover', pct: 50, amountPaise: 50_000_00 },
          ],
          paidPhases: [],
          doneStages: [],
          // Phase 5: money is counted from payment rows and quote changes.
          payments: [],
          quoteChanges: [],
        }
      : null;
  const client = {
    studioMember: {
      findUnique: rec('studioMember.findUnique', (a: { where: { userId: string } }) => members[a.where.userId] ?? null),
    },
    studioProjectMember: {
      findUnique: rec('studioProjectMember.findUnique', (a: { where: { homeProjectId_memberId: { homeProjectId: string; memberId: string } } }) => {
        const k = a.where.homeProjectId_memberId;
        return assigned.has(`${k.homeProjectId}:${k.memberId}`) ? { id: 'spm' } : null;
      }),
    },
    homeProject: {
      findUnique: rec('homeProject.findUnique', (a: { where: { id: string } }) => project(a.where.id)),
      findMany: rec('homeProject.findMany', () => []),
      update: rec('homeProject.update', () => ({})),
    },
    homeSnag: {
      findUnique: rec('homeSnag.findUnique', (a: { where: { id: string } }) => ({
        id: a.where.id,
        projectId: a.where.id.replace('snag-', ''),
        title: 'Chipped shutter',
        status: 'OPEN',
        // Phase 4: the snag's events (none here: the flow rebuilds them from the legacy columns).
        createdAt: new Date('2026-10-01T00:00:00Z'),
        fixBy: null,
        fixedAt: null,
        fixedNote: null,
        photoPaths: [],
        fixedPhotoPaths: [],
        raisedByStudio: false,
        assigneeId: null,
        room: null,
        events: [],
      })),
      findMany: rec('homeSnag.findMany', () => []),
      update: rec('homeSnag.update', () => ({})),
      create: rec('homeSnag.create', () => ({ id: 'snag-new' })),
    },
    homeDecision: {
      findMany: rec('homeDecision.findMany', () => []),
      create: rec('homeDecision.create', () => ({ id: 'd-new' })),
    },
    homeDocument: { findMany: rec('homeDocument.findMany', () => []), findUnique: rec('homeDocument.findUnique', () => null) },
    homeProjectUpdate: { create: rec('homeProjectUpdate.create', () => ({ project: project('p1') })) },
    homeProjectStage: { updateMany: rec('homeProjectStage.updateMany', () => ({ count: 0 })) },
    // Phase 4: snag steps run in an interactive transaction (project/snag-flow.ts).
    homeSnagEvent: {
      findMany: rec('homeSnagEvent.findMany', () => []),
      create: rec('homeSnagEvent.create', () => ({ id: 'se-new' })),
    },
    // Phase 5: a payment row, written after locking the project row.
    homeProjectPayment: { create: rec('homeProjectPayment.create', () => ({ id: 'pay-new' })) },
    $queryRaw: vi.fn(async () => []),
    homeProjectEvent: {
      create: rec('homeProjectEvent.create', () => ({ id: 'pe-new' })),
      createMany: rec('homeProjectEvent.createMany', () => ({ count: 1 })),
    },
    $transaction: vi.fn(async (ops: Promise<unknown>[] | ((tx: unknown) => Promise<unknown>)) =>
      typeof ops === 'function' ? ops(client) : Promise.all(ops),
    ),
    dreamPin: { findMany: rec('dreamPin.findMany', () => []) },
    studioVendor: { findMany: rec('studioVendor.findMany', () => []) },
    studioWorkOrder: { findMany: rec('studioWorkOrder.findMany', () => []) },
  };
  return { client, calls, members };
});
vi.mock('@/lib/prisma', () => ({ prisma: db.client }));

const state = vi.hoisted(() => ({ user: null as null | User }));
vi.mock('@/modules/auth/session', () => {
  const RANK = { CUSTOMER: 0, STUDIO: 1, OPS: 2, ADMIN: 3 } as const;
  return {
    getCurrentUser: vi.fn(async () => state.user),
    hasRole: (user: User | null, role: keyof typeof RANK) => !!user && RANK[user.role] >= RANK[role],
    requireRole: vi.fn(async () => {
      throw new Error('UNAUTHORISED');
    }),
  };
});
vi.mock('@/modules/notify/service', () => ({ notify: vi.fn(async () => undefined), notifyStudio: vi.fn(async () => undefined) }));
vi.mock('@/modules/storage/site-photos', () => ({
  MAX_PHOTOS_PER_UPDATE: 6,
  signedSitePhotoUrls: vi.fn(async () => []),
  storeSitePhoto: vi.fn(async () => ({ ok: true, path: 'x' })),
}));
vi.mock('@/modules/storage/project-docs', () => ({
  signedDocUrls: vi.fn(async () => []),
  storeProjectDoc: vi.fn(async () => ({ ok: true, path: 'doc' })),
}));

/** Phase 4: marking a snag fixed needs the after photo. */
const AFTER = [new File([new Uint8Array([1, 2, 3])], 'after.jpg', { type: 'image/jpeg' })];

import { accessTo, assertCan, currentMember, memberFor, StudioAccessError } from '@/modules/studio/access';
import { addDocument, fixSnag, postDecision, projectWork, setPaymentStage } from '@/modules/portal/project-store';
import { postStudioUpdate, projectsForStudio, setStudioStageDone } from '@/modules/portal/tracker-store';
import { STAGE_KEYS } from '@/modules/portal/tracker';
import { myVendors } from '@/modules/studio-practice/vendors';

const as = (userId: string, role: User['role'] = 'STUDIO') => {
  state.user = { id: userId, role };
};
const ops = (op: string) => db.calls.filter((c) => c.op === op);
const NOT_YOURS = { ok: false, error: 'That project is not one of yours.' };
const NOT_YOUR_ROLE = { ok: false, error: 'Your role in the studio does not include that. Ask your studio owner.' };

beforeEach(() => {
  vi.stubEnv('DATABASE_URL', 'postgres://test');
  vi.stubEnv('SAMPLE_DATA_ONLY', '');
  db.calls.length = 0;
  state.user = null;
});

describe('access.ts', () => {
  it('finds a member by user, and the signed-in member only on the STUDIO side', async () => {
    expect((await memberFor('u-pm'))?.role).toBe('PM');
    expect(await memberFor('nobody')).toBeNull();
    as('u-pm', 'CUSTOMER');
    expect(await currentMember()).toBeNull();
    as('u-pm');
    expect((await currentMember())?.id).toBe('m-pm');
  });

  it('refuses every role on another studio’s project, the owner included', async () => {
    expect(await accessTo(db.members['u-owner']!, 'p9')).toBeNull();
    expect(await accessTo(db.members['u-owner']!, 'gone')).toBeNull();
  });

  it('does not look up an assignment for the owner', async () => {
    const access = await accessTo(db.members['u-owner']!, 'p2');
    expect(access?.may('vendor.rates')).toBe(true);
    expect(ops('studioProjectMember.findUnique')).toHaveLength(0);
  });

  it('lets a supervisor read their own site and not an unassigned one', async () => {
    expect((await accessTo(db.members['u-sup']!, 'p1'))?.may('project.read')).toBe(true);
    expect((await accessTo(db.members['u-sup']!, 'p2'))?.may('project.read')).toBe(false);
  });

  it('assertCan throws for a refused action and passes an allowed one', async () => {
    await expect(assertCan(db.members['u-sup']!, 'project.read', 'p2')).rejects.toBeInstanceOf(StudioAccessError);
    await expect(assertCan(db.members['u-pm']!, 'vendor.rates')).rejects.toBeInstanceOf(StudioAccessError);
    await expect(assertCan(null, 'project.read', 'p1')).rejects.toBeInstanceOf(StudioAccessError);
    await expect(assertCan(db.members['u-pm']!, 'decision.create', 'p1')).resolves.toBeUndefined();
    await expect(assertCan(db.members['u-acc']!, 'payment.record', 'p2')).resolves.toBeUndefined();
  });
});

describe('the customer project writers (project-store.ts)', () => {
  it('lets the owner fix a snag on any project of the studio, as before', async () => {
    as('u-owner');
    expect(await fixSnag('snag-p2', 'Replaced', AFTER)).toEqual({ ok: true, id: 'snag-p2' });
    expect(ops('homeSnag.update')).toHaveLength(1);
  });

  it('refuses the owner on another studio’s project', async () => {
    as('u-owner');
    expect(await fixSnag('snag-p9', 'Replaced', [])).toEqual(NOT_YOURS);
    expect(ops('homeSnag.update')).toHaveLength(0);
  });

  it('refuses a supervisor anything on an unassigned project, reading included', async () => {
    as('u-sup');
    expect(await fixSnag('snag-p2', 'Replaced', [])).toEqual(NOT_YOURS);
    expect(await projectWork('p2')).toBeNull();
    expect(ops('homeSnag.update')).toHaveLength(0);
  });

  it('lets a supervisor fix a snag on their own site, and nothing a PM decides', async () => {
    as('u-sup');
    expect(await fixSnag('snag-p1', 'Replaced', AFTER)).toEqual({ ok: true, id: 'snag-p1' });
    expect(await postDecision('p1', { title: 'Laminate', why: 'Cutting next week', dueOn: '2026-12-01', options: [] })).toEqual(NOT_YOUR_ROLE);
    expect(await setPaymentStage('p1', 0, { paidOn: '2026-10-11' })).toEqual(NOT_YOUR_ROLE);
    expect(await addDocument('p1', { kind: 'DRAWINGS', title: 'Kitchen' }, null)).toEqual(NOT_YOUR_ROLE);
    expect(ops('homeDecision.create')).toHaveLength(0);
    expect(ops('homeProject.update')).toHaveLength(0);
  });

  it('gives a supervisor their site without its money', async () => {
    as('u-sup');
    const work = await projectWork('p1');
    expect(work).not.toBeNull();
    expect(work!.money).toBeNull();
  });

  it('lets a PM set when a payment is due on their project, but not mark it received', async () => {
    as('u-pm');
    expect(await setPaymentStage('p1', 0, { dueOn: '2026-11-01' })).toEqual({ ok: true });
    expect(await setPaymentStage('p1', 0, { paidOn: '2026-11-01' })).toEqual(NOT_YOUR_ROLE);
    expect(await setPaymentStage('p2', 0, { dueOn: '2026-11-01' })).toEqual(NOT_YOURS);
    expect(ops('homeProject.update')).toHaveLength(1);
  });

  it('lets accounts mark payments received on every project, and see only the money', async () => {
    as('u-acc');
    expect(await setPaymentStage('p2', 0, { paidOn: '2026-10-11' })).toEqual({ ok: true });
    const work = await projectWork('p2');
    expect(work?.money?.stages).toHaveLength(2);
    expect(work).toMatchObject({ dream: [], documents: [], decisions: [], snags: [] });
    expect(ops('homeSnag.findMany')).toHaveLength(0);
    expect(ops('homeDocument.findMany')).toHaveLength(0);
    expect(await fixSnag('snag-p2', 'Replaced', [])).toEqual(NOT_YOUR_ROLE);
  });

  it('refuses a suspended member everything, even an owner', async () => {
    as('u-gone');
    expect(await fixSnag('snag-p1', 'Replaced', [])).toEqual(NOT_YOURS);
    expect(await setPaymentStage('p1', 0, { paidOn: '2026-10-11' })).toEqual(NOT_YOURS);
    expect(await projectWork('p1')).toBeNull();
  });

  it('still lets ops act on any project', async () => {
    as('u-ops', 'OPS');
    expect(await fixSnag('snag-p9', 'Replaced', AFTER)).toEqual({ ok: true, id: 'snag-p9' });
  });
});

describe('the tracker writers (tracker-store.ts)', () => {
  it('lets a supervisor post and tick on their own site only', async () => {
    as('u-sup');
    expect(await setStudioStageDone('p1', STAGE_KEYS[0], true)).toEqual({ ok: true });
    expect(await setStudioStageDone('p2', STAGE_KEYS[0], true)).toEqual(NOT_YOURS);
    expect(await postStudioUpdate('p2', 'Carcasses delivered', null)).toEqual(NOT_YOURS);
  });

  it('refuses accounts an update', async () => {
    as('u-acc');
    expect(await postStudioUpdate('p1', 'Carcasses delivered', null)).toEqual(NOT_YOUR_ROLE);
  });

  it('lists only the projects a member may read', async () => {
    as('u-sup');
    await projectsForStudio();
    as('u-owner');
    await projectsForStudio();
    as('u-acc');
    await projectsForStudio();
    const wheres = ops('homeProject.findMany').map((c) => (c.args as { where: unknown }).where);
    expect(wheres).toEqual([
      { introduction: { studioId: 's1' }, team: { some: { memberId: 'm-sup' } } },
      { introduction: { studioId: 's1' } },
      { id: { in: [] } },
    ]);
  });
});

describe('vendor rates (studio-practice/vendors.ts)', () => {
  it('are read for the owner and never for a PM or accounts', async () => {
    as('u-pm');
    expect(await myVendors()).toEqual([]);
    as('u-acc');
    expect(await myVendors()).toEqual([]);
    expect(ops('studioVendor.findMany')).toHaveLength(0);
    as('u-owner');
    await myVendors();
    expect(ops('studioVendor.findMany')).toHaveLength(1);
  });
});
