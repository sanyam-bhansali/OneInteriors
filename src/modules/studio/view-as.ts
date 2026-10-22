import 'server-only';

/**
 * Developer access, "Open as…" (owner, 22 Oct 2026; docs/studio-os/VIEW-AS.md):
 * the server half. The rules are in view-as-rules.ts (pure, tested); this file
 * reads and writes the four `Session` columns and the audit log.
 *
 * ## The round trip
 *
 *  1. /ops/[slug] → "Open as…" → `startViewAs` (OPS or ADMIN): checks the
 *     member is on that studio, makes a session row for the admin that
 *     carries the view (two hours) and a one-time ticket (two minutes), writes
 *     `staff.view_as.start` to the audit log, and hands back the studio host's
 *     `/api/staff/view-as/enter?ticket=…`.
 *  2. That route (`enterViewAs`) redeems the ticket once. On the studio host
 *     the ops cookie is never sent (cookies are host-only, lib/host.ts), so the
 *     row becomes the admin's session THERE: its token is rotated and set as
 *     the cookie — the token itself never travels in a URL, only the
 *     single-use ticket does, like a sign-in link. On a single origin (local,
 *     preview) where the admin's own session is already present, the view is
 *     put on that session instead and the spare row revoked.
 *  3. Every studio request: access.ts `currentMember` and tenancy.ts
 *     `myStudioId` ask `liveView()` and, for a staff session with a live view,
 *     answer as the member — `viewOnly`, and nobody at all on a write request.
 *  4. Stop (the banner, POST /api/staff/view-as/stop): `stopViewAs` clears the
 *     view (a view-only session is revoked), writes `staff.view_as.stop`, and
 *     the route returns to /ops/[slug].
 *
 * An expired view is ignored and its columns cleared on the next read.
 * Customers and studio accounts never get a view: `viewStateOf` honours the
 * columns for OPS and ADMIN only, and nothing but `startViewAs` writes them.
 * Bearer sessions (the phone app) never view as anyone: only the cookie is read.
 */

import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { audienceFor } from '@/lib/host';
import { SESSION_COOKIE, getCurrentUser, hasRole, hashIp, hashToken, newToken } from '@/modules/auth/session';
import {
  METHOD_HEADER,
  NEXT_ACTION_HEADER,
  VIEW_AS_ENTER_PATH,
  checkViewTarget,
  isStaff,
  requestIsWrite,
  ticketUsable,
  viewStateOf,
  viewUntil,
} from './view-as-rules';

/** A live view, as the studio layout and the resolution need it. */
export interface LiveView {
  sessionId: string;
  actorId: string;
  memberId: string;
  studioId: string;
  until: Date;
  viewAsOnly: boolean;
  memberName: string;
  role: string;
  salesRoleName: string | null;
  studioName: string;
  studioSlug: string;
}

/** A name for the banner and the ops list: their name, else their number or email, else their role. */
function nameOf(u: { name: string | null; phone: string | null; email: string | null } | null, role: string): string {
  return u?.name?.trim() || u?.phone || u?.email || role;
}

/**
 * This request's live view, or null. Read once per request (React `cache`).
 * Never throws: a failed read is "not viewing", which shows an ops account
 * nothing of any studio — closed, never wider.
 */
export const liveView = cache(async (): Promise<LiveView | null> => {
  if (!hasDatabase()) return null;
  try {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const s = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      select: {
        id: true,
        userId: true,
        revokedAt: true,
        expiresAt: true,
        viewAsMemberId: true,
        viewAsUntil: true,
        viewAsOnly: true,
        user: { select: { role: true, deletedAt: true } },
      },
    });
    const now = new Date();
    if (!s || s.revokedAt || s.expiresAt <= now || s.user.deletedAt) return null;
    const state = viewStateOf({ role: s.user.role, memberId: s.viewAsMemberId, until: s.viewAsUntil }, now);
    if (state.kind === 'expired') {
      /* Lazily, and only if nobody has started a fresh view meanwhile. */
      await prisma.session
        .updateMany({ where: { id: s.id, viewAsUntil: s.viewAsUntil }, data: { viewAsMemberId: null, viewAsUntil: null } })
        .catch(() => {});
      return null;
    }
    if (state.kind !== 'live') return null;
    const m = await prisma.studioMember.findUnique({
      where: { id: state.memberId },
      select: {
        id: true,
        studioId: true,
        role: true,
        user: { select: { name: true, phone: true, email: true } },
        salesRole: { select: { name: true } },
        studio: { select: { tradeName: true, slug: true } },
      },
    });
    if (!m) return null;
    return {
      sessionId: s.id,
      actorId: s.userId,
      memberId: m.id,
      studioId: m.studioId,
      until: state.until,
      viewAsOnly: s.viewAsOnly,
      memberName: nameOf(m.user, m.role),
      role: m.role,
      salesRoleName: m.salesRole?.name ?? null,
      studioName: m.studio.tradeName,
      studioSlug: m.studio.slug,
    };
  } catch (error) {
    console.error('[view-as] live view read failed', error instanceof Error ? error.name : 'unknown');
    return null;
  }
});

