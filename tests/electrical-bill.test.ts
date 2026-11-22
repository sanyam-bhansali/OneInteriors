import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { checkElectricalLines, electricalAmount, electricalTotals, parseQty, qtyWords, spreadOverUnpaid, type ElectricalItem } from '@/modules/project/electrical-rules';

/* Owner, 22 Nov 2026: the electrical bill — picked from the admin's rate list, quantity and note by the designer, approved by the client, spread over the unpaid stages, in one PDF with the quotation. */
const ITEMS = new Map<string, ElectricalItem>([
  ['light', { id: 'light', name: 'Light point', unit: 'point', details: '1.5 sq mm FR wire, modular switch', ratePaise: 850_00 }],
  ['wire', { id: 'wire', name: 'Extra wiring', unit: 'metre', details: null, ratePaise: 45_50 }],
]);
const HAUSPIRE = [
  { pct: null }, // booking
  { pct: 5 },
  { pct: 10 },
  { pct: 40 },
  { pct: 40 },
  { pct: 5 },
];

describe('lines from the rate list', () => {
  it('priced from the list, never from the browser; quantity and note from the designer', () => {
    const r = checkElectricalLines([{ itemId: 'light', qty: '12', note: ' Living room,  ceiling ', ratePaise: 1 }, { itemId: 'wire', qty: '2.5' }], ITEMS);
    if (!r.ok) throw new Error(r.error);
    expect(r.lines[0]).toEqual({ itemId: 'light', product: 'Light point', unitLabel: 'point', details: '1.5 sq mm FR wire, modular switch', note: 'Living room, ceiling', qtyMilli: 12_000, ratePaise: 850_00, amountPaise: 10_200_00 });
    expect(r.lines[1]!.amountPaise).toBe(114_00); // 45.50 × 2.5 = 113.75 → ₹114
  });

  it('refuses an item not on the list, or no quantity', () => {
    expect(checkElectricalLines([{ itemId: 'nope', qty: '1' }], ITEMS)).toMatchObject({ ok: false });
    expect(checkElectricalLines([{ itemId: 'light', qty: '0' }], ITEMS)).toMatchObject({ ok: false });
    expect(checkElectricalLines([], ITEMS)).toMatchObject({ ok: false });
  });

  it('GST on the project’s rate, no discount', () => {
    expect(electricalTotals([{ amountPaise: 10_000_00 }], 1800)).toEqual({ workPaise: 10_000_00, gstPaise: 1_800_00, totalPaise: 11_800_00 });
  });

  it('quantities and words', () => {
    expect(parseQty('2.5')).toBe(2500);
    expect(parseQty('-1')).toBeNull();
    expect(electricalAmount(850_00, 1000)).toBe(850_00);
    expect(qtyWords(12_000, 'point')).toBe('12 points');
    expect(qtyWords(1_000, 'point')).toBe('1 point');
    expect(qtyWords(5_000, 'nos')).toBe('5 nos');
  });
});

describe('spread over the stages not yet paid ("Spread over unpaid stages")', () => {
  it('booking, design advance and closure paid: the rest by 40 / 40 / 5', () => {
    const parts = spreadOverUnpaid(17_000_00, HAUSPIRE, new Set([0, 1, 2]));
    expect(parts.map((p) => p.stageIndex)).toEqual([3, 4, 5]);
    expect(parts.reduce((a, p) => a + p.deltaPaise, 0)).toBe(17_000_00);
    expect(parts.map((p) => p.deltaPaise)).toEqual([8_000_00, 8_000_00, 1_000_00]);
  });

  it('never on a paid stage, never on the fixed booking', () => {
    const parts = spreadOverUnpaid(10_000_00, HAUSPIRE, new Set([0]));
    expect(parts.some((p) => p.stageIndex === 0)).toBe(false);
    expect(parts.reduce((a, p) => a + p.deltaPaise, 0)).toBe(10_000_00);
  });

  it('everything paid: it all lands on the last stage', () => {
    expect(spreadOverUnpaid(5_000_00, HAUSPIRE, new Set([0, 1, 2, 3, 4, 5]))).toEqual([{ stageIndex: 5, deltaPaise: 5_000_00 }]);
  });

  it('paise totals still add up exactly', () => {
    const parts = spreadOverUnpaid(1_000_33, HAUSPIRE, new Set([0, 1, 2]));
    expect(parts.reduce((a, p) => a + p.deltaPaise, 0)).toBe(1_000_33);
  });
});

describe('wiring', () => {
  it('the client’s approval spreads an electrical bill; other extra work keeps its last-stage rule', () => {
    const co = readFileSync('src/modules/project/change-orders.ts', 'utf8');
    expect(co).toContain('if (approve && stages && o.kind === ELECTRICAL) {');
    expect(co).toContain('spreadOverUnpaid(totalPaise, stages, new Set(paid.map((r) => r.stageIndex)))');
    // Not in the Extra work tab, its counts, the extras to collect, or the extras summary.
    expect(co.match(/kind: \{ not: ELECTRICAL \}/g)?.length).toBe(4);
  });

  it('the project tab, the value and the one PDF', () => {
    const page = readFileSync('src/app/studio/projects/[id]/page.tsx', 'utf8');
    expect(page).toContain("{ key: 'electrical', label: 'Electrical bill' }");
    expect(page).toContain('formatINR(w.contractPaise! + electricalPaise)');
    const print = readFileSync('src/app/studio/quotations/[id]/print/page.tsx', 'utf8');
    expect(print).toContain('<ElectricalBillDoc bills={electrical} quotationPaise={totals.totalPaise} />');
  });

  it('only the owner or the design head keeps the rate list', () => {
    const store = readFileSync('src/modules/project/electrical-bill.ts', 'utf8');
    expect(store).toContain("m.role === 'OWNER' || (m.role === 'DESIGNER' && m.designHead === true)");
  });
});
