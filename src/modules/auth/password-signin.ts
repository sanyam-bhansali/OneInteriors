import 'server-only';

/**
 * Password sign-in, and the lock that sits behind it.
 *
 * The decisions are all in `./password.ts`, pure and tested. This file does
 * only the database work, so the rules can be checked without Postgres and the
 * queries can be read without the rules tangled through them.
 *
 * ## The shape of every failure is the same
 *
 * Wrong password, no password set, an account type that does not use one, no
 * such user at all, already locked — one outcome, one message, no timing tell
 * worth chasing. A form that distinguishes them is a tool for discovering
 * which addresses are staff accounts, and a staff address is worth phishing:
 * ops reaches every studio's GSTIN and every customer's phone number, and a
 * studio account reaches that studio's whole client list.
 *
 * ## Why the lock is not timed
 *
 * Fifteen minutes is a wait, not a wall. This lock stays shut until someone
 * redeems a magic link, which proves control of the mailbox — the same proof
 * the account was created with, and the one thing a password guesser does not
 * have. So the operator is never stuck, and the guesser is stopped for good
 * rather than briefly.
 */

import { prisma } from '@/lib/prisma';
import { createSession } from './session';
import { sendMagicLink } from './email';
import { requestMagicLink, normaliseEmail, isValidEmail } from './magic-link';
import {
  canUsePassword,
  decideSignIn,
  hashPassword,
  passwordProblem,
  verifyPassword,
} from './password';

export type PasswordSignInResult =
  /** `role` and `mustSetPassword` decide where the caller sends them. */
  | { ok: true; role: string; mustSetPassword: false }
  | { ok: false; message: string; locked?: boolean };

/**
 * One sentence, used for every refusal.
 *
 * It names the magic link because that is the way out of all of them —
 * forgotten password, never set one, locked, wrong account type. The person
 * who typed a typo and the person probing for ops accounts read the same
 * words.
 */
const REFUSED =
  'That email and password did not match. Use the sign-in link below instead — it always works.';

export async function signInWithPassword(
  rawEmail: string,
  password: string,
  meta: { userAgent?: string | null; ip?: string | null; baseUrl: string },
): Promise<PasswordSignInResult> {
  const email = normaliseEmail(rawEmail);
  if (!isValidEmail(email) || password.length === 0) {
    return { ok: false, message: REFUSED };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      role: true,
      deletedAt: true,
      passwordHash: true,
      failedSignIns: true,
      lockedOutAt: true,
    },
  });

  /* No such user. Do the work anyway, at roughly the cost of a real check, so
     the response time does not answer a question the message refuses to. */
  if (!user || user.deletedAt) {
    await verifyPassword(password, 's1$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAA');
    return { ok: false, message: REFUSED };
  }

  const matched = user.passwordHash
    ? await verifyPassword(password, user.passwordHash)
    : false;

  const outcome = decideSignIn(user, matched);

  if (outcome.kind === 'ok') {
    /* A successful sign-in clears the counter. Four typos on Monday should not
       combine with one on Friday to lock an account nobody is attacking. */
    await prisma.user.update({
      where: { id: user.id },
      data: { failedSignIns: 0, lockedOutAt: null },
    });
    await createSession(user.id, meta);
    /* Signing in WITH a password means one is set, by definition — so this is
       never the first-run case. Stated rather than inferred, because the
       caller branches on it. */
    return { ok: true, role: user.role, mustSetPassword: false };
  }

  if (outcome.kind === 'refused') {
    return { ok: false, message: REFUSED };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedSignIns: { increment: 1 },
      ...(outcome.nowLocked ? { lockedOutAt: new Date() } : {}),
    },
  });

  if (outcome.nowLocked) {
    /* Send the way back in, unprompted. Whoever owns this mailbox either just
       locked themselves out and needs the link, or is being guessed at and
       should know. Best effort: a failed send must not turn a locked account
       into a 500. */
    try {
      await requestMagicLink(email, { ip: meta.ip ?? null, baseUrl: meta.baseUrl, next: null });
    } catch (error) {
      console.error('[password] lockout link failed to send:', error);
    }
    return { ok: false, message: REFUSED, locked: true };
  }

  /* Deliberately not "3 attempts remaining". A counter tells a guesser how
     much room is left and tells an honest typist nothing they can act on. */
  return { ok: false, message: REFUSED };
}

export type SetPasswordResult = { ok: true } | { ok: false; message: string };

/**
 * Set or change the signed-in user's own password.
 *
 * This is the only way a password is ever set. There is deliberately no seed
 * script and no CLI flag: a password that arrives through a script has been
 * typed into a terminal, a chat or a note, and is compromised before it is
 * used.
 */
export async function setOwnPassword(
  userId: string,
  newPassword: string,
  currentPassword: string | null,
): Promise<SetPasswordResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, passwordHash: true },
  });

  if (!user || !canUsePassword(user.role)) {
    /* Customers reach this only by URL, and the honest answer is that their
       account does not use a password — not that they did something wrong. */
    return { ok: false, message: 'This account signs in by link, not by password.' };
  }

  /* Changing an existing password requires the old one. Without this, anyone
     who borrows an unlocked laptop for thirty seconds owns the account
     permanently, rather than until the session expires. */
  if (user.passwordHash) {
    if (!currentPassword || !(await verifyPassword(currentPassword, user.passwordHash))) {
      return { ok: false, message: 'Your current password is not right.' };
    }
  }

  const problem = passwordProblem(newPassword);
  if (problem) return { ok: false, message: problem };

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(newPassword),
      passwordSetAt: new Date(),
      failedSignIns: 0,
      lockedOutAt: null,
    },
  });

  return { ok: true };
}

/**
 * Clear the lock after a magic link is redeemed.
 *
 * Called from the link-consumption path. This is what makes the lock
 * permanent-until-proven rather than permanent: the person who owns the
 * mailbox gets their password back, and nobody else can.
 */
export async function clearLockout(userId: string): Promise<void> {
  await prisma.user.updateMany({
    where: { id: userId, OR: [{ failedSignIns: { gt: 0 } }, { lockedOutAt: { not: null } }] },
    data: { failedSignIns: 0, lockedOutAt: null },
  });
}

export { sendMagicLink };
