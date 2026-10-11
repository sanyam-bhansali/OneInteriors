import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STUDIOS } from '@/data/studios';
import { publicStudios } from '@/modules/studio/public';
import { EMPTY_BRIEF, type Brief } from '@/modules/brief/types';
import { journeyCompare, journeyMatches, journeyStudios, quoteValidTill, studioProfile } from '@/modules/app/journey-view';
import { listedStudios, plainWords, quotesFor, topMatches } from '@/modules/app/journey';
import { filedRatesFor } from '@/data/filed-rates';
import { slotDays } from '@/modules/consultation/slots';
import { VERIFIED_STUDIOS } from '@/lib/claims';

/**
 * The phone app's first-visit journey (docs/APP-API-JOURNEY.md): the public
 * estimate, matches, studios, profile and compare routes; sign-in with the
 * brief and its consent; the journey submit; the expert's slots and booking.
 * Every answer is checked against the functions the website's screens call,
 * so the two cannot disagree. No database: Prisma and the session are mocked.
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
    brief: { findUnique: rec('brief.findUnique', null) },
    shortlist: { deleteMany: rec('shortlist.deleteMany'), upsert: rec('shortlist.upsert'), findMany: rec('shortlist.findMany', []) },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  };
  const next = (op: string, value: unknown) => (queued[op] ??= []).push(value);
  return { client, calls, next, queued };
});
vi.mock('@/lib/prisma', () => ({ prisma: db.client }));

const state = vi.hoisted(() => ({
  user: null as null | { id: string; name: string | null; phone: string | null; email: string | null; role: string },
  allowed: true,
  data: null as unknown,
  loaded: { brief: null as unknown, found: false, id: undefined as string | undefined },
}));
vi.mock('@/modules/auth/session', () => ({
  getCurrentUser: vi.fn(async () => state.user),
  hashIp: (ip: string | null) => (ip ? `h:${ip}` : null),
  requireRole: vi.fn(async () => state.user),
}));
vi.mock('@/modules/rate-limit/store', async (orig) => ({
  ...(await orig<typeof import('@/modules/rate-limit/store')>()),
  consume: vi.fn(async () => (state.allowed ? { allowed: true, remaining: 1 } : { allowed: false, retryInSeconds: 120 })),
}));
vi.mock('@/modules/app/app-data', () => ({ appData: vi.fn(async () => state.data) }));
vi.mock('@/modules/brief/repository', () => ({
  loadBrief: vi.fn(async () => state.loaded),
  saveContact: vi.fn(async () => ({ ok: true, persisted: true })),
  readAnonKey: vi.fn(async () => null),
}));
vi.mock('@/modules/consent/record', () => ({ recordConsent: vi.fn(async () => ({ ok: true })) }));
vi.mock('@/modules/auth/otp', () => ({
  verifyOtp: vi.fn(async () => ({ ok: true, userId: 'u-new', token: 'tok' })),
  requestOtp: vi.fn(async () => ({ ok: true, devCode: '123456' })),
}));
vi.mock('@/modules/analytics/record', () => ({ record: vi.fn(async () => undefined) }));
vi.mock('@/modules/matching/store', () => ({ storeMatches: vi.fn(async () => undefined) }));
vi.mock('@/modules/quotation/journey-repository', () => ({ recordFirstQuoteForBrief: vi.fn(async () => undefined) }));
vi.mock('@/modules/consultation/availability', () => ({ availableSlots: vi.fn(async () => SLOTS) }));
vi.mock('@/modules/consultation/request', () => ({
  MAX_STUDIOS: 5,
  requestConsultation: vi.fn(async (input: { startsAt?: string }) =>
    input.startsAt === GONE ? { ok: false, errors: { startsAt: 'That time has just gone.' } } : { ok: true, id: 'c1', scheduledFor: input.startsAt },
  ),
}));

const SLOTS = [
  { startsAt: '2026-10-13T06:00:00.000Z', experts: ['e1'] },
  { startsAt: '2026-10-12T05:30:00.000Z', experts: ['e1'] },
  { startsAt: '2026-10-12T06:00:00.000Z', experts: ['e1'] },
];
const GONE = '2026-10-12T05:30:00.000Z';

const BRIEF: Brief = {
  ...EMPTY_BRIEF,
  contactName: 'Priya',
  propertyType: 'BHK_2',
  carpetAreaSqft: 850,
  locality: 'baner',
  scope: 'FULL_HOME',
  tier: 'PREMIUM',
  budgetMinPaise: 12_00_000_00,
  budgetMaxPaise: 20_00_000_00,
  styleLikes: ['warm-modern', 'scandinavian'],
  completedAt: '2026-10-10T06:00:00.000Z',
};

/** The roster, with one studio paused: it must appear nowhere. */
const PAUSED = STUDIOS[0]!.slug;
const DATA = {
  studios: publicStudios(STUDIOS.map((s, i) => (i === 0 ? { ...s, pausedAt: '2026-10-01T00:00:00Z', pausedReason: 'x' } : s))),
  rates: {},
  allowUnverified: false,
  sample: false,
  ratesReal: false,
};
const NOW = new Date('2026-10-11T06:00:00Z');

