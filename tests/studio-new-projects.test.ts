import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { isNewProject, newProjectsLine, newProjectsOf, waitingWords } from '@/modules/studio-design/new-projects-rules';
import { can } from '@/modules/studio/roles';

/** "New projects" for the design head (owner, 13 Nov 2026): converted, no designer yet, Assign designer. */

const at = (iso: string) => new Date(iso);

describe('a new project', () => {
  it('is in design, with no designer, not cancelled', () => {
    expect(isNewProject({ phase: 'DESIGN', designerId: null, cancelledAt: null })).toBe(true);
    expect(isNewProject({ phase: 'DESIGN', designerId: 'm1', cancelledAt: null })).toBe(false);
    expect(isNewProject({ phase: 'EXECUTION', designerId: null, cancelledAt: null })).toBe(false);
    expect(isNewProject({ phase: 'DESIGN', designerId: null, cancelledAt: at('2026-11-12T10:00:00Z') })).toBe(false);
  });

  it('lists the oldest waiting first', () => {
    const rows = [
      { id: 'b', phase: 'DESIGN', designerId: null, cancelledAt: null, createdAt: at('2026-11-13T09:00:00Z') },
      { id: 'x', phase: 'DESIGN', designerId: 'm1', cancelledAt: null, createdAt: at('2026-11-01T09:00:00Z') },
      { id: 'a', phase: 'DESIGN', designerId: null, cancelledAt: null, createdAt: at('2026-11-10T09:00:00Z') },
    ];
    expect(newProjectsOf(rows).map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('says how long it has waited, in India days', () => {
    const now = at('2026-11-13T12:00:00Z');
    expect(waitingWords(at('2026-11-13T04:00:00Z'), now)).toBe('Since today');
    expect(waitingWords(at('2026-11-12T12:00:00Z'), now)).toBe('Waiting 1 day');
    expect(waitingWords(at('2026-11-10T12:00:00Z'), now)).toBe('Waiting 3 days');
    /* 23:00 IST on the 12th is yesterday in India, though the same UTC day. */
    expect(waitingWords(at('2026-11-12T17:30:00Z'), at('2026-11-12T19:00:00Z'))).toBe('Waiting 1 day');
  });

  it('heads the list in plain words', () => {
    expect(newProjectsLine(1)).toBe('1 new project needs a designer');
    expect(newProjectsLine(2)).toBe('2 new projects need a designer');
  });
});

describe('who sees New projects', () => {
  const base = { status: 'ACTIVE' as const };
  it('the design head, the owner and a PM (who may assign), not a plain designer', () => {
    expect(can({ ...base, role: 'DESIGNER', designHead: true }, 'design.assign', { assigned: true })).toBe(true);
    expect(can({ ...base, role: 'OWNER' }, 'design.assign', { assigned: true })).toBe(true);
    expect(can({ ...base, role: 'PM' }, 'design.assign', { assigned: true })).toBe(true);
    expect(can({ ...base, role: 'DESIGNER' }, 'design.assign', { assigned: true })).toBe(false);
  });

  it('sits at the top of the Design board and the home', () => {
    expect(readFileSync('src/app/studio/design/page.tsx', 'utf8')).toMatch(/<NewProjects data=\{fresh\} \/>/);
    expect(readFileSync('src/app/studio/home/page.tsx', 'utf8')).toMatch(/<NewProjects data=\{fresh\} \/>/);
  });
});
