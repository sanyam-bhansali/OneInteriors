import { describe, expect, it } from 'vitest';
import { contentKey, formatReport, groupRows, matchClient, phoneKey, planImport, textKey, type ExistingClient, type ExistingQuote } from '@/modules/studio-bring-in/hauspire-import-plan';
import { mapQuote, type SourceQuote } from '@/modules/studio-bring-in/hauspire-map';
import { listAllHauspire, connectionFromEnv, PAGE_SIZE } from '@/modules/studio-bring-in/hauspire-fetch';
import { runHauspireImport } from '@/modules/studio-bring-in/hauspire-import';
import { oldComputeTotals } from '@/modules/studio-quote/hauspire-calc';

/**
 * The full import from the Hauspire quotation app (owner, 22 Oct 2026).
 * Every row and lead here is FAKE, shaped like the old app's `quotes` table
 * (supabase/schema.sql) — no real client data, and no network: the fetcher
 * and the database are stubs.
 */

const line = (room: string, product: string, wc: 'MO-01' | 'NM-01', amount: number, extra: Record<string, unknown> = {}) => ({ room, product, wc, details: '', width: null, height: null, amount, ...extra });

/** A fake row whose stored tpv is the old app's own arithmetic. */
function row(id: string, over: Partial<SourceQuote> & { lines?: unknown[] } = {}): SourceQuote {
  const lines = (over.lines as ReturnType<typeof line>[] | undefined) ?? [
    line('Kitchen', 'Base Cabinets', 'MO-01', 82_480, { width: 3960, height: 750, rate: 2580 }),
    line('Kitchen', 'Base Cabinets- Tandems (Horizantal)', 'NM-01', 30_000, { qty: 3, unitPrice: 10_000 }),
    line('Other Services', 'Painting - 3BHK (Emulsion)', 'NM-01', 55_000, { qty: 1, unitPrice: 55_000 }),
  ];
  const settings = (over.settings as Record<string, unknown> | undefined) ?? { modularPct: 0.15, onSpot: 0, feeOn: true, gstOn: false, quoteDate: '2026-09-10' };
  const tpv = oldComputeTotals(lines, { modularPct: settings.modularPct as number, onSpot: settings.onSpot as number, feeOn: settings.feeOn as boolean }).tpv;
  return { id, quote_no: '2301', stage: 'sales', client_name: 'Test Client A', mobile: '98765 00001', location: 'Testnagar', bhk: '3 BHK', kitchen_run: 3960, created_at: '2026-09-10T08:00:00Z', settings, tpv, ...over, lines };
}

const clients: ExistingClient[] = [
  { id: 'c-phone', name: 'Someone Else', phone: '+919876500001', locality: 'Elsewhere', city: 'Pune' },
  { id: 'c-name', name: 'Test  Client B.', phone: null, locality: 'testnagar', city: 'Pune' },
  { id: 'c-dup1', name: 'Twin Name', phone: '+919876500009', locality: 'Testnagar', city: 'Pune' },
  { id: 'c-dup2', name: 'Twin Name', phone: '+919876500009', locality: 'Testnagar', city: 'Pune' },
];

describe('keys', () => {
  it('phone: the last ten digits, whatever the writing', () => {
    expect(phoneKey('+91 98765 00001')).toBe('9876500001');
    expect(phoneKey('098765-00001')).toBe('9876500001');
    expect(phoneKey('91987650000')).toBeNull();
    expect(phoneKey(null)).toBeNull();
  });
  it('names and places without case, spaces, punctuation or a title', () => {
    expect(textKey('  Mr. Test   Client ')).toBe('test client');
    expect(textKey('Test Client.')).toBe(textKey('test client'));
  });
});

describe('whose lead', () => {
  it('by mobile first', () => {
    expect(matchClient({ phone: '9876500001', client: 'Anyone', location: 'X' }, clients)).toEqual({ id: 'c-phone', how: 'phone' });
  });
  it('else by name and location', () => {
    expect(matchClient({ phone: null, client: 'test client b', location: 'Testnagar' }, clients)).toEqual({ id: 'c-name', how: 'name+location' });
    expect(matchClient({ phone: null, client: 'test client b', location: 'Pune' }, clients)).toEqual({ id: 'c-name', how: 'name+location' });
    expect(matchClient({ phone: null, client: 'test client b', location: 'Otherplace' }, clients)).toEqual({ id: null, why: 'none' });
    // A mobile on the quotation and another on the lead: not the same client (31 Oct 2026).
    expect(matchClient({ phone: '9930700000', client: 'Someone Else', location: 'Pune' }, clients)).toEqual({ id: null, why: 'none' });
    expect(matchClient({ phone: '9930700000', client: 'test client b', location: 'Pune' }, clients)).toEqual({ id: 'c-name', how: 'name+location' });
  });
  it('more than one lead: ambiguous, never a guess', () => {
    expect(matchClient({ phone: '9876500009', client: 'Twin Name', location: 'Testnagar' }, clients)).toEqual({ id: null, why: 'ambiguous' });
    expect(matchClient({ phone: null, client: 'Twin Name', location: 'Testnagar' }, clients)).toEqual({ id: null, why: 'ambiguous' });
  });
});

