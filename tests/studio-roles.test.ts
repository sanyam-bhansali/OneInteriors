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
  'team.manage': { OWNER: 'Y', PM: '-', SUPERVISOR: '-', ACCOUNTS: '-' },
  'project.create': { OWNER: 'Y', PM: 'Y', SUPERVISOR: '-', ACCOUNTS: '-' },
  'plan.edit': { OWNER: 'Y', PM: 'A', SUPERVISOR: '-', ACCOUNTS: '-' },
  'update.post': { OWNER: 'Y', PM: 'A', SUPERVISOR: 'A', ACCOUNTS: '-' },
  'checklist.tick': { OWNER: 'Y', PM: 'A', SUPERVISOR: 'A', ACCOUNTS: '-' },
  'decision.create': { OWNER: 'Y', PM: 'A', SUPERVISOR: '-', ACCOUNTS: '-' },
  'snag.accept': { OWNER: 'Y', PM: 'A', SUPERVISOR: '-', ACCOUNTS: '-' },
  'snag.fix': { OWNER: 'Y', PM: 'A', SUPERVISOR: 'A', ACCOUNTS: '-' },
  'payment.record': { OWNER: 'Y', PM: '-', SUPERVISOR: '-', ACCOUNTS: 'Y' },
  'payment.read': { OWNER: 'Y', PM: 'A', SUPERVISOR: '-', ACCOUNTS: 'Y' },
  'document.upload': { OWNER: 'Y', PM: 'A', SUPERVISOR: '-', ACCOUNTS: '-' },
  'vendor.rates': { OWNER: 'Y', PM: '-', SUPERVISOR: '-', ACCOUNTS: '-' },
  'project.read': { OWNER: 'Y', PM: 'A', SUPERVISOR: 'A', ACCOUNTS: '-' },
  // Phases 2–5: studio-wide settings, not project actions.
  'crew.manage': { OWNER: 'Y', PM: 'Y', SUPERVISOR: '-', ACCOUNTS: '-' },
  'calendar.edit': { OWNER: 'Y', PM: 'Y', SUPERVISOR: '-', ACCOUNTS: '-' },
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

  it('accounts sees payments on every project and nothing else', () => {
    const accounts = active('ACCOUNTS');
    expect(can(accounts, 'payment.read', { assigned: false })).toBe(true);
    expect(can(accounts, 'payment.record', { assigned: false })).toBe(true);
    const others = STUDIO_ACTIONS.filter((a) => a !== 'payment.read' && a !== 'payment.record');
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
