import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ASSURED_EXPERT_CALLS, PLAN_COPY, geioOpen, parsePlan, planView } from '@/modules/portal/plans';
import { chooseApiView } from '@/modules/portal/choose-api';
import { messageFor } from '@/modules/notify/messages';
import type { ChooseView } from '@/modules/portal/choose';

/**
 * The two plans (owner, 11 Oct 2026; docs/APP-API-JOURNEY.md) and Choose &
 * sign in the phone app: the plan on Me and on each project, asking for
 * Assured (interest only, ops told once), signing with a plan, the GEIO
 * gate on both clients, and ops switching the plan. Prisma and the session
 * are mocked; no database.
 */

const db = vi.hoisted(() => {
  const calls: { op: string; args: unknown }[] = [];
  const queued: Record<string, unknown[]> = {};
  const rec = (op: string, value: unknown = undefined) =>
    vi.fn(async (args?: unknown) => {
      calls.push({ op, args });
      return queued[op]?.length ? queued[op]!.shift() : value;
    });
  const client = {
    homeProject: {
      findMany: rec('homeProject.findMany', []),
      findFirst: rec('homeProject.findFirst', null),
      findUnique: rec('homeProject.findUnique', null),
      count: rec('homeProject.count', 0),
      updateMany: rec('homeProject.updateMany', { count: 1 }),
      update: rec('homeProject.update'),
      create: rec('homeProject.create', { id: 'p-new' }),
    },
    consultation: { count: rec('consultation.count', 0) },
    auditLog: { create: rec('auditLog.create') },
    brief: { findUnique: rec('brief.findUnique', null), findFirst: rec('brief.findFirst', null) },
    introduction: { findMany: rec('introduction.findMany', []), findFirst: rec('introduction.findFirst', null) },
    studioQuote: { findFirst: rec('studioQuote.findFirst', null), update: rec('studioQuote.update') },
    quoteDecision: { upsert: rec('quoteDecision.upsert') },
    appointment: { findFirst: rec('appointment.findFirst', null) },
    notification: { count: rec('notification.count', 0) },
    user: { findUnique: rec('user.findUnique', { locale: 'en' }) },
    $transaction: vi.fn(async (arg: unknown) => (typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(client) : arg)),
  };
  const next = (op: string, value: unknown) => (queued[op] ??= []).push(value);
  return { client, calls, next, queued };
});
vi.mock('@/lib/prisma', () => ({ prisma: db.client }));

type User = { id: string; name: string | null; phone: string | null; email: string | null; role: string };
const state = vi.hoisted(() => ({ user: null as null | User, projects: [] as unknown[] }));
vi.mock('@/modules/auth/session', () => ({
  getCurrentUser: vi.fn(async () => state.user),
  hashIp: () => null,
  requireRole: vi.fn(async (role: string) => {
    if (!state.user || (state.user.role !== role && state.user.role !== 'ADMIN')) throw new Error('UNAUTHORISED');
    return state.user;
  }),
}));
vi.mock('@/modules/notify/service', () => ({ notifyOps: vi.fn(async () => undefined), notifyStudio: vi.fn(async () => undefined) }));
vi.mock('@/modules/auth/otp', () => ({
  verifyOtp: vi.fn(async () => ({ ok: true, userId: 'u1', token: 't' })),
  requestOtp: vi.fn(async () => ({ ok: true, devCode: '654321' })),
}));
vi.mock('@/modules/app/first-before-gst', () => ({ firstBeforeGst: vi.fn(async () => 1_00_000_00) }));
vi.mock('@/modules/engagement/coins', () => ({
  settleCoins: vi.fn(async () => undefined),
  wallet: vi.fn(async () => ({ balance: 0, streak: 0, expiresOn: null, entries: [] })),
}));
vi.mock('@/modules/portal/project-store', () => ({ customerProjects: vi.fn(async () => state.projects) }));
vi.mock('@/modules/app/geio-budget', () => ({ withinBudget: vi.fn(async () => true), recordSpend: vi.fn(async () => undefined) }));
vi.mock('next/server', () => ({ after: (fn: () => unknown) => void fn() }));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.7' }) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const CUSTOMER: User = { id: 'u1', name: 'Priya Shah', phone: '+919800000000', email: null, role: 'CUSTOMER' };

