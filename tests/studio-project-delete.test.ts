import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import { mayDeleteProjects, nameMatches } from '@/modules/studio/project-delete';
import { mayOpen } from '@/modules/studio/surfaces';
import { can } from '@/modules/studio/roles';
import { PROJECT_EVENT_TYPES } from '@/modules/project/events';

/** Delete and restore a project (owner, 27 Oct 2026; studio/project-delete.ts). */

describe('confirming a delete', () => {
  it('takes the client’s name as the project shows it, in any case and spacing', () => {
    expect(nameMatches('Ankita', 'Ankita')).toBe(true);
    expect(nameMatches('  ankita   shah ', 'Ankita Shah')).toBe(true);
    expect(nameMatches('Ankit', 'Ankita')).toBe(false);
    expect(nameMatches('', 'Ankita')).toBe(false);
    expect(nameMatches(null, 'Ankita')).toBe(false);
  });
});

describe('who deletes, and opens Deleted projects', () => {
  it('the owner only: not the design head, another designer, PM, sales or accounts', () => {
    expect(mayDeleteProjects({ role: 'OWNER', status: 'ACTIVE' })).toBe(true);
    expect(mayDeleteProjects({ role: 'DESIGNER', status: 'ACTIVE', designHead: true })).toBe(false);
    for (const role of ['DESIGNER', 'PM', 'SALES', 'ACCOUNTS', 'SUPERVISOR'] as const) expect(mayDeleteProjects({ role, status: 'ACTIVE' }), role).toBe(false);
    expect(mayDeleteProjects({ role: 'DESIGNER', status: 'SUSPENDED', designHead: true })).toBe(false);
    expect(mayDeleteProjects(null)).toBe(false);
  });

  it('only the owner opens the page; a designer does not, even though a designer opens a project page', () => {
    expect(mayOpen({ role: 'OWNER', status: 'ACTIVE', fullSoftware: true }, '/studio/projects/deleted')).toBe(true);
    expect(mayOpen({ role: 'DESIGNER', status: 'ACTIVE', fullSoftware: true, designHead: true }, '/studio/projects/deleted')).toBe(false);
    expect(mayOpen({ role: 'DESIGNER', status: 'ACTIVE', fullSoftware: true }, '/studio/projects/deleted')).toBe(false);
    expect(mayOpen({ role: 'DESIGNER', status: 'ACTIVE', fullSoftware: true }, '/studio/projects/p1')).toBe(true);
  });
});

describe('the design head starts projects too (27 Oct 2026)', () => {
  it('may create and open the start page; another designer may not', () => {
    const head = { role: 'DESIGNER' as const, status: 'ACTIVE' as const, fullSoftware: true, designHead: true };
    const plain = { role: 'DESIGNER' as const, status: 'ACTIVE' as const, fullSoftware: true };
    expect(can(head, 'project.create')).toBe(true);
    expect(can(plain, 'project.create')).toBe(false);
    expect(mayOpen(head, '/studio/projects/start')).toBe(true);
    expect(mayOpen(plain, '/studio/projects/start')).toBe(false);
  });
});

describe('the record', () => {
  it('deleting and restoring are project events', () => {
    expect(PROJECT_EVENT_TYPES).toContain('project.deleted');
    expect(PROJECT_EVENT_TYPES).toContain('project.replaced');
    expect(PROJECT_EVENT_TYPES).toContain('project.restored');
  });
});
