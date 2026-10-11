import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Settings → Team (studio/team-store.ts): only the owner (`team.manage`)
 * changes anything; an invite finds or creates the user by phone, never
 * turns a customer's account into a studio member, writes the member as
 * INVITED with its sites, and sends the sign-in link; suspend signs them out
 * everywhere; seats count sign-ins. Prisma, the session and the sender are
 * mocked; no database.
 */

type Role = 'OWNER' | 'PM' | 'SUPERVISOR' | 'ACCOUNTS';
type Status = 'INVITED' | 'ACTIVE' | 'SUSPENDED';

/** Prisma call arguments, read loosely by the mocks below. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Args = any;

const db = vi.hoisted(() => {
  const members: Record<string, { id: string; studioId: string; userId: string; role: Role; status: Status; lastSeenAt: Date | null }> = {};
  const users: Record<string, { id: string; role: string; deletedAt: Date | null; studioMember: { studioId: string } | null }> = {};
  const calls: { op: string; args: Args }[] = [];
  const rec = (op: string, fn: (args: Args) => unknown = () => undefined) =>
    vi.fn(async (args: Args) => {
      calls.push({ op, args });
      return fn(args);
    });
  const client: Args = {
    studioMember: {
      findUnique: rec('studioMember.findUnique', (a) => Object.values(members).find((m) => m.userId === a.where.userId) ?? null),
      findFirst: rec('studioMember.findFirst', (a) => {
        const m = Object.values(members).find((x) => x.id === a.where.id && x.studioId === a.where.studioId);
        return m ? { ...m, user: { name: 'Ramesh Pawar', phone: '+919822055310' } } : null;
      }),
      findMany: rec('studioMember.findMany', (a) =>
        Object.values(members)
          .filter((m) => m.studioId === a.where.studioId)
          .map((m) => ({ ...m, user: { name: m.id, phone: null, email: null, locale: 'en-IN' }, projects: [] })),
      ),
      count: rec('studioMember.count', (a) =>
        Object.values(members).filter((m) => m.studioId === a.where.studioId && m.role === a.where.role && m.status === a.where.status).length,
      ),
      create: rec('studioMember.create', () => ({ id: 'm-new' })),
      update: rec('studioMember.update'),
    },
    user: {
      findUnique: rec('user.findUnique', (a) => users[a.where.phone] ?? null),
      create: rec('user.create', () => ({ id: 'u-new' })),
    },
    homeProject: {
      findMany: rec('homeProject.findMany', (a) => {
        const own = ['p1', 'p2'];
        const ids: string[] = a.where.id?.in ?? own;
        return ids.filter((id) => own.includes(id)).map((id) => ({ id, introduction: { brief: { society: 'Skyline', locality: 'baner', propertyType: 'BHK_3' } } }));
      }),
    },
    studioProjectMember: { createMany: rec('studioProjectMember.createMany'), deleteMany: rec('studioProjectMember.deleteMany') },
    studio: { findUnique: rec('studio.findUnique', () => ({ tradeName: 'Teakline Studio' })) },
    auditLog: { create: rec('auditLog.create') },
  };
  client.$transaction = vi.fn(async (arg: unknown) => (typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(client) : Promise.all(arg as unknown[])));
  return { client, calls, members, users };
});
vi.mock('@/lib/prisma', () => ({ prisma: db.client }));

const session = vi.hoisted(() => ({ userId: null as string | null }));
const revokeAllSessions = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('@/modules/auth/session', () => ({
  getCurrentUser: vi.fn(async () => (session.userId ? { id: session.userId, role: 'STUDIO', email: null, phone: null, name: null } : null)),
  hasRole: (u: { role: string } | null, r: string) => Boolean(u) && (u!.role === r || u!.role === 'OPS' || u!.role === 'ADMIN'),
  revokeAllSessions,
}));
const send = vi.hoisted(() => vi.fn(async () => ({ delivered: true, via: 'whatsapp' })));
vi.mock('@/modules/messaging/sender', () => ({ send }));
vi.mock('@/modules/rate-limit/store', () => ({ bucketFor: (a: string, b: string) => `${a}:${b}`, consume: vi.fn(async () => ({ allowed: true, remaining: 2 })) }));

import { inviteMember, reinstateMember, resendInvite, signOutEverywhere, suspendMember, teamView } from '@/modules/studio/team-store';
import { roleCan, seatLine, seatsUsed, checkInvite } from '@/modules/studio/team-rules';

const ops = (op: string) => db.calls.filter((c) => c.op === op);
const BASE = 'https://studio.oneinteriors.in';

beforeEach(() => {
  db.calls.length = 0;
  send.mockClear();
  revokeAllSessions.mockClear();
  for (const k of Object.keys(db.members)) delete db.members[k];
  for (const k of Object.keys(db.users)) delete db.users[k];
  Object.assign(db.members, {
    owner: { id: 'm-owner', studioId: 's1', userId: 'u-owner', role: 'OWNER', status: 'ACTIVE', lastSeenAt: new Date() },
    pm: { id: 'm-pm', studioId: 's1', userId: 'u-pm', role: 'PM', status: 'ACTIVE', lastSeenAt: new Date() },
    sup: { id: 'm-sup', studioId: 's1', userId: 'u-sup', role: 'SUPERVISOR', status: 'ACTIVE', lastSeenAt: new Date() },
    inv: { id: 'm-inv', studioId: 's1', userId: 'u-inv', role: 'SUPERVISOR', status: 'INVITED', lastSeenAt: null },
    other: { id: 'm-other', studioId: 's2', userId: 'u-other', role: 'PM', status: 'ACTIVE', lastSeenAt: null },
  });
  session.userId = 'u-owner';
  vi.stubEnv('DATABASE_URL', 'postgres://test');
  vi.stubEnv('SAMPLE_DATA_ONLY', '');
});
afterEach(() => vi.unstubAllEnvs());

const invite = { name: 'Imran Shaikh', phone: '98500 66124', role: 'SUPERVISOR', sites: ['p1'] };

describe('only the owner changes the team', () => {
  for (const who of ['u-pm', 'u-sup']) {
    it(`${who} is refused every action, and nothing is written or sent`, async () => {
      session.userId = who;
      expect((await inviteMember(invite, BASE)).ok).toBe(false);
      expect((await suspendMember('m-inv')).ok).toBe(false);
      expect((await reinstateMember('m-inv')).ok).toBe(false);
      expect((await signOutEverywhere('m-owner')).ok).toBe(false);
      expect((await resendInvite('m-inv', BASE)).ok).toBe(false);
      expect(await teamView()).toBeNull();
      expect(ops('studioMember.create')).toHaveLength(0);
      expect(ops('studioMember.update')).toHaveLength(0);
      expect(revokeAllSessions).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    });
  }

  it('a suspended owner is refused too', async () => {
    db.members.owner!.status = 'SUSPENDED';
    expect((await inviteMember(invite, BASE)).ok).toBe(false);
  });
});

describe('inviting', () => {
  it('creates a STUDIO user and an INVITED member with its sites, and sends the sign-in link', async () => {
    const r = await inviteMember(invite, BASE);
    expect(r.ok).toBe(true);
    expect(ops('user.create')[0]!.args.data).toEqual({ phone: '+919850066124', name: 'Imran Shaikh', role: 'STUDIO' });
    expect(ops('studioMember.create')[0]!.args.data).toMatchObject({
      studioId: 's1',
      userId: 'u-new',
      role: 'SUPERVISOR',
      status: 'INVITED',
      isOwner: false,
      invitedById: 'm-owner',
    });
    expect(ops('studioProjectMember.createMany')[0]!.args.data).toEqual([{ homeProjectId: 'p1', memberId: 'm-new' }]);
    expect(send).toHaveBeenCalledWith('+919850066124', {
      kind: 'invite',
      name: 'Imran',
      studioName: 'Teakline Studio',
      link: 'https://studio.oneinteriors.in/studio/sign-in',
    });
  });

  it('never turns a customer account into a studio member', async () => {
    db.users['+919850066124'] = { id: 'u-cust', role: 'CUSTOMER', deletedAt: null, studioMember: null };
    const r = await inviteMember(invite, BASE);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/customer account/);
    expect(ops('studioMember.create')).toHaveLength(0);
    expect(send).not.toHaveBeenCalled();
  });

  it('refuses a number already on another studio’s team', async () => {
    db.users['+919850066124'] = { id: 'u-x', role: 'STUDIO', deletedAt: null, studioMember: { studioId: 's2' } };
    const r = await inviteMember(invite, BASE);
    expect(!r.ok && r.error).toMatch(/another studio/);
  });

  it('reuses a studio account with no team', async () => {
    db.users['+919850066124'] = { id: 'u-free', role: 'STUDIO', deletedAt: null, studioMember: null };
    expect((await inviteMember(invite, BASE)).ok).toBe(true);
    expect(ops('user.create')).toHaveLength(0);
    expect(ops('studioMember.create')[0]!.args.data.userId).toBe('u-free');
  });

  it('refuses a site that is not the studio’s', async () => {
    const r = await inviteMember({ ...invite, sites: ['p1', 'p9'] }, BASE);
    expect(r.ok).toBe(false);
    expect(ops('studioMember.create')).toHaveLength(0);
  });

  it('drops sites for roles that see the whole studio', () => {
    const c = checkInvite({ ...invite, role: 'ACCOUNTS' });
    expect(c.ok && c.invite.sites).toEqual([]);
    expect(checkInvite({ ...invite, role: 'BOSS' }).ok).toBe(false);
    expect(checkInvite({ ...invite, phone: '123' }).ok).toBe(false);
  });

  it('resends only to someone who has not signed in', async () => {
    expect((await resendInvite('m-inv', BASE)).ok).toBe(true);
    expect((await resendInvite('m-sup', BASE)).ok).toBe(false);
    expect((await resendInvite('m-other', BASE)).ok).toBe(false);
  });
});

describe('suspend, reinstate, sign out everywhere', () => {
  it('suspending sets SUSPENDED and ends every session', async () => {
    expect((await suspendMember('m-sup')).ok).toBe(true);
    expect(ops('studioMember.update')[0]!.args).toEqual({ where: { id: 'm-sup' }, data: { status: 'SUSPENDED' } });
    expect(revokeAllSessions).toHaveBeenCalledWith('u-sup');
  });

  it('not yourself, and not another studio’s member', async () => {
    expect((await suspendMember('m-owner')).ok).toBe(false);
    expect((await suspendMember('m-other')).ok).toBe(false);
    expect(revokeAllSessions).not.toHaveBeenCalled();
  });

  it('a co-owner can be suspended while another active owner remains', async () => {
    db.members.owner2 = { id: 'm-owner2', studioId: 's1', userId: 'u-owner2', role: 'OWNER', status: 'ACTIVE', lastSeenAt: null };
    expect((await suspendMember('m-owner2')).ok).toBe(true);
    expect(revokeAllSessions).toHaveBeenCalledWith('u-owner2');
  });

  it('reinstating someone who never signed in puts them back to INVITED, not ACTIVE', async () => {
    db.members.inv!.status = 'SUSPENDED';
    await reinstateMember('m-inv');
    expect(ops('studioMember.update')[0]!.args.data).toEqual({ status: 'INVITED' });
    db.members.sup!.status = 'SUSPENDED';
    await reinstateMember('m-sup');
    expect(ops('studioMember.update')[1]!.args.data).toEqual({ status: 'ACTIVE' });
  });

  it('sign out everywhere revokes the member’s sessions', async () => {
    expect((await signOutEverywhere('m-pm')).ok).toBe(true);
    expect(revokeAllSessions).toHaveBeenCalledWith('u-pm');
  });
});

describe('seats', () => {
  it('a seat is a member who has signed in and is not suspended', async () => {
    const view = await teamView();
    expect(view?.seatsUsed).toBe(3); // owner, PM, supervisor; the invitee is not using one
    expect(view?.freeSeats).toBe(5);
    expect(seatsUsed([{ status: 'ACTIVE' }, { status: 'INVITED' }, { status: 'SUSPENDED' }])).toBe(1);
    expect(seatLine(4)).toBe('4 of 5 free seats used');
    expect(seatLine(7)).toBe('7 seats, 5 of them free');
  });

  it('role cards are read off the permission table', () => {
    expect(roleCan('SUPERVISOR')).toEqual(['Post site updates', 'Tick the checklist', 'Fix snags', 'See the project']);
    expect(roleCan('PM')).not.toContain('Vendor rates and margins');
    expect(roleCan('PM')).not.toContain('Add and remove people');
    expect(roleCan('ACCOUNTS')).toEqual(['Record payments', 'See payments']);
    expect(roleCan('OWNER')).toContain('Add and remove people');
  });
});
