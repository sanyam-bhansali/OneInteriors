import 'server-only';

import { prisma } from '@/lib/prisma';
import type { ApprovalFacts } from './approval';

type Db = Pick<typeof prisma, 'quotationArchive' | 'studioFiledRate' | 'studioProduct' | 'studio'>;

/** The facts `approvalBlockers` reads, for one studio. */
export async function approvalFactsFor(studioId: string, db: Db = prisma): Promise<ApprovalFacts> {
  const [read, liveRates, productMaster, studio] = await Promise.all([
    db.quotationArchive.aggregate({
      where: { studioId, state: 'FILED' },
      _sum: { quotationCount: true },
    }),
    db.studioFiledRate.count({ where: { studioId, state: 'LIVE' } }),
    db.studioProduct.count({ where: { studioId, isActive: true, ratePaise: { gt: 0 } } }),
    db.studio.findUnique({ where: { id: studioId }, select: { ratesFilledAt: true } }),
  ]);
  return {
    quotationsRead: read._sum.quotationCount ?? 0,
    liveRates,
    productMasterApproved: Boolean(studio?.ratesFilledAt),
    productMaster,
  };
}
