import { describe, expect, it } from 'vitest';
import {
  PLAN_ORDER,
  SOFTWARE_PLANS,
  fits,
  isSoftwarePlan,
  istMonthStart,
  limitMessage,
  limitsFor,
  opensFullSoftware,
  planAllowsRole,
  planForRole,
  planOf,
  seatLimit,
  worksAlone,
  type SoftwarePlan,
} from '@/modules/studio/software-plan';
import { mayOpen } from '@/modules/studio/surfaces';
import { appsFor } from '@/modules/studio/apps';
import { can, STUDIO_ROLES, type StudioRoleName } from '@/modules/studio/roles';

/**
 * The studio CRM plans, Free / Pro / Max (owner, approved 24 Nov 2026):
 * the matrix in studio/software-plan.ts, and what the door (`mayOpen`), the
 * lock (`can`) and the apps menu make of each plan for each role.
 */

/** A member as access.ts memberFor builds them for a studio on this plan. */
const on = (plan: SoftwarePlan, role: StudioRoleName = 'OWNER') => ({
  role,
  status: 'ACTIVE' as const,
  fullSoftware: opensFullSoftware(plan),
  solo: worksAlone(plan),
});

describe('the plan matrix', () => {
  it('has Free, Pro and Max, in that order', () => {
    expect(PLAN_ORDER).toEqual(['FREE', 'PRO', 'MAX']);
    expect(PLAN_ORDER.map((p) => SOFTWARE_PLANS[p].name)).toEqual(['Free', 'Pro', 'Max']);
  });

  it('each plan lets in every role the plan below it does', () => {
    for (let i = 1; i < PLAN_ORDER.length; i++) {
      for (const r of SOFTWARE_PLANS[PLAN_ORDER[i - 1]!].roles) expect(planAllowsRole(PLAN_ORDER[i]!, r)).toBe(true);
    }
  });

  it('roles: Free is the owner, Pro adds sales, Max adds the delivery roles', () => {
    expect(SOFTWARE_PLANS.FREE.roles).toEqual(['OWNER']);
    expect(SOFTWARE_PLANS.PRO.roles).toEqual(['OWNER', 'SALES']);
    expect([...SOFTWARE_PLANS.MAX.roles].sort()).toEqual([...STUDIO_ROLES].sort());
    expect(planForRole('SALES')).toBe('PRO');
    expect(planForRole('DESIGNER')).toBe('MAX');
    expect(planForRole('OWNER')).toBe('FREE');
  });

  it('seats included: 1, 5, 15; only Free limits seats until billing sells them', () => {
    expect(PLAN_ORDER.map((p) => SOFTWARE_PLANS[p].includedSeats)).toEqual([1, 5, 15]);
    expect(seatLimit('FREE')).toBe(1);
    expect(seatLimit('PRO')).toBeNull();
    expect(seatLimit('MAX')).toBeNull();
  });

  it('only Free has limits, and only Pro and Max may take our line off the quotation', () => {
    expect(SOFTWARE_PLANS.FREE.limits).toEqual({ seats: 1, activeLeads: 200, quotePrintsPerMonth: 20, storageBytes: 1024 ** 3 });
    for (const p of ['PRO', 'MAX'] as const) {
      expect(SOFTWARE_PLANS[p].limits).toEqual({ seats: null, activeLeads: null, quotePrintsPerMonth: null, storageBytes: null });
      expect(SOFTWARE_PLANS[p].mayRemoveMark).toBe(true);
    }
    expect(SOFTWARE_PLANS.FREE.mayRemoveMark).toBe(false);
  });

  it('accepts only the three plan names', () => {
    expect(isSoftwarePlan('FREE')).toBe(true);
    expect(isSoftwarePlan('PRO')).toBe(true);
    expect(isSoftwarePlan('MAX')).toBe(true);
    expect(isSoftwarePlan('SOLO')).toBe(false);
    expect(isSoftwarePlan('max')).toBe(false);
    expect(isSoftwarePlan('ENTERPRISE')).toBe(false);
  });
});

describe('reading a studio row', () => {
  it('Pro unless it says Free or Max', () => {
    expect(planOf(null)).toBe('PRO');
    expect(planOf({ softwarePlan: 'PRO', fullSoftware: false })).toBe('PRO');
    expect(planOf({ softwarePlan: 'FREE', fullSoftware: false })).toBe('FREE');
    expect(planOf({ softwarePlan: 'MAX', fullSoftware: true })).toBe('MAX');
  });

  it('the old pilot switch still means Max', () => {
    expect(planOf({ softwarePlan: 'PRO', fullSoftware: true })).toBe('MAX');
    expect(planOf({ fullSoftware: true })).toBe('MAX');
  });

  it('the old Pro Solo reads as Free, one seat, with the other limits waived', () => {
    const solo = { softwarePlan: 'SOLO', fullSoftware: false };
    expect(planOf(solo)).toBe('FREE');
    expect(limitsFor(solo)).toEqual({ seats: 1, activeLeads: null, quotePrintsPerMonth: null, storageBytes: null });
    expect(limitsFor({ softwarePlan: 'FREE', fullSoftware: false })).toEqual(SOFTWARE_PLANS.FREE.limits);
    expect(limitsFor({ softwarePlan: 'PRO' }).activeLeads).toBeNull();
  });
});

