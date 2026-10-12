import { describe, expect, it } from 'vitest';
import { appForPath, appsFor, tabForPath, STUDIO_HOME } from '@/modules/studio/apps';
import { homeFor, mayOpen } from '@/modules/studio/surfaces';
import type { StudioRoleName } from '@/modules/studio/roles';

const m = (role: StudioRoleName) => ({ role, status: 'ACTIVE' as const });
const keys = (role: StudioRoleName) => appsFor(m(role)).map((a) => a.key);

describe('studio apps (UI handoff 12 Oct 2026)', () => {
  it('the owner sees every app, in the launcher order', () => {
    expect(keys('OWNER')).toEqual(['today', 'clients', 'quotes', 'projects', 'site', 'money', 'vendors', 'calendar', 'intros', 'rates', 'team']);
  });

  it('a salesperson sees Leads, Quotations and Calendar only', () => {
    expect(keys('SALES')).toEqual(['clients', 'quotes', 'calendar']);
    expect(appsFor(m('SALES'))[0].name).toBe('Leads');
  });

  it('a salesperson gets no owner-only Leads tabs', () => {
    const tabs = appsFor(m('SALES'))[0].tabs.map((t) => t.href);
    expect(tabs).not.toContain('/studio/clients/import');
    expect(tabs).not.toContain('/studio/clients/bin');
    expect(tabs).toContain('/studio/clients/pool');
  });

  it('never lists an app or tab the door would bounce', () => {
    for (const role of ['OWNER', 'PM', 'SALES', 'DESIGNER', 'ACCOUNTS', 'SUPERVISOR'] as const) {
      for (const a of appsFor(m(role))) {
        expect(mayOpen(m(role), a.href)).toBe(true);
        for (const t of a.tabs) expect(mayOpen(m(role), t.href)).toBe(true);
      }
    }
  });

  it('a project manager sees no Vendors app until they may open crew rates, and Settings rather than Team', () => {
    const pm = appsFor(m('PM'));
    expect(pm.map((a) => a.key)).not.toContain('vendors');
    expect(pm.find((a) => a.key === 'team')?.name).toBe('Settings');
  });

  it("a designer's Projects opens their design page", () => {
    expect(appsFor(m('DESIGNER')).find((a) => a.key === 'projects')?.href).toBe('/studio/design');
  });

  it('accounts keeps Money and Vendors', () => {
    expect(keys('ACCOUNTS')).toEqual(['money', 'vendors']);
  });

  it('a supervisor has site mode only and lands there', () => {
    expect(keys('SUPERVISOR')).toEqual(['site']);
    expect(homeFor('SUPERVISOR')).toBe('/studio/site');
  });

  it('everyone else lands on the home, and may open it', () => {
    for (const role of ['OWNER', 'PM', 'SALES', 'DESIGNER', 'ACCOUNTS'] as const) {
      expect(homeFor(role)).toBe(STUDIO_HOME);
      expect(mayOpen(m(role), STUDIO_HOME)).toBe(true);
    }
    expect(mayOpen(m('SUPERVISOR'), STUDIO_HOME)).toBe(false);
  });

  it('a suspended member has no apps', () => {
    expect(appsFor({ role: 'OWNER', status: 'SUSPENDED' })).toEqual([]);
  });

  it('finds the app and tab a path belongs to', () => {
    expect(appForPath('/studio/calendar/appointments')?.key).toBe('calendar');
    expect(appForPath('/studio/dashboard')?.key).toBe('clients');
    expect(appForPath('/studio')?.key).toBe('today');
    expect(appForPath(STUDIO_HOME)).toBeNull();
    const clients = appForPath('/studio/clients/pool')!;
    expect(tabForPath('/studio/clients/pool', clients.tabs)?.label).toBe('Pool');
    expect(tabForPath('/studio/clients/abc', clients.tabs)?.label).toBe('All clients');
  });
});
