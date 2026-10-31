'use client';

/**
 * Whether only the project app is open (owner, 1 Nov 2026: Hauspire's
 * clients first, the choosing journey and its extras later). Set once by the
 * app's layout from the server's switch (lib/host.ts `projectsOnly`), so a
 * screen can leave out links to pages that are not open yet.
 */

import { createContext, useContext, type ReactNode } from 'react';

const ProjectsOnly = createContext(false);

export function AppMode({ projectsOnly, children }: { projectsOnly: boolean; children: ReactNode }) {
  return <ProjectsOnly.Provider value={projectsOnly}>{children}</ProjectsOnly.Provider>;
}

export const useProjectsOnly = () => useContext(ProjectsOnly);
