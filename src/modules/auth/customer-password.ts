import 'server-only';

/**
 * Client password sign-in — the database side (owner, 1 Nov 2026). The rules
 * and the words are customer-password-rules.ts.
 *
 * Three writes: the studio makes a client a one-time password from the
 * project page (`setClientOneTimePassword`); the client signs in with their
 * mobile number and it (`customerPasswordSignIn`); and chooses their own
 * (`chooseCustomerPassword`). Same hashing, same sessions and the same
 * five-try lock as staff (studio-password.ts). Signing in counts as joining
 * every project the client was invited to, as opening the invite link does.
 */

import { prisma } from '@/lib/prisma';
import { normalisePhone } from '@/modules/studio/phone';
import { memberOnProject } from '@/modules/studio/access';
import { recordEvent } from '@/modules/project/events';
import { bucketFor, consume } from '@/modules/rate-limit/store';
import { createSession, hashIp, revokeAllSessions, type SessionMeta } from './session';
import { hashPassword, verifyPassword } from './password';
import { passwordProblem } from './password-rules';
import { temporaryPassword } from './studio-password-rules';
import { decideCustomerSignIn, type CustomerPasswordRefusal } from './customer-password-rules';

/** `token` is the session itself, for the phone app (`meta.bearer`); the website gets a cookie instead. */
export type CustomerPasswordResult = { ok: true; userId: string; mustChange: boolean; token: string } | { ok: false; reason: CustomerPasswordRefusal };

/** Twenty tries an hour from one address, across every number typed. */
const IP_LIMIT = { max: 20, windowMs: 60 * 60_000 };

/** A hash shaped like a real one, so a number with no client account costs the same time to refuse. */
const DUMMY_HASH = 's1$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAA';

export async function customerPasswordSignIn(rawPhone: string, password: string, meta: SessionMeta = {}): Promise<CustomerPasswordResult> {
  const phone = normalisePhone(String(rawPhone ?? '').slice(0, 20));
  if (!phone) return { ok: false, reason: 'invalid_phone' };
  const plain = String(password ?? '').slice(0, 200);
  if (!plain) return { ok: false, reason: 'no_match' };

  const byIp = await consume(bucketFor('customer-password-ip', hashIp(meta.ip) ?? 'unknown'), IP_LIMIT);
  if (!byIp.allowed) return { ok: false, reason: 'rate_limited' };

  const user = await prisma.user.findUnique({
    where: { phone },
    select: { id: true, role: true, deletedAt: true, passwordHash: true, passwordTemporary: true, failedSignIns: true, lockedOutAt: true },
  });
  /* Staff sign in at the studio's own door; a staff number here reads as no match. */
  if (!user || user.deletedAt || user.role !== 'CUSTOMER') {
    await verifyPassword(plain, DUMMY_HASH);
    return { ok: false, reason: 'no_match' };
  }

  const matched = user.passwordHash ? await verifyPassword(plain, user.passwordHash) : false;
  const outcome = decideCustomerSignIn(user, matched);
  if (outcome.kind === 'refused') return { ok: false, reason: outcome.reason };
  if (outcome.kind === 'wrong') {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedSignIns: { increment: 1 }, ...(outcome.nowLocked ? { lockedOutAt: new Date() } : {}) },
    });
    return { ok: false, reason: outcome.nowLocked ? 'locked' : 'no_match' };
  }

  await prisma.user.update({ where: { id: user.id }, data: { failedSignIns: 0, lockedOutAt: null } });
  await markJoined(user.id);
  const token = await createSession(user.id, { userAgent: meta.userAgent, ip: meta.ip, bearer: meta.bearer });
  return { ok: true, userId: user.id, mustChange: user.passwordTemporary, token };
}

/** Every live invite for this client counts as joined: they are in the app now, link or not. */
async function markJoined(userId: string): Promise<void> {
  const open = await prisma.homeProjectInvite.findMany({ where: { userId, revokedAt: null, joinedAt: null }, select: { id: true, projectId: true } });
  for (const i of open) {
    await prisma.$transaction(async (tx) => {
      const n = await tx.homeProjectInvite.updateMany({ where: { id: i.id, joinedAt: null }, data: { joinedAt: new Date() } });
      if (n.count === 1) await recordEvent(tx, { projectId: i.projectId, type: 'customer.joined', actor: { type: 'CUSTOMER', id: userId }, refId: i.id });
    });
  }
}

/** The client chooses their own password (a one-time one is replaced without asking for it again). */
export async function chooseCustomerPassword(userId: string, next: string, current: string | null): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, passwordHash: true, passwordTemporary: true } });
  if (!user || user.role !== 'CUSTOMER') return { ok: false, message: 'This account does not sign in with a password here.' };
  if (user.passwordHash && !user.passwordTemporary) {
    if (!current || !(await verifyPassword(current, user.passwordHash))) return { ok: false, message: 'Your current password is not right.' };
  }
  const problem = passwordProblem(next);
  if (problem) return { ok: false, message: problem };
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(next), passwordSetAt: new Date(), passwordTemporary: false, failedSignIns: 0, lockedOutAt: null },
  });
  return { ok: true };
}

/** Whether this signed-in client is still on a one-time password. Never throws. */
export async function customerMustChoose(userId: string): Promise<boolean> {
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, passwordTemporary: true } });
    return u?.role === 'CUSTOMER' && u.passwordTemporary === true;
  } catch {
    return false;
  }
}

/**
 * The studio makes its client a one-time password, from the project page:
 * for a first sign-in, a forgotten password or a lock. The client is signed
 * out everywhere; the studio sees the password once and hands it over
 * itself. Whoever may ask the client for a sign-off may do this (the owner,
 * a project manager, the project's designer). Refused for a number that is
 * also a studio or team account.
 */
export async function setClientOneTimePassword(projectId: string): Promise<{ ok: true; password: string; message: string } | { ok: false; error: string }> {
  const on = await memberOnProject(projectId);
  if (!on.ok) return { ok: false, error: on.error };
  if (!on.access.may('project.create') && !on.access.may('signoff.request')) return { ok: false, error: 'Making your client a password is for the owner, a project manager or the project’s designer.' };
  const project = await prisma.homeProject.findFirst({
    where: { id: projectId, cancelledAt: null, introduction: { studioId: on.member.studioId } },
    select: { introduction: { select: { brief: { select: { user: { select: { id: true, name: true, role: true, deletedAt: true } } } } } } },
  });
  const client = project?.introduction.brief.user ?? null;
  if (!client || client.deletedAt) return { ok: false, error: 'This project has no client account yet.' };
  if (client.role !== 'CUSTOMER') return { ok: false, error: 'This number is a studio or team account, so it cannot sign in as a client.' };
  const plain = temporaryPassword();
  await prisma.user.update({
    where: { id: client.id },
    data: { passwordHash: await hashPassword(plain), passwordSetAt: new Date(), passwordTemporary: true, failedSignIns: 0, lockedOutAt: null },
  });
  await revokeAllSessions(client.id);
  await prisma.auditLog.create({
    data: { actorId: on.member.userId, action: 'studio.client.password_set', entityType: 'HomeProject', entityId: projectId, after: { temporary: true } },
  });
  const first = (client.name ?? '').trim().split(/\s+/)[0] || 'your client';
  return {
    ok: true,
    password: plain,
    message: `Give ${first} this one-time password with the app link. They sign in with their mobile number and choose their own; any old password stops working now.`,
  };
}
