import { describe, expect, it } from 'vitest';
import {
  can,
  FREE_SEATS,
  isSeat,
  projectsVisibleTo,
  sessionDaysFor,
  STUDIO_ACTIONS,
  STUDIO_ROLES,
  type StudioAction,
  type StudioMemberStatusName,
  type StudioRoleName,
} from '@/modules/studio/roles';

/**
 * The studio workspace permission table (docs/studio-workspace/STUDIO-
 * WORKSPACE-BUILD.md §3), every cell. Written out as the brief's table rather
 * than derived from roles.ts, so a change to either one fails here until the
 * other agrees.
 *
 * `A` = allowed only on an assigned project; `Y` = allowed anywhere in the
 * studio; `-` = never.
 */
type Cell = 'Y' | 'A' | '-';
const TABLE: Record<StudioAction, Record<StudioRoleName, Cell>> = {
  'team.manage': { OWNER: 'Y', PM: '-', SUPERVISOR: '-', ACCOUNTS: '-', SALES: '-', DESIGNER: '-' },
  'project.create': { OWNER: 'Y', PM: 'Y', SUPERVISOR: '-', ACCOUNTS: '-', SALES: '-', DESIGNER: '-' },
  'plan.edit': { OWNER: 'Y', PM: 'A', SUPERVISOR: '-', ACCOUNTS: '-', SALES: '-', DESIGNER: '-' },
  'update.post': { OWNER: 'Y', PM: 'A', SUPERVISOR: 'A', ACCOUNTS: '-', SALES: '-', DESIGNER: 'A' },
  'checklist.tick': { OWNER: 'Y', PM: 'A', SUPERVISOR: 'A', ACCOUNTS: '-', SALES: '-', DESIGNER: 'A' },
  'decision.create': { OWNER: 'Y', PM: 'A', SUPERVISOR: '-', ACCOUNTS: '-', SALES: '-', DESIGNER: '-' },
  'snag.accept': { OWNER: 'Y', PM: 'A', SUPERVISOR: '-', ACCOUNTS: '-', SALES: '-', DESIGNER: '-' },
  'snag.fix': { OWNER: 'Y', PM: 'A', SUPERVISOR: 'A', ACCOUNTS: '-', SALES: '-', DESIGNER: '-' },
  'payment.record': { OWNER: 'Y', PM: '-', SUPERVISOR: '-', ACCOUNTS: 'Y', SALES: '-', DESIGNER: '-' },
  'payment.read': { OWNER: 'Y', PM: 'A', SUPERVISOR: '-', ACCOUNTS: 'Y', SALES: '-', DESIGNER: 'A' },
  'document.upload': { OWNER: 'Y', PM: 'A', SUPERVISOR: '-', ACCOUNTS: '-', SALES: '-', DESIGNER: 'A' },
  'vendor.rates': { OWNER: 'Y', PM: '-', SUPERVISOR: '-', ACCOUNTS: '-', SALES: '-', DESIGNER: '-' },
  'project.read': { OWNER: 'Y', PM: 'A', SUPERVISOR: 'A', ACCOUNTS: '-', SALES: '-', DESIGNER: 'A' },
  // Phases 2–5: studio-wide settings, not project actions.
  'crew.manage': { OWNER: 'Y', PM: 'Y', SUPERVISOR: '-', ACCOUNTS: '-', SALES: '-', DESIGNER: '-' },
  'calendar.edit': { OWNER: 'Y', PM: 'Y', SUPERVISOR: '-', ACCOUNTS: '-', SALES: '-', DESIGNER: '-' },
  // Studio OS Phase 1: leads and sales. For SALES, 'A' means "a lead assigned to them".
  'lead.read': { OWNER: 'Y', PM: 'Y', SUPERVISOR: '-', ACCOUNTS: '-', SALES: 'A', DESIGNER: '-' },
  'lead.edit': { OWNER: 'Y', PM: 'Y', SUPERVISOR: '-', ACCOUNTS: '-', SALES: 'A', DESIGNER: '-' },
  'lead.add': { OWNER: 'Y', PM: 'Y', SUPERVISOR: '-', ACCOUNTS: '-', SALES: 'Y', DESIGNER: '-' },
  'lead.assign': { OWNER: 'Y', PM: 'Y', SUPERVISOR: '-', ACCOUNTS: '-', SALES: '-', DESIGNER: '-' },
  'lead.merge': { OWNER: 'Y', PM: 'Y', SUPERVISOR: '-', ACCOUNTS: '-', SALES: '-', DESIGNER: '-' },
  'lead.delete': { OWNER: 'Y', PM: 'Y', SUPERVISOR: '-', ACCOUNTS: '-', SALES: '-', DESIGNER: '-' },
  'lead.import': { OWNER: 'Y', PM: 'Y', SUPERVISOR: '-', ACCOUNTS: '-', SALES: '-', DESIGNER: '-' },
  'lead.pool': { OWNER: 'Y', PM: 'Y', SUPERVISOR: '-', ACCOUNTS: '-', SALES: '-', DESIGNER: '-' },
  'lead.claim': { OWNER: 'Y', PM: 'Y', SUPERVISOR: '-', ACCOUNTS: '-', SALES: 'Y', DESIGNER: '-' },
  'quote.write': { OWNER: 'Y', PM: 'Y', SUPERVISOR: '-', ACCOUNTS: '-', SALES: 'A', DESIGNER: '-' },
  'quote.salesFinal': { OWNER: 'Y', PM: 'Y', SUPERVISOR: '-', ACCOUNTS: '-', SALES: 'A', DESIGNER: '-' },
  'booking.record': { OWNER: 'Y', PM: 'Y', SUPERVISOR: '-', ACCOUNTS: 'Y', SALES: '-', DESIGNER: '-' },
  'booking.refund': { OWNER: 'Y', PM: 'Y', SUPERVISOR: '-', ACCOUNTS: 'Y', SALES: '-', DESIGNER: '-' },
  'payments.template': { OWNER: 'Y', PM: '-', SUPERVISOR: '-', ACCOUNTS: '-', SALES: '-', DESIGNER: '-' },
  // Studio OS Phase 2: design. For DESIGNER, 'A' means "a project they are the designer on".
  'design.work': { OWNER: 'Y', PM: 'A', SUPERVISOR: '-', ACCOUNTS: '-', SALES: '-', DESIGNER: 'A' },
  'design.assign': { OWNER: 'Y', PM: 'A', SUPERVISOR: '-', ACCOUNTS: '-', SALES: '-', DESIGNER: '-' },
  'design.template': { OWNER: 'Y', PM: '-', SUPERVISOR: '-', ACCOUNTS: '-', SALES: '-', DESIGNER: '-' },
  'design.workload': { OWNER: 'Y', PM: 'Y', SUPERVISOR: '-', ACCOUNTS: '-', SALES: '-', DESIGNER: '-' },
  // Studio OS Phase 3: site crews. The PM builds and measures but never sees or sets money.
  'crew.list': { OWNER: 'Y', PM: 'Y', SUPERVISOR: '-', ACCOUNTS: 'Y', SALES: '-', DESIGNER: '-' },
  'crew.edit': { OWNER: 'Y', PM: '-', SUPERVISOR: '-', ACCOUNTS: 'Y', SALES: '-', DESIGNER: '-' },
  'crew.settings': { OWNER: 'Y', PM: '-', SUPERVISOR: '-', ACCOUNTS: '-', SALES: '-', DESIGNER: '-' },
  'workorder.read': { OWNER: 'Y', PM: 'A', SUPERVISOR: 'A', ACCOUNTS: 'Y', SALES: '-', DESIGNER: 'A' },
  'workorder.build': { OWNER: 'Y', PM: 'A', SUPERVISOR: '-', ACCOUNTS: '-', SALES: '-', DESIGNER: '-' },
  'workorder.money': { OWNER: 'Y', PM: '-', SUPERVISOR: '-', ACCOUNTS: 'Y', SALES: '-', DESIGNER: 'A' },
  'crew.pay': { OWNER: 'Y', PM: '-', SUPERVISOR: '-', ACCOUNTS: 'Y', SALES: '-', DESIGNER: '-' },
  // The project lifecycle (owner, 13 Oct 2026): designers see money everywhere on the projects they design
  // (payment.read, workorder.read/money above, read only), tick execution steps (update.post, checklist.tick),
  // sign off the design and do the project closure. The PM still never sees crew money.
  'design.close': { OWNER: 'Y', PM: 'A', SUPERVISOR: '-', ACCOUNTS: '-', SALES: '-', DESIGNER: 'A' },
  'project.closure': { OWNER: 'Y', PM: 'A', SUPERVISOR: '-', ACCOUNTS: '-', SALES: '-', DESIGNER: 'A' },
};

