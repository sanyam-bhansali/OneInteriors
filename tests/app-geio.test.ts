import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomerProject } from '@/modules/portal/project-store';
import type { HomeBrief } from '@/modules/app/home-summary';
import { briefFacts, geioFacts, projectFacts } from '@/modules/app/geio-facts';
import { expertFirstName, geioHistory, geioImage, geioLang, geioName, geioQuestion, withinLimit } from '@/modules/app/geio-input';

/**
 * GEIO for a real customer (POST /api/app/v1/geio, and the website's action
 * when signed in): the shared input checks, facts built from their own
 * project or brief instead of the sample flat, the cache mark on the shared
 * rules only, and the handover reaching ops.
 */

const db = vi.hoisted(() => ({
  brief: null as unknown,
  client: {
    brief: { findUnique: vi.fn(async () => db.brief), findFirst: vi.fn(async () => null) },
  },
}));
vi.mock('@/lib/prisma', () => ({ prisma: db.client }));

const state = vi.hoisted(() => ({
  user: null as null | { id: string; name: string | null; phone: string | null; email: string | null; role: string },
  projects: [] as unknown[],
}));
vi.mock('@/modules/auth/session', () => ({ getCurrentUser: vi.fn(async () => state.user) }));
vi.mock('@/modules/portal/project-store', () => ({ customerProjects: vi.fn(async () => state.projects) }));
vi.mock('@/modules/app/geio-budget', () => ({ withinBudget: vi.fn(async () => true), recordSpend: vi.fn(async () => undefined) }));
vi.mock('@/modules/notify/service', () => ({ notifyOps: vi.fn(async () => undefined) }));
vi.mock('next/server', () => ({ after: (fn: () => unknown) => void fn() }));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.9' }) }));

const NOW = new Date('2026-10-11T04:30:00Z');
const day = (iso: string) => new Date(`${iso}T00:00:00+05:30`);

const BRIEF: HomeBrief = {
  propertyType: 'BHK_3',
  carpetAreaSqft: 1150,
  locality: 'kharadi',
  society: 'Gera World of Joy',
  scope: 'FULL_HOME',
  scopeRooms: [],
  tier: 'LUXURY',
  budgetMinPaise: 12_00_000_00,
  budgetMaxPaise: 18_00_000_00,
  possessionStatus: 'HAVE_KEYS',
  possessionOn: null,
};

const PROJECT: CustomerProject = {
  id: 'p1',
  role: 'owner',
  studio: 'Teakline Studio',
  startOn: day('2026-09-01').toISOString(),
  stages: [
    { key: 'DESIGN', label: 'Design signed off', targetOn: day('2026-09-15'), state: 'done', late: false },
    { key: 'PRODUCTION', label: 'Factory production', targetOn: day('2026-10-05'), state: 'now', late: true },
    { key: 'HANDOVER', label: 'Handover', targetOn: day('2026-12-14'), state: 'later', late: false },
  ],
  phases: null,
  money: {
    contractPaise: 14_20_000_00,
    paidPaise: 4_26_000_00,
    next: { index: 1, label: 'Material delivery', pct: 40, amountPaise: 5_68_000_00, dueOn: '2026-10-20', paidOn: null, state: 'next' },
    laterPaise: 4_26_000_00,
    stages: [
      { index: 0, label: 'Booking', pct: 30, amountPaise: 4_26_000_00, dueOn: null, paidOn: '2026-09-01', state: 'paid' },
      { index: 1, label: 'Material delivery', pct: 40, amountPaise: 5_68_000_00, dueOn: '2026-10-20', paidOn: null, state: 'next' },
      { index: 2, label: 'Handover', pct: 30, amountPaise: 4_26_000_00, dueOn: null, paidOn: null, state: 'later' },
    ],
  },
  changes: { totalPaise: 0, items: [] },
  updates: [{ id: 'u1', note: 'Kitchen carcass levelled and fixed.', stage: 'PRODUCTION', at: day('2026-10-10').toISOString(), byStudio: true, photos: [] }],
  decisions: [
    {
      id: 'd1',
      title: 'Wardrobe shutter finish',
      why: 'The factory cuts shutters next week.',
      dueOn: day('2026-10-14').toISOString(),
      daysLeft: 3,
      state: 'open',
      options: [
        { name: 'Sage matte', note: 'Soft-touch', extraPaise: 0, swatch: null },
        { name: 'Walnut grain', note: 'Warm wood look', extraPaise: 14_500_00, swatch: null },
      ],
      chosenIndex: null,
      chosenAt: null,
      byStudio: true,
      votes: [],
    },
  ],
  snags: [],
  documents: [],
};

