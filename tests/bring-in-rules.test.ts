import { afterEach, describe, expect, it, vi } from 'vitest';
import { templateStages } from '@/modules/portal/quote-to-plan';
import { dayToDb } from '@/modules/project/working-days';
import { anchorDays, broughtInLine, checkPayments, doneSteps, shiftedStart, stepChoices, stepKey } from '@/modules/studio-bring-in/rules';
import { hauspireConfig, importOpenFor, readHauspire, searchHauspire } from '@/modules/studio-bring-in/hauspire-source';

/** "Add an existing project": where it is now, the dates, the money (docs/studio-os/BRING-IN-PROJECTS.md). */

const TODAY = '2026-10-20';
const PAYMENTS = [
  { label: 'Booking advance', amountPaise: 2_500_000 },
  { label: 'Design advance', amountPaise: 5_000_000 },
  { label: 'Material procurement', amountPaise: 40_000_000 },
];
const plan = (start = TODAY) => templateStages(dayToDb(start), 120, { template: null, bhk: 2, payments: PAYMENTS });

describe('the steps to pick from', () => {
  const stages = plan();

  it('design: the design steps only; execution: the execution steps, not the handover itself', () => {
    const d = stepChoices(stages, 'DESIGN');
    expect(d.length).toBeGreaterThan(5);
    expect(d.every((c) => c.stageKind === 'DESIGN')).toBe(true);
    const e = stepChoices(stages, 'EXECUTION');
    expect(e.every((c) => c.stageKind !== 'DESIGN')).toBe(true);
    expect(e.some((c) => c.label === 'Provisional handover')).toBe(false);
    expect(stepChoices(stages, 'SNAGS')).toEqual([]);
  });

  it('design with a step: everything up to it is done, nothing after', () => {
    const pick = stepChoices(stages, 'DESIGN')[3]!;
    const r = doneSteps(stages, 'DESIGN', pick.key);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect([...r.done[0]!.items]).toEqual([0, 1, 2, 3]);
    expect(r.done[0]!.complete).toBe(false);
    expect(r.done.slice(1).every((s) => s.items.size === 0)).toBe(true);
  });

  it('design with nothing picked: nothing done', () => {
    const r = doneSteps(stages, 'DESIGN', null);
    expect(r.ok && r.done.every((s) => s.items.size === 0)).toBe(true);
  });

  it('execution: design is done and every stage before the picked one', () => {
    const e = stepChoices(stages, 'EXECUTION');
    const pick = e.find((c) => c.stageKind === 'CARPENTRY')!;
    const r = doneSteps(stages, 'EXECUTION', pick.key);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.done[0]!.complete).toBe(true);
    expect(r.done[1]!.complete).toBe(true); // civil
    expect(r.done[2]!.items.size).toBe(1);
    expect(r.done[2]!.complete).toBe(false);
    expect(r.done[4]!.items.size).toBe(0);
  });

  it('snags and warranty: every step', () => {
    for (const p of ['SNAGS', 'WARRANTY'] as const) {
      const r = doneSteps(stages, p, null);
      expect(r.ok && r.done.every((s) => s.complete)).toBe(true);
    }
  });

  it('a step from the wrong phase or a made-up key is refused', () => {
    const design = stepChoices(stages, 'DESIGN')[0]!.key;
    expect(doneSteps(stages, 'EXECUTION', design).ok).toBe(false);
    expect(doneSteps(stages, 'DESIGN', 'zz').ok).toBe(false);
    const handover = stages[4]!.items.findIndex((i) => i.label === 'Provisional handover');
    expect(doneSteps(stages, 'EXECUTION', stepKey(4, handover)).ok).toBe(false);
  });
});

describe('dates from today', () => {
  it('the first open step lands on today; everything moves by the same days', () => {
    const draft = plan();
    const e = stepChoices(draft, 'EXECUTION');
    const r = doneSteps(draft, 'EXECUTION', e[5]!.key);
    if (!r.ok) throw new Error(r.error);
    const a = anchorDays(draft, r.done, TODAY, TODAY);
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(a.days).toBeGreaterThan(20);
    const moved = plan(shiftedStart(TODAY, a.days));
    const firstOpen = moved.flatMap((s, si) => s.items.map((it, ii) => ({ it, si, ii }))).filter((x) => x.it.inScope && !r.done[x.si]!.items.has(x.ii)).map((x) => x.it.plannedOn!.toISOString().slice(0, 10)).sort()[0];
    expect(firstOpen).toBe(TODAY);
  });

  it('design with nothing done: starts today', () => {
    const draft = plan();
    const r = doneSteps(draft, 'DESIGN', null);
    if (!r.ok) throw new Error(r.error);
    expect(anchorDays(draft, r.done, TODAY, TODAY)).toEqual({ ok: true, days: 0 });
  });

  it('all done: the last step lands on the handover day', () => {
    const draft = plan();
    const r = doneSteps(draft, 'WARRANTY', null);
    if (!r.ok) throw new Error(r.error);
    const a = anchorDays(draft, r.done, TODAY, '2026-09-01');
    expect(a.ok && a.days).toBe(120 + 49);
  });

  it('more than three years back is refused', () => {
    const draft = plan();
    const r = doneSteps(draft, 'WARRANTY', null);
    if (!r.ok) throw new Error(r.error);
    expect(anchorDays(draft, r.done, TODAY, '2022-01-01').ok).toBe(false);
  });
});

