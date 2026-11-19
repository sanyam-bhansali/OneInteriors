import { describe, expect, it } from 'vitest';
import { restageOnTotal } from '@/modules/studio-design/restage';

const HAUSPIRE = [
  { label: 'Booking Advance', pct: null, amountPaise: 2_500_000 },
  { label: 'Design Advance', pct: 5, amountPaise: 85_800 },
  { label: 'Design Closure', pct: 10, amountPaise: 171_500 },
  { label: 'Material Procurement', pct: 40, amountPaise: 686_000 },
  { label: 'Material Dispatch', pct: 40, amountPaise: 686_000 },
  { label: 'Project Handover', pct: 5, amountPaise: 85_700 },
];

describe('payment stages on the Design Final total (owner, 14 Nov 2026)', () => {
  it('keeps the booking advance and re-splits the rest by percentage, exactly', () => {
    const r = restageOnTotal(HAUSPIRE, 5_000_000);
    expect(r.ok && r.changed).toBe(true);
    if (!r.ok) return;
    expect(r.stages[0]!.amountPaise).toBe(2_500_000);
    expect(r.stages.reduce((a, s) => a + s.amountPaise, 0)).toBe(5_000_000);
    expect(r.stages[3]!.amountPaise).toBe(1_000_000);
    expect(r.stages.map((s) => s.label)).toEqual(HAUSPIRE.map((s) => s.label));
  });

  it('changes nothing when the total is the same', () => {
    expect(restageOnTotal(HAUSPIRE, 4_215_000)).toMatchObject({ ok: true, changed: false });
  });

  it('scales amounts when no stage has a percentage', () => {
    const r = restageOnTotal([{ label: 'A', pct: null, amountPaise: 100 }, { label: 'B', pct: null, amountPaise: 300 }], 800);
    expect(r.ok && r.stages.map((s) => s.amountPaise)).toEqual([200, 600]);
  });

  it('keeps the design advance as on the sales final; the later stages share the rest of the Design Final (owner, 19 Nov 2026)', () => {
    // Sales final ₹10,00,000: booking ₹25,000, then 5/10/40/40/5% of ₹9,75,000. Design Final ₹11,13,522.
    const sales = restageOnTotal(HAUSPIRE, 100_000_000);
    if (!sales.ok) throw new Error('sales split failed');
    expect(sales.stages[1]!.amountPaise).toBe(4_875_000);
    const r = restageOnTotal(sales.stages, 111_352_200, 100_000_000);
    if (!r.ok) throw new Error(r.error);
    expect(r.stages[0]!.amountPaise).toBe(2_500_000);
    expect(r.stages[1]!.amountPaise).toBe(4_875_000);
    const later = 111_352_200 - 2_500_000 - 4_875_000;
    expect(r.stages.slice(2).reduce((a, s) => a + s.amountPaise, 0)).toBe(later);
    expect(r.stages[3]!.amountPaise).toBe(Math.round((later * 40) / 95));
    expect(r.stages.reduce((a, s) => a + s.amountPaise, 0)).toBe(111_352_200);
  });

  it('puts right a project restaged under the older rule, and then changes nothing', () => {
    const old = restageOnTotal(HAUSPIRE, 111_352_200);
    if (!old.ok) throw new Error('old split failed');
    expect(old.stages[1]!.amountPaise).not.toBe(4_875_000);
    const fixed = restageOnTotal(old.stages, 111_352_200, 100_000_000);
    expect(fixed).toMatchObject({ ok: true, changed: true });
    if (!fixed.ok) return;
    expect(fixed.stages[1]!.amountPaise).toBe(4_875_000);
    expect(restageOnTotal(fixed.stages, 111_352_200, 100_000_000)).toMatchObject({ ok: true, changed: false });
  });

  it('refuses a total below the fixed stages, or none', () => {
    expect(restageOnTotal(HAUSPIRE, 1_000_000)).toMatchObject({ ok: false });
    expect(restageOnTotal(HAUSPIRE, 0)).toMatchObject({ ok: false });
  });
});
