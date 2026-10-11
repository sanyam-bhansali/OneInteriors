import 'server-only';

/**
 * Deleting an account, as the customer asks for it from the app (Me →
 * Privacy → Delete my account) — an App Store and Play Store requirement,
 * and a DPDP right.
 *
 * A soft delete, as `User.deletedAt` was designed for: the row stays, so the
 * records other people rely on stay whole, and everything that says who the
 * person was goes. In one transaction:
 *
 * - the user: deletedAt set; name, phone and email cleared (both unique, so
 *   the number can sign up afresh), with their verified-at stamps and any
 *   password;
 * - every session and every push device deleted — signed out everywhere, at
 *   once, and no more notices to the phone;
 * - social sign-ins deleted, so a Google or Apple account no longer leads here;
 * - their notifications deleted;
 * - every consent still standing withdrawn — stamped, not deleted, because
 *   the record of what they agreed to is how we show we asked properly;
 * - the contact details on their brief and on its expert-call requests
 *   cleared, with the brief's share link and anonymous cookie key, and ops'
 *   follow-up note.
 *
 * Left alone, on purpose: the brief's answers about the home, introductions,
 * the project, its decisions, snags, documents and payment records, coins,
 * and the audit log. A studio mid-way through their kitchen needs the job's
 * record; it no longer says whose phone number it was. `getCurrentUser`
 * refuses a deleted user, and every sign-in path checks `deletedAt`, so the
 * row can never be signed in to again.
 */

import { prisma } from '@/lib/prisma';

export async function eraseAccount(userId: string, now = new Date()): Promise<{ ok: boolean }> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, deletedAt: true } });
  if (!user) return { ok: false };
  if (user.deletedAt) return { ok: true };

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        deletedAt: now,
        name: null,
        phone: null,
        phoneVerified: null,
        email: null,
        emailVerified: null,
        passwordHash: null,
        passwordSetAt: null,
      },
    });
    await tx.session.deleteMany({ where: { userId } });
    await tx.pushDevice.deleteMany({ where: { userId } });
    await tx.authIdentity.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.consent.updateMany({ where: { userId, granted: true, withdrawnAt: null }, data: { withdrawnAt: now } });

    const brief = await tx.brief.findUnique({ where: { userId }, select: { id: true } });
    if (brief) {
      await tx.brief.update({
        where: { id: brief.id },
        data: { contactName: null, contactPhone: null, contactEmail: null, shareToken: null, sharedAt: null, anonKey: null, followUpNote: null },
      });
      await tx.consultation.updateMany({
        where: { briefId: brief.id },
        data: { contactName: null, contactPhone: null, contactEmail: null },
      });
    }

    // A studio's invites to its own client (project/own-project.ts) copy the number, name and email.
    await tx.homeProjectInvite.updateMany({ where: { userId }, data: { phone: '', name: '', email: null, revokedAt: now } });

    // Append-only, like every audit row: what happened and when, never the scrubbed values.
    await tx.auditLog.create({
      data: { actorId: userId, action: 'account.erase', entityType: 'User', entityId: userId, after: { deletedAt: now.toISOString(), by: 'self' } },
    });
  });
  return { ok: true };
}