beforeEach(() => {
  vi.stubEnv('CUSTOMER_LIVE', '1');
  vi.stubEnv('DATABASE_URL', 'postgres://test');
  vi.stubEnv('SAMPLE_DATA_ONLY', '');
  vi.clearAllMocks();
  db.calls.length = 0;
  for (const k of Object.keys(db.queued)) delete db.queued[k];
  state.user = { id: 'u1', name: 'Priya Shah', phone: '+919800000000', email: null, role: 'CUSTOMER' };
  state.allowed = true;
  state.data = DATA;
  state.loaded = { brief: BRIEF, found: true, id: 'b1' };
});
afterEach(() => vi.unstubAllEnvs());

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://x/api/app/v1/${path}`, { method: 'POST', headers: { 'x-forwarded-for': '203.0.113.9', ...headers }, body: JSON.stringify(body) });

describe('the journey answers are the website’s', () => {
  it('matches each band with the same ranking and quotes as the website’s screens', () => {
    const view = journeyMatches(BRIEF, DATA, NOW);
    const web = topMatches(BRIEF, DATA.studios, DATA.rates, filedRatesFor, DATA.allowUnverified);
    const quotes = quotesFor(BRIEF, web, DATA.rates, filedRatesFor);
    expect(view.tier).toBe('premium');
    expect(view.tiers.premium.map((m) => m.slug)).toEqual(web.map((m) => m.studio.slug));
    expect(view.tiers.premium.map((m) => m.quote.totalPaise)).toEqual(quotes.map((q) => q.quote.totalPaise));
    const first = view.tiers.premium[0]!;
    expect(first.score).toBe(Math.round(web[0]!.match.score));
    expect(first.quote.beforeGstPaise + first.quote.gstPaise).toBe(first.quote.totalPaise);
    expect(first.quote.lines.length).toBeGreaterThan(0);
    expect(first.quote.validTill).toBe(quoteValidTill(BRIEF.completedAt, NOW).toISOString());
    expect(first.rating).toBeNull(); // no verified reviews exist yet
    expect(view.style).toEqual({ primary: expect.objectContaining({ tag: 'warm-modern' }), secondary: expect.objectContaining({ tag: 'scandinavian' }) });
    expect(view.studioCount).toBe(Math.min(listedStudios(DATA).length, VERIFIED_STUDIOS));
    for (const t of ['essential', 'premium', 'luxury'] as const) {
      expect(view.tiers[t].some((m) => m.slug === PAUSED)).toBe(false);
    }
  });

  it('shows no matches before the brief is finished, as the website does', () => {
    const view = journeyMatches({ ...BRIEF, completedAt: null }, DATA, NOW);
    expect(view.tiers.premium).toEqual([]);
  });

  it('lists every listed studio best first, scored only on a finished brief', () => {
    const all = journeyStudios(BRIEF, DATA, NOW);
    expect(all.map((s) => s.slug)).not.toContain(PAUSED);
    expect(all).toHaveLength(listedStudios(DATA).length);
    const scores = all.map((s) => s.score ?? -1);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    expect(journeyStudios({ ...BRIEF, completedAt: null }, DATA, NOW).every((s) => s.score === null)).toBe(true);
  });

  it('opens a listed studio’s profile and nothing else', () => {
    const slug = listedStudios(DATA)[0]!.slug;
    const p = studioProfile(slug, DATA, NOW)!;
    expect(p.slug).toBe(slug);
    expect(p.checks.every((c) => typeof c.passed === 'boolean')).toBe(true);
    expect(p.reviews).toEqual([]);
    expect(p.delivery.line).toEqual(expect.any(String));
    expect(studioProfile(PAUSED, DATA, NOW)).toBeNull();
    expect(studioProfile('nobody', DATA, NOW)).toBeNull();
  });

  it('compares in the website’s plain words, and never prices an unlisted studio', () => {
    const slugs = journeyMatches(BRIEF, DATA, NOW).tiers.premium.map((m) => m.slug);
    const view = journeyCompare(BRIEF, [...slugs, PAUSED], DATA);
    expect(view.columns.map((c) => c.slug)).toEqual(slugs);
    const quotes = quotesFor(BRIEF, topMatches(BRIEF, DATA.studios, DATA.rates, filedRatesFor, false), DATA.rates, filedRatesFor);
    expect(view.plainWords).toEqual(plainWords(quotes));
    expect(view.columns[0]!.checks).toMatch(/^\d+\/\d+$/);
  });
});