const active = (role: StudioRoleName) => ({ role, status: 'ACTIVE' as const });

describe('the permission table', () => {
  it('covers every action', () => {
    expect(Object.keys(TABLE).sort()).toEqual([...STUDIO_ACTIONS].sort());
  });

  for (const action of STUDIO_ACTIONS) {
    for (const role of STUDIO_ROLES) {
      const cell = TABLE[action][role];
      it(`${role} ${cell === '-' ? 'cannot' : 'can'} ${action}${cell === 'A' ? ' (assigned only)' : ''}`, () => {
        expect(can(active(role), action, { assigned: true })).toBe(cell !== '-');
        expect(can(active(role), action, { assigned: false })).toBe(cell === 'Y');
        // Asked with no project facts, a project action is refused for the assigned-only roles.
        expect(can(active(role), action)).toBe(cell === 'Y');
      });
    }
  }
});

describe('the cells that matter most', () => {
  it('a supervisor cannot read an unassigned project', () => {
    expect(can(active('SUPERVISOR'), 'project.read', { assigned: false })).toBe(false);
    expect(can(active('SUPERVISOR'), 'project.read', { assigned: true })).toBe(true);
  });

  it('a PM cannot see vendor rates, even on their own project', () => {
    expect(can(active('PM'), 'vendor.rates')).toBe(false);
    expect(can(active('PM'), 'vendor.rates', { assigned: true })).toBe(false);
  });

  it('accounts sees payments on every project, keeps and pays the crews (Phase 3), and nothing else', () => {
    const accounts = active('ACCOUNTS');
    expect(can(accounts, 'payment.read', { assigned: false })).toBe(true);
    expect(can(accounts, 'payment.record', { assigned: false })).toBe(true);
    const crews = ['crew.list', 'crew.edit', 'workorder.read', 'workorder.money', 'crew.pay'];
    for (const a of crews) expect(can(accounts, a as (typeof STUDIO_ACTIONS)[number], { assigned: false }), a).toBe(true);
    const others = STUDIO_ACTIONS.filter((a) => ![...crews, 'payment.read', 'payment.record', 'booking.record', 'booking.refund'].includes(a));
    for (const a of others) expect(can(accounts, a, { assigned: true }), a).toBe(false);
  });

  it('a supervisor cannot mark a payment received or create a decision', () => {
    expect(can(active('SUPERVISOR'), 'payment.record', { assigned: true })).toBe(false);
    expect(can(active('SUPERVISOR'), 'decision.create', { assigned: true })).toBe(false);
  });

  it('only the owner manages the team', () => {
    for (const role of STUDIO_ROLES) expect(can(active(role), 'team.manage')).toBe(role === 'OWNER');
  });

  it('the owner can do everything, assigned or not', () => {
    for (const a of STUDIO_ACTIONS) {
      expect(can(active('OWNER'), a)).toBe(true);
      expect(can(active('OWNER'), a, { assigned: false })).toBe(true);
    }
  });

  it('an invited or suspended member can do nothing, whatever their role', () => {
    for (const status of ['INVITED', 'SUSPENDED'] as StudioMemberStatusName[]) {
      for (const role of STUDIO_ROLES) {
        for (const a of STUDIO_ACTIONS) expect(can({ role, status }, a, { assigned: true }), `${status} ${role} ${a}`).toBe(false);
      }
    }
  });
});

