import 'server-only';

/**
 * "By campaign" on lead analytics (owner, 22 Oct 2026): four SQL groupBys
 * over the attribution columns, folded by `campaign-rules.ts`. Owner and
 * project managers only — `myStudioId()` finds no studio for anyone else,
 * the same door as the rest of the analytics page. Every count carries LIVE,
 * so the sample lead is never counted.
 *
 * - Leads: every live lead with a campaign id or name.
 * - Contacted: somebody logged a call (`lastContactedAt`).
 * - Quoted: it has at least one quotation.
 * - Converted: booked, or in a WON or DONE column.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { myStudioId } from '@/modules/studio-quote/store';
import { LIVE } from '@/modules/studio-practice/demo-lead';
import { foldCampaigns, type CampaignGroupRow, type CampaignLine } from './campaign-rules';

export async function campaignAnalytics(): Promise<CampaignLine[] | null> {
  const studioId = await myStudioId();
  if (!studioId) return null;
  try {
    const wonIds = (await prisma.studioStage.findMany({ where: { studioId, kind: { in: ['WON', 'DONE'] } }, select: { id: true } })).map((s) => s.id);
    const base: Prisma.StudioClientWhereInput = { studioId, ...LIVE, OR: [{ campaignId: { not: null } }, { campaignName: { not: null } }] };
    const group = async (extra: Prisma.StudioClientWhereInput): Promise<CampaignGroupRow[]> => {
      const rows = await prisma.studioClient.groupBy({
        by: ['campaignId', 'campaignName'],
        where: { AND: [base, extra] },
        _count: { _all: true },
      });
      return rows.map((r) => ({ campaignId: r.campaignId, campaignName: r.campaignName, count: r._count._all }));
    };
    const [leads, contacted, quoted, converted] = await Promise.all([
      group({}),
      group({ lastContactedAt: { not: null } }),
      group({ quotes: { some: {} } }),
      group({ OR: [{ bookedAt: { not: null } }, { stageId: { in: wonIds } }] }),
    ]);
    return foldCampaigns({ leads, contacted, quoted, converted });
  } catch (error) {
    console.error('[analytics] by campaign failed', error instanceof Error ? error.message : 'unknown');
    return null;
  }
}
