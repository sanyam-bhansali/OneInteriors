import { describe, expect, it } from 'vitest';
import { appsFor, comingSoonApps } from '@/modules/studio/apps';
import { homeFor, mayOpen, FULL_SOFTWARE_PATHS, SETUP_PATH } from '@/modules/studio/surfaces';
import { doorFor, pilotAreaFor, waitingForFullSoftware } from '@/modules/studio/pilot';
import { can, FULL_SOFTWARE_ACTIONS, STUDIO_ACTIONS, type StudioRoleName } from '@/modules/studio/roles';

/**
 * The per-studio pilot switch (owner, 14 Oct 2026; studio/pilot.ts): the
 * rule both ways. With the switch on (and when it is not known, as in every
 * older test) nothing changes; off, only leads, quotations, the product
 * master, the needed settings, Today and Calendar open.
 */

const m = (role: StudioRoleName, fullSoftware?: boolean) => ({ role, status: 'ACTIVE' as const, ...(fullSoftware === undefined ? {} : { fullSoftware }) });
const ROLES: StudioRoleName[] = ['OWNER', 'PM', 'SALES', 'DESIGNER', 'ACCOUNTS', 'SUPERVISOR'];

const OPEN_TO_OWNER = [
  '/studio/home',
  '/studio/today',
  '/studio',
  '/studio/clients',
  '/studio/clients/c1',
  '/studio/clients/pool',
  '/studio/clients/import',
  '/studio/clients/bin',
  '/studio/clients/analytics',
  '/studio/dashboard',
  '/studio/quotations',
  '/studio/quotations/first',
  '/studio/quotations/builder',
  '/studio/quotations/terms',
  '/studio/quotations/q1',
  '/studio/quotations/q1/print',
  '/studio/products',
  '/studio/rates',
  '/studio/calendar',
  '/studio/settings',
  '/studio/settings/pipeline',
  '/studio/settings/sources',
  '/studio/settings/fields',
  '/studio/settings/payments',
  SETUP_PATH,
];

const CLOSED = [
  '/studio/projects',
  '/studio/projects/p1',
  '/studio/projects/start',
  '/studio/updates',
  '/studio/design',
  '/studio/site',
  '/studio/site/snag',
  '/studio/payments',
  '/studio/vendors',
  '/studio/vendors/pay',
  '/studio/vendors/labour',
  '/studio/settings/design',
  '/studio/settings/trades',
  '/studio/settings/crew',
  '/studio/listing',
];

describe('the pilot switch: on (or unknown) changes nothing', () => {
  it('every role opens exactly what it did', () => {
    for (const role of ROLES) {
      for (const p of [...OPEN_TO_OWNER, ...CLOSED]) {
        expect(mayOpen(m(role, true), p), `${role} ${p}`).toBe(mayOpen(m(role), p));
      }
      expect(appsFor(m(role, true))).toEqual(appsFor(m(role)));
      expect(homeFor(role, true)).toBe(homeFor(role));
    }
  });

  it('every action stays as the table has it', () => {
    for (const role of ROLES) for (const a of STUDIO_ACTIONS) expect(can(m(role, true), a, { assigned: true }), `${role} ${a}`).toBe(can(m(role), a, { assigned: true }));
  });

  it('no coming-soon tiles and nobody waiting', () => {
    for (const role of ROLES) {
      expect(comingSoonApps(m(role, true))).toEqual([]);
      expect(waitingForFullSoftware(m(role, true))).toBe(false);
    }
  });
});

describe('the pilot switch: off', () => {
  it('the owner opens leads, quotations, the product master, its settings, Today and Calendar', () => {
    for (const p of OPEN_TO_OWNER) expect(mayOpen(m('OWNER', false), p), p).toBe(true);
  });

  it('every full-software screen is closed to everyone, typed by hand or not', () => {
    for (const role of ROLES) for (const p of CLOSED) expect(mayOpen(m(role, false), p), `${role} ${p}`).toBe(false);
    for (const p of FULL_SOFTWARE_PATHS) expect(pilotAreaFor(p), p).not.toBeNull();
  });

  it('a closed screen shows its "coming soon" to the owner and sales; other refusals still go home', () => {
    expect(doorFor(m('OWNER', false), '/studio/projects/p1')).toEqual({ kind: 'soon', area: 'projects' });
    /* Pro (owner, 21 Oct 2026): the owner adds salespeople. */
    expect(doorFor(m('OWNER', false), '/studio/settings/team')).toEqual({ kind: 'open' });
    expect(doorFor(m('OWNER', false), '/studio/vendors/pay')).toEqual({ kind: 'soon', area: 'vendors' });
    expect(doorFor(m('OWNER', false), '/studio/clients')).toEqual({ kind: 'open' });
    /* Sales never had projects: still home, not "coming soon". */
    expect(doorFor(m('SALES', false), '/studio/projects')).toEqual({ kind: 'home', to: '/studio/home' });
    expect(doorFor(m('SALES', false), '/studio/quotations/q1')).toEqual({ kind: 'open' });
  });

  it('the roles that need the full software open only their home, which says why', () => {
    for (const role of ['PM', 'DESIGNER', 'ACCOUNTS', 'SUPERVISOR'] as const) {
      expect(mayOpen(m(role, false), '/studio/home'), role).toBe(true);
      for (const p of [...OPEN_TO_OWNER.filter((x) => x !== '/studio/home'), ...CLOSED]) expect(mayOpen(m(role, false), p), `${role} ${p}`).toBe(false);
      expect(homeFor(role, false)).toBe('/studio/home');
      expect(doorFor(m(role, false), '/studio/site')).toEqual({ kind: 'home', to: '/studio/home' });
      expect(appsFor(m(role, false))).toEqual([]);
      expect(waitingForFullSoftware(m(role, false))).toBe(true);
      for (const a of STUDIO_ACTIONS) expect(can(m(role, false), a, { assigned: true }), `${role} ${a}`).toBe(false);
    }
  });

  it('the apps menu shows only open apps; the owner sees the rest as coming soon', () => {
    expect(appsFor(m('OWNER', false)).map((a) => a.key)).toEqual(['today', 'clients', 'quotes', 'calendar', 'rates', 'team']);
    /* Pro (owner, 21 Oct 2026): the Team app opens the team, where the owner adds salespeople. */
    const team = appsFor(m('OWNER', false)).find((a) => a.key === 'team')!;
    expect(team.href).toBe('/studio/settings/team');
    expect(team.name).toBe('Team');
    expect(comingSoonApps(m('OWNER', false)).map((a) => a.key)).toEqual(['projects', 'documents', 'site', 'money', 'vendors', 'chats', 'intros']);
    expect(comingSoonApps(m('SALES', false))).toEqual([]);
    expect(appsFor(m('SALES', false)).map((a) => a.key)).toEqual(['clients', 'quotes', 'calendar']);
  });

  it('the owner keeps leads, quotations, booking, payment stages and the calendar; loses the full software’s actions', () => {
    for (const a of ['lead.read', 'lead.import', 'lead.assign', 'quote.write', 'quote.salesFinal', 'booking.record', 'payments.template', 'calendar.edit'] as const) {
      expect(can(m('OWNER', false), a), a).toBe(true);
    }
    for (const a of FULL_SOFTWARE_ACTIONS) expect(can(m('OWNER', false), a, { assigned: true }), a).toBe(false);
    expect(can(m('SALES', false), 'quote.write', { assigned: true })).toBe(true);
  });

  it('the setup quiz is the owner’s alone', () => {
    for (const role of ROLES) expect(mayOpen(m(role), SETUP_PATH), role).toBe(role === 'OWNER');
  });
});
