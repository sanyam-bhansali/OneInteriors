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

import { cookies, headers } from 'next/headers';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { bearerFrom } from './bearer';
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

export interface SessionMeta {
  userAgent?: string | null;
  ip?: string | null;
  /**
   * Hand the token back instead of setting the cookie — the phone app, which
   * keeps it in the device keychain and sends it as `Authorization: Bearer`.
   * Same row, same token strength, same revocation; only the transport differs.
   */
  bearer?: boolean;
}

/** Write the session row and return its token, without touching any cookie. */
export async function issueSession(
  userId: string,
  meta: SessionMeta = {},
): Promise<{ token: string; expiresAt: Date }> {
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

  return { token, expiresAt };
}

export async function createSession(userId: string, meta: SessionMeta = {}): Promise<string> {
  const { token, expiresAt } = await issueSession(userId, meta);
  if (meta.bearer) return token;

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
 * The session token for this request: the website's cookie, or the phone
 * app's bearer header.
 *
 * The cookie wins when both are present. A browser never sends our bearer
 * header, and the app never holds the cookie, so in practice there is only
 * ever one — but if something did send both, the cookie is the one the
 * same-site rules have already vetted.
 *
 * A bearer header cannot be forged cross-site the way a cookie can be
 * ridden, so accepting it adds no CSRF surface: a page on another origin
 * cannot read the token from the keychain to put it in a header.
 */
async function requestToken(): Promise<string | null> {
  const jar = await cookies();
  const fromCookie = jar.get(COOKIE)?.value;
  if (fromCookie) return fromCookie;
  const h = await headers();
  return bearerFrom(h.get('authorization'));
}

/**
 * The current user, or null. Reads the role fresh from the database — see (3).
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = await requestToken();
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
  const token = await requestToken();
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

/**
 * The phone app's web pages (its GEIO tab and the screens it opens from Me)
 * load the website's /app inside a WebView. The first request carries the
 * app's bearer header; this turns that same, still-valid session into the
 * WebView's cookie, so the page's own requests are signed in too. No new
 * session is made and the token never appears in a URL.
 */
export async function adoptBearerAsCookie(authorization: string | null): Promise<boolean> {
  const token = bearerFrom(authorization);
  if (!token) return false;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { expiresAt: true, revokedAt: true },
  });
  if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) return false;
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: session.expiresAt,
  });
  return true;
}
