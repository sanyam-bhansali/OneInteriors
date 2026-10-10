import 'server-only';

/**
 * What we have told this person at a studio and they have not opened: a new
 * client, a signature, a customer's choice, a snag.
 *
 * Rows written by `notify()` (modules/notify/service.ts) — the same rows a
 * customer's app lists — read here for the studio dashboard, where a studio
 * actually looks. Announcements about the studio itself (approval) are
 * `announcements.ts`; those carry no title and are skipped here.
 */

import { prisma } from '@/lib/prisma';
import { currentStudio } from './onboarding';

export interface InboxItem {
  id: string;
  title: string;
  body: string;
  url: string;
  createdAt: string;
}

export async function myInbox(): Promise<InboxItem[]> {
  const context = await currentStudio();
  if (!context) return [];
  try {
    const rows = await prisma.notification.findMany({
      where: { userId: context.user.id, readAt: null },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return rows.flatMap((r) => {
      const p = (r.payload ?? {}) as Record<string, unknown>;
      if (typeof p.title !== 'string' || typeof p.url !== 'string') return [];
      // Only links inside the studio side: a customer-app path is not theirs to open.
      if (!p.url.startsWith('/studio')) return [];
      return [{ id: r.id, title: p.title, body: typeof p.body === 'string' ? p.body : '', url: p.url, createdAt: r.createdAt.toISOString() }];
    });
  } catch (error) {
    console.error('[studio] myInbox failed', error);
    return [];
  }
}

/** Mark one read — theirs only. */
export async function markInboxRead(id: string): Promise<void> {
  const context = await currentStudio();
  if (!context) return;
  await prisma.notification
    .updateMany({ where: { id, userId: context.user.id, readAt: null }, data: { readAt: new Date() } })
    .catch(() => undefined);
}
