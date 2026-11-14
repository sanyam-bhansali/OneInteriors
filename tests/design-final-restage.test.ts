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

  it('refuses a total below the fixed stages, or none', () => {
    expect(restageOnTotal(HAUSPIRE, 1_000_000)).toMatchObject({ ok: false });
    expect(restageOnTotal(HAUSPIRE, 0)).toMatchObject({ ok: false });
  });
});
