import { describe, expect, it } from 'vitest';
import { checkPhases, parsePhasesText } from '@/modules/studio/payment-phases';

describe('studio onboarding fixes (9 Oct 2026)', () => {
  it('reads a decimal percentage whole, and asks for whole percents', () => {
    const p = parsePhasesText('12.5% booking, 87.5% handover');
    expect(p?.[0]).toEqual({ label: 'Booking', pct: 12.5 });
    expect(checkPhases(p!)).toMatch(/whole percent/);
  });

  it('still reads ordinary schedules', () => {
    const p = parsePhasesText('10% booking, 40% design sign-off, 40% delivery, 10% handover');
    expect(p?.map((x) => x.pct)).toEqual([10, 40, 40, 10]);
    expect(checkPhases(p!)).toBeNull();
  });
});