describe('projectsVisibleTo', () => {
  const m = (role: StudioRoleName, status: StudioMemberStatusName = 'ACTIVE') => ({ id: 'm1', studioId: 's1', role, status });
  const NONE = { id: { in: [] } };

  it('gives the owner every project of their own studio, and only theirs', () => {
    expect(projectsVisibleTo(m('OWNER'))).toEqual({ introduction: { studioId: 's1' } });
  });

  it('gives a PM or supervisor only the projects they are on', () => {
    for (const role of ['PM', 'SUPERVISOR'] as const) {
      expect(projectsVisibleTo(m(role))).toEqual({ introduction: { studioId: 's1' }, team: { some: { memberId: 'm1' } } });
    }
  });

  it('gives accounts no projects to read, but every project for payments', () => {
    expect(projectsVisibleTo(m('ACCOUNTS'))).toEqual(NONE);
    expect(projectsVisibleTo(m('ACCOUNTS'), 'payments')).toEqual({ introduction: { studioId: 's1' } });
  });

  it('gives a supervisor no payments list, and a PM only their own projects', () => {
    expect(projectsVisibleTo(m('SUPERVISOR'), 'payments')).toEqual(NONE);
    expect(projectsVisibleTo(m('PM'), 'payments')).toEqual({ introduction: { studioId: 's1' }, team: { some: { memberId: 'm1' } } });
  });

  it('gives a suspended or invited member nothing', () => {
    expect(projectsVisibleTo(m('OWNER', 'SUSPENDED'))).toEqual(NONE);
    expect(projectsVisibleTo(m('PM', 'INVITED'))).toEqual(NONE);
    expect(projectsVisibleTo(m('ACCOUNTS', 'SUSPENDED'), 'payments')).toEqual(NONE);
  });
});

describe('seats and sessions', () => {
  it('counts a seat only for a member who has signed in and is not suspended', () => {
    expect(isSeat({ status: 'ACTIVE' })).toBe(true);
    expect(isSeat({ status: 'INVITED' })).toBe(false);
    expect(isSeat({ status: 'SUSPENDED' })).toBe(false);
    expect(FREE_SEATS).toBe(5);
  });

  it('keeps a supervisor signed in for 90 days and everyone else for 30', () => {
    expect(sessionDaysFor('SUPERVISOR')).toBe(90);
    for (const role of ['OWNER', 'PM', 'ACCOUNTS'] as const) expect(sessionDaysFor(role)).toBe(30);
  });
});