describe('what the clients may send', () => {
  it('keeps alternating turns that start with the customer and end with GEIO', () => {
    expect(
      geioHistory([
        { role: 'assistant', text: 'hello' },
        { role: 'user', text: ' a ' },
        { role: 'user', text: 'b' },
        { role: 'assistant', text: 'c' },
        { role: 'user', text: 'd' },
        'junk',
      ]),
    ).toEqual([
      { role: 'user', text: 'a' },
      { role: 'assistant', text: 'c' },
    ]);
    expect(geioHistory('nope')).toEqual([]);
  });

  it('takes a JPEG, PNG or WebP data URL and nothing else', () => {
    expect(geioImage('data:image/jpeg;base64,AAAA')).toEqual({ mediaType: 'image/jpeg', data: 'AAAA' });
    expect(geioImage('data:image/gif;base64,AAAA')).toBeNull();
    expect(geioImage('https://example.com/a.jpg')).toBeNull();
    expect(geioImage(`data:image/png;base64,${'A'.repeat(2_000_001)}`)).toBeNull();
  });

  it('asks about a photo sent without a question, and refuses an empty one', () => {
    expect(geioQuestion('  ', { mediaType: 'image/png', data: 'A' })).toBe('Is this normal?');
    expect(geioQuestion('', null)).toBe('');
    expect(geioQuestion('x'.repeat(900), null)).toHaveLength(600);
  });

  it('cleans the language, the name and the expert', () => {
    expect(geioLang('mr')).toBe('mr');
    expect(geioLang('fr')).toBe('en');
    expect(geioName('Priya<script>')).toBe('Priyascript');
    expect(geioName(42)).toBe('there');
    expect(expertFirstName('Ar. Meera Kulkarni')).toBe('Meera');
  });

  it('allows twenty questions in ten minutes per key', () => {
    const t = 1_000_000;
    for (let i = 0; i < 20; i++) expect(withinLimit('test:a', t + i)).toBe(true);
    expect(withinLimit('test:a', t + 21)).toBe(false);
    expect(withinLimit('test:b', t + 21)).toBe(true);
    expect(withinLimit('test:a', t + 10 * 60_000 + 1)).toBe(true);
  });
});

describe('facts for a customer with no studio yet', () => {
  const facts = briefFacts('Meera', BRIEF, NOW);

  it('describes their home from the brief, and says no studio is signed', () => {
    expect(facts.text).toContain('Gera World of Joy, Kharadi, 3 BHK, 1150 sq ft carpet');
    expect(facts.text).toContain('SCOPE OF WORK: Full home');
    expect(facts.text).toContain('FINISH BAND THEY CHOSE: Luxury');
    expect(facts.text).toContain('₹12,00,000 to ₹18,00,000');
    expect(facts.text).toContain('no studio is signed yet');
    expect(facts.lines).toEqual([]);
  });

  it('never carries the sample flat', () => {
    const sample = geioFacts('Meera').text;
    expect(sample).toContain('Flat 1204, Baner');
    expect(facts.text).not.toContain('Flat 1204');
    expect(facts.text).not.toMatch(/per sq|\/sq/i);
  });

  it('allows only the budget they gave', () => {
    expect(facts.allowed.paise).toContain(18_00_000_00);
    expect(facts.allowed.paise).not.toContain(86_000_00);
  });

  it('still says something with no brief at all', () => {
    expect(briefFacts('Meera', null, NOW).text).toContain('have not told us about their home');
  });
});

describe('facts for a customer with a project', () => {
  const facts = projectFacts('Meera', PROJECT, BRIEF, NOW);

  it('carries their studio, stages, money and decisions', () => {
    expect(facts.text).toContain('STUDIO: Teakline Studio');
    expect(facts.text).toContain('Factory production: happening now');
    expect(facts.text).toContain('past its target');
    expect(facts.text).toContain('Running 6 days late');
    expect(facts.text).toContain('₹14,20,000');
    expect(facts.text).toContain('NEXT PAYMENT: Material delivery, ₹5,68,000, due 20 Oct');
    expect(facts.text).toContain('Walnut grain (Warm wood look; +₹14,500)');
    expect(facts.text).toContain('Kitchen carcass levelled');
    expect(facts.text).not.toContain('Flat 1204');
    expect(facts.text).not.toMatch(/\d+%/);
  });

  it('lets GEIO say their figures, and sums of them, and nothing else', async () => {
    const { checked } = await import('@/modules/app/geio');
    const ok = checked({ paragraphs: ['Your next payment is ₹5,68,000, and walnut adds ₹14,500.'], hand_to_expert: false }, facts.allowed, 'Priya', 'q');
    expect(ok.handover).toBeNull();
    const stray = checked({ paragraphs: ['That would be ₹86,000.'], hand_to_expert: false, sources: [14] }, facts.allowed, 'Priya', 'q', facts.lines);
    expect(stray.handover).not.toBeNull();
    expect(stray.sources).toEqual([]);
  });

  it('says when the money is not recorded, and who is asking', () => {
    const f = projectFacts('Meera', { ...PROJECT, role: 'family', money: null }, BRIEF, NOW);
    expect(f.text).toContain('not recorded in the app');
    expect(f.text).toContain('a family member');
  });
});