/**
 * Whether this request writes (view-as-rules.ts `requestIsWrite`): a server
 * action, or any method but GET or HEAD, as the middleware recorded it.
 */
export async function isWriteRequest(): Promise<boolean> {
  try {
    const h = await headers();
    return requestIsWrite({ method: h.get(METHOD_HEADER), nextAction: h.get(NEXT_ACTION_HEADER) });
  } catch {
    return true;
  }
}

/**
 * The live view for this signed-in user, when they are staff. For the
 * resolution in access.ts and tenancy.ts; `undefined` when not viewing.
 */
export async function staffViewFor(user: { id: string; role: string }): Promise<LiveView | undefined> {
  if (!isStaff(user.role)) return undefined;
  const view = await liveView();
  return view && view.actorId === user.id ? view : undefined;
}

// ── The ops page ────────────────────────────────────────────────

export interface ViewAsOption {
  id: string;
  name: string;
  role: string;
  salesRole: string | null;
  status: string;
}

/** The studio's people, for "Open as…" on /ops/[slug]. Staff only; anyone else gets none. */
export async function viewAsOptions(studioId: string): Promise<ViewAsOption[]> {
  const user = await getCurrentUser();
  if (!hasRole(user, 'OPS') || !hasDatabase()) return [];
  const rows = await prisma.studioMember.findMany({
    where: { studioId },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, role: true, status: true, user: { select: { name: true, phone: true, email: true } }, salesRole: { select: { name: true } } },
  });
  return rows.map((r) => ({ id: r.id, name: nameOf(r.user, r.role), role: r.role, salesRole: r.salesRole?.name ?? null, status: r.status }));
}

function forwardedIp(h: Headers): string | null {
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null;
}

function protoOf(h: Headers): string {
  const p = h.get('x-forwarded-proto')?.split(',')[0]?.trim();
  if (p === 'http' || p === 'https') return p;
  return process.env.NODE_ENV === 'production' ? 'https' : 'http';
}

/**
 * The address of a path on the studio host, from where this request is.
 * Same origin when the hosts are not split; the configured STUDIO_HOST when
 * they are. Never a host taken from the request beyond deciding which.
 */
function studioUrl(h: Headers, path: string): string | null {
  const audience = audienceFor(h.get('host'));
  if (audience === 'all') return path;
  const studioHost = process.env.STUDIO_HOST?.trim();
  if (!studioHost) return null;
  return `${protoOf(h)}://${studioHost}${path}`;
}

/** Where Stop returns to: the studio's ops page, on the ops host when the hosts are split. */
export function opsUrl(h: Headers, slug: string): string {
  const path = `/ops/${encodeURIComponent(slug)}`;
  const audience = audienceFor(h.get('host'));
  const opsHost = process.env.OPS_HOST?.trim();
  if (audience === 'all' || !opsHost) return path;
  return `${protoOf(h)}://${opsHost}${path}`;
}

export type StartResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Start viewing a studio as one of its members (the ops page's server
 * action). Staff only; the member must be on that studio. Audited.
 */
export async function startViewAs(studioId: string, memberId: string): Promise<StartResult> {
  const actor = await getCurrentUser();
  if (!actor || !hasRole(actor, 'OPS')) return { ok: false, error: 'Only One Interiors staff can open a studio as one of its people.' };
  if (!hasDatabase()) return { ok: false, error: 'There is no database here to open a studio from.' };

  const member = await prisma.studioMember.findUnique({
    where: { id: memberId },
    select: { id: true, studioId: true, role: true, user: { select: { name: true, phone: true, email: true } }, salesRole: { select: { name: true } }, studio: { select: { tradeName: true } } },
  });
  const check = checkViewTarget(actor.role, member, studioId);
  if (!check.ok || !member) return { ok: false, error: check.ok ? 'That person is not on this studio’s team.' : check.error };

  const h = await headers();
  const ticket = newToken();
  const enter = studioUrl(h, `${VIEW_AS_ENTER_PATH}?ticket=${encodeURIComponent(ticket)}`);
  if (!enter) return { ok: false, error: 'The studio address (STUDIO_HOST) is not set, so there is nowhere to open it.' };

  const now = new Date();
  const until = viewUntil(now);
  const ipHash = hashIp(forwardedIp(h));
  await prisma.$transaction(async (tx) => {
    await tx.session.create({
      data: {
        userId: actor.id,
        /* A placeholder nobody holds: the real token is made when the ticket is redeemed (`enterViewAs`). */
        tokenHash: hashToken(newToken()),
        userAgent: h.get('user-agent')?.slice(0, 400) ?? null,
        ipHash,
        expiresAt: until,
        viewAsMemberId: member.id,
        viewAsUntil: until,
        viewAsTicketHash: hashToken(ticket),
        viewAsOnly: true,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'staff.view_as.start',
        entityType: 'StudioMember',
        entityId: member.id,
        before: Prisma.JsonNull,
        after: {
          studioId,
          studio: member.studio.tradeName,
          member: nameOf(member.user, member.role),
          role: member.role,
          salesRole: member.salesRole?.name ?? null,
          until: until.toISOString(),
        },
        ipHash,
      },
    });
  });
  return { ok: true, url: enter };
}

