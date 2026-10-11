import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Snags, written (modules/project/snag-flow.ts), against a small in-memory
 * stand-in for Prisma (no database). What a real studio could get wrong:
 *
 * - a snag cannot close on the studio's tap alone — only the customer's
 *   confirm, or seven days after the fix;
 * - mark fixed needs the after photo;
 * - dispute needs a reason, and stays open;
 * - "not fixed" reopens it and goes back to the studio;
 * - the seven-day close is written once, by the cron, and tells the customer;
 * - a supervisor fixes but does not accept (studio/roles.ts);
 * - two taps racing on the same state write one step;
 * - the last payment cannot be due while a snag is open.
 */

type Role = 'OWNER' | 'PM' | 'SUPERVISOR' | 'ACCOUNTS';
type User = { id: string; role: 'CUSTOMER' | 'STUDIO' | 'OPS' | 'ADMIN' };
type Row = Record<string, unknown> & { id: string };

const db = vi.hoisted(() => {
  const state = {
    snags: [] as Row[],
    snagEvents: [] as Row[],
    projectEvents: [] as Row[],
    projectUpdates: 0,
  };
  const members: Record<string, { id: string; studioId: string; userId: string; role: Role; status: 'ACTIVE' | 'SUSPENDED'; createdAt: Date; user: { name: string } }> = {
    'u-owner': { id: 'm-owner', studioId: 's1', userId: 'u-owner', role: 'OWNER', status: 'ACTIVE', createdAt: new Date(1), user: { name: 'Neha' } },
    'u-pm': { id: 'm-pm', studioId: 's1', userId: 'u-pm', role: 'PM', status: 'ACTIVE', createdAt: new Date(2), user: { name: 'Pooja' } },
    'u-sup': { id: 'm-sup', studioId: 's1', userId: 'u-sup', role: 'SUPERVISOR', status: 'ACTIVE', createdAt: new Date(3), user: { name: 'Ramesh' } },
    'u-sup2': { id: 'm-sup2', studioId: 's1', userId: 'u-sup2', role: 'SUPERVISOR', status: 'ACTIVE', createdAt: new Date(4), user: { name: 'Imran' } },
    'u-acc': { id: 'm-acc', studioId: 's1', userId: 'u-acc', role: 'ACCOUNTS', status: 'ACTIVE', createdAt: new Date(5), user: { name: 'Asha' } },
  };
  const assigned = new Set(['p1:m-pm', 'p1:m-sup']);
  const project = (id: string) =>
    id === 'p1'
      ? {
          id: 'p1',
          introduction: { studioId: 's1', studio: { tradeName: 'Teakline' }, brief: { userId: 'u-customer', user: { locale: 'mr-IN' } } },
          contractPaise: BigInt(10_00_000_00),
          paymentPhases: [
            { label: 'Booking', pct: 40, amountPaise: 4_00_000_00 },
            { label: 'Carpentry', pct: 40, amountPaise: 4_00_000_00 },
            { label: 'Handover', pct: 20, amountPaise: 2_00_000_00 },
          ],
          paidPhases: [],
        }
      : null;
  let seq = 0;
  const id = (p: string) => `${p}${++seq}`;
  const eventsOf = (snagId: string) => state.snagEvents.filter((e) => e.snagId === snagId).sort((a, b) => (a.at as Date).getTime() - (b.at as Date).getTime());
  const withEvents = (s: Row) => ({ ...s, events: eventsOf(s.id), project: { introduction: project(s.projectId as string)!.introduction } });

  const client = {
    homeProject: {
      findUnique: vi.fn(async (a: { where: { id: string } }) => {
        const p = project(a.where.id);
        return p ? { ...p, family: [] } : null;
      }),
      update: vi.fn(async () => {
        state.projectUpdates += 1;
        return {};
      }),
    },
    homeSnag: {
      findUnique: vi.fn(async (a: { where: { id: string } }) => {
        const s = state.snags.find((x) => x.id === a.where.id);
        return s ? withEvents(s) : null;
      }),
      findMany: vi.fn(async (a: { where: { projectId?: string; status?: string; fixedAt?: { lte: Date } } }) =>
        state.snags
          .filter((s) => (a.where.projectId ? s.projectId === a.where.projectId : true))
          .filter((s) => (a.where.status ? s.status === a.where.status : true))
          .filter((s) => (a.where.fixedAt ? s.fixedAt !== null && (s.fixedAt as Date) <= a.where.fixedAt.lte : true))
          .map(withEvents),
      ),
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        const row = { id: id('snag'), createdAt: new Date(), fixBy: null, fixedAt: null, fixedNote: null, fixedPhotoPaths: [], assigneeId: null, ...a.data };
        state.snags.push(row);
        return { id: row.id };
      }),
      update: vi.fn(async (a: { where: { id: string }; data: Record<string, unknown> }) => {
        const s = state.snags.find((x) => x.id === a.where.id)!;
        Object.assign(s, a.data);
        return { id: s.id };
      }),
    },
    homeSnagEvent: {
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        const row = { id: id('se'), at: new Date(), photoPaths: [], fixBy: null, assigneeId: null, customerText: null, note: null, internalNote: null, ...a.data };
        state.snagEvents.push(row);
        return { id: row.id };
      }),
      findMany: vi.fn(async (a: { where: { snagId: string } }) => eventsOf(a.where.snagId)),
    },
    homeProjectEvent: {
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        const row = { id: id('pe'), ...a.data };
        state.projectEvents.push(row);
        return { id: row.id };
      }),
      createMany: vi.fn(async (a: { data: Record<string, unknown>[] }) => {
        let count = 0;
        for (const d of a.data) {
          if (d.dedupeKey && state.projectEvents.some((e) => e.dedupeKey === d.dedupeKey)) continue;
          state.projectEvents.push({ id: id('pe'), ...d });
          count += 1;
        }
        return { count };
      }),
    },
    studioMember: {
      findUnique: vi.fn(async (a: { where: { userId?: string; id?: string } }) => {
        if (a.where.userId) return members[a.where.userId] ?? null;
        return Object.values(members).find((m) => m.id === a.where.id) ?? null;
      }),
      findMany: vi.fn(
        async (a: { where: { studioId: string; OR: unknown } }) =>
          Object.values(members).filter(
            (m) => m.studioId === a.where.studioId && m.status === 'ACTIVE' && (m.role === 'OWNER' || ((m.role === 'PM' || m.role === 'SUPERVISOR') && assigned.has(`p1:${m.id}`))),
          ),
      ),
    },
    studioProjectMember: {
      findUnique: vi.fn(async (a: { where: { homeProjectId_memberId: { homeProjectId: string; memberId: string } } }) => {
        const k = a.where.homeProjectId_memberId;
        return assigned.has(`${k.homeProjectId}:${k.memberId}`) ? { id: 'spm' } : null;
      }),
    },
    /* An interactive transaction that rolls back on a throw, like the real one. */
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const snapshot = structuredClone({ snags: state.snags, snagEvents: state.snagEvents, projectEvents: state.projectEvents });
      try {
        return await fn(client);
      } catch (e) {
        state.snags = snapshot.snags;
        state.snagEvents = snapshot.snagEvents;
        state.projectEvents = snapshot.projectEvents;
        throw e;
      }
    }),
  };
  return { client, state, members, reset: () => ((state.snags = []), (state.snagEvents = []), (state.projectEvents = []), (state.projectUpdates = 0), (seq = 0)) };
});
vi.mock('@/lib/prisma', () => ({ prisma: db.client }));

