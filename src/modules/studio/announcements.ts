import 'server-only';

/**
 * Things we have told a studio that they have not yet read.
 *
 * ## Why these are rows rather than derived state
 *
 * Most of this codebase derives rather than stores — a step is complete
 * because the data says so, not because a flag says so. This is the
 * exception, and the reason is that an announcement is about a MOMENT, not a
 * condition.
 *
 * "You are on the roster" is true forever once it is true. Derived, it would
 * either show for ever or need a second flag saying it had been seen, which
 * is the same row by another name. The row also records when we said it,
 * which is the thing a studio asks about later: *when* were we approved.
 *
 * ## Nothing here is a channel
 *
 * `Notification.channel` is 'push' for these — in-app only. Email goes
 * through `modules/auth/email.ts`, separately and outside the transaction
 * that writes this, because a mail provider having a bad minute must never
 * roll back an approval.
 */

import { prisma } from '@/lib/prisma';
import { currentStudio } from './onboarding';

export interface Announcement {
  id: string;
  template: string;
  createdAt: string;
}

/**
 * The unread ones for whoever is signed in.
 *
 * Guarded, like every other read on a render path. A studio whose
 * announcements cannot be fetched should see their dashboard without one,
 * not an application error — the same lesson the rates step taught.
 */
export async function myAnnouncements(): Promise<Announcement[]> {
  const context = await currentStudio();
  if (!context) return [];

  try {
    const rows = await prisma.notification.findMany({
      where: { userId: context.user.id, readAt: null, channel: 'push' },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return rows.map((r) => ({
      id: r.id,
      template: r.template,
      createdAt: r.createdAt.toISOString(),
    }));
  } catch (error) {
    console.error('[studio] myAnnouncements failed', error);
    return [];
  }
}

/**
 * Mark one as read.
 *
 * Scoped by user in the WHERE rather than checked after a lookup. An id
 * arriving from a form is attacker-controlled, and `findUnique` then compare
 * is the shape that forgets the compare.
 */
export async function dismissAnnouncement(id: string): Promise<void> {
  const context = await currentStudio();
  if (!context) return;

  await prisma.notification
    .updateMany({
      where: { id, userId: context.user.id, readAt: null },
      data: { readAt: new Date() },
    })
    .catch(() => {
      /* Dismissing is a convenience. Failing to record it should not take
         down the page the banner sits on. */
    });
}
