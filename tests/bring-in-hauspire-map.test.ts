import { describe, expect, it } from 'vitest';
import {
  cleanSearch,
  dateOf,
  importKey,
  mapLine,
  mapQuote,
  mapTerms,
  notInMaster,
  toMatch,
  workCodeOf,
  type SourceLine,
  type SourceQuote,
} from '@/modules/studio-bring-in/hauspire-map';

/**
 * The Hauspire quotation app's rows as our quotation
 * (docs/studio-os/BRING-IN-PROJECTS.md). Every row here is FAKE, shaped
 * like the source schema (supabase/schema.sql `quotes`, src/lib/types.ts
 * `QuoteLine` / `QuoteSettings`); no real client data.
 */

const SALES: SourceQuote = {
  id: '11111111-2222-3333-4444-555555555555',
  quote_no: '2399',
  stage: 'sales',
  client_name: 'Test Client One',
  location: 'Testnagar',
  bhk: '2 BHK',
  created_at: '2026-09-01T10:00:00.000Z',
  settings: { modularPct: 0.15, onSpot: 5000, onSpotLabel: 'On-spot discount', feeOn: true, gstOn: false, quoteDate: '2026-08-30' },
  lines: [] as unknown,
  tpv: 0,
};
const LINES: SourceLine[] = [
    // W × H: 2400 × 600 mm at ₹1,500 / sq ft
    { room: 'Kitchen', product: 'Base Cabinet', wc: 'MO-01', details: 'BWP ply, laminate', width: 2400, height: 600, rate: 1500, amount: 23250 },
    // Each: 4 tandems at ₹2,500
    { room: 'Kitchen', product: 'Tandem Drawer', wc: 'MO-01', details: '', width: null, height: null, qty: 4, unitPrice: 2500, amount: 10000 },
    // Sq ft: 1,000 sq ft painting at ₹26.5
    { room: 'Other Services', product: 'Painting - 2BHK (Emulsion)', wc: 'NM-01', details: 'Two coats', width: null, height: null, sqft: 1000, rate: 26.5, amount: 26500 },
    // Rft: 12 running feet at ₹1,200, amount agreed lower than the arithmetic
    { room: 'Living, Dining & Foyer', product: 'TV Unit', wc: 'MO-01', details: null, width: null, height: null, rft: 12, rate: 1200, amount: 14000 },
    // Lump sum, no sizing
    { room: 'Other Services', product: 'Deep cleaning', wc: 'NM-01', details: '', width: null, height: null, amount: 8000 },
    // An empty row the app sometimes leaves
    { room: 'Kitchen', product: '', wc: 'MO-01', details: '', width: null, height: null, amount: 0 },
];
SALES.lines = LINES;
// The source's own arithmetic: MO 47,250 + NM 34,500 = 81,750; fee 7% = 5,723 (rounded); discount 15% of MO = 7,088 (rounded); on-spot 5,000.
SALES.tpv = 81750 + Math.round(81750 * 0.07) - Math.round(47250 * 0.15) - 5000;

describe('a source line becomes ours', () => {
  it('W × H keeps the sizes, the rate and the agreed amount', () => {
    const m = mapLine(LINES[0]!, 0)!;
    expect(m.line).toMatchObject({ room: 'Kitchen', product: 'Base Cabinet', code: 'MODULAR', unit: 'AREA', widthMm: 2400, heightMm: 600, ratePaise: 150_000, amountPaise: 2_325_000, details: 'BWP ply, laminate' });
    expect(m.unknownCode).toBe(false);
  });

  it('each: quantity in thousandths, the unit price as the rate', () => {
    expect(mapLine(LINES[1]!, 1)!.line).toMatchObject({ unit: 'UNIT', qtyMilli: 4000, ratePaise: 250_000, amountPaise: 1_000_000, details: null });
  });

  it('square feet keep a rate with paise (₹26.5)', () => {
    expect(mapLine(LINES[2]!, 2)!.line).toMatchObject({ unit: 'SQFT', code: 'ONSITE', qtyMilli: 1_000_000, ratePaise: 2650, amountPaise: 2_650_000 });
  });

  it('running feet keep the agreed amount even when it is not the arithmetic', () => {
    expect(mapLine(LINES[3]!, 3)!.line).toMatchObject({ unit: 'RFT', qtyMilli: 12_000, ratePaise: 120_000, amountPaise: 1_400_000, details: null });
  });

  it('a line with no sizing is an amount on its own: no quantity, Units blank as in the old PDF', () => {
    expect(mapLine(LINES[4]!, 4)!.line).toMatchObject({ unit: 'UNIT', qtyMilli: null, ratePaise: 0, amountPaise: 800_000 });
  });

  it('an empty row is skipped; a missing room is the whole home', () => {
    expect(mapLine(LINES[5]!, 5)).toBeNull();
    expect(mapLine({ product: 'Sofa', wc: 'NM-01', amount: 1000 }, 0)!.line.room).toBe('Whole home');
  });

  it('numeric strings are read; nonsense is not', () => {
    expect(mapLine({ product: 'Loft', wc: 'MO-01', width: '1200', height: '600', rate: '900', amount: '6975' }, 0)!.line).toMatchObject({ unit: 'AREA', widthMm: 1200, amountPaise: 697_500 });
    expect(mapLine({ product: 'X', wc: 'MO-01', width: 'wide', amount: 10 }, 0)!.line.unit).toBe('UNIT');
  });

  it('work codes: MO-01 modular, NM-01 on-site, anything else on-site and reported', () => {
    expect(workCodeOf('MO-01')).toEqual({ code: 'MODULAR', known: true });
    expect(workCodeOf('nm-01')).toEqual({ code: 'ONSITE', known: true });
    expect(workCodeOf(undefined)).toEqual({ code: 'ONSITE', known: false });
    expect(mapLine({ product: 'Odd', wc: 'XX', amount: 100 }, 0)!.unknownCode).toBe(true);
  });
});