describe('limits at and past their edge', () => {
  const L = SOFTWARE_PLANS.FREE.limits;

  it('open leads: the 200th fits, the 201st does not; an import is all or nothing', () => {
    expect(fits(L.activeLeads, 199)).toBe(true);
    expect(fits(L.activeLeads, 200)).toBe(false);
    expect(fits(L.activeLeads, 150, 50)).toBe(true);
    expect(fits(L.activeLeads, 150, 51)).toBe(false);
  });

  it('quotation prints: the 20th new one this month prints, the 21st does not', () => {
    expect(fits(L.quotePrintsPerMonth, 19)).toBe(true);
    expect(fits(L.quotePrintsPerMonth, 20)).toBe(false);
  });

  it('storage: a file that exactly fills it fits, one byte more does not', () => {
    const gb = 1024 ** 3;
    expect(fits(L.storageBytes, gb - 100, 100)).toBe(true);
    expect(fits(L.storageBytes, gb - 100, 101)).toBe(false);
  });

  it('no limit always fits', () => {
    expect(fits(null, 1_000_000, 1_000_000)).toBe(true);
  });

  it('every limit message says how to get past it and that nothing is lost', () => {
    expect(limitMessage('activeLeads', L)).toMatch(/200 open leads.*nothing is deleted.*Pro/);
    expect(limitMessage('activeLeads', L)).toMatch(/enquiry form still arrive/);
    expect(limitMessage('quotePrintsPerMonth', L)).toMatch(/20 new quotations a month.*print again/);
    expect(limitMessage('storageBytes', L)).toMatch(/1 GB/);
    expect(limitMessage('seats', L)).toMatch(/one person/);
  });

  it('the print month starts at midnight on the 1st, India time', () => {
    /* 1 Dec 00:10 IST is 30 Nov 18:40 UTC: already December. */
    expect(istMonthStart(new Date('2026-11-30T18:40:00Z')).toISOString()).toBe('2026-11-30T18:30:00.000Z');
    /* 30 Nov 23:50 IST is still November. */
    expect(istMonthStart(new Date('2026-11-30T18:20:00Z')).toISOString()).toBe('2026-10-31T18:30:00.000Z');
  });
});

describe('what each plan opens (the door, the lock and the apps menu)', () => {
  const SALES_PATHS = ['/studio/clients', '/studio/quotations', '/studio/products', '/studio/today', '/studio/calendar', '/studio/settings'];
  const MAX_PATHS = ['/studio/projects', '/studio/design', '/studio/site', '/studio/payments', '/studio/vendors', '/studio/documents', '/studio/chats', '/studio/service-visits', '/studio/clients/societies'];

  it('every plan opens leads, quotations, products, Today, Calendar and Settings to the owner', () => {
    for (const p of PLAN_ORDER) for (const path of SALES_PATHS) expect(mayOpen(on(p), path), `${p} ${path}`).toBe(true);
  });

  it('only Max opens projects, design, site, payments, crews, documents, chats, service visits and societies', () => {
    for (const path of MAX_PATHS) {
      expect(mayOpen(on('FREE'), path), `FREE ${path}`).toBe(false);
      expect(mayOpen(on('PRO'), path), `PRO ${path}`).toBe(false);
      expect(mayOpen(on('MAX'), path), `MAX ${path}`).toBe(true);
    }
  });

  it('Free has no team screen and no lead pool; Pro and Max have both', () => {
    expect(mayOpen(on('FREE'), '/studio/settings/team')).toBe(false);
    expect(mayOpen(on('FREE'), '/studio/clients/pool')).toBe(false);
    for (const p of ['PRO', 'MAX'] as const) {
      expect(mayOpen(on(p), '/studio/settings/team')).toBe(true);
      expect(mayOpen(on(p), '/studio/clients/pool')).toBe(true);
    }
    const apps = appsFor(on('FREE'));
    expect(apps.find((a) => a.key === 'team')?.href).toBe('/studio/settings');
    expect(apps.find((a) => a.key === 'clients')?.tabs.map((t) => t.label)).not.toContain('Pool');
  });

  it('the delivery roles work only on Max; on Free and Pro they are sent home', () => {
    for (const role of ['DESIGNER', 'PM', 'SUPERVISOR', 'ACCOUNTS'] as const) {
      expect(mayOpen(on('MAX', role), '/studio/calendar'), `MAX ${role}`).toBe(true);
      for (const p of ['FREE', 'PRO'] as const) {
        expect(mayOpen(on(p, role), '/studio/calendar'), `${p} ${role}`).toBe(false);
        expect(mayOpen(on(p, role), '/studio/home'), `${p} ${role}`).toBe(true);
      }
    }
  });

  it('the full-software actions are refused below Max, whoever asks', () => {
    for (const p of ['FREE', 'PRO'] as const) {
      expect(can(on(p), 'project.create')).toBe(false);
      expect(can(on(p), 'payment.read')).toBe(false);
    }
    expect(can(on('MAX'), 'project.create')).toBe(true);
  });

  it('the owner on Free or Pro sees the Max apps as "coming soon", never as links', () => {
    const open = new Set(appsFor(on('PRO')).map((a) => a.key));
    for (const k of ['projects', 'site', 'money'] as const) expect(open.has(k)).toBe(false);
    const max = new Set(appsFor(on('MAX')).map((a) => a.key));
    for (const k of ['projects', 'site', 'money'] as const) expect(max.has(k)).toBe(true);
  });
});
