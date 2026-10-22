import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_SALES_ROLES,
  SALES_GROUPS,
  SALES_PERMISSIONS,
  SALES_PERMISSION_KEYS,
  builtInSalesRoleRows,
  checkSalesRole,
  narrower,
  permissionWords,
  reachesAtLeast,
  readSalesPermissions,
} from '@/modules/studio/sales-permissions';

/**
 * The sales permission catalogue (owner, 22 Oct 2026; docs/studio-os/
 * SALES-ROLES.md): its shape, how a stored role is read (anything unknown
 * grants nothing), the role form's check, and that the migration's built-in
 * roles are exactly BUILT_IN_SALES_ROLES.
 */

const MIGRATION = 'prisma/migrations/20261022110000_sales_roles_teams/migration.sql';

describe('the catalogue', () => {
  it('has each key once, in a known group, with a label and a hint', () => {
    expect(new Set(SALES_PERMISSION_KEYS).size).toBe(SALES_PERMISSION_KEYS.length);
    for (const p of SALES_PERMISSIONS) {
      expect(SALES_GROUPS).toContain(p.group);
      expect(p.label.length).toBeGreaterThan(3);
      expect(p.hint.length).toBeGreaterThan(10);
    }
  });

  it('gives a reach to the lead permissions, and none to the on/off ones', () => {
    const reach = (k: string) => SALES_PERMISSIONS.find((p) => p.key === k)!.reaches;
    expect(reach('leads.view')).toEqual(['own', 'team', 'all']);
    expect(reach('leads.edit')).toEqual(['own', 'team', 'all']);
    expect(reach('calls.log')).toEqual(['own', 'team', 'all']);
    expect(reach('quotes.write')).toEqual(['own', 'team', 'all']);
    expect(reach('quotes.salesFinal')).toEqual(['own', 'team', 'all']);
    expect(reach('leads.assign')).toEqual(['team', 'all']);
    expect(reach('leads.pool')).toEqual(['team', 'all']);
    expect(reach('analytics.view')).toEqual(['team', 'all']);
    for (const k of ['leads.add', 'leads.merge', 'leads.delete', 'leads.import', 'leads.export', 'quotes.build', 'settings.leads', 'team.manageSales']) expect(reach(k), k).toBeNull();
  });

  it('carries "Builds quotations" (owner, 22 Oct 2026) as an on/off permission', () => {
    const p = SALES_PERMISSIONS.find((x) => x.key === 'quotes.build')!;
    expect(p.label).toBe('Builds quotations');
    expect(p.hint).toMatch(/handed out in turns/);
    expect(p.reaches).toBeNull();
  });
});

describe('reading a stored role', () => {
  it('keeps known keys with allowed values only', () => {
    expect(readSalesPermissions({ 'leads.view': 'team', 'leads.add': true, 'leads.assign': 'all' })).toEqual({ 'leads.view': 'team', 'leads.add': true, 'leads.assign': 'all' });
  });

  it('drops unknown keys, unknown reaches, a reach a key does not take, and truthy non-true values', () => {
    expect(
      readSalesPermissions({
        'leads.everything': 'all',
        'leads.view': 'galaxy',
        'leads.assign': 'own',
        'leads.pool': true,
        'leads.add': 'yes',
        'leads.delete': 1,
        'team.manageSales': 'all',
      }),
    ).toEqual({});
  });

  it('reads nonsense as nothing', () => {
    for (const raw of [null, undefined, 'all', 42, [], ['leads.view']]) expect(readSalesPermissions(raw)).toEqual({});
  });
});

describe('the role form', () => {
  it('needs a name and "See leads"', () => {
    expect(checkSalesRole({ name: ' ', permissions: { 'leads.view': 'own' } })).toEqual({ ok: false, error: 'Give the role a name.' });
    expect(checkSalesRole({ name: 'Telecaller', permissions: { 'leads.add': true } })).toEqual({ ok: false, error: 'A sales role needs “See leads” at least.' });
    expect(checkSalesRole({ name: 'x'.repeat(41), permissions: { 'leads.view': 'own' } }).ok).toBe(false);
  });

  it('cleans what it keeps', () => {
    const r = checkSalesRole({ name: '  Team   lead ', description: '  runs  a pod ', permissions: { 'leads.view': 'team', bogus: true } });
    expect(r).toEqual({ ok: true, role: { name: 'Team lead', description: 'runs a pod', permissions: { 'leads.view': 'team' } } });
  });
});

