import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { homeSummary, scopeLine, type HomeBrief } from '@/modules/app/home-summary';
import { appLocale, isAppLocale } from '@/modules/app/locale';
import { messageFor } from '@/modules/notify/messages';

/**
 * The phone app's "Me" endpoint (GET, PATCH, DELETE /api/app/v1/me): the
 * home line, the language, and account deletion — what is scrubbed, what is
 * kept, and that it happens in one transaction.
 */

const db = vi.hoisted(() => {
  const calls: { op: string; args: unknown }[] = [];
  /** What the next call to an operation returns, before its default. */
  const queued: Record<string, unknown[]> = {};
  const rec = (op: string, value: unknown = undefined) =>
    vi.fn(async (args?: unknown) => {
      calls.push({ op, args });
      return queued[op]?.length ? queued[op]!.shift() : value;
    });
  const client = {
    user: { findUnique: rec('user.findUnique'), update: rec('user.update') },
    session: { deleteMany: rec('session.deleteMany') },
    pushDevice: { deleteMany: rec('pushDevice.deleteMany') },
    authIdentity: { deleteMany: rec('authIdentity.deleteMany') },
    notification: { deleteMany: rec('notification.deleteMany'), count: rec('notification.count', 0) },
    consent: { updateMany: rec('consent.updateMany') },
    brief: { findUnique: rec('brief.findUnique', null), findFirst: rec('brief.findFirst', null), update: rec('brief.update') },
    consultation: { updateMany: rec('consultation.updateMany') },
    auditLog: { create: rec('auditLog.create') },
    homeProject: { findMany: rec('homeProject.findMany', []) },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      calls.push({ op: 'tx.begin', args: null });
      const out = await fn(client);
      calls.push({ op: 'tx.end', args: null });
      return out;
    }),
  };
  const next = (op: string, value: unknown) => (queued[op] ??= []).push(value);
  return { client, calls, next, queued };
});
vi.mock('@/lib/prisma', () => ({ prisma: db.client }));

const session = vi.hoisted(() => ({ user: null as null | { id: string; name: string | null; phone: string | null; email: string | null; role: string } }));
vi.mock('@/modules/auth/session', () => ({ getCurrentUser: vi.fn(async () => session.user) }));
vi.mock('@/modules/engagement/coins', () => ({
  settleCoins: vi.fn(async () => undefined),
  wallet: vi.fn(async () => ({ balance: 140, streak: 3, expiresOn: null, entries: [] })),
}));
vi.mock('@/modules/portal/project-store', () => ({ customerProjects: vi.fn(async () => []) }));
vi.mock('@/modules/notify/service', () => ({ notifyOps: vi.fn(async () => undefined) }));

const brief = (over: Partial<HomeBrief> = {}): HomeBrief => ({
  propertyType: 'BHK_2',
  carpetAreaSqft: 850,
  locality: 'baner',
  society: 'Gera World of Joy',
  scope: 'FULL_HOME',
  scopeRooms: [],
  tier: 'PREMIUM',
  budgetMinPaise: null,
  budgetMaxPaise: null,
  possessionStatus: null,
  possessionOn: null,
  ...over,
});

describe('the home line', () => {
  it('names the society and the locality, the size and the band', () => {
    expect(homeSummary(brief())).toEqual({
      label: 'Gera World of Joy, Baner',
      locality: 'Baner',
      bhk: '2 BHK',
      carpetSqft: 850,
      tier: 'premium',
      fullHome: true,
    });
  });

  it('is null with no brief, and leaves unanswered fields null', () => {
    expect(homeSummary(null)).toBeNull();
    const h = homeSummary(brief({ society: '  ', locality: null, propertyType: 'OTHER', carpetAreaSqft: 0, tier: null }))!;
    expect(h.label).toBeNull();
    expect(h.bhk).toBeNull();
    expect(h.carpetSqft).toBeNull();
    expect(h.tier).toBeNull();
  });

  it('is a full home only for the full-home scope', () => {
    for (const scope of ['KITCHEN_WARDROBE', 'SINGLE_ROOM', 'RENOVATION', null]) {
      expect(homeSummary(brief({ scope }))!.fullHome).toBe(false);
    }
    expect(scopeLine(brief({ scope: 'SINGLE_ROOM', scopeRooms: ['MASTER_BEDROOM'] }))).toBe('One room (master bedroom)');
    expect(scopeLine(brief({ scopeRooms: ['KITCHEN'] }))).toBe('Full home');
  });
});

