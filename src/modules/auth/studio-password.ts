import 'server-only';

/**
 * Studio password sign-in — the database side (owner, 27 Oct 2026). The
 * rules and the words are studio-password-rules.ts.
 *
 * Mobile number + password, for anyone on a studio's team (invited or
 * active, never suspended). Same hashing, same five-try lock and same
 * sessions as the emailed-password sign-in (password.ts,
 * password-signin.ts); the difference is the way back from a lock. Staff have
 * no mailbox, so a lock lifts when the owner makes a new one-time password
 * (team-store.ts `setTemporaryPassword`), not by a link.
 *
 * Signing in does what the WhatsApp code did: an invited member becomes
 * active, and last seen is set.
 */

import { prisma } from '@/lib/prisma';
import { normalisePhone } from '@/modules/studio/phone';
import type { StudioRoleName } from '@/modules/studio/roles';
import { bucketFor, consume } from '@/modules/rate-limit/store';
import { createSession, hashIp, type SessionMeta } from './session';
import { decideSignIn, verifyPassword } from './password';
import type { StudioPasswordRefusal } from './studio-password-rules';

export type StudioPasswordResult =
  | { ok: true; userId: string; role: StudioRoleName; mustChange: boolean }
  | { ok: false; reason: StudioPasswordRefusal };

/** Twenty tries an hour from one address, across every number typed. */
const IP_LIMIT = { max: 20, windowMs: 60 * 60_000 };

/** A hash shaped like a real one, so a number that is not on a team costs the same time to refuse. */
const DUMMY_HASH = 's1$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAA';

export async function studioPasswordSignIn(rawPhone: string, password: string, meta: SessionMeta & { locale?: string | null } = {}): Promise<StudioPasswordResult> {
  const phone = normalisePhone(String(rawPhone ?? '').slice(0, 20));
  if (!phone) return { ok: false, reason: 'invalid_phone' };
  const plain = String(password ?? '').slice(0, 200);
  if (!plain) return { ok: false, reason: 'no_match' };

  const byIp = await consume(bucketFor('studio-password-ip', hashIp(meta.ip) ?? 'unknown'), IP_LIMIT);
  if (!byIp.allowed) return { ok: false, reason: 'rate_limited' };

  const user = await prisma.user.findUnique({
    where: { phone },
    select: {
      id: true,
      role: true,
      deletedAt: true,
      passwordHash: true,
      passwordTemporary: true,
      failedSignIns: true,
      lockedOutAt: true,
      studioMember: { select: { id: true, role: true, status: true } },
    },
  });

  if (!user || user.deletedAt || user.role === 'CUSTOMER' || !user.studioMember) {
    await verifyPassword(plain, DUMMY_HASH);
    return { ok: false, reason: 'no_match' };
  }
  const member = user.studioMember;
  if (member.status === 'SUSPENDED') return { ok: false, reason: 'suspended' };
  if (!user.passwordHash) return { ok: false, reason: 'no_password' };
  if (user.lockedOutAt) return { ok: false, reason: 'locked' };

  const matched = await verifyPassword(plain, user.passwordHash);
  const outcome = decideSignIn(user, matched);

  if (outcome.kind === 'ok') {
    const now = new Date();
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { failedSignIns: 0, lockedOutAt: null, ...(meta.locale ? { locale: meta.locale } : {}) } }),
      prisma.studioMember.update({ where: { id: member.id }, data: { lastSeenAt: now, ...(member.status === 'INVITED' ? { status: 'ACTIVE' as const } : {}) } }),
    ]);
    await createSession(user.id, { userAgent: meta.userAgent, ip: meta.ip });
    return { ok: true, userId: user.id, role: member.role, mustChange: user.passwordTemporary };
  }
  if (outcome.kind === 'refused') return { ok: false, reason: 'locked' };

  await prisma.user.update({
    where: { id: user.id },
    data: { failedSignIns: { increment: 1 }, ...(outcome.nowLocked ? { lockedOutAt: new Date() } : {}) },
  });
  return { ok: false, reason: outcome.nowLocked ? 'locked' : 'no_match' };
}

/** Whether this signed-in person must choose their own password before anything else. */
export async function mustChoosePassword(userId: string): Promise<boolean> {
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { passwordTemporary: true } });
    return u?.passwordTemporary === true;
  } catch {
    return false;
  }
}
