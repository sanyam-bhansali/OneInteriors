import { describe, expect, it } from 'vitest';
import { HAUSPIRE_TEMPLATE, projectStages, scheduleAmounts } from '@/modules/studio-sales/payment-template';
import { restageOnTotal } from '@/modules/studio-design/restage';

describe('project stages keep their percentages (owner, 20 Nov 2026: "booking advance 25000")', () => {
  it('stores the percentage on each percentage stage and none on the booking advance', () => {
    const s = scheduleAmounts(HAUSPIRE_TEMPLATE, 100_000_000);
    if (!s.ok) throw new Error(s.error);
    expect(projectStages(s.stages).map((x) => x.pct)).toEqual([null, 5, 10, 40, 40, 5]);
    expect(projectStages(s.stages)[0]!.amountPaise).toBe(2_500_000);
  });

  it('so a Design Final keeps the booking advance at ₹25,000 and the design advance as sold', () => {
    const s = scheduleAmounts(HAUSPIRE_TEMPLATE, 100_000_000);
    if (!s.ok) throw new Error(s.error);
    const r = restageOnTotal(projectStages(s.stages), 130_000_000, 100_000_000);
    if (!r.ok) throw new Error(r.error);
    expect(r.stages[0]!.amountPaise).toBe(2_500_000);
    expect(r.stages[1]!.amountPaise).toBe(s.stages[1]!.amountPaise);
    expect(r.stages.reduce((a, x) => a + x.amountPaise, 0)).toBe(130_000_000);
  });
});
