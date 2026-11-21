import { describe, expect, it } from 'vitest';
import { checkGstPct, gstOn, gstSplit, regst, restageKeepingGst, withGst, withoutGst } from '@/modules/project/project-gst';
import { restageOnTotal } from '@/modules/studio-design/restage';

// Hauspire's stages on a ₹10,00,000 project: booking ₹25,000, then 5/10/40/40/5% of ₹9,75,000.
const STAGES = [
  { label: 'Booking Advance', pct: null, amountPaise: 2_500_000 },
  { label: 'Design Advance', pct: 5, amountPaise: 4_875_000 },
  { label: 'Design Closure', pct: 10, amountPaise: 9_750_000 },
  { label: 'Material Procurement', pct: 40, amountPaise: 39_000_000 },
  { label: 'Material Dispatch', pct: 40, amountPaise: 39_000_000 },
  { label: 'Project Handover', pct: 5, amountPaise: 4_875_000 },
];
const sum = (l: { amountPaise: number }[]) => l.reduce((a, s) => a + s.amountPaise, 0);

describe('GST on part of the project (owner, 21 Nov 2026)', () => {
  it('is 18% of the given % of the value, to the rupee', () => {
    expect(gstOn(100_000_000, 30)).toBe(5_400_000); // 18% of ₹3,00,000 = ₹54,000
    expect(gstOn(100_000_000, 100)).toBe(18_000_000);
    expect(checkGstPct('30')).toEqual({ ok: true, pct: 30 });
    expect(checkGstPct('30%')).toEqual({ ok: true, pct: 30 });
    expect(checkGstPct('0')).toMatchObject({ ok: false });
    expect(checkGstPct('12.5')).toMatchObject({ ok: false });
  });

  it('goes only on the stages after the design advance, by their percentages, exactly', () => {
    const parts = gstSplit(STAGES, 5_400_000);
    expect(parts[0]).toBe(0);
    expect(parts[1]).toBe(0);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(5_400_000);
    expect(parts[3]).toBe(parts[4]);
    expect(parts[3]! / parts[2]!).toBeCloseTo(4, 1);
  });

  it('comes off exactly what it added', () => {
    expect(withoutGst(withGst(STAGES, 5_400_000), 5_400_000)).toEqual(STAGES);
  });

  it('sets, changes and removes GST on the stages and the total', () => {
    const on = regst(STAGES, 0, 30);
    expect(on.gstPaise).toBe(5_400_000);
    expect(on.totalPaise).toBe(105_400_000);
    expect(sum(on.stages)).toBe(105_400_000);
    expect(on.stages[0]!.amountPaise).toBe(2_500_000);
    expect(on.stages[1]!.amountPaise).toBe(4_875_000);
    const more = regst(on.stages, on.gstPaise, 50);
    expect(more.gstPaise).toBe(9_000_000);
    expect(sum(more.stages)).toBe(109_000_000);
    const off = regst(more.stages, more.gstPaise, null);
    expect(off.stages).toEqual(STAGES);
    expect(off.totalPaise).toBe(100_000_000);
  });

  it('keeps the GST through the Design Final re-split, on its new value', () => {
    const on = regst(STAGES, 0, 30);
    const r = restageKeepingGst(on.stages, on.gstPaise, 30, (base) => restageOnTotal(base, 110_000_000, 100_000_000));
    if (!r.ok) throw new Error(r.error);
    expect(r.gstPaise).toBe(gstOn(110_000_000, 30));
    expect(r.totalPaise).toBe(110_000_000 + r.gstPaise);
    expect(sum(r.stages)).toBe(r.totalPaise);
    expect(r.stages[0]!.amountPaise).toBe(2_500_000);
    expect(r.stages[1]!.amountPaise).toBe(4_875_000);
  });
});