const session = vi.hoisted(() => ({ user: null as null | User }));
vi.mock('@/modules/auth/session', () => {
  const RANK = { CUSTOMER: 0, STUDIO: 1, OPS: 2, ADMIN: 3 } as const;
  return {
    getCurrentUser: vi.fn(async () => session.user),
    hasRole: (user: User | null, role: keyof typeof RANK) => !!user && RANK[user.role] >= RANK[role],
    requireRole: vi.fn(async () => {
      throw new Error('UNAUTHORISED');
    }),
  };
});
const notified = vi.hoisted(() => [] as { to: string; kind: string }[]);
vi.mock('@/modules/notify/service', () => ({
  notify: vi.fn(async (to: string, e: { kind: string }) => void notified.push({ to, kind: e.kind })),
  notifyStudio: vi.fn(async (studioId: string, e: { kind: string }) => void notified.push({ to: `studio:${studioId}`, kind: e.kind })),
}));
vi.mock('@/modules/storage/site-photos', () => ({
  MAX_PHOTOS_PER_UPDATE: 6,
  signedSitePhotoUrls: vi.fn(async () => []),
  storeSitePhoto: vi.fn(async () => ({ ok: true, path: `project_p1/${Math.random().toString(36).slice(2)}.jpg` })),
}));
vi.mock('@/modules/storage/project-docs', () => ({ signedDocUrls: vi.fn(async () => []), storeProjectDoc: vi.fn() }));

