import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The studio phone sign-in (auth/otp.ts with `studio: true`): a number on a
 * studio's team signs in as that member, anyone else is refused and nothing
 * is created; the per-IP limit on code requests; the code-on-screen
 * shortcut is local development only; session length by role. Prisma is
 * mocked; no database.
 */

type Role = 'OWNER' | 'PM' | 'SUPERVISOR' | 'ACCOUNTS';
type Status = 'INVITED' | 'ACTIVE' | 'SUSPENDED';

/** Prisma call arguments, read loosely by the mocks below. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Args = any;

const db = vi.hoisted(() => {
  const people: Record<string, { id: string; role: string; member: { id: string; role: Role; status: Status } | null }> = {};
  const calls: { op: string; args: Args }[] = [];
  const state = { rateHits: 0, challenge: null as null | { id: string; consumedAt: Date | null; expiresAt: Date; attempts: number } };
  const rec = (op: string, fn: (args: Args) => unknown = () => undefined) =>
    vi.fn(async (args: Args) => {
      calls.push({ op, args });
      return fn(args);
    });
  const userByPhone = (phone: string) => {
    const p = people[phone];
    if (!p) return null;
    return {
      id: p.id,
      role: p.role,
      deletedAt: null,
      phoneVerified: null,
      name: 'Ramesh',
      studioMember: p.member,
    };
  };
  const client: Args = {
    user: {
      findUnique: rec('user.findUnique', (a) => userByPhone(a.where.phone)),
      create: rec('user.create', () => ({ id: 'u-new', deletedAt: null, phoneVerified: null, name: null })),
      update: rec('user.update'),
    },
    studioMember: {
      update: rec('studioMember.update'),
      updateMany: rec('studioMember.updateMany'),
      findUnique: rec('studioMember.findUnique', (a) => {
        const p = Object.values(people).find((x) => x.id === a.where.userId);
        return p?.member ? { role: p.member.role } : null;
      }),
    },
    loginChallenge: {
      findMany: rec('loginChallenge.findMany', () => []),
      updateMany: rec('loginChallenge.updateMany', () => ({ count: 0 })),
      create: rec('loginChallenge.create'),
      findUnique: rec('loginChallenge.findUnique', () => state.challenge),
      findFirst: rec('loginChallenge.findFirst', () => null),
      update: rec('loginChallenge.update'),
    },
    session: { create: rec('session.create') },
    rateLimitHit: {
      deleteMany: rec('rateLimitHit.deleteMany'),
      count: rec('rateLimitHit.count', () => state.rateHits),
      findFirst: rec('rateLimitHit.findFirst', () => ({ createdAt: new Date() })),
      create: rec('rateLimitHit.create'),
    },
  };
  client.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(client));
  return { client, calls, people, state };
});
vi.mock('@/lib/prisma', () => ({ prisma: db.client }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ set: vi.fn(), get: () => undefined, delete: vi.fn() }),
  headers: async () => new Headers(),
}));

const whatsapp = vi.hoisted(() => ({ sendOtp: vi.fn(async () => ({ delivered: false, reason: 'dev_console' })) }));
vi.mock('@/modules/auth/whatsapp', () => ({
  hasWhatsApp: () => false,
  sendOtp: whatsapp.sendOtp,
  sendTemplate: vi.fn(async () => ({ delivered: false })),
}));

import { otpIpBucket, requestOtp, studioDevCode, verifyOtp } from '@/modules/auth/otp';
import { sessionDaysForUser } from '@/modules/auth/session';

const PHONE = '+919822055310';
const typed = '98220 55310';
const ops = (op: string) => db.calls.filter((c) => c.op === op);

function person(role: Role, status: Status, userRole = 'STUDIO') {
  db.people[PHONE] = { id: 'u-ramesh', role: userRole, member: { id: 'm-ramesh', role, status } };
}

beforeEach(() => {
  db.calls.length = 0;
  for (const k of Object.keys(db.people)) delete db.people[k];
  db.state.rateHits = 0;
  db.state.challenge = { id: 'c1', consumedAt: null, expiresAt: new Date(Date.now() + 60_000), attempts: 0 };
  vi.stubEnv('DATABASE_URL', 'postgres://test');
  vi.stubEnv('SAMPLE_DATA_ONLY', '');
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('asking for a studio code', () => {
  it('sends a code to an invited member, without asking for a name', async () => {
    person('SUPERVISOR', 'INVITED');
    const r = await requestOtp(typed, '', { ip: '203.0.113.7', studio: true });
    expect(r.ok).toBe(true);
    expect(ops('loginChallenge.create')).toHaveLength(1);
    // Studio codes go through MessageSender, never the customer's WhatsApp OTP path.
    expect(whatsapp.sendOtp).not.toHaveBeenCalled();
  });

  it('refuses a number that is on no team: no code, nothing created', async () => {
    const r = await requestOtp(typed, '', { studio: true });
    expect(r).toEqual({ ok: false, reason: 'not_member' });
    expect(ops('loginChallenge.create')).toHaveLength(0);
    expect(ops('user.create')).toHaveLength(0);
  });

  it('refuses a customer account, even one that somehow has a membership', async () => {
    person('PM', 'ACTIVE', 'CUSTOMER');
    expect(await requestOtp(typed, '', { studio: true })).toEqual({ ok: false, reason: 'not_member' });
  });

  it('refuses a suspended member', async () => {
    person('PM', 'SUSPENDED');
    expect(await requestOtp(typed, '', { studio: true })).toEqual({ ok: false, reason: 'suspended' });
    expect(ops('loginChallenge.create')).toHaveLength(0);
  });
});

describe('the per-IP limit on code requests', () => {
  it('refuses once the address has asked for 20 codes this hour, before anything is looked up or sent', async () => {
    person('SUPERVISOR', 'ACTIVE');
    db.state.rateHits = 20;
    const r = await requestOtp(typed, '', { ip: '203.0.113.7', studio: true });
    expect(r).toEqual({ ok: false, reason: 'rate_limited' });
    expect(ops('user.findUnique')).toHaveLength(0);
    expect(ops('loginChallenge.create')).toHaveLength(0);
  });

  it('applies to the customer path too', async () => {
    db.state.rateHits = 20;
    expect(await requestOtp(typed, 'Priya Shah', { ip: '203.0.113.7' })).toEqual({ ok: false, reason: 'rate_limited' });
  });

  it('allows under the limit and counts the hit', async () => {
    db.state.rateHits = 19;
    expect((await requestOtp(typed, 'Priya Shah', { ip: '203.0.113.7' })).ok).toBe(true);
    expect(ops('rateLimitHit.create')).toHaveLength(1);
  });

  it('keys the bucket by a hash of the address, never the address itself', () => {
    const bucket = otpIpBucket('203.0.113.7');
    expect(bucket.startsWith('otp-ip:')).toBe(true);
    expect(bucket).not.toContain('203.0.113.7');
    expect(otpIpBucket('203.0.113.7')).toBe(bucket);
    expect(otpIpBucket('203.0.113.8')).not.toBe(bucket);
  });
});

describe('the code on screen is local development only (studio)', () => {
  it('local development, nothing delivered: the code is shown', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    person('SUPERVISOR', 'ACTIVE');
    const r = await requestOtp(typed, '', { studio: true });
    expect(r.ok && r.devCode).toMatch(/^\d{6}$/);
  });

  it('a production build never shows it, even with DEV_SHOW_OTP_ON_SCREEN set', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DEV_SHOW_OTP_ON_SCREEN', '1');
    vi.stubEnv('NEXT_PUBLIC_ROSTER_IS_REAL', '');
    person('SUPERVISOR', 'ACTIVE');
    const r = await requestOtp(typed, '', { studio: true });
    expect(r).toEqual({ ok: true });
  });

  it('studioDevCode: production or delivered means no code', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(studioDevCode(false, '123456')).toBeUndefined();
    vi.stubEnv('NODE_ENV', 'development');
    expect(studioDevCode(true, '123456')).toBeUndefined();
    expect(studioDevCode(false, '123456')).toBe('123456');
  });
});

describe('signing in with the code', () => {
  it('an invited member signs in as that member and becomes ACTIVE; no account is created', async () => {
    person('SUPERVISOR', 'INVITED');
    const r = await verifyOtp(typed, '481726', null, { studio: true, bearer: true, locale: 'mr-IN' });
    expect(r).toMatchObject({ ok: true, userId: 'u-ramesh', studioRole: 'SUPERVISOR' });
    const upd = ops('studioMember.update')[0]!.args;
    expect(upd.where).toEqual({ id: 'm-ramesh' });
    expect(upd.data.status).toBe('ACTIVE');
    expect(upd.data.lastSeenAt).toBeInstanceOf(Date);
    expect(ops('user.update')[0]!.args.data.locale).toBe('mr-IN');
    expect(ops('user.create')).toHaveLength(0);
    expect(ops('session.create')).toHaveLength(1);
  });

  it('an active member stays ACTIVE (no status write)', async () => {
    person('PM', 'ACTIVE');
    const r = await verifyOtp(typed, '481726', null, { studio: true, bearer: true });
    expect(r.ok).toBe(true);
    expect(ops('studioMember.update')[0]!.args.data.status).toBeUndefined();
  });

  it('a number on no team is refused, no customer is created and no session opened', async () => {
    const r = await verifyOtp(typed, '481726', null, { studio: true, bearer: true });
    expect(r).toEqual({ ok: false, reason: 'not_member' });
    expect(ops('user.create')).toHaveLength(0);
    expect(ops('session.create')).toHaveLength(0);
  });

  it('a suspended member is refused', async () => {
    person('OWNER', 'SUSPENDED');
    expect(await verifyOtp(typed, '481726', null, { studio: true, bearer: true })).toEqual({ ok: false, reason: 'suspended' });
    expect(ops('session.create')).toHaveLength(0);
  });

  it('the customer path is unchanged: a new number becomes a CUSTOMER', async () => {
    const r = await verifyOtp(typed, '481726', 'Priya Shah', { bearer: true });
    expect(r.ok).toBe(true);
    expect(ops('user.create')[0]!.args.data.role).toBe('CUSTOMER');
  });
});

describe('session length by role', () => {
  it('a site supervisor gets 90 days, everyone else 30', async () => {
    person('SUPERVISOR', 'ACTIVE');
    expect(await sessionDaysForUser('u-ramesh')).toBe(90);
    person('PM', 'ACTIVE');
    expect(await sessionDaysForUser('u-ramesh')).toBe(30);
    person('ACCOUNTS', 'ACTIVE');
    expect(await sessionDaysForUser('u-ramesh')).toBe(30);
    expect(await sessionDaysForUser('u-customer')).toBe(30);
  });

  it('the session row a supervisor gets expires in 90 days', async () => {
    person('SUPERVISOR', 'INVITED');
    await verifyOtp(typed, '481726', null, { studio: true, bearer: true });
    const expires: Date = ops('session.create')[0]!.args.data.expiresAt;
    const days = (expires.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(89.9);
    expect(days).toBeLessThanOrEqual(90);
  });
});
