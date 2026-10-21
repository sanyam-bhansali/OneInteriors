import { describe, expect, it } from 'vitest';
import { SOFTWARE_PLANS, isSoftwarePlan, opensFullSoftware, planOf, seatLimit } from '@/modules/studio/software-plan';
import { mayOpen } from '@/modules/studio/surfaces';
import { appsFor } from '@/modules/studio/apps';

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

  it('accepts only the three plans', () => {
    expect(isSoftwarePlan('MAX')).toBe(true);
    expect(isSoftwarePlan('SOLO')).toBe(true);
    expect(isSoftwarePlan('max')).toBe(false);
    expect(isSoftwarePlan('ENTERPRISE')).toBe(false);
  });

  it('Pro Solo (owner, 21 Oct 2026) is Pro for one person', () => {
    expect(SOFTWARE_PLANS.SOLO.name).toBe('Pro Solo');
    expect(planOf({ softwarePlan: 'SOLO', fullSoftware: false })).toBe('SOLO');
    expect(opensFullSoftware('SOLO')).toBe(false);
    expect(seatLimit('SOLO')).toBe(1);
    expect(seatLimit('PRO')).toBeNull();
    expect(seatLimit('MAX')).toBeNull();
  });

  it('on Pro Solo the owner keeps Leads and Settings but has no team screen or pool', () => {
    const owner = { role: 'OWNER' as const, status: 'ACTIVE' as const, fullSoftware: false, solo: true };
    expect(mayOpen(owner, '/studio/clients')).toBe(true);
    expect(mayOpen(owner, '/studio/settings')).toBe(true);
    expect(mayOpen(owner, '/studio/settings/team')).toBe(false);
    expect(mayOpen(owner, '/studio/clients/pool')).toBe(false);
    const apps = appsFor(owner);
    expect(apps.find((a) => a.key === 'team')?.href).toBe('/studio/settings');
    expect(apps.find((a) => a.key === 'clients')?.tabs.map((t) => t.label)).not.toContain('Pool');
    /* A Pro owner keeps both. */
    expect(mayOpen({ ...owner, solo: false }, '/studio/settings/team')).toBe(true);
  });
});