describe('the pricing choices become our terms', () => {
  it('reads every setting', () => {
    expect(mapTerms(SALES.settings)).toEqual({ feeBps: 700, discountBps: 1500, onSpotPaise: 500_000, onSpotLabel: 'On-spot discount', gstBps: 0, quoteDate: '2026-08-30' });
  });

  it('the source defaults when settings are missing: 15%, fee on, GST off', () => {
    expect(mapTerms(null)).toEqual({ feeBps: 700, discountBps: 1500, onSpotPaise: 0, onSpotLabel: null, gstBps: 0, quoteDate: null });
  });

  it('fee off, GST on, a percent written as 12, a bad date', () => {
    expect(mapTerms({ feeOn: false, gstOn: true, modularPct: 12, quoteDate: '30/08/2026' })).toMatchObject({ feeBps: 0, gstBps: 1800, discountBps: 1200, quoteDate: null });
    expect(mapTerms({ modularPct: 0 }).discountBps).toBe(0);
  });
});

describe('the whole quotation', () => {
  const q = mapQuote(SALES);

  it('keeps every real line, in order', () => {
    expect(q.lines.map((l) => l.product)).toEqual(['Base Cabinet', 'Tandem Drawer', 'Painting - 2BHK (Emulsion)', 'TV Unit', 'Deep cleaning']);
    expect(q.lines.map((l) => l.sortOrder)).toEqual([0, 1, 2, 3, 4]);
  });

  it('adds up exactly like the source app', () => {
    expect(q.totals.modularPaise).toBe(4_725_000);
    expect(q.totals.onsitePaise).toBe(3_450_000);
    expect(q.totals.beforeTaxPaise).toBe(q.sourceTpvPaise); // to the paisa, not "within rounding"
    expect(q.differencePaise).toBe(0);
    expect(q.totals.totalPaise).toBe(q.totals.beforeTaxPaise); // GST off
    expect(q.warnings).toEqual([]);
  });

  it('GST on: added after every discount', () => {
    const g = mapQuote({ ...SALES, settings: { ...(SALES.settings as object), gstOn: true } });
    expect(g.totals.gstPaise).toBe(Math.round((g.totals.beforeTaxPaise / 100) * 0.18) * 100);
  });

  it('a total that does not match is reported, not hidden', () => {
    const off = mapQuote({ ...SALES, tpv: (SALES.tpv ?? 0) + 10_000 });
    expect(off.differencePaise).toBe(-1_000_000);
    expect(off.warnings.join(' ')).toMatch(/differs .* by ₹10,000/);
  });

  it('carries the number, stage, client and flat', () => {
    expect(q).toMatchObject({ sourceId: SALES.id, number: '2399', stage: 'sales', client: 'Test Client One', bhk: '2 BHK', location: 'Testnagar' });
    expect(mapQuote({ ...SALES, stage: 'design' }).stage).toBe('design');
  });

  it('no lines, or lines that are not a list, says so', () => {
    expect(mapQuote({ id: 'x-1234567', lines: 'oops', tpv: 0 }).warnings).toContain('This quotation has no lines.');
  });

  it('unknown work codes are counted in a warning', () => {
    const w = mapQuote({ id: 'x-1234567', lines: [{ product: 'A', amount: 10 }, { product: 'B', wc: '?', amount: 10 }], tpv: 0.21 });
    expect(w.warnings[0]).toMatch(/2 lines have no MO-01/);
  });
});

describe('search rows, dates and the product master', () => {
  it('a search row shows number, client, BHK, total and date', () => {
    expect(toMatch(SALES)).toEqual({ id: SALES.id, number: '2399', client: 'Test Client One', bhk: '2 BHK', location: 'Testnagar', tpvPaise: (SALES.tpv ?? 0) * 100, date: '2026-08-30', stage: 'sales' });
  });

  it('the date falls back to the day it was saved, in India', () => {
    expect(dateOf({ created_at: '2026-09-01T20:00:00.000Z', settings: null })).toBe('2026-09-02');
    expect(dateOf({ created_at: null, settings: null })).toBeNull();
  });

  it('lines not in the product master are flagged, ignoring case and spaces', () => {
    const flagged = notInMaster(mapQuote(SALES).lines, ['base cabinet', 'Tandem  Drawer', 'TV Unit']);
    expect([...flagged]).toEqual([2, 4]);
  });

  it('the import key is one per source row', () => {
    expect(importKey(SALES.id)).toBe(`hauspire:${SALES.id}`);
  });

  it('search text cannot change the PostgREST filter', () => {
    expect(cleanSearch('2399')).toBe('2399');
    expect(cleanSearch('Test),id.eq.(*')).toBe('Test id.eq.');
    expect(cleanSearch("a'b\"c,d*e(f)")).toBe('a b c d e f');
    expect(cleanSearch(42)).toBe('');
    expect(cleanSearch('x'.repeat(80))).toHaveLength(40);
  });
});