import {
  acceptSnag,
  autoCloseSnags,
  confirmSnag,
  disputeSnag,
  markSnagFixed,
  openSnagsOn,
  raiseHandoverSnags,
  raiseSnagAsCustomer,
  reportNotFixed,
  SNAG_ERRORS,
} from '@/modules/project/snag-flow';
import { snagStatus } from '@/modules/project/snag-status';
import { setPaymentStage } from '@/modules/portal/project-store';

const as = (userId: string, role: User['role'] = 'STUDIO') => {
  session.user = { id: userId, role };
};
const photo = () => new File([new Uint8Array([1, 2, 3])], 'p.jpg', { type: 'image/jpeg' });
const T0 = new Date('2026-10-12T05:00:00Z'); // Mon 12 Oct, 10:30 IST
const later = (days: number) => new Date(T0.getTime() + days * 86_400_000);
const NOT_YOUR_ROLE = { ok: false, error: 'Your role in the studio does not include that. Ask your studio owner.' };
const NOT_YOURS = { ok: false, error: 'That project is not one of yours.' };

const kinds = (snagId: string) => db.state.snagEvents.filter((e) => e.snagId === snagId).map((e) => e.kind);
const status = (snagId: string, now: Date) => snagStatus(db.state.snagEvents.filter((e) => e.snagId === snagId) as never, now);
const legacy = (snagId: string) => db.state.snags.find((s) => s.id === snagId)!;

async function raised(): Promise<string> {
  as('u-customer', 'CUSTOMER');
  const r = await raiseSnagAsCustomer('u-customer', 'p1', { title: 'Gap above the wardrobe', room: 'Bedroom 1' }, [photo()]);
  if (!r.ok) throw new Error(r.error);
  return r.id;
}
async function accepted(): Promise<string> {
  const id = await raised();
  as('u-pm');
  // An hour before T0, so a fix at T0 lands after it.
  const r = await acceptSnag(id, { fixBy: '2026-10-15', assigneeId: 'm-sup', internalNote: 'Add a filler strip' }, new Date(T0.getTime() - 3_600_000));
  if (!r.ok) throw new Error(r.error);
  return id;
}
async function fixed(at = T0): Promise<string> {
  const id = await accepted();
  as('u-sup');
  const r = await markSnagFixed(id, { photos: [photo()], text: 'Filler strip fitted above the wardrobe.' }, at);
  if (!r.ok) throw new Error(r.error);
  return id;
}