describe('payments already received', () => {
  const ok = (stageIndex: number, amountPaise: number, extra: object = {}) => ({ stageIndex, amountPaise, receivedOn: '2026-09-10', mode: 'UPI', ...extra });

  it('rows within each stage pass; empty rows are skipped', () => {
    const r = checkPayments([ok(0, 2_500_000), ok(1, 2_000_000), ok(1, 3_000_000), ok(2, 0)], PAYMENTS, TODAY);
    expect(r.ok && r.value.map((p) => [p.stageIndex, p.amountPaise])).toEqual([
      [0, 2_500_000],
      [1, 2_000_000],
      [1, 3_000_000],
    ]);
  });

  it('more than a stage is owed, a future date, no mode or a missing stage is refused', () => {
    expect(checkPayments([ok(0, 2_500_001)], PAYMENTS, TODAY).ok).toBe(false);
    expect(checkPayments([ok(1, 3_000_000), ok(1, 2_000_001)], PAYMENTS, TODAY).ok).toBe(false);
    expect(checkPayments([ok(0, 100, { receivedOn: '2026-10-21' })], PAYMENTS, TODAY).ok).toBe(false);
    expect(checkPayments([ok(0, 100, { mode: 'GOLD' })], PAYMENTS, TODAY).ok).toBe(false);
    expect(checkPayments([ok(7, 100)], PAYMENTS, TODAY).ok).toBe(false);
    expect(checkPayments([ok(0, 10.5)], PAYMENTS, TODAY).ok).toBe(false);
  });
});

describe('the timeline line', () => {
  it('names the source quotation', () => {
    expect(broughtInLine('2399')).toBe('Brought in from the Hauspire quotation app (Q-2399)');
    expect(broughtInLine('Q-2399')).toBe('Brought in from the Hauspire quotation app (Q-2399)');
    expect(broughtInLine(null)).toMatch(/builder/);
  });
});

describe('the connector', () => {
  const ENV = { HAUSPIRE_QUOTES_SUPABASE_URL: 'https://fake.example.test/', HAUSPIRE_QUOTES_SUPABASE_KEY: 'fake-read-key', HAUSPIRE_QUOTES_STUDIO_SLUG: 'test-studio' };
  afterEach(() => vi.unstubAllEnvs());
  const setEnv = () => Object.entries(ENV).forEach(([k, v]) => vi.stubEnv(k, v));

  it('is off without all three settings, and only for its studio', () => {
    expect(hauspireConfig({})).toBeNull();
    expect(hauspireConfig({ ...ENV, HAUSPIRE_QUOTES_SUPABASE_KEY: '' })).toBeNull();
    expect(hauspireConfig(ENV)).toEqual({ url: 'https://fake.example.test', key: 'fake-read-key', slug: 'test-studio' });
    expect(importOpenFor('test-studio', ENV)).toBe(true);
    expect(importOpenFor('another', ENV)).toBe(false);
  });

  it('not connected: says so, never fetches', async () => {
    const f = vi.fn();
    const r = await searchHauspire('test-studio', '2399', f as unknown as typeof fetch);
    expect(r).toEqual({ ok: false, error: 'Ask One Interiors to connect your quotation app.' });
    expect(f).not.toHaveBeenCalled();
  });

  it('searches read-only with the key, only the needed columns, the text cleaned', async () => {
    setEnv();
    const f = vi.fn(async () => new Response(JSON.stringify([{ id: 'aaaaaaaa-1', quote_no: '2399', stage: 'sales', client_name: 'Test Client One', bhk: '2 BHK', tpv: 100, created_at: '2026-09-01T00:00:00Z' }]), { status: 200 }));
    const r = await searchHauspire('test-studio', '23),(99', f as unknown as typeof fetch);
    expect(r.ok && r.value[0]).toMatchObject({ number: '2399', client: 'Test Client One', tpvPaise: 10_000 });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url.startsWith('https://fake.example.test/rest/v1/quotes?select=id,quote_no,stage,client_name,location,bhk,tpv,created_at,settings&')).toBe(true);
    expect(url).not.toContain('lines');
    expect(url).not.toContain('mobile');
    expect(decodeURIComponent(url)).toContain('quote_no.ilike.*23 99*');
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>).apikey).toBe('fake-read-key');
  });

  it('a refusal or a network failure is one plain message, and logs no key or data', async () => {
    setEnv();
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bad = vi.fn(async () => new Response('nope', { status: 401 }));
    expect((await searchHauspire('test-studio', '2399', bad as unknown as typeof fetch)).ok).toBe(false);
    const down = vi.fn(async () => {
      throw new TypeError('fetch failed fake-read-key');
    });
    expect((await searchHauspire('test-studio', '2399', down as unknown as typeof fetch)).ok).toBe(false);
    for (const call of log.mock.calls) expect(JSON.stringify(call)).not.toMatch(/fake-read-key|fake\.example|2399/);
    log.mockRestore();
  });

  it('reads one quotation and finds its design copy by number', async () => {
    setEnv();
    const sales = { id: 'aaaaaaaa-1', quote_no: '2399', stage: 'sales', created_at: '2026-09-01T00:00:00Z', lines: [], tpv: 0 };
    const design = { id: 'aaaaaaaa-2', quote_no: '2399', stage: 'design', created_at: '2026-09-20T00:00:00Z', lines: [], tpv: 0 };
    const f = vi.fn(async (url: string) => new Response(JSON.stringify(url.includes('id=eq.') ? [sales] : [design, sales]), { status: 200 }));
    const r = await readHauspire('test-studio', 'aaaaaaaa-1', f as unknown as typeof fetch);
    expect(r.ok && r.value.sales.id).toBe('aaaaaaaa-1');
    expect(r.ok && r.value.design?.id).toBe('aaaaaaaa-2');
    expect((await readHauspire('test-studio', 'bad id!', f as unknown as typeof fetch)).ok).toBe(false);
  });
});
