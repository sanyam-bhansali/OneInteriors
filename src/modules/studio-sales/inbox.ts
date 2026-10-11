import 'server-only';

/**
 * The studio inbox for any studio member (Studio OS Phase 1): the same
 * notification rows `studio/inbox.ts` reads for the office, read by the
 * signed-in user's own id, so a salesperson sees "a lead for you" on
 * Today. Only links inside the studio side.
 */

import { prisma } from '@/lib/prisma';
import type { InboxItem } from '@/modules/studio/inbox';

export async function myInboxFor(userId: string | null): Promise<InboxItem[]> {
  if (!userId) return [];
  try {
    const rows = await prisma.notification.findMany({
      where: { userId, readAt: null },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return rows.flatMap((r) => {
      const p = (r.payload ?? {}) as Record<string, unknown>;
      if (typeof p.title !== 'string' || typeof p.url !== 'string' || !p.url.startsWith('/studio')) return [];
      return [{ id: r.id, title: p.title, body: typeof p.body === 'string' ? p.body : '', url: p.url, createdAt: r.createdAt.toISOString() }];
    });
  } catch {
    return [];
  }
}
