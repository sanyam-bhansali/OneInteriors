import 'server-only';

/**
 * The accounts member's screen (/studio/payments): every project of the
 * studio, its signed payment stages, and what has been received — nothing
 * else (STUDIO-WORKSPACE-BUILD §3, "Accounts sees payments across all
 * projects, nothing else").
 *
 * The list is `projectsVisibleTo(member, 'payments')`, so the same screen
 * works for an owner (all) and a project manager (their projects); a
 * supervisor gets none. Marking a stage received goes through the existing
 * `setPaymentStage` (portal/project-store.ts), which checks
 * `payment.record` per project.
 */

import { prisma } from '@/lib/prisma';
import { fromDb } from '@/lib/money';
import { moneyView, type MoneyView } from '@/modules/portal/payments';
import { currentMember, projectsVisibleTo } from './access';
import { siteLabel } from './team-rules';

export interface DeskProject {
  id: string;
  label: string;
  /** Null when nothing was signed in the app (no stages to collect against). */
  money: MoneyView | null;
}

export async function paymentsDesk(): Promise<DeskProject[]> {
  const member = await currentMember();
  if (!member) return [];
  try {
    const rows = await prisma.homeProject.findMany({
      where: projectsVisibleTo(member, 'payments'),
      orderBy: { startOn: 'desc' },
      select: {
        id: true,
        contractPaise: true,
        paymentPhases: true,
        paidPhases: true,
        introduction: { select: { brief: { select: { society: true, locality: true, propertyType: true } } } },
      },
    });
    return rows.map((p) => ({
      id: p.id,
      label: siteLabel(p.introduction.brief),
      money: moneyView(p.contractPaise === null ? null : fromDb(p.contractPaise), p.paymentPhases, p.paidPhases),
    }));
  } catch (error) {
    console.error('[studio] paymentsDesk failed', error);
    return [];
  }
}
