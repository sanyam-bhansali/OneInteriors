/**
 * "New projects" for the design head (owner, 13 Nov 2026): "Once it's in
 * Converted with a quotation, a project is created automatically, not
 * assigned to anyone. Then she assigns it." and "On Renuka's dashboard there
 * should be 'New project' so she knows there is a new project." Pure and
 * tested (tests/studio-new-projects.test.ts); the read is new-projects.ts.
 *
 * A new project is one in design with no designer yet, not cancelled. The
 * oldest waiting comes first, so nobody's booking sits at the bottom.
 */

export interface NewProjectFacts {
  phase: string;
  designerId: string | null;
  cancelledAt: Date | null;
  createdAt: Date;
}

export const isNewProject = (p: Pick<NewProjectFacts, 'phase' | 'designerId' | 'cancelledAt'>): boolean =>
  p.phase === 'DESIGN' && p.designerId === null && p.cancelledAt === null;

/** The new projects, oldest waiting first. */
export function newProjectsOf<P extends NewProjectFacts>(rows: readonly P[]): P[] {
  return rows.filter(isNewProject).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

/** "Waiting 3 days", "Since today": whole days in India since the project was made. */
export function waitingWords(createdAt: Date, now: Date): string {
  const ist = (d: Date) => Math.floor((d.getTime() + 330 * 60_000) / 86_400_000);
  const days = Math.max(0, ist(now) - ist(createdAt));
  if (days === 0) return 'Since today';
  return days === 1 ? 'Waiting 1 day' : `Waiting ${days} days`;
}

/** The heading line: "1 new project needs a designer". */
export const newProjectsLine = (n: number): string => `${n} new project${n === 1 ? '' : 's'} need${n === 1 ? 's' : ''} a designer`;