export type EnterResult =
  | { ok: true; until: Date; /** Set this as the session cookie (a new session on this host). */ newToken: string | null; /** The session the hint is bound to. */ sessionToken: string }
  | { ok: false; error: string };

const TICKET_SHAPE = /^[A-Za-z0-9_-]{40,64}$/;

/**
 * Redeem a ticket on the studio host, once. `currentToken` is the session
 * cookie this browser already has here, if any.
 */
export async function enterViewAs(ticket: string, currentToken: string | null): Promise<EnterResult> {
  const fail = { ok: false as const, error: 'This link has expired or was already used. Open the studio again from the ops page.' };
  if (!hasDatabase() || !TICKET_SHAPE.test(ticket)) return fail;
  const ticketHash = hashToken(ticket);
  const pending = await prisma.session.findUnique({
    where: { viewAsTicketHash: ticketHash },
    select: { id: true, userId: true, createdAt: true, revokedAt: true, viewAsMemberId: true, viewAsUntil: true, user: { select: { role: true, deletedAt: true } } },
  });
  const now = new Date();
  if (!pending || pending.revokedAt || pending.user.deletedAt || !ticketUsable(pending.createdAt, now)) return fail;
  const state = viewStateOf({ role: pending.user.role, memberId: pending.viewAsMemberId, until: pending.viewAsUntil }, now);
  if (state.kind !== 'live') return fail;

  /* Single use: whoever clears the ticket first redeems it. */
  const redeemed = await prisma.session.updateMany({ where: { id: pending.id, viewAsTicketHash: ticketHash }, data: { viewAsTicketHash: null } });
  if (redeemed.count !== 1) return fail;

  if (currentToken) {
    const current = await prisma.session.findUnique({
      where: { tokenHash: hashToken(currentToken) },
      select: { id: true, userId: true, revokedAt: true, expiresAt: true },
    });
    if (current && !current.revokedAt && current.expiresAt > now) {
      if (current.userId !== pending.userId) {
        await prisma.session.update({ where: { id: pending.id }, data: { revokedAt: now } });
        return { ok: false, error: 'This browser is signed in to the studio software as somebody else. Sign out here first, then open the studio again from the ops page.' };
      }
      /* The admin's own session on a single origin: the view goes on it, and the spare row is revoked. */
      await prisma.$transaction([
        prisma.session.update({ where: { id: current.id }, data: { viewAsMemberId: state.memberId, viewAsUntil: state.until } }),
        prisma.session.update({ where: { id: pending.id }, data: { revokedAt: now, viewAsMemberId: null, viewAsUntil: null } }),
      ]);
      return { ok: true, until: state.until, newToken: null, sessionToken: currentToken };
    }
  }

  const token = newToken();
  await prisma.session.update({ where: { id: pending.id }, data: { tokenHash: hashToken(token), lastUsedAt: now } });
  return { ok: true, until: state.until, newToken: token, sessionToken: token };
}

export type StopResult = { slug: string | null; revoked: boolean };

/** Stop viewing (the banner). Clears the view; a view-only session is revoked. Audited. Safe to call when not viewing. */
export async function stopViewAs(currentToken: string | null): Promise<StopResult> {
  if (!currentToken || !hasDatabase()) return { slug: null, revoked: false };
  const s = await prisma.session.findUnique({
    where: { tokenHash: hashToken(currentToken) },
    select: { id: true, userId: true, viewAsMemberId: true, viewAsUntil: true, viewAsOnly: true },
  });
  if (!s || (!s.viewAsMemberId && !s.viewAsOnly)) return { slug: null, revoked: false };
  const member = s.viewAsMemberId
    ? await prisma.studioMember.findUnique({ where: { id: s.viewAsMemberId }, select: { id: true, studioId: true, studio: { select: { slug: true } } } })
    : null;
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.session.update({
      where: { id: s.id },
      data: { viewAsMemberId: null, viewAsUntil: null, viewAsTicketHash: null, ...(s.viewAsOnly ? { revokedAt: now } : {}) },
    });
    if (s.viewAsMemberId) {
      await tx.auditLog.create({
        data: {
          actorId: s.userId,
          action: 'staff.view_as.stop',
          entityType: 'StudioMember',
          entityId: s.viewAsMemberId,
          before: { studioId: member?.studioId ?? null, until: s.viewAsUntil?.toISOString() ?? null },
          after: Prisma.JsonNull,
        },
      });
    }
  });
  return { slug: member?.studio.slug ?? null, revoked: s.viewAsOnly };
}