describe('the app language', () => {
  it('reads the old default as English, and Hindi or Marathi in any form', () => {
    expect(appLocale('en-IN')).toBe('en');
    expect(appLocale(null)).toBe('en');
    expect(appLocale('hi')).toBe('hi');
    expect(appLocale('mr-IN')).toBe('mr');
    expect(appLocale('fr')).toBe('en');
  });

  it('accepts only en, hi and mr from the app', () => {
    expect(['en', 'hi', 'mr'].every(isAppLocale)).toBe(true);
    expect(isAppLocale('en-IN')).toBe(false);
    expect(isAppLocale('HI')).toBe(false);
    expect(isAppLocale(1)).toBe(false);
  });
});

describe('a GEIO handover notice to ops', () => {
  it('names the customer and the home, and opens the expert queue', () => {
    const m = messageFor({ kind: 'geio-handover', customer: 'Priya', home: 'Gera World of Joy, Baner', note: 'Wants a lower price on the TV unit.' });
    expect(m.template).toBe('geio.handover');
    expect(m.title).toBe('GEIO handed over · Priya');
    expect(m.body).toBe('Gera World of Joy, Baner. Wants a lower price on the TV unit.');
    expect(m.url).toBe('/ops/consultations');
    expect(messageFor({ kind: 'geio-handover', customer: 'P', home: null, note: 'x'.repeat(300) }).body.length).toBe(160);
  });
});

describe('/api/app/v1/me', () => {
  beforeEach(() => {
    vi.stubEnv('CUSTOMER_LIVE', '1');
    vi.stubEnv('DATABASE_URL', 'postgres://test');
    vi.stubEnv('SAMPLE_DATA_ONLY', '');
    db.calls.length = 0;
    for (const k of Object.keys(db.queued)) delete db.queued[k];
    vi.clearAllMocks();
    session.user = { id: 'u1', name: 'Priya Shah', phone: '+919800000000', email: null, role: 'CUSTOMER' };
  });
  afterEach(() => vi.unstubAllEnvs());

  const req = (method: string, body?: unknown) =>
    new Request('http://x/api/app/v1/me', { method, body: body === undefined ? undefined : JSON.stringify(body) });

  it('401s without a session', async () => {
    session.user = null;
    const { GET } = await import('@/app/api/app/v1/me/route');
    expect((await GET()).status).toBe(401);
  });

  it('returns the profile with home, coins, expert, unread and language', async () => {
    db.next('brief.findUnique', { ...brief(), budgetMinPaise: null, budgetMaxPaise: null, possessionOn: null });
    db.next('notification.count', 4);
    db.next('user.findUnique', { locale: 'en-IN' });
    const { GET } = await import('@/app/api/app/v1/me/route');
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(body.user).toEqual({ id: 'u1', name: 'Priya Shah', phone: '+919800000000' });
    expect(body.home.label).toBe('Gera World of Joy, Baner');
    expect(body.coins).toEqual({ balance: 140, streak: 3 });
    expect(typeof body.expert.name).toBe('string');
    expect(body.expert.name).not.toMatch(/\s|^Ar\./);
    expect(body.unread).toBe(4);
    expect(body.locale).toBe('en');
    expect(body.plan).toBeNull(); // no project yet
  });

  it('home is null when there is no brief', async () => {
    db.next('user.findUnique', { locale: 'mr' });
    const { GET } = await import('@/app/api/app/v1/me/route');
    const body = await (await GET()).json();
    expect(body.home).toBeNull();
    expect(body.locale).toBe('mr');
  });

  it('saves a language, and refuses anything else', async () => {
    const { PATCH } = await import('@/app/api/app/v1/me/route');
    expect((await PATCH(req('PATCH', { locale: 'fr' }))).status).toBe(400);
    expect((await PATCH(req('PATCH', { locale: 'en-IN' }))).status).toBe(400);
    expect((await PATCH(req('PATCH'))).status).toBe(400);
    expect(db.client.user.update).not.toHaveBeenCalled();
    const ok = await PATCH(req('PATCH', { locale: 'hi' }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ ok: true });
    expect(db.client.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { locale: 'hi' } });
  });
});

