import { describe, expect, it } from 'vitest';
import { SOFTWARE_PLANS, isSoftwarePlan, opensFullSoftware, planOf } from '@/modules/studio/software-plan';

describe('studio software plans (owner, 19 Oct 2026)', () => {
  it('has Pro and Max, and only Max opens the full studio software', () => {
    expect(SOFTWARE_PLANS.PRO.name).toBe('Pro');
    expect(SOFTWARE_PLANS.MAX.name).toBe('Max');
    expect(opensFullSoftware('PRO')).toBe(false);
    expect(opensFullSoftware('MAX')).toBe(true);
  });

  it('every studio is on Pro unless it is on Max', () => {
    expect(planOf(null)).toBe('PRO');
    expect(planOf({ softwarePlan: 'PRO', fullSoftware: false })).toBe('PRO');
    expect(planOf({ softwarePlan: 'MAX', fullSoftware: true })).toBe('MAX');
  });

  it('a studio switched on under the old pilot switch counts as Max', () => {
    expect(planOf({ softwarePlan: 'PRO', fullSoftware: true })).toBe('MAX');
    expect(planOf({ fullSoftware: true })).toBe('MAX');
  });

  it('accepts only the two plans', () => {
    expect(isSoftwarePlan('MAX')).toBe(true);
    expect(isSoftwarePlan('max')).toBe(false);
    expect(isSoftwarePlan('ENTERPRISE')).toBe(false);
  });
});