describe('the public journey routes', () => {
  it('answer the estimate, matches, studios and compare', async () => {
    const est = await (await import('@/app/api/app/v1/journey/estimate/route')).POST(post('journey/estimate', { brief: BRIEF }));
    expect(est.status).toBe(200);
    const range = (await est.json()).range;
    expect(range.lowPaise).toBeLessThanOrEqual(range.highPaise);

    const m = await (await import('@/app/api/app/v1/journey/matches/route')).POST(post('journey/matches', { brief: BRIEF }));
    const mb = await m.json();
    expect(mb.ok).toBe(true);
    expect(mb.tiers.premium.length).toBeGreaterThan(0);
    expect(mb.ratesReal).toBe(false);

    const s = await (await import('@/app/api/app/v1/journey/studios/route')).POST(post('journey/studios', { brief: BRIEF }));
    expect((await s.json()).studios.length).toBe(listedStudios(DATA).length);

    const c = await (await import('@/app/api/app/v1/journey/compare/route')).POST(post('journey/compare', { brief: BRIEF, slugs: [] }));
    expect((await c.json()).columns.length).toBe(mb.tiers.premium.length);
  });

  it('refuse a body without a brief, and slugs that are not a list', async () => {
    const { POST } = await import('@/app/api/app/v1/journey/matches/route');
    expect((await POST(post('journey/matches', { nope: 1 }))).status).toBe(400);
    expect((await POST(post('journey/matches', 'x'))).status).toBe(400);
    const compare = await import('@/app/api/app/v1/journey/compare/route');
    expect((await compare.POST(post('journey/compare', { brief: BRIEF, slugs: 'a' }))).status).toBe(400);
  });

  it('are limited per address, and closed while the customer side is', async () => {
    state.allowed = false;
    const { POST } = await import('@/app/api/app/v1/journey/estimate/route');
    const res = await POST(post('journey/estimate', { brief: BRIEF }));
    expect(res.status).toBe(429);
    const { consume } = await import('@/modules/rate-limit/store');
    // Keyed on a hash of the address, never the address itself.
    expect(vi.mocked(consume).mock.calls[0]![0]).toBe('app-journey:h:203.0.113.9');
    state.allowed = true;
    vi.stubEnv('CUSTOMER_LIVE', '');
    expect((await POST(post('journey/estimate', { brief: BRIEF }))).status).toBe(404);
  });

  it('answer a listed studio’s profile and 404 a paused one', async () => {
    const { GET } = await import('@/app/api/app/v1/studios/[slug]/route');
    const slug = listedStudios(DATA)[0]!.slug;
    const ok = await GET(new Request('http://x'), { params: Promise.resolve({ slug }) });
    expect((await ok.json()).studio.slug).toBe(slug);
    expect((await GET(new Request('http://x'), { params: Promise.resolve({ slug: PAUSED }) })).status).toBe(404);
  });
});