describe('grouping: one quotation per number and stage, older saves as revisions', () => {
  it('newest first in each group; a row without a number stands alone', () => {
    const groups = groupRows([
      row('a1', { created_at: '2026-09-01T00:00:00Z' }),
      row('a2', { created_at: '2026-09-05T00:00:00Z' }),
      row('d1', { stage: 'design' }),
      row('x1', { quote_no: null }),
    ]);
    expect(groups.map((g) => g.map((r) => r.id))).toEqual([['a2', 'a1'], ['d1'], ['x1']]);
  });
});

describe('the plan', () => {
  const rows = [
    row('s1'),
    row('s1-old', { created_at: '2026-09-01T00:00:00Z', lines: [line('Kitchen', 'Base Cabinets', 'MO-01', 70_000)] }),
    row('d1', { stage: 'design', created_at: '2026-09-20T00:00:00Z' }),
    row('s2', { quote_no: '2302', client_name: 'Test Client B', mobile: null }),
    row('s3', { quote_no: '2303', client_name: 'New Person', mobile: '9876500077' }),
    row('s4', { quote_no: '2304', client_name: 'New Person', mobile: '+91 98765 00077', stage: 'sales' }),
    row('bad', { quote_no: '2305', lines: 'oops' as unknown as unknown[] }),
  ];
  const plan = planImport({ rows, existing: [], clients });

  it('counts quotations by stage, earlier saves, and skips what cannot be read', () => {
    expect(plan.report).toMatchObject({ rows: 7, quotations: 5, byStage: { sales: 4, design: 1 }, earlierRevisions: 1 });
    expect(plan.report.unreadable).toEqual([{ id: 'bad', number: '2305', reason: 'its lines are not a list' }]);
    expect(plan.report.byAction.create).toBe(5);
  });

  it('attaches each to its lead, and makes one new lead per new client', () => {
    const of = (id: string) => plan.quotes.find((q) => q.mapped.sourceId === id)!.client;
    expect(of('s1')).toEqual({ kind: 'existing', id: 'c-phone', how: 'phone' });
    expect(of('s2')).toEqual({ kind: 'existing', id: 'c-name', how: 'name+location' });
    expect(of('s3')).toEqual(of('s4'));
    expect(plan.newClients).toHaveLength(1);
    expect(plan.newClients[0]).toMatchObject({ name: 'New Person', numbers: ['2303', '2304'], why: 'none' });
  });

  it('Sales Finals first, and the Design Final knows its Sales Final', () => {
    expect(plan.quotes.at(-1)!.mapped.stage).toBe('design');
    expect(plan.quotes.find((q) => q.mapped.sourceId === 'd1')!.salesSourceId).toBe('s1');
    expect(plan.quotes.find((q) => q.mapped.sourceId === 's1')!.earlier.map((e) => e.sourceId)).toEqual(['s1-old']);
  });

  it('every total checks to the paisa against the old app’s stored tpv', () => {
    expect(plan.report.totalsChecked).toBe(5);
    expect(plan.report.totalsMatched).toBe(5);
    expect(plan.report.mismatches).toEqual([]);
  });

  it('a stored total that does not match is listed', () => {
    const off = planImport({ rows: [row('m1', { tpv: 1 })], existing: [], clients });
    expect(off.report.mismatches[0]).toMatchObject({ number: '2301', oldTpvPaise: 100 });
  });
});