describe('reach arithmetic and words', () => {
  it('orders own < team < all', () => {
    expect(narrower('all', 'team')).toBe('team');
    expect(narrower('own', 'all')).toBe('own');
    expect(reachesAtLeast('team', 'own')).toBe(true);
    expect(reachesAtLeast('own', 'team')).toBe(false);
  });

  it('says a row in words', () => {
    expect(permissionWords({ 'leads.view': 'team' }, 'leads.view')).toBe('Their team');
    expect(permissionWords({ 'leads.add': true }, 'leads.add')).toBe('On');
    expect(permissionWords({}, 'leads.add')).toBe('Off');
  });
});

describe('the built-in roles', () => {
  const byKey = Object.fromEntries(BUILT_IN_SALES_ROLES.map((r) => [r.system, r]));

  it('are Admin, Sales head and Sales rep, each a valid role', () => {
    expect(BUILT_IN_SALES_ROLES.map((r) => [r.system, r.name])).toEqual([
      ['ADMIN', 'Admin'],
      ['HEAD', 'Sales head'],
      ['REP', 'Sales rep'],
    ]);
    for (const r of BUILT_IN_SALES_ROLES) {
      expect(readSalesPermissions(r.permissions), r.name).toEqual(r.permissions);
      expect(checkSalesRole({ name: r.name, permissions: r.permissions }).ok).toBe(true);
    }
  });

  it('Admin: everything across the studio except the leads download (still the owner’s choice)', () => {
    const a = byKey.ADMIN!.permissions;
    expect(a['leads.view']).toBe('all');
    expect(a['leads.assign']).toBe('all');
    expect(a['team.manageSales']).toBe(true);
    expect(a['settings.leads']).toBe(true);
    expect(a['leads.export']).toBeUndefined();
  });

  it('Sales head: their team; Sales rep: their own leads and their team’s pool (Phase 1)', () => {
    const h = byKey.HEAD!.permissions;
    expect(h['leads.view']).toBe('team');
    expect(h['leads.assign']).toBe('team');
    expect(h['analytics.view']).toBe('team');
    expect(h['team.manageSales']).toBeUndefined();
    const r = byKey.REP!.permissions;
    expect(r).toEqual({ 'leads.view': 'own', 'leads.edit': 'own', 'leads.add': true, 'leads.bulk': 'own', 'leads.pool': 'team', 'calls.log': 'own', 'quotes.write': 'own', 'quotes.salesFinal': 'own' });
  });

  it('quotes.build: Admin and Sales head on, Sales rep off', () => {
    expect(byKey.ADMIN!.permissions['quotes.build']).toBe(true);
    expect(byKey.HEAD!.permissions['quotes.build']).toBe(true);
    expect(byKey.REP!.permissions['quotes.build']).toBeUndefined();
  });

  it('as rows, one per built-in for the studio', () => {
    const rows = builtInSalesRoleRows('s1');
    expect(rows.map((r) => [r.studioId, r.system])).toEqual([
      ['s1', 'ADMIN'],
      ['s1', 'HEAD'],
      ['s1', 'REP'],
    ]);
  });
});

describe('the migration', () => {
  const sql = readFileSync(MIGRATION, 'utf8');

  it('writes exactly the built-in roles, word for word', () => {
    for (const r of BUILT_IN_SALES_ROLES) {
      const json = JSON.stringify(r.permissions);
      expect(sql, r.system).toContain(`('${r.system}', '${r.name}', '${r.description}', ${r.sortOrder},\n         '${json}')`);
    }
  });

  it('puts every SALES member on Sales rep, and closes the new table', () => {
    expect(sql).toMatch(/r\."system" = 'REP'\s+AND m\."role" = 'SALES'/);
    expect(sql).toContain('ALTER TABLE "studio_sales_roles" ENABLE ROW LEVEL SECURITY;');
    expect(sql).toContain('ALTER TABLE "studio_sales_roles" FORCE ROW LEVEL SECURITY;');
    expect(sql).toContain('REVOKE ALL ON "studio_sales_roles" FROM anon, authenticated;');
    expect(sql).toContain(`ALTER TYPE "LeadRouteMode" ADD VALUE 'TEAM';`);
  });

  it('is expand-only (nothing dropped)', () => {
    expect(sql).not.toMatch(/\bDROP\b/i);
  });
});
