import 'server-only';

/**
 * The customer's plan, in the database (rules in `plans.ts`). Read for
 * "Me" and the GEIO gate; asked for by the customer; switched by ops.
 *
 * Expert calls used are counted, not stored: the consultations on their
 * brief booked after they signed. The free call before signing is older
 * than the project, so it never counts toward the five.
 */

import { prisma } from '@/lib/prisma';
import { requireRole, type AuthUser } from '@/modules/auth/session';
import { notifyOps } from '@/modules/notify/service';
import { planView, type DbPlan, type PlanName, type PlanView } from './plans';

const LIVE_CALL = ['scheduled', 'completed'];

/** Projects this person may read: their own, or one they joined as family (as `customerProjects`). */
const readable = (userId: string) => ({
  OR: [
    { introduction: { brief: { userId } } },
    { family: { some: { userId, joinedAt: { not: null }, removedAt: null } } },
  ],
});

/** Their plan, or null before they have signed with a studio. An Assured project wins over a Basic one. */
export async function customerPlan(userId: string): Promise<PlanView | null> {
  const rows = await prisma.homeProject.findMany({
    where: readable(userId),
    orderBy: { startOn: 'desc' },
    take: 10,
    select: { plan: true, assuredRequestedAt: true, signedAt: true, createdAt: true, introduction: { select: { briefId: true } } },
  });
  const row = rows.find((r) => r.plan === 'ASSURED') ?? rows[0];
  if (!row) return null;
  const used =
    row.plan === 'ASSURED'
      ? await prisma.consultation.count({
          where: { briefId: row.introduction.briefId, status: { in: LIVE_CALL }, createdAt: { gt: row.signedAt ?? row.createdAt } },
        })
      : 0;
  return planView(row, used);
}

/** Tell ops someone asked for Assured: they confirm the fee with the customer, then switch the plan. */
export async function tellOpsAssured(user: Pick<AuthUser, 'name' | 'phone'>, studio: string, atSigning: boolean): Promise<void> {
  await notifyOps({ kind: 'assured-requested', customer: user.name?.trim() || user.phone || 'A customer', studio, atSigning });
}

export type AssuredResult =
  | { ok: true; plan: PlanName; assuredRequested: boolean }
  | { ok: false; status: 403 | 409; error: string };

/**
 * "I want Assured", after signing (from Me or the locked GEIO card). Their
 * newest project of their own; a family member cannot choose the owner's
 * plan. Asking twice changes nothing and tells ops once.
 */
export async function requestAssured(user: AuthUser): Promise<AssuredResult> {
  const project = await prisma.homeProject.findFirst({
    where: { introduction: { brief: { userId: user.id } } },
    orderBy: { startOn: 'desc' },
    select: { id: true, plan: true, assuredRequestedAt: true, introduction: { select: { studio: { select: { tradeName: true } } } } },
  });
  if (!project) {
    const family = await prisma.homeProject.count({ where: readable(user.id) });
    return family > 0
      ? { ok: false, status: 403, error: 'Only the person who signed can choose the plan.' }
      : { ok: false, status: 409, error: 'Plans start when you sign with a studio.' };
  }
  if (project.plan === 'ASSURED') return { ok: true, plan: 'assured', assuredRequested: false };
  if (project.assuredRequestedAt) return { ok: true, plan: 'basic', assuredRequested: true };

  const now = new Date();
  // Only the first ask stamps, so two taps cannot tell ops twice.
  const { count } = await prisma.homeProject.updateMany({
    where: { id: project.id, plan: 'BASIC', assuredRequestedAt: null },
    data: { assuredRequestedAt: now },
  });
  if (count === 1) {
    await prisma.auditLog.create({
      data: { actorId: user.id, action: 'plan.assured-requested', entityType: 'HomeProject', entityId: project.id, after: { at: 'later' } },
    });
    void tellOpsAssured(user, project.introduction.studio.tradeName, false);
  }
  return { ok: true, plan: 'basic', assuredRequested: true };
}

export type SetPlanResult = { ok: true } | { ok: false; error: string };

/**
 * Ops switches a project's plan — to Assured once the customer has agreed
 * the fee, or back to Basic. Audited with who and what it was before; the
 * customer's request stays stamped as history.
 */
export async function setProjectPlan(projectId: string, plan: DbPlan): Promise<SetPlanResult> {
  const ops = await requireRole('OPS');
  if (plan !== 'BASIC' && plan !== 'ASSURED') return { ok: false, error: 'Basic or Assured.' };
  const project = await prisma.homeProject.findUnique({ where: { id: projectId }, select: { plan: true } });
  if (!project) return { ok: false, error: 'That project is gone.' };
  if (project.plan === plan) return { ok: true };
  await prisma.$transaction([
    prisma.homeProject.update({ where: { id: projectId }, data: { plan } }),
    prisma.auditLog.create({
      data: { actorId: ops.id, action: 'plan.set', entityType: 'HomeProject', entityId: projectId, before: { plan: project.plan }, after: { plan } },
    }),
  ]);
  return { ok: true };
}
