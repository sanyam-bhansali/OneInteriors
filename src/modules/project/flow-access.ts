import 'server-only';

/**
 * Who is acting on a customer's project, for the Phase 5 flows (decisions,
 * payments, locker): ops (may do everything), or a studio member whose role
 * allows the action on this project (studio/access.ts `memberOnProject` —
 * the studio's tenancy first, then the role table). The same rule as
 * project-store.ts `staffFor`, returning what the flows need to write the
 * event log and tell people.
 */

import { prisma } from '@/lib/prisma';
import { getCurrentUser, hasRole } from '@/modules/auth/session';
import { ACCESS_ERRORS, memberOnProject } from '@/modules/studio/access';
import type { StudioAction } from '@/modules/studio/roles';
import type { ProjectActor } from './events';

export interface Staff {
  userId: string;
  byStudio: boolean;
  actor: ProjectActor;
  /** The customer (owner of the brief), to tell. */
  customerId: string | null;
  studioId: string;
  studioName: string;
  may: (action: StudioAction) => boolean;
}

export type StaffResult = ({ ok: true } & Staff) | { ok: false; error: string };

export async function staffOn(projectId: string, action: StudioAction): Promise<StaffResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Sign in first.' };
  const project = await prisma.homeProject.findUnique({
    where: { id: projectId },
    select: { introduction: { select: { studioId: true, studio: { select: { tradeName: true } }, brief: { select: { userId: true } } } } },
  });
  if (!project) return { ok: false, error: ACCESS_ERRORS.notYours };
  const intro = project.introduction;
  const base = { userId: user.id, customerId: intro.brief.userId, studioId: intro.studioId, studioName: intro.studio.tradeName };
  if (hasRole(user, 'OPS')) return { ok: true, ...base, byStudio: false, actor: { type: 'OPS', id: user.id }, may: () => true };
  const check = await memberOnProject(projectId, action);
  if (!check.ok) return check;
  return { ok: true, ...base, byStudio: true, actor: { type: 'STUDIO', id: user.id }, may: check.access.may };
}