describe('idempotent: run it again', () => {
  const r = row('s1');
  const mapped = mapQuote(r);
  const base: ExistingQuote = { id: 'q1', importedFrom: 'hauspire:s1', number: '2301', clientId: 'c-kept', importedAt: new Date('2026-10-22T10:00:00Z'), updatedAt: new Date('2026-10-22T10:00:01Z'), content: contentKey(mapped) };

  it('unchanged: left alone, its lead kept', () => {
    const p = planImport({ rows: [r], existing: [base], clients });
    expect(p.quotes[0]).toMatchObject({ action: 'same', existingId: 'q1', client: { kind: 'existing', id: 'c-kept', how: 'already' } });
    expect(p.newClients).toEqual([]);
  });
  it('changed there, untouched here: updated', () => {
    const p = planImport({ rows: [r], existing: [{ ...base, content: 'older' }], clients });
    expect(p.quotes[0]!.action).toBe('update');
  });
  it('changed there AND edited here: ours wins, reported', () => {
    const p = planImport({ rows: [r], existing: [{ ...base, content: 'older', updatedAt: new Date('2026-10-23T09:00:00Z') }], clients });
    expect(p.quotes[0]!.action).toBe('edited-here');
    expect(formatReport(p.report, { studio: 'Test Studio (test)', dryRun: true, poolTeam: null })).toMatch(/changed there AND edited here \(ours kept\)\s+1/);
  });
  it('--replace: a number the owner names is updated though edited here, and moves to the lead its mobile matches (31 Oct 2026)', () => {
    const moved = row('s1', { mobile: '+91 98765 00001' });
    const edited = { ...base, content: 'older', updatedAt: new Date('2026-10-23T09:00:00Z') };
    const p = planImport({ rows: [moved], existing: [edited], clients, replace: new Set([mapQuote(moved).number]) });
    expect(p.quotes[0]!.action).toBe('update');
    expect(p.quotes[0]!.client).toEqual({ kind: 'existing', id: 'c-phone', how: 'phone' });
    const kept = planImport({ rows: [moved], existing: [edited], clients, replace: new Set(['other']) });
    expect(kept.quotes[0]!.action).toBe('edited-here');
    expect(kept.quotes[0]!.client).toEqual({ kind: 'existing', id: 'c-kept', how: 'already' });
  });
  it('with the earlier file: untouched content is updated whatever the clock says (31 Oct 2026)', () => {
    const late = { ...base, content: 'older', updatedAt: new Date('2026-10-23T09:00:00Z') };
    expect(planImport({ rows: [r], existing: [late], clients, previous: new Map([['s1', 'older']]) }).quotes[0]!.action).toBe('update');
    expect(planImport({ rows: [r], existing: [late], clients, previous: new Map([['s1', 'what was imported']]) }).quotes[0]!.action).toBe('edited-here');
  });
});

describe('the report (fake sample)', () => {
  it('reads as plain lines with counts, leads made and the totals check', () => {
    const p = planImport({ rows: [row('s1'), row('s9', { quote_no: '2309', client_name: 'Fresh Lead', mobile: null, location: 'Nowhere' })], existing: [], clients });
    const text = formatReport(p.report, { studio: 'Test Studio (test)', dryRun: true, poolTeam: 'Sales Head' });
    expect(text).toContain('(DRY RUN: nothing is written)');
    expect(text).toMatch(/quotations \(one per number and stage\)\s+2/);
    expect(text).toMatch(/created \(team pool of Sales Head\)\s+1/);
    expect(text).toContain('+ Fresh Lead · 2309');
    expect(text).toMatch(/identical to the paisa\s+2/);
  });
});

describe('reading every row: GET only, page by page', () => {
  it('pages with limit and offset until a short page, never anything but GET', async () => {
    const calls: { url: string; method: string }[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, method: String(init.method) });
      const offset = Number(new URL(url).searchParams.get('offset'));
      const n = offset === 0 ? PAGE_SIZE : 3;
      return new Response(JSON.stringify(Array.from({ length: n }, (_, i) => ({ id: `r${offset + i}` }))), { status: 200 });
    }) as unknown as typeof fetch;
    const r = await listAllHauspire({ url: 'https://example.invalid', key: 'k', slug: 's' }, fake);
    expect(r.ok && r.rows.length).toBe(PAGE_SIZE + 3);
    expect(calls).toHaveLength(2);
    expect(calls.every((c) => c.method === 'GET' && c.url.includes('/rest/v1/quotes?select=*&order=created_at.asc,id.asc&limit=500'))).toBe(true);
  });
  it('the connection needs all three settings', () => {
    expect(connectionFromEnv({})).toBeNull();
    expect(connectionFromEnv({ HAUSPIRE_QUOTES_SUPABASE_URL: 'https://x.supabase.co/', HAUSPIRE_QUOTES_SUPABASE_KEY: 'k', HAUSPIRE_QUOTES_STUDIO_SLUG: 'h' })).toEqual({ url: 'https://x.supabase.co', key: 'k', slug: 'h' });
  });
});

describe('a dry run writes nothing', () => {
  it('reads what is here and plans, with a database that refuses every write', async () => {
    const refuse = () => {
      throw new Error('a dry run wrote');
    };
    const db = {
      studioQuote: { findMany: async () => [], create: refuse, update: refuse },
      studioClient: { findMany: async () => clients, create: refuse },
      auditLog: { create: refuse },
      $transaction: refuse,
    } as unknown as Parameters<typeof runHauspireImport>[0];
    const { plan, written } = await runHauspireImport(db, { studioId: 'st-test', rows: [row('s1')], dryRun: true, poolTeam: null });
    expect(written).toBeNull();
    expect(plan.report.quotations).toBe(1);
  });
});