beforeEach(() => {
  // The clock stands two hours before T0, so rows stamped "now" (a raise) come before the steps the tests date.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(T0.getTime() - 2 * 3_600_000));
  vi.stubEnv('DATABASE_URL', 'postgres://test');
  vi.stubEnv('SAMPLE_DATA_ONLY', '');
  db.reset();
  notified.length = 0;
  session.user = null;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('raising', () => {
  it('the customer raises with a photo: the snag, its RAISED event and one project event; the studio hears', async () => {
    const id = await raised();
    expect(kinds(id)).toEqual(['RAISED']);
    expect(legacy(id).status).toBe('OPEN');
    expect(db.state.projectEvents.map((e) => e.type)).toEqual(['snag.raised']);
    expect(notified).toContainEqual({ to: 'studio:s1', kind: 'snag-raised' });
  });

  it('the customer must add a photo', async () => {
    as('u-customer', 'CUSTOMER');
    expect(await raiseSnagAsCustomer('u-customer', 'p1', { title: 'Gap above the wardrobe' }, [])).toEqual({ ok: false, error: SNAG_ERRORS.needsPhoto });
    expect(db.state.snags).toHaveLength(0);
  });

  it('nobody else raises on this customer’s project as the customer', async () => {
    expect(await raiseSnagAsCustomer('u-stranger', 'p1', { title: 'Gap above the wardrobe' }, [photo()])).toMatchObject({ ok: false });
  });

  it('the handover walk-through adds many at once, skipping empty lines, in one go', async () => {
    as('u-pm');
    const r = await raiseHandoverSnags('p1', [
      { title: 'Shutter rubbing', room: 'Kitchen' },
      { title: '', room: '' },
      { title: 'Switchboard off-centre', room: 'Bedroom 2' },
    ]);
    expect(r).toMatchObject({ ok: true });
    expect(db.state.snags).toHaveLength(2);
    expect(db.state.snags.every((s) => s.raisedByStudio === true)).toBe(true);
    expect(db.state.projectEvents.map((e) => (e.payload as { walkThrough?: boolean }).walkThrough)).toEqual([true, true]);
  });

  it('a walk-through line that is too short refuses the whole list', async () => {
    as('u-pm');
    expect(await raiseHandoverSnags('p1', [{ title: 'Shutter rubbing' }, { title: 'x', room: 'Hall' }])).toEqual({ ok: false, error: 'Line 2: Say what is wrong, in a few words.' });
    expect(db.state.snags).toHaveLength(0);
  });

  it('a supervisor cannot run the walk-through (snag.accept)', async () => {
    as('u-sup');
    expect(await raiseHandoverSnags('p1', [{ title: 'Shutter rubbing' }])).toEqual(NOT_YOUR_ROLE);
  });
});

describe('accepting and disputing (snag.accept)', () => {
  it('a PM on the project accepts with a fix-by date and who fixes it; the note stays inside', async () => {
    const id = await accepted();
    expect(kinds(id)).toEqual(['RAISED', 'ACCEPTED']);
    const ev = db.state.snagEvents.find((e) => e.kind === 'ACCEPTED')!;
    expect(ev).toMatchObject({ assigneeId: 'm-sup', internalNote: 'Add a filler strip', actorType: 'STUDIO', byId: 'u-pm' });
    expect(legacy(id)).toMatchObject({ status: 'OPEN', assigneeId: 'm-sup' });
    expect((legacy(id).fixBy as Date).toISOString()).toBe('2026-10-15T12:00:00.000Z');
    expect(notified).toContainEqual({ to: 'u-customer', kind: 'snag-accepted' });
    // The project event carries no notes.
    expect(JSON.stringify(db.state.projectEvents)).not.toContain('filler strip');
  });

  it('a supervisor cannot accept, even on their own site', async () => {
    const id = await raised();
    as('u-sup');
    expect(await acceptSnag(id, { fixBy: '2026-10-15', assigneeId: 'm-sup' }, T0)).toEqual(NOT_YOUR_ROLE);
    expect(kinds(id)).toEqual(['RAISED']);
  });

  it('accounts cannot accept or fix', async () => {
    const id = await raised();
    as('u-acc');
    expect(await acceptSnag(id, { fixBy: '2026-10-15', assigneeId: 'm-sup' }, T0)).toEqual(NOT_YOUR_ROLE);
    expect(await markSnagFixed(id, { photos: [photo()] }, T0)).toEqual(NOT_YOUR_ROLE);
  });

  it('refuses a fix-by date in the past, and someone not on the project', async () => {
    const id = await raised();
    as('u-owner');
    expect(await acceptSnag(id, { fixBy: '2026-10-11', assigneeId: 'm-sup' }, T0)).toEqual({ ok: false, error: SNAG_ERRORS.fixByPast });
    expect(await acceptSnag(id, { fixBy: '2026-10-15', assigneeId: 'm-sup2' }, T0)).toEqual({ ok: false, error: SNAG_ERRORS.assignee });
    expect(await acceptSnag(id, { fixBy: '2026-10-15', assigneeId: 'm-acc' }, T0)).toEqual({ ok: false, error: SNAG_ERRORS.assignee });
    expect(await acceptSnag(id, { fixBy: '2026-10-12', assigneeId: 'm-owner' }, T0)).toMatchObject({ ok: true });
  });

  it('a dispute needs a reason the customer reads, and the snag stays open', async () => {
    const id = await raised();
    as('u-pm');
    expect(await disputeSnag(id, '  ', T0)).toEqual({ ok: false, error: SNAG_ERRORS.reason });
    expect(await disputeSnag(id, 'Natural stone has veins like this.', T0)).toMatchObject({ ok: true });
    expect(status(id, T0)).toMatchObject({ state: 'disputed', open: true, disputeReason: 'Natural stone has veins like this.' });
    expect(legacy(id).status).toBe('OPEN');
    expect(notified).toContainEqual({ to: 'u-customer', kind: 'snag-disputed' });
    // The customer agreeing closes it.
    expect(await confirmSnag('u-customer', id, later(1))).toMatchObject({ ok: true });
    expect(status(id, later(1))).toMatchObject({ state: 'closed', closedBy: 'customer' });
  });
});

describe('fixing (snag.fix)', () => {
  it('needs the after photo; nothing is written without it', async () => {
    const id = await accepted();
    as('u-sup');
    expect(await markSnagFixed(id, { photos: [], text: 'Done' }, T0)).toEqual({ ok: false, error: SNAG_ERRORS.needsAfter });
    expect(kinds(id)).toEqual(['RAISED', 'ACCEPTED']);
  });

  it('a supervisor on the site fixes it; it waits for the customer — the studio’s tap does not close it', async () => {
    const id = await fixed();
    expect(kinds(id)).toEqual(['RAISED', 'ACCEPTED', 'FIXED']);
    const ev = db.state.snagEvents.find((e) => e.kind === 'FIXED')!;
    expect(ev).toMatchObject({ customerText: 'Filler strip fitted above the wardrobe.', customerLang: 'mr', actorType: 'STUDIO', byId: 'u-sup' });
    expect((ev.photoPaths as string[]).length).toBe(1);
    // Legacy columns kept in step, so today's app still shows the fix.
    expect(legacy(id)).toMatchObject({ status: 'FIXED', fixedNote: 'Filler strip fitted above the wardrobe.' });
    expect(legacy(id).fixedPhotoPaths).toEqual(ev.photoPaths);
    // …but it is still open.
    expect(status(id, later(1))).toMatchObject({ state: 'fixed', open: true });
    expect(await openSnagsOn('p1', later(1))).toBe(1);
    expect(notified).toContainEqual({ to: 'u-customer', kind: 'snag-fixed' });
  });

  it('a supervisor not on the site cannot fix it', async () => {
    const id = await accepted();
    as('u-sup2');
    expect(await markSnagFixed(id, { photos: [photo()] }, T0)).toEqual(NOT_YOURS);
  });

  it('there is no studio path to close: the studio cannot confirm its own fix', async () => {
    const id = await fixed();
    for (const studioUser of ['u-owner', 'u-pm', 'u-sup']) {
      as(studioUser);
      expect(await confirmSnag(studioUser, id, later(1))).toEqual({ ok: false, error: SNAG_ERRORS.notYours });
    }
    // Fixing again does not close it either.
    as('u-sup');
    expect(await markSnagFixed(id, { photos: [photo()] }, later(1))).toEqual({ ok: false, error: SNAG_ERRORS.notNow.FIXED });
    expect(status(id, later(1)).state).toBe('fixed');
  });

  it('accepts uploaded paths only from this project’s site folder', async () => {
    const id = await accepted();
    as('u-sup');
    expect(await markSnagFixed(id, { photoPaths: ['project_p9/site/a.jpg'] }, T0)).toMatchObject({ ok: false });
    expect(await markSnagFixed(id, { photoPaths: ['project_p1/site/a.jpg'] }, T0)).toMatchObject({ ok: true });
  });
});

describe('the customer’s answer', () => {
  it('Confirm closes it', async () => {
    const id = await fixed();
    expect(await confirmSnag('u-customer', id, later(2))).toEqual({ ok: true, id });
    expect(status(id, later(2))).toMatchObject({ state: 'closed', closedBy: 'customer' });
    expect(legacy(id).status).toBe('FIXED');
    expect(await openSnagsOn('p1', later(2))).toBe(0);
  });

  it('Not fixed reopens it with the reason; the studio and the assigned supervisor hear; a second fix waits again', async () => {
    const id = await fixed();
    expect(await reportNotFixed('u-customer', id, 'Still a gap on the left', later(1))).toEqual({ ok: true, id });
    expect(status(id, later(1))).toMatchObject({ state: 'reopened', notFixedReason: 'Still a gap on the left' });
    expect(legacy(id).status).toBe('OPEN');
    expect(notified).toContainEqual({ to: 'studio:s1', kind: 'snag-not-fixed' });
    expect(notified).toContainEqual({ to: 'u-sup', kind: 'snag-not-fixed' });
    as('u-sup');
    expect(await markSnagFixed(id, { photos: [photo()] }, later(2))).toMatchObject({ ok: true });
    expect(status(id, later(3))).toMatchObject({ state: 'fixed', reopenCount: 1 });
  });

  it('cannot confirm before there is a fix', async () => {
    const id = await accepted();
    expect(await confirmSnag('u-customer', id, later(1))).toEqual({ ok: false, error: SNAG_ERRORS.notNow.CONFIRMED });
  });

  it('two taps racing on the same state write one step', async () => {
    const id = await fixed();
    // The other tap got there first: its project event holds the key for "moving on from the FIXED event".
    const fixedEvent = db.state.snagEvents.find((e) => e.kind === 'FIXED')!;
    db.state.projectEvents.push({ id: 'other', dedupeKey: `snag|${id}|${fixedEvent.id}` });
    expect(await confirmSnag('u-customer', id, later(1))).toEqual({ ok: false, error: SNAG_ERRORS.raced });
    expect(kinds(id)).toEqual(['RAISED', 'ACCEPTED', 'FIXED']);
  });
});

describe('the seven-day close (cron)', () => {
  it('closes an unanswered fix at seven days, once, and tells the customer', async () => {
    const id = await fixed(T0);
    expect(await autoCloseSnags(later(6))).toEqual({ closed: 0 });
    expect(await autoCloseSnags(later(7))).toEqual({ closed: 1 });
    const ev = db.state.snagEvents.find((e) => e.kind === 'AUTO_CLOSED')!;
    expect(ev).toMatchObject({ actorType: 'SYSTEM', byId: null });
    expect((ev.at as Date).toISOString()).toBe(later(7).toISOString());
    expect(notified).toContainEqual({ to: 'u-customer', kind: 'snag-auto-closed' });
    expect(status(id, later(8))).toMatchObject({ state: 'closed', closedBy: 'auto' });
    // A second run writes nothing.
    expect(await autoCloseSnags(later(8))).toEqual({ closed: 0 });
    expect(kinds(id).filter((k) => k === 'AUTO_CLOSED')).toHaveLength(1);
  });

  it('after seven days the customer can no longer answer it', async () => {
    const id = await fixed(T0);
    expect(await reportNotFixed('u-customer', id, 'no', later(7))).toEqual({ ok: false, error: SNAG_ERRORS.closed });
  });

  it('leaves answered fixes alone', async () => {
    const id = await fixed(T0);
    await confirmSnag('u-customer', id, later(1));
    expect(await autoCloseSnags(later(9))).toEqual({ closed: 0 });
  });
});

describe('the final payment gate (project-store.ts setPaymentStage)', () => {
  it('the last payment cannot be due while a snag is open — fixes waiting for the customer included', async () => {
    // Real time here: setPaymentStage judges the snags as of now.
    const id = await raised();
    const now = new Date();
    as('u-sup');
    expect(await markSnagFixed(id, { photos: [photo()] }, now)).toMatchObject({ ok: true });
    as('u-owner');
    const r = await setPaymentStage('p1', 2, { dueOn: '2026-12-14' });
    expect(r).toEqual({ ok: false, error: 'The last payment can be due only once every snag is closed. 1 snag is still open.' });
    expect(db.state.projectUpdates).toBe(0);
    // An earlier stage is not held.
    const earlier = await setPaymentStage('p1', 1, { dueOn: '2026-11-14' });
    expect(earlier, JSON.stringify(earlier)).toEqual({ ok: true });
    // Once the customer confirms, it may be due.
    expect(await confirmSnag('u-customer', id, new Date(now.getTime() + 1_000))).toEqual({ ok: true, id });
    expect(await setPaymentStage('p1', 2, { dueOn: '2026-12-14' })).toEqual({ ok: true });
  });
});