/** The model's answer, as the API returns it. */
function modelReply(input: Record<string, unknown>) {
  return new Response(
    JSON.stringify({ content: [{ type: 'tool_use', name: 'reply', input }], usage: { input_tokens: 100, output_tokens: 50 } }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

describe('POST /api/app/v1/geio', () => {
  let sent: { system: { text: string; cache_control?: unknown }[] }[] = [];

  beforeEach(() => {
    vi.stubEnv('CUSTOMER_LIVE', '1');
    vi.stubEnv('DATABASE_URL', 'postgres://test');
    vi.stubEnv('SAMPLE_DATA_ONLY', '');
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.clearAllMocks();
    sent = [];
    state.user = { id: `u-${Math.random()}`, name: 'Priya Shah', phone: '+919800000000', email: null, role: 'CUSTOMER' };
    state.projects = [PROJECT];
    db.brief = { ...BRIEF, budgetMinPaise: BigInt(BRIEF.budgetMinPaise!), budgetMaxPaise: BigInt(BRIEF.budgetMaxPaise!), possessionOn: null };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { body: string }) => {
        sent.push(JSON.parse(init.body));
        return modelReply({ paragraphs: ['Factory production is running late.'], hand_to_expert: false });
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const post = (body: unknown) => new Request('http://x/api/app/v1/geio', { method: 'POST', body: JSON.stringify(body) });

  it('needs sign-in', async () => {
    state.user = null;
    const { POST } = await import('@/app/api/app/v1/geio/route');
    expect((await POST(post({ question: 'hi' }))).status).toBe(401);
  });

  it('answers about their own project, with the cache mark on the shared rules only', async () => {
    const { POST } = await import('@/app/api/app/v1/geio/route');
    const res = await POST(post({ question: 'Are we late?', lang: 'hi', history: [] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.reply.paragraphs).toEqual(['Factory production is running late.']);

    const [rules, facts] = sent[0]!.system;
    expect(rules!.cache_control).toEqual({ type: 'ephemeral' });
    expect(facts!.cache_control).toBeUndefined();
    expect(rules!.text).not.toContain('Teakline');
    expect(facts!.text).toContain('Teakline Studio');
    expect(facts!.text).not.toContain('Flat 1204');
  });

  it('with no project yet, answers from the brief', async () => {
    state.projects = [];
    const { POST } = await import('@/app/api/app/v1/geio/route');
    await POST(post({ question: 'What next?' }));
    expect(sent[0]!.system[1]!.text).toContain('no studio is signed yet');
  });

  it('400s an empty question, 429s the twenty-first, 503s with no model', async () => {
    const { POST } = await import('@/app/api/app/v1/geio/route');
    const empty = await POST(post({ question: '   ' }));
    expect(empty.status).toBe(400);
    expect(await empty.json()).toEqual({ ok: false, reason: 'empty' });

    for (let i = 0; i < 20; i++) await POST(post({ question: `q${i}` }));
    const busy = await POST(post({ question: 'one more' }));
    expect(busy.status).toBe(429);
    expect((await busy.json()).reason).toBe('busy');

    state.user = { ...state.user!, id: 'u-fresh' };
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const off = await POST(post({ question: 'anyone?' }));
    expect(off.status).toBe(503);
    expect((await off.json()).reason).toBe('unavailable');
  });

  it('tells ops when GEIO hands over', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => modelReply({ paragraphs: ['Your expert will help.'], hand_to_expert: true, handover_note: 'Priya wants a discount.' })));
    const { notifyOps } = await import('@/modules/notify/service');
    const { POST } = await import('@/app/api/app/v1/geio/route');
    const body = await (await POST(post({ question: 'Can I get a discount?' }))).json();
    expect(body.reply.handover).toBe('Priya wants a discount.');
    await vi.waitFor(() =>
      expect(notifyOps).toHaveBeenCalledWith({ kind: 'geio-handover', customer: 'Priya Shah', home: 'Gera World of Joy, Kharadi', note: 'Priya wants a discount.' }),
    );
  });
});

describe("the website's GEIO", () => {
  let sent: { system: { text: string }[] }[] = [];
  beforeEach(() => {
    vi.stubEnv('DATABASE_URL', 'postgres://test');
    vi.stubEnv('SAMPLE_DATA_ONLY', '');
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.clearAllMocks();
    sent = [];
    state.projects = [PROJECT];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { body: string }) => {
        sent.push(JSON.parse(init.body));
        return modelReply({ paragraphs: ['Fine.'], hand_to_expert: true, handover_note: 'n' });
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('answers a signed-in customer about their own home', async () => {
    state.user = { id: 'web-1', name: 'Priya', phone: null, email: null, role: 'CUSTOMER' };
    const { askGeioAction } = await import('@/app/app/geio/actions');
    expect((await askGeioAction({ question: 'q', history: [], lang: 'en', name: 'Priya' })).ok).toBe(true);
    expect(sent[0]!.system[1]!.text).toContain('Teakline Studio');
  });

  it('answers the signed-out sample about the example flat, and tells nobody', async () => {
    state.user = null;
    const { askGeioAction } = await import('@/app/app/geio/actions');
    await askGeioAction({ question: 'q', history: [], lang: 'en', name: 'Priya' });
    expect(sent[0]!.system[1]!.text).toContain('Flat 1204, Baner');
    const { notifyOps } = await import('@/modules/notify/service');
    expect(notifyOps).not.toHaveBeenCalled();
  });
});
