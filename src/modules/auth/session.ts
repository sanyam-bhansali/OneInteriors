import 'server-only';

/**
 * Sessions.
 *
 * Design decisions worth knowing, because each of them is the difference
 * between a session system and a liability:
 *
 *  1. **The database stores a SHA-256 of the token, never the token.** The
 *     cookie holds the plaintext. A database dump therefore cannot be replayed
 *     as a login — same reasoning as storing password hashes.
 *
 *  2. **Constant-time comparison.** Lookup is by hash so the index does the
 *     work, but any direct comparison uses timingSafeEqual.
 *
 *  3. **The role is read from the database on every request**, never trusted
 *     from the cookie. A revoked or downgraded user loses access immediately
 *     rather than at their next sign-in. It costs one indexed query.
 *
 *  4. **Revocation is real.** `revokedAt` is checked; sessions are rows, not
 *     signed claims, precisely so we can kill one.
 */

import { cookies } from 'next/headers';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import type { UserRole } from '@prisma/client';

const COOKIE = 'oi_session';
const SESSION_DAYS = 30;
/** Refresh lastUsedAt at most this often, to avoid a write on every request. */
const TOUCH_AFTER_MINUTES = 60;

export interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  role: UserRole;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** 256 bits, url-safe. */
export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Never store a raw IP — DPDP minimisation. */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash('sha256').update(ip).digest('hex').slice(0, 32);
}

export async function createSession(
  userId: string,
  meta: { userAgent?: string | null; ip?: string | null } = {},
): Promise<string> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      userAgent: meta.userAgent?.slice(0, 400) ?? null,
      ipHash: hashIp(meta.ip),
      expiresAt,
    },
  });

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });

  return token;
}

/**
 * The current user, or null. Reads the role fresh from the database — see (3).
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt < new Date()) return null;
  if (session.user.deletedAt) return null;

  // Cheap liveness tracking without a write per request.
  const stale = Date.now() - session.lastUsedAt.getTime() > TOUCH_AFTER_MINUTES * 60_000;
  if (stale) {
    await prisma.session
      .update({ where: { id: session.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {
        /* liveness is not worth failing a request over */
      });
  }

  const { user } = session;
  return { id: user.id, email: user.email, phone: user.phone, name: user.name, role: user.role };
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await prisma.session
      .updateMany({ where: { tokenHash: hashToken(token) }, data: { revokedAt: new Date() } })
      .catch(() => {});
  }
  jar.delete(COOKIE);
}

/** Sign out everywhere — used when a role changes or an account is compromised. */
export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// ── Authorisation ──────────────────────────────────────────────

const RANK: Record<UserRole, number> = { CUSTOMER: 0, STUDIO: 1, OPS: 2, ADMIN: 3 };

export function hasRole(user: AuthUser | null, required: UserRole): boolean {
  if (!user) return false;
  return RANK[user.role] >= RANK[required];
}

/**
 * Throws if the caller lacks the role. Use at the top of every server action
 * and route handler that mutates — never rely on the UI having hidden a button.
 */
export async function requireRole(required: UserRole): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!hasRole(user, required)) {
    throw new Error('UNAUTHORISED');
  }
  return user as AuthUser;
}