describe('deleting an account', () => {
  beforeEach(() => {
    vi.stubEnv('CUSTOMER_LIVE', '1');
    vi.stubEnv('DATABASE_URL', 'postgres://test');
    vi.stubEnv('SAMPLE_DATA_ONLY', '');
    db.calls.length = 0;
    for (const k of Object.keys(db.queued)) delete db.queued[k];
    vi.clearAllMocks();
    session.user = { id: 'u1', name: 'Priya Shah', phone: '+919800000000', email: null, role: 'CUSTOMER' };
  });
  afterEach(() => vi.unstubAllEnvs());

  it('scrubs, signs out and audits in one transaction, and keeps the project', async () => {
    db.next('user.findUnique', { id: 'u1', deletedAt: null });
    db.next('brief.findUnique', { id: 'b1' });
    const { DELETE } = await import('@/app/api/app/v1/me/route');
    const res = await DELETE();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const ops = db.calls.map((c) => c.op);
    const inTx = ops.slice(ops.indexOf('tx.begin') + 1, ops.indexOf('tx.end'));
    expect(inTx).toEqual([
      'user.update',
      'session.deleteMany',
      'pushDevice.deleteMany',
      'authIdentity.deleteMany',
      'notification.deleteMany',
      'consent.updateMany',
      'brief.findUnique',
      'brief.update',
      'consultation.updateMany',
      'auditLog.create',
    ]);

    const user = db.calls.find((c) => c.op === 'user.update')!.args as { data: Record<string, unknown> };
    expect(user.data.deletedAt).toBeInstanceOf(Date);
    expect(user.data).toMatchObject({ name: null, phone: null, email: null, phoneVerified: null, emailVerified: null, passwordHash: null });
    const b = db.calls.find((c) => c.op === 'brief.update')!.args as { data: Record<string, unknown> };
    expect(b.data).toMatchObject({ contactName: null, contactPhone: null, contactEmail: null, shareToken: null });
    // The home's answers stay: nothing about the flat is in the scrub.
    expect(Object.keys(b.data)).not.toContain('society');
    const audit = db.calls.find((c) => c.op === 'auditLog.create')!.args as { data: { action: string; after: Record<string, unknown> } };
    expect(audit.data.action).toBe('account.erase');
    expect(JSON.stringify(audit.data)).not.toContain('Priya');
  });

  it('touches nothing it should keep', async () => {
    db.next('user.findUnique', { id: 'u1', deletedAt: null });
    const { eraseAccount } = await import('@/modules/auth/erase');
    await eraseAccount('u1');
    const ops = db.calls.map((c) => c.op);
    expect(ops.some((o) => /homeProject|introduction|coinEntry|studioClient|delete$/.test(o))).toBe(false);
    expect(ops).not.toContain('brief.update'); // no brief of their own
  });

  it('is done once: a second request changes nothing', async () => {
    db.next('user.findUnique', { id: 'u1', deletedAt: new Date() });
    const { eraseAccount } = await import('@/modules/auth/erase');
    expect(await eraseAccount('u1')).toEqual({ ok: true });
    expect(db.calls.map((c) => c.op)).toEqual(['user.findUnique']);
  });

  it('needs the session', async () => {
    session.user = null;
    const { DELETE } = await import('@/app/api/app/v1/me/route');
    expect((await DELETE()).status).toBe(401);
    expect(db.calls).toEqual([]);
  });
});
