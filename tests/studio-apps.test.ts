import { describe, expect, it } from 'vitest';
import { appForPath, appsFor, tabForPath, STUDIO_HOME } from '@/modules/studio/apps';
import { homeFor, mayOpen } from '@/modules/studio/surfaces';
import type { StudioRoleName } from '@/modules/studio/roles';
import { buildSalesContext } from '@/modules/studio/sales-access';

const m = (role: StudioRoleName) => ({ role, status: 'ACTIVE' as const });
const keys = (role: StudioRoleName) => appsFor(m(role)).map((a) => a.key);

describe('studio apps (UI handoff 12 Oct 2026)', () => {
  it('the owner sees every app, in the launcher order', () => {
    expect(keys('OWNER')).toEqual(['today', 'clients', 'quotes', 'projects', 'documents', 'site', 'money', 'vendors', 'calendar', 'intros', 'rates', 'team']);
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

  it('accounts keeps Money and Vendors, and the calendar everyone has (27 Oct 2026)', () => {
    expect(keys('ACCOUNTS')).toEqual(['money', 'vendors', 'calendar']);
  });

  it('a supervisor has site mode (and the calendar everyone has) and lands there', () => {
    expect(keys('SUPERVISOR')).toEqual(['site', 'calendar']);
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

  it("Quotations carries Hauspire's top bar: First Quote, Full Builder, My Quotations, Products, Terms (13 Oct 2026)", () => {
    const tabs = (role: StudioRoleName) => appsFor(m(role)).find((a) => a.key === 'quotes')?.tabs.map((t) => t.label);
    /* To build (quotation requests, owner 22 Oct 2026): owner and PM hand requests over. */
    expect(tabs('OWNER')).toEqual(['First Quote', 'Full Builder', 'My Quotations', 'To build', 'Products', 'Terms']);
    expect(tabs('PM')).toEqual(['First Quote', 'Full Builder', 'My Quotations', 'To build', 'Products', 'Terms']);
    /* A salesperson opens neither the product master nor the studio's terms. */
    expect(tabs('SALES')).toEqual(['First Quote', 'Full Builder', 'My Quotations']);
    expect(mayOpen(m('SALES'), '/studio/quotations/terms')).toBe(false);
    expect(mayOpen(m('SALES'), '/studio/quotations/builder')).toBe(true);
  });

  it('To build shows for a salesperson whose sales role builds quotations, not for one without (22 Oct 2026)', () => {
    const sales = (permissions: Record<string, unknown>) => ({
      role: 'SALES' as const,
      status: 'ACTIVE' as const,
      id: 'k',
      sales: buildSalesContext({ id: 'k', reportsToId: null }, { id: 'r', name: 'Role', permissions }, []),
    });
    const tabsOf = (member: ReturnType<typeof sales>) => appsFor(member).find((a) => a.key === 'quotes')?.tabs.map((t) => t.label);
    expect(tabsOf(sales({ 'leads.view': 'own', 'quotes.write': 'own', 'quotes.build': true }))).toContain('To build');
    expect(tabsOf(sales({ 'leads.view': 'own', 'quotes.write': 'own' }))).not.toContain('To build');
    expect(tabForPath('/studio/quotations/requests', appForPath('/studio/quotations')!.tabs)?.label).toBe('To build');
  });

  it('the product master page sits under Quotations, and its own tile still opens it', () => {
    const quotes = appForPath('/studio/products')!;
    expect(quotes.key).toBe('quotes');
    expect(tabForPath('/studio/products', quotes.tabs)?.label).toBe('Products');
    expect(appForPath('/studio/rates')?.key).toBe('rates');
    expect(appsFor(m('OWNER')).find((a) => a.key === 'rates')?.href).toBe('/studio/products');
    expect(tabForPath('/studio/quotations/terms', quotes.tabs)?.label).toBe('Terms');
    expect(tabForPath('/studio/quotations/builder', quotes.tabs)?.label).toBe('Full Builder');
    expect(tabForPath('/studio/quotations/abc', quotes.tabs)?.label).toBe('My Quotations');
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
