import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import { nameMatches } from '@/modules/studio/project-delete';
import { mayOpen } from '@/modules/studio/surfaces';
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

describe('who opens Deleted projects', () => {
  it('the owner (and the office), never a designer, even though a designer opens a project page', () => {
    expect(mayOpen({ role: 'OWNER', status: 'ACTIVE', fullSoftware: true }, '/studio/projects/deleted')).toBe(true);
    expect(mayOpen({ role: 'DESIGNER', status: 'ACTIVE', fullSoftware: true }, '/studio/projects/deleted')).toBe(false);
    expect(mayOpen({ role: 'DESIGNER', status: 'ACTIVE', fullSoftware: true }, '/studio/projects/p1')).toBe(true);
  });
});

describe('the record', () => {
  it('deleting and restoring are project events', () => {
    expect(PROJECT_EVENT_TYPES).toContain('project.deleted');
    expect(PROJECT_EVENT_TYPES).toContain('project.restored');
  });
});