beforeEach(() => {
  vi.stubEnv('CUSTOMER_LIVE', '1');
  vi.stubEnv('DATABASE_URL', 'postgres://test');
  vi.stubEnv('SAMPLE_DATA_ONLY', '');
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
  vi.clearAllMocks();
  db.calls.length = 0;
  for (const k of Object.keys(db.queued)) delete db.queued[k];
  state.user = { ...CUSTOMER, id: `u-${Math.random()}` };
  state.projects = [];
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const post = (body: unknown) => new Request('http://x', { method: 'POST', body: JSON.stringify(body) });
const ops = () => db.calls.map((c) => c.op);

describe('the plan rules', () => {
  it('reads the plan, the request and the calls', () => {
    expect(planView({ plan: 'BASIC', assuredRequestedAt: null }, 3)).toEqual({ plan: 'basic', assuredRequested: false, expertCalls: null });
    expect(planView({ plan: 'BASIC', assuredRequestedAt: new Date() }, 0).assuredRequested).toBe(true);
    expect(planView({ plan: 'ASSURED', assuredRequestedAt: new Date() }, 7)).toEqual({
      plan: 'assured',
      assuredRequested: false,
      expertCalls: { used: ASSURED_EXPERT_CALLS, total: ASSURED_EXPERT_CALLS },
    });
  });

  it('opens GEIO before signing and on Assured only', () => {
    expect(geioOpen([])).toBe(true);
    expect(geioOpen(['basic'])).toBe(false);
    expect(geioOpen(['basic', 'assured'])).toBe(true);
  });

  it('takes only basic or assured, and names no fee', () => {
    expect(parsePlan('assured')).toBe('assured');
    expect(parsePlan('ASSURED')).toBeNull();
    expect(JSON.stringify(PLAN_COPY)).not.toMatch(/₹|\d+%/);
  });

  it('tells ops where to switch it', () => {
    const m = messageFor({ kind: 'assured-requested', customer: 'Priya', studio: 'Teakline', atSigning: true });
    expect(m.template).toBe('plan.assured-requested');
    expect(m.title).toBe('Assured requested · Priya');
    expect(m.body).toContain('when signing with Teakline');
    expect(m.url).toBe('/ops/introductions');
  });
});

describe('GET /me and the plan', () => {
  it('is null before signing', async () => {
    const { GET } = await import('@/app/api/app/v1/me/route');
    expect((await (await GET()).json()).plan).toBeNull();
  });

  it('counts expert calls booked after signing on Assured', async () => {
    const signedAt = new Date('2026-10-01T00:00:00Z');
    db.next('homeProject.findMany', [
      { plan: 'BASIC', assuredRequestedAt: null, signedAt, createdAt: signedAt, introduction: { briefId: 'b0' } },
      { plan: 'ASSURED', assuredRequestedAt: signedAt, signedAt, createdAt: signedAt, introduction: { briefId: 'b1' } },
    ]);
    db.next('consultation.count', 2);
    const { GET } = await import('@/app/api/app/v1/me/route');
    const body = await (await GET()).json();
    expect(body.plan).toEqual({ plan: 'assured', assuredRequested: false, expertCalls: { used: 2, total: 5 } });
    const count = db.calls.find((c) => c.op === 'consultation.count')!.args as { where: Record<string, unknown> };
    // The free call before signing is older than the project, so it never counts.
    expect(count.where).toMatchObject({ briefId: 'b1', createdAt: { gt: signedAt } });
  });
});

describe('POST /plan — asking for Assured', () => {
  const ask = async (body: unknown = { plan: 'assured' }) => (await import('@/app/api/app/v1/plan/route')).POST(post(body));

  it('needs sign-in and asks only for Assured', async () => {
    state.user = null;
    expect((await ask()).status).toBe(401);
    state.user = CUSTOMER;
    expect((await ask({ plan: 'basic' })).status).toBe(400);
  });

  it('409s before signing, 403s a family member', async () => {
    expect((await ask()).status).toBe(409);
    db.next('homeProject.count', 1);
    expect((await ask()).status).toBe(403);
  });

  it('stamps the request, keeps Basic, audits and tells ops once', async () => {
    db.next('homeProject.findFirst', { id: 'p1', plan: 'BASIC', assuredRequestedAt: null, introduction: { studio: { tradeName: 'Teakline' } } });
    const res = await ask();
    expect(await res.json()).toEqual({ ok: true, plan: 'basic', assuredRequested: true });
    const upd = db.calls.find((c) => c.op === 'homeProject.updateMany')!.args as { where: unknown; data: Record<string, unknown> };
    expect(upd.where).toEqual({ id: 'p1', plan: 'BASIC', assuredRequestedAt: null });
    expect(Object.keys(upd.data)).toEqual(['assuredRequestedAt']); // never the plan itself
    expect(ops()).toContain('auditLog.create');
    const { notifyOps } = await import('@/modules/notify/service');
    expect(notifyOps).toHaveBeenCalledWith({ kind: 'assured-requested', customer: 'Priya Shah', studio: 'Teakline', atSigning: false });

    vi.clearAllMocks();
    db.next('homeProject.findFirst', { id: 'p1', plan: 'BASIC', assuredRequestedAt: new Date(), introduction: { studio: { tradeName: 'Teakline' } } });
    expect(await (await ask()).json()).toEqual({ ok: true, plan: 'basic', assuredRequested: true });
    expect(notifyOps).not.toHaveBeenCalled();
  });

  it('says so when already on Assured', async () => {
    db.next('homeProject.findFirst', { id: 'p1', plan: 'ASSURED', assuredRequestedAt: null, introduction: { studio: { tradeName: 'T' } } });
    expect(await (await ask()).json()).toEqual({ ok: true, plan: 'assured', assuredRequested: false });
  });
});

describe('Choose & sign in the app', () => {
  const QUOTE_ROW = {
    id: 'q1',
    number: 'Q-101',
    status: 'ISSUED',
    issuedOn: new Date('2026-10-09T00:00:00Z'),
    introductionId: 'i1',
    feeBps: 0,
    discountBps: 0,
    onSpotPaise: 0n,
    onSpotLabel: null,
    bookingAdvancePaise: 0n,
    gstBps: 0,
    phases: null,
    terms: null,
    studio: { slug: 'teakline', tradeName: 'Teakline', paymentPhases: null, matchingProfile: null },
    lines: [{ room: 'Kitchen', product: 'Base units', details: null, unit: 'UNIT', code: 'ONSITE', ratePaise: 1_00_000_00n, amountPaise: 1_00_000_00n, widthMm: null, heightMm: null, qtyMilli: 1000 }],
  };
  /** Everything `finalQuoteView` then `signFinalQuote` read, in order. */
  const queueSign = () => {
    db.next('brief.findUnique', { id: 'b1' });
    db.next('introduction.findMany', [{ id: 'i1' }]);
    db.next('studioQuote.findFirst', QUOTE_ROW);
    db.next('introduction.findFirst', { brief: { scope: 'FULL_HOME' } });
    db.next('brief.findUnique', { id: 'b1' });
    db.next('introduction.findMany', [{ id: 'i1' }]);
    db.next('studioQuote.findFirst', { id: 'q1', introductionId: 'i1', studioId: 's1', number: 'Q-101', clientName: 'Priya' });
    db.next('introduction.findFirst', { id: 'i1', briefId: 'b1', homeProject: null });
  };
  const sign = async (body: unknown) =>
    (await import('@/app/api/app/v1/choose/sign/[id]/route')).POST(post(body), { params: Promise.resolve({ id: 'q1' }) });

  it('maps the website’s choose view, with the visit to act on', () => {
    const view: ChooseView = {
      call: { scheduledFor: null, status: 'completed' },
      signedWith: null,
      studios: [
        {
          introductionId: 'i1',
          slug: 'teakline',
          name: 'Teakline',
          visits: [
            { id: 'a1', kind: 'FIRST_MEETING', status: 'COMPLETED', startsAt: '2026-10-01T05:00:00Z', location: null },
            { id: 'a2', kind: 'SITE_VISIT', status: 'PROPOSED', startsAt: '2026-10-14T05:00:00Z', location: 'Flat' },
          ],
          finalQuote: { id: 'q1', totalPaise: 100, issuedOn: null, accepted: false },
        },
      ],
    };
    const api = chooseApiView(view);
    expect(api.studios[0]).toMatchObject({ introId: 'i1', finalQuoteId: 'q1', visit: { id: 'a2', kind: 'site_visit', state: 'proposed', at: '2026-10-14T05:00:00Z' } });
    expect(api.expertNote).toBeNull();
  });

  it('GET /choose, the visit answer and the final quote need sign-in and stay on their own introduction', async () => {
    state.user = null;
    const choose = await import('@/app/api/app/v1/choose/route');
    expect((await choose.GET()).status).toBe(401);
    state.user = CUSTOMER;
    expect(await (await choose.GET()).json()).toEqual({ ok: true, view: null });

    const visits = await import('@/app/api/app/v1/choose/visits/[id]/route');
    const params = { params: Promise.resolve({ id: 'a2' }) };
    expect((await visits.POST(post({ answer: 'maybe' }), params)).status).toBe(400);
    db.next('brief.findUnique', { id: 'b1' });
    // Not on their introduction: the query is scoped, so nothing is found.
    expect((await visits.POST(post({ answer: 'confirm' }), params)).status).toBe(409);

    const quote = await import('@/app/api/app/v1/choose/quote/[id]/route');
    expect((await quote.GET(new Request('http://x'), { params: Promise.resolve({ id: 'q-other' }) })).status).toBe(404);
  });

  it('sends the signing code to their own number', async () => {
    const { POST } = await import('@/app/api/app/v1/choose/sign/[id]/code/route');
    const res = await POST(new Request('http://x', { method: 'POST', headers: { 'x-forwarded-for': '198.51.100.1' } }));
    expect(await res.json()).toEqual({ ok: true, devCode: '654321' });
    const { requestOtp } = await import('@/modules/auth/otp');
    expect(vi.mocked(requestOtp).mock.calls[0]![0]).toBe(CUSTOMER.phone);
  });

  it('refuses a sign without a plan or a code', async () => {
    expect((await sign({ code: '123456' })).status).toBe(400);
    expect((await sign({ plan: 'basic' })).status).toBe(400);
    expect((await sign({ code: '123456', plan: 'basic', agreed: false })).status).toBe(400);
  });

  it('signs on Basic', async () => {
    state.user = CUSTOMER;
    queueSign();
    const res = await sign({ code: '123456', plan: 'basic' });
    expect(await res.json()).toEqual({ ok: true, projectId: 'p-new', plan: 'basic', assuredRequested: false });
    const created = db.calls.find((c) => c.op === 'homeProject.create')!.args as { data: Record<string, unknown> };
    expect(created.data.assuredRequestedAt).toBeNull();
    expect(created.data).not.toHaveProperty('plan'); // the default, BASIC
    const { notifyOps } = await import('@/modules/notify/service');
    expect(notifyOps).not.toHaveBeenCalled();
    const { verifyOtp } = await import('@/modules/auth/otp');
    expect(vi.mocked(verifyOtp).mock.calls[0]![3]).toMatchObject({ bearer: true });
  });

  it('signs with Assured as interest: Basic, stamped, ops told', async () => {
    state.user = CUSTOMER;
    queueSign();
    const res = await sign({ code: '123456', plan: 'assured' });
    expect(await res.json()).toEqual({ ok: true, projectId: 'p-new', plan: 'basic', assuredRequested: true });
    const created = db.calls.find((c) => c.op === 'homeProject.create')!.args as { data: Record<string, unknown> };
    expect(created.data.assuredRequestedAt).toBeInstanceOf(Date);
    const { notifyOps } = await import('@/modules/notify/service');
    expect(notifyOps).toHaveBeenCalledWith({ kind: 'assured-requested', customer: 'Priya Shah', studio: 'Teakline', atSigning: true });
  });

  it('the website’s sign action sends the plan through the same module', async () => {
    state.user = CUSTOMER;
    queueSign();
    const { signAction } = await import('@/app/app/choose/actions');
    expect(await signAction({ quoteId: 'q1', code: '123456', agreed: true, plan: 'assured' })).toEqual({ ok: true });
    const created = db.calls.find((c) => c.op === 'homeProject.create')!.args as { data: Record<string, unknown> };
    expect(created.data.assuredRequestedAt).toBeInstanceOf(Date);
    expect(await signAction({ quoteId: 'q1', code: '123456', agreed: true, plan: 'gold' })).toEqual({ ok: false, error: 'Choose Basic or Assured.' });
  });
});

describe('the GEIO plan gate', () => {
  const PROJECT = { id: 'p1', role: 'owner', studio: 'Teakline', startOn: '2026-09-01T00:00:00Z', stages: [], phases: null, money: null, changes: { totalPaise: 0, items: [] }, updates: [], decisions: [], snags: [], documents: [] };
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ content: [{ type: 'tool_use', name: 'reply', input: { paragraphs: ['Fine.'], hand_to_expert: false } }], usage: { input_tokens: 1, output_tokens: 1 } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
  });
  const ask = async () => (await import('@/app/api/app/v1/geio/route')).POST(post({ question: 'Are we late?' }));

  it('403s a signed customer on Basic, and never asks the model', async () => {
    state.projects = [{ ...PROJECT, plan: 'basic' }];
    const res = await ask();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, reason: 'plan' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('answers on Assured, and before signing', async () => {
    state.projects = [{ ...PROJECT, plan: 'assured' }];
    expect((await ask()).status).toBe(200);
    state.projects = [];
    state.user = { ...CUSTOMER, id: 'u-fresh' };
    expect((await ask()).status).toBe(200);
  });

  it('holds on the website too', async () => {
    state.projects = [{ ...PROJECT, plan: 'basic' }];
    const { askGeioAction } = await import('@/app/app/geio/actions');
    expect(await askGeioAction({ question: 'q', history: [], lang: 'en', name: 'Priya' })).toEqual({ ok: false, reason: 'plan' });
  });
});

describe('ops switches the plan', () => {
  it('only ops, audited with before and after', async () => {
    const { setProjectPlan } = await import('@/modules/portal/plan-store');
    await expect(setProjectPlan('p1', 'ASSURED')).rejects.toThrow('UNAUTHORISED');
    state.user = { id: 'ops1', name: 'Ops', phone: null, email: null, role: 'OPS' };
    db.next('homeProject.findUnique', { plan: 'BASIC' });
    expect(await setProjectPlan('p1', 'ASSURED')).toEqual({ ok: true });
    expect(db.calls.find((c) => c.op === 'homeProject.update')!.args).toEqual({ where: { id: 'p1' }, data: { plan: 'ASSURED' } });
    const audit = db.calls.find((c) => c.op === 'auditLog.create')!.args as { data: Record<string, unknown> };
    expect(audit.data).toMatchObject({ actorId: 'ops1', action: 'plan.set', before: { plan: 'BASIC' }, after: { plan: 'ASSURED' } });
    expect(await setProjectPlan('gone', 'ASSURED')).toEqual({ ok: false, error: 'That project is gone.' });
  });
});