describe('sign-in with the brief and its consent', () => {
  const verify = async (body: unknown) => (await import('@/app/api/app/v1/auth/otp/verify/route')).POST(post('auth/otp/verify', body));

  it('refuses a brief without consent to share it, before the code is spent', async () => {
    const res = await verify({ phone: '9800000000', code: '123456', name: 'Priya', brief: BRIEF, consent: { share: false, offers: true } });
    expect(res.status).toBe(400);
    const { verifyOtp } = await import('@/modules/auth/otp');
    expect(verifyOtp).not.toHaveBeenCalled();
    expect((await verify({ phone: '9800000000', code: '123456', name: 'Priya', brief: BRIEF })).status).toBe(400);
  });

  it('records the consent for the verified account, then saves the brief onto it', async () => {
    const res = await verify({ phone: '98000 00000', code: '123456', name: 'Priya', brief: BRIEF, consent: { share: true, offers: false } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, token: 'tok' });
    const { recordConsent } = await import('@/modules/consent/record');
    const { saveContact } = await import('@/modules/brief/repository');
    expect(recordConsent).toHaveBeenCalledWith(
      [
        { purpose: 'DATA_PROCESSING', granted: true },
        { purpose: 'MARKETING_WHATSAPP', granted: false },
      ],
      'quiz_contact_step',
      { userId: 'u-new' },
    );
    expect(saveContact).toHaveBeenCalledWith(expect.objectContaining({ locality: 'baner' }), expect.objectContaining({ name: 'Priya', phone: '+919800000000' }), { userId: 'u-new' });
    expect(vi.mocked(recordConsent).mock.invocationCallOrder[0]!).toBeLessThan(vi.mocked(saveContact).mock.invocationCallOrder[0]!);
  });

  it('asks a returning customer for neither', async () => {
    const res = await verify({ phone: '9800000000', code: '123456' });
    expect(res.status).toBe(200);
    const { recordConsent } = await import('@/modules/consent/record');
    expect(recordConsent).not.toHaveBeenCalled();
  });

  it('records nothing when the code is wrong', async () => {
    const { verifyOtp } = await import('@/modules/auth/otp');
    vi.mocked(verifyOtp).mockResolvedValueOnce({ ok: false, reason: 'invalid_code' });
    const res = await verify({ phone: '9800000000', code: '000000', name: 'Priya', brief: BRIEF, consent: { share: true, offers: true } });
    expect(res.status).toBe(400);
    const { recordConsent } = await import('@/modules/consent/record');
    expect(recordConsent).not.toHaveBeenCalled();
  });
});

