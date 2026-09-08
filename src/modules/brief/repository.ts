import 'server-only';

/**
 * Server-side brief persistence, with anonymous claim.
 *
 * ## The shape of the problem
 *
 * The quiz gives value before it asks for anything — nine questions, then a
 * style reveal and ranked matches, and only then a reason to sign in. That
 * ordering is deliberate and it is what keeps completion rates survivable. It
 * also means a brief has to exist and be useful *before* we know who wrote it.
 *
 * So a brief starts anonymous, keyed to a random token in an httpOnly cookie.
 * When the person signs in, the brief is claimed: `userId` is set and
 * `anonKey` is cleared, so it can never afterwards be reached by a stale
 * cookie on a shared machine.
 *
 * ## Why the cookie is httpOnly
 *
 * The token is a bearer credential for a document containing someone's budget,
 * their address area, when their flat is empty and who lives in it. Script
 * access to it buys nothing and costs a whole class of attack.
 *
 * Everything degrades: with no database the quiz keeps working out of
 * sessionStorage exactly as before.
 */

import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { getCurrentUser } from '@/modules/auth/session';
import { EMPTY_BRIEF, type Brief } from './types';
import { rowToBrief, briefToRow } from './mapping';

const COOKIE = 'oi.brief';
/**
 * Thirty days. Long enough to survive the weeks people spend deciding on a
 * home, short enough that an abandoned brief does not resurrect a year later
 * with a stale budget and a possession date that has passed.
 */
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function newAnonKey(): string {
  return randomBytes(24).toString('base64url');
}

/** Read the anonymous key without creating one. */
export async function readAnonKey(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(COOKIE)?.value ?? null;
}

/**
 * Read the key, creating and setting it if absent.
 *
 * Only call this from a route or action that is *about* to write a brief —
 * setting a tracking-shaped cookie on someone who is only reading the landing
 * page is both rude and a consent question we do not need to have.
 */
export async function ensureAnonKey(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(COOKIE)?.value;
  if (existing) return existing;

  const key = newAnonKey();
  jar.set(COOKIE, key, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
  return key;
}

export interface LoadedBrief {
  brief: Brief;
  /** False when there is nothing stored yet — the caller may prefer its local copy. */
  found: boolean;
}

/**
 * Load the current brief: the signed-in user's if there is one, otherwise the
 * one this browser owns.
 */
export async function loadBrief(): Promise<LoadedBrief> {
  if (!hasDatabase()) return { brief: EMPTY_BRIEF, found: false };

  const user = await getCurrentUser();
  if (user) {
    const row = await prisma.brief.findUnique({ where: { userId: user.id } });
    if (row) return { brief: rowToBrief(row), found: true };
  }

  const anonKey = await readAnonKey();
  if (anonKey) {
    const row = await prisma.brief.findUnique({ where: { anonKey } });
    if (row) return { brief: rowToBrief(row), found: true };
  }

  return { brief: EMPTY_BRIEF, found: false };
}

export type SaveResult = { ok: true; persisted: boolean };

/**
 * Write the brief.
 *
 * Returns `persisted: false` rather than throwing when there is no database —
 * the quiz must never break because Postgres is unreachable. Losing a brief is
 * bad; a customer hitting an error screen in the middle of the funnel is worse.
 */
export async function saveBrief(brief: Brief): Promise<SaveResult> {
  if (!hasDatabase()) return { ok: true, persisted: false };

  try {
    const data = briefToRow(brief);
    const user = await getCurrentUser();

    if (user) {
      await prisma.brief.upsert({
        where: { userId: user.id },
        create: { ...data, userId: user.id },
        update: data,
      });
      return { ok: true, persisted: true };
    }

    const anonKey = await ensureAnonKey();
    await prisma.brief.upsert({
      where: { anonKey },
      create: { ...data, anonKey },
      update: data,
    });
    return { ok: true, persisted: true };
  } catch {
    return { ok: true, persisted: false };
  }
}

/**
 * Attach this browser's anonymous brief to the account that just signed in.
 *
 * Called from the sign-in path. The rules, in order of how badly each would
 * hurt if wrong:
 *
 *  1. **Never overwrite an existing brief.** Someone who already has a brief
 *     and arrives with a stale cookie from a shared laptop must not have their
 *     answers replaced by a stranger's.
 *  2. **Always clear the cookie afterwards**, claimed or not, so the token
 *     cannot later reach a brief that now belongs to an account.
 */
export async function claimBrief(
  userId: string,
): Promise<{ claimed: boolean; anonKey: string | null }> {
  if (!hasDatabase()) return { claimed: false, anonKey: null };

  const jar = await cookies();
  const anonKey = jar.get(COOKIE)?.value ?? null;
  if (!anonKey) return { claimed: false, anonKey: null };

  // Whatever happens below, this token stops being usable.
  jar.delete(COOKIE);

  try {
    const [anonymous, existing] = await Promise.all([
      prisma.brief.findUnique({ where: { anonKey } }),
      prisma.brief.findUnique({ where: { userId } }),
    ]);

    if (!anonymous) return { claimed: false, anonKey };

    if (existing) {
      // They already have one. Theirs wins; the anonymous row is dropped
      // rather than left orphaned holding someone's budget indefinitely.
      await prisma.brief.delete({ where: { id: anonymous.id } });
      return { claimed: false, anonKey };
    }

    await prisma.brief.update({
      where: { id: anonymous.id },
      data: { userId, anonKey: null, claimedAt: new Date() },
    });
    return { claimed: true, anonKey };
  } catch {
    return { claimed: false, anonKey };
  }
}
