import { describe, expect, it } from 'vitest';
import { can, projectsVisibleTo, needsAssignment } from '@/modules/studio/roles';
import { STUDIO_HOME, homeFor, mayOpen, usesOffice, usesOfficeShell } from '@/modules/studio/surfaces';
import { roleCan, ROLE_NAMES } from '@/modules/studio/team-rules';

/**
 * Studio OS Phase 2 (docs/studio-os/PHASE-2-DESIGN.md §1): the DESIGNER role.
 * Only the projects they are the designer on (a team row, written with the
 * designer pick), design work and files there, no money, no leads, no
 * other designers' projects.
 */

const designer = { id: 'm-d', studioId: 's1', role: 'DESIGNER' as const, status: 'ACTIVE' as const };

describe('what a designer may do', () => {
  it('works the design and its files only on a project they are on', () => {
    for (const a of ['project.read', 'design.work', 'document.upload'] as const) {
      expect(can(designer, a, { assigned: true }), a).toBe(true);
      expect(can(designer, a, { assigned: false }), a).toBe(false);
    }
  });

  it('sees no money, edits no plan, picks no designer, posts nothing from site and sees no leads', () => {
    for (const a of ['payment.read', 'payment.record', 'plan.edit', 'design.assign', 'design.template', 'design.workload', 'update.post', 'checklist.tick', 'decision.create', 'lead.read', 'quote.write', 'booking.record'] as const) {
      expect(can(designer, a, { assigned: true }), a).toBe(false);
    }
  });

  it('reads only the projects they are on, inside their own studio', () => {
    expect(needsAssignment('DESIGNER')).toBe(true);
    expect(projectsVisibleTo(designer)).toEqual({ introduction: { studioId: 's1' }, team: { some: { memberId: 'm-d' } } });
    expect(projectsVisibleTo(designer, 'payments')).toEqual({ id: { in: [] } });
  });

  it('is nothing at all when suspended', () => {
    expect(can({ ...designer, status: 'SUSPENDED' }, 'design.work', { assigned: true })).toBe(false);
  });
});

describe('where a designer works', () => {
  it('lands on the studio home (UI handoff), not in the office', () => {
    expect(homeFor('DESIGNER')).toBe(STUDIO_HOME);
    expect(usesOffice(designer)).toBe(false);
    expect(usesOfficeShell(designer)).toBe(false);
  });

  it('opens the design page and one project’s workspace, nothing else', () => {
    for (const p of ['/studio/design', '/studio/projects/p1', '/studio/projects/p1/']) expect(mayOpen(designer, p), p).toBe(true);
    for (const p of ['/studio/projects', '/studio/projects/start', '/studio/projects/p1/decisions/new', '/studio/clients', '/studio/today', '/studio/payments', '/studio/settings/design', '/studio/quotations']) {
      expect(mayOpen(designer, p), p).toBe(false);
    }
  });

  it('owner and PM see the designers’ page; only the owner sets the design steps', () => {
    const pm = { role: 'PM' as const, status: 'ACTIVE' as const };
    const owner = { role: 'OWNER' as const, status: 'ACTIVE' as const };
    expect(mayOpen(pm, '/studio/design')).toBe(true);
    expect(mayOpen(pm, '/studio/settings/design')).toBe(false);
    expect(mayOpen(owner, '/studio/settings/design')).toBe(true);
    expect(can(pm, 'design.workload')).toBe(true);
    expect(can(pm, 'design.assign', { assigned: true })).toBe(true);
    expect(can(pm, 'design.assign', { assigned: false })).toBe(false);
  });
});

describe('the team screen', () => {
  it('names the role and reads its card off the table', () => {
    expect(ROLE_NAMES.DESIGNER).toBe('Designer');
    expect(roleCan('DESIGNER')).toEqual(['Upload drawings', 'See the project', 'Design steps, drawings and site visits']);
  });
});