describe('POST /journey/submit', () => {
  const submit = async (body: unknown) => (await import('@/app/api/app/v1/journey/submit/route')).POST(post('journey/submit', body));

  it('needs sign-in and a list of studios', async () => {
    state.user = null;
    expect((await submit({ slugs: [] })).status).toBe(401);
    state.user = { id: 'u1', name: 'P', phone: null, email: null, role: 'CUSTOMER' };
    expect((await submit({})).status).toBe(400);
  });

  it('keeps the journey and the chosen listed studios as the shortlist, in order', async () => {
    const [a, b] = listedStudios(DATA);
    const res = await submit({ slugs: [b!.slug, a!.slug, PAUSED] });
    expect(await res.json()).toEqual({ ok: true, shortlisted: 2 });
    const { storeMatches } = await import('@/modules/matching/store');
    expect(storeMatches).toHaveBeenCalled();
    const upserts = db.calls.filter((c) => c.op === 'shortlist.upsert').map((c) => (c.args as { create: { studioId: string; position: number } }).create);
    expect(upserts).toEqual([
      { briefId: 'b1', studioId: b!.id, position: 0 },
      { briefId: 'b1', studioId: a!.id, position: 1 },
    ]);
  });

  it('409s without a saved, finished brief', async () => {
    state.loaded = { brief: null, found: false, id: undefined };
    expect((await submit({ slugs: [] })).status).toBe(409);
    state.loaded = { brief: { ...BRIEF, completedAt: null }, found: true, id: 'b1' };
    expect((await submit({ slugs: [] })).status).toBe(409);
  });
});

describe('the expert call', () => {
  it('groups open slots by IST day, in order', () => {
    expect(slotDays(SLOTS)).toEqual([
      {
        date: '2026-10-12',
        slots: [
          { startsAt: '2026-10-12T05:30:00.000Z', label: expect.stringMatching(/11:00\s?am/i) },
          { startsAt: '2026-10-12T06:00:00.000Z', label: expect.stringMatching(/11:30\s?am/i) },
        ],
      },
      { date: '2026-10-13', slots: [{ startsAt: '2026-10-13T06:00:00.000Z', label: expect.stringMatching(/11:30\s?am/i) }] },
    ]);
  });

  it('GET /expert/slots needs sign-in and names the expert', async () => {
    const { GET } = await import('@/app/api/app/v1/expert/slots/route');
    const body = await (await GET()).json();
    expect(body.expert.name).toBe('Meera');
    expect(body.days).toHaveLength(2);
    state.user = null;
    expect((await GET()).status).toBe(401);
  });

  it('books on the shortlist, and 409s a slot somebody took', async () => {
    db.next('brief.findUnique', { id: 'b1', contactName: 'Priya', contactPhone: '+919800000000' });
    db.next('shortlist.findMany', [{ studioId: 's2' }, { studioId: 's1' }]);
    const { POST } = await import('@/app/api/app/v1/expert/book/route');
    const ok = await POST(post('expert/book', { startsAt: '2026-10-12T06:00:00.000Z' }));
    expect(ok.status).toBe(200);
    expect((await ok.json()).booking.startsAt).toBe('2026-10-12T06:00:00.000Z');
    const { requestConsultation } = await import('@/modules/consultation/request');
    expect(vi.mocked(requestConsultation).mock.calls[0]![0]).toMatchObject({ briefId: 'b1', studioIds: ['s2', 's1'], shareConsent: true });

    db.next('brief.findUnique', { id: 'b1', contactName: 'Priya', contactPhone: '+919800000000' });
    expect((await POST(post('expert/book', { startsAt: GONE }))).status).toBe(409);
    expect((await POST(post('expert/book', { startsAt: 'soon' }))).status).toBe(400);
  });

  it('falls back to the brief’s own matches when there is no shortlist', async () => {
    db.next('brief.findUnique', { id: 'b1', contactName: 'Priya', contactPhone: '+919800000000' });
    const { POST } = await import('@/app/api/app/v1/expert/book/route');
    await POST(post('expert/book', { startsAt: '2026-10-12T06:00:00.000Z' }));
    const { requestConsultation } = await import('@/modules/consultation/request');
    const ids = topMatches(BRIEF, DATA.studios, DATA.rates, filedRatesFor, false).map((m) => m.studio.id);
    expect(vi.mocked(requestConsultation).mock.calls[0]![0].studioIds).toEqual(ids);
  });
});
