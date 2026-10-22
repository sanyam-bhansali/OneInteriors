import 'server-only';

/**
 * The leads either side of this one in the list it was opened from
 * (improvement 8, owner 22 Oct 2026): "← Previous" and "Next lead →".
 *
 * Two reads of one row each, never the list: the lead's own sort value
 * becomes a keyset cursor (lead-filters.ts `cursorOf`), and the next lead is
 * the first row after it with the list's filters and order
 * (lead-where.ts `keysetWhere` / `orderByFor`), the previous one the first
 * row before it in reverse (lead-neighbours-where.ts). Same filters, same
 * scope as the list (`scopedLeadWhere`): a salesperson's neighbours are
 * their own leads; never the pool, which they cannot open before claiming.
 *
 * The lead itself need not still match the filters: after a call moves it
 * from Calling 1 to Calling 2 its neighbours are still worked out from where
 * it stood. The page reads them when it first opens (before the call), and
 * the browser keeps that answer (LeadNav.tsx), so a call that changes the
 * lead's follow-up date or last-contacted time does not move "next".
 */

import { prisma } from '@/lib/prisma';
import { LIVE } from '@/modules/studio-practice/demo-lead';
import type { LeadScope } from '@/modules/studio/lead-scope';
import { cursorOf, parseCursor } from './lead-filters';
import { keysetWhere, orderByFor, scopedLeadWhere } from './lead-where';
import { keysetBeforeWhere, reverseOrderBy } from './lead-neighbours-where';
import type { ListContext } from './lead-context';

export interface LeadNeighbours {
  prev: { id: string; name: string } | null;
  next: { id: string; name: string } | null;
}

/** This lead's neighbours in the list, or null when it is not one this person may open. */
export async function leadNeighbours(scope: LeadScope, ctx: ListContext, leadId: string, now = new Date()): Promise<LeadNeighbours | null> {
  if (typeof leadId !== 'string' || leadId.length === 0 || leadId.length > 64) return null;
  /* A salesperson's pool is a list to claim from, not to open: their next lead is one of their own. */
  const filters = !scope.seesAll && ctx.filters.owner === 'pool' ? { ...ctx.filters, owner: undefined } : ctx.filters;
  try {
    const here = await prisma.studioClient.findFirst({
      where: { AND: [scope.leads, { studioId: scope.studioId, id: leadId, deletedAt: null }] },
      select: { id: true, name: true, createdAt: true, updatedAt: true, nextActionOn: true, lastContactedAt: true },
    });
    if (!here) return null;
    const cursor = parseCursor(cursorOf(ctx.sort, here));
    if (!cursor) return null;
    const where = scopedLeadWhere(scope, filters, now, LIVE);
    const notHere = { id: { not: here.id } };
    const [next, prev] = await Promise.all([
      prisma.studioClient.findFirst({
        where: { AND: [where, keysetWhere(ctx.sort, cursor), notHere] },
        orderBy: orderByFor(ctx.sort),
        select: { id: true, name: true },
      }),
      prisma.studioClient.findFirst({
        where: { AND: [where, keysetBeforeWhere(ctx.sort, cursor), notHere] },
        orderBy: reverseOrderBy(ctx.sort),
        select: { id: true, name: true },
      }),
    ]);
    return { prev, next };
  } catch (error) {
    console.error('[lead-neighbours] read failed', error instanceof Error ? error.message : 'unknown');
    return null;
  }
}
