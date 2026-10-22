import 'server-only';

/**
 * The studio's side of lead intake: Settings → Lead sources, "Leads that
 * come in by themselves" (21 Oct 2026; docs/studio-os/LEAD-INTAKE.md).
 *
 * Every read and write is scoped by the member's own studio, and only those
 * who may import leads (`lead.import`: the owner and project managers, the
 * same people who keep the studio's source names) manage the doors. It is a
 * Pro feature: every studio has it, not only the full software.
 *
 * The key is returned exactly twice in a door's life — when it is made and
 * when it is given a new one — and is never readable again: only its hash is
 * kept (`secrets.ts`).
 */

import { prisma } from '@/lib/prisma';
import { siteUrlFor } from '@/lib/site';
import { currentMember } from '@/modules/studio/access';
import { can } from '@/modules/studio/roles';
import { hashSecret, newSecret } from './secrets';
import { isMetaId, type ConnectionKindName, type IntakeStatusName } from './payloads';
import { retryMetaEvent } from './intake';
import type { LeadRouteModeName } from '@/modules/studio-sales/lead-routing';

export const CONNECTION_KINDS: readonly ConnectionKindName[] = ['WEBSITE', 'GOOGLE_LEAD_FORM', 'PORTAL', 'META_PAGE'];

/** Twenty doors is far more than a studio has sources; it stops a runaway script. */
const MAX_DOORS = 20;

export interface IntakeEventRow {
  id: string;
  status: IntakeStatusName;
  clientId: string | null;
  error: string | null;
  isTest: boolean;
  at: string;
  /** "21 Oct, 4:05 pm", India time, written on the server. */
  atLabel: string;
}

export interface ConnectionRow {
  id: string;
  kind: ConnectionKindName;
  label: string;
  enabled: boolean;
  metaPageId: string | null;
  /** "New leads go to" for this door (22 Oct 2026): null follows the studio. */
  routeMode: LeadRouteModeName | null;
  routeMemberId: string | null;
  /** Where the sender posts. */
  url: string;
  lastEventAt: string | null;
  lastEventLabel: string | null;
  eventCount: number;
  failed: number;
  events: IntakeEventRow[];
}

export interface IntakeScreen {
  canManage: boolean;
  connections: ConnectionRow[];
  /** Meta's one callback for every studio. */
  metaCallbackUrl: string;
  /** Whether the server has what Meta needs (never the values). */
  metaReady: { appSecret: boolean; verifyToken: boolean; pageTokens: boolean };
}

export type IntakeResult = { ok: true; message: string; secret?: string } | { ok: false; error: string };

function when(d: Date): string {
  return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
}

function base(): string {
  return siteUrlFor('studio').replace(/\/+$/, '');
}

export function doorUrl(kind: ConnectionKindName, id: string): string {
  if (kind === 'META_PAGE') return `${base()}/api/studio/intake/meta`;
  if (kind === 'GOOGLE_LEAD_FORM') return `${base()}/api/studio/intake/google/${id}`;
  return `${base()}/api/studio/intake/${id}`;
}

/** The screen: every door with its last few leads. Null when the member has no studio. */
export async function myIntakeScreen(): Promise<IntakeScreen | null> {
  const member = await currentMember();
  if (!member) return null;
  const canManage = can(member, 'lead.import');
  const metaReady = {
    appSecret: Boolean(process.env.META_APP_SECRET?.trim()),
    verifyToken: Boolean(process.env.META_VERIFY_TOKEN?.trim()),
    pageTokens: Boolean(process.env.STUDIO_META_PAGE_TOKENS?.trim()),
  };
  const metaCallbackUrl = `${base()}/api/studio/intake/meta`;
  if (!canManage) return { canManage, connections: [], metaCallbackUrl, metaReady };
  try {
    const rows = await prisma.studioLeadConnection.findMany({
      where: { studioId: member.studioId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        kind: true,
        label: true,
        enabled: true,
        metaPageId: true,
        routeMode: true,
        routeMemberId: true,
        lastEventAt: true,
        eventCount: true,
        events: {
          orderBy: { createdAt: 'desc' },
          take: 6,
          select: { id: true, status: true, clientId: true, error: true, isTest: true, createdAt: true },
        },
        _count: { select: { events: { where: { status: 'FAILED' } } } },
      },
    });
    return {
      canManage,
      metaCallbackUrl,
      metaReady,
      connections: rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        label: r.label,
        enabled: r.enabled,
        metaPageId: r.metaPageId,
        routeMode: r.routeMode,
        routeMemberId: r.routeMemberId,
        url: doorUrl(r.kind, r.id),
        lastEventAt: r.lastEventAt?.toISOString() ?? null,
        lastEventLabel: r.lastEventAt ? when(r.lastEventAt) : null,
        eventCount: r.eventCount,
        failed: r._count.events,
        events: r.events.map((e) => ({
          id: e.id,
          status: e.status,
          clientId: e.clientId,
          error: e.error,
          isTest: e.isTest,
          at: e.createdAt.toISOString(),
          atLabel: when(e.createdAt),
        })),
      })),
    };
  } catch (error) {
    console.error('[intake] screen failed', error instanceof Error ? error.message : error);
    return { canManage, connections: [], metaCallbackUrl, metaReady };
  }
}

async function manager() {
  const member = await currentMember();
  if (!member || !can(member, 'lead.import')) return null;
  return member;
}

const REFUSED = { ok: false as const, error: 'Only the owner or a project manager sets up where leads come in from.' };

/** Make a door. The key comes back once, in `secret` (none for a Meta Page). */
export async function createConnection(input: { kind: unknown; label: unknown; metaPageId?: unknown }): Promise<IntakeResult> {
  const member = await manager();
  if (!member) return REFUSED;
  const kind = CONNECTION_KINDS.find((k) => k === input.kind);
  if (!kind) return { ok: false, error: 'Pick where the leads come from.' };
  const label = typeof input.label === 'string' ? input.label.replace(/\s+/g, ' ').trim().slice(0, 40) : '';
  if (label.length < 2) return { ok: false, error: 'Give it a name you will recognise, like "Website" or "99acres".' };

  let metaPageId: string | null = null;
  if (kind === 'META_PAGE') {
    const raw = typeof input.metaPageId === 'string' ? input.metaPageId.trim() : '';
    if (!isMetaId(raw) || raw.length < 5) return { ok: false, error: 'The Facebook Page ID is a long number. Find it on the Page: About → Page transparency.' };
    metaPageId = raw;
  }

  const count = await prisma.studioLeadConnection.count({ where: { studioId: member.studioId } });
  if (count >= MAX_DOORS) return { ok: false, error: 'Twenty connections is the most. Remove one you no longer use.' };

  const secret = newSecret();
  try {
    await prisma.studioLeadConnection.create({
      data: { studioId: member.studioId, kind, label, metaPageId, secretHash: hashSecret(secret), createdById: member.id },
    });
  } catch {
    return { ok: false, error: kind === 'META_PAGE' ? 'That Facebook Page is already connected, here or to another studio. Ask One Interiors if it should be yours.' : 'That did not save. Try again.' };
  }
  if (kind === 'META_PAGE') return { ok: true, message: 'Page added. Leads from its lead ads will land in your pool once Meta is set up (below).' };
  return { ok: true, message: 'Made. Copy the key now: it is shown only this once.', secret };
}

/** A new key; the old one stops working at once. */
export async function rotateKey(id: unknown): Promise<IntakeResult> {
  const member = await manager();
  if (!member) return REFUSED;
  if (typeof id !== 'string') return { ok: false, error: 'That connection is not yours.' };
  const secret = newSecret();
  const { count } = await prisma.studioLeadConnection.updateMany({
    where: { id, studioId: member.studioId, kind: { not: 'META_PAGE' } },
    data: { secretHash: hashSecret(secret) },
  });
  if (count === 0) return { ok: false, error: 'That connection is not yours.' };
  return { ok: true, message: 'New key made. The old one no longer works: paste this one wherever the old one was.', secret };
}

export async function setConnectionEnabled(id: unknown, enabled: boolean): Promise<IntakeResult> {
  const member = await manager();
  if (!member) return REFUSED;
  if (typeof id !== 'string') return { ok: false, error: 'That connection is not yours.' };
  const { count } = await prisma.studioLeadConnection.updateMany({ where: { id, studioId: member.studioId }, data: { enabled } });
  if (count === 0) return { ok: false, error: 'That connection is not yours.' };
  return { ok: true, message: enabled ? 'On. Leads land in your pool again.' : 'Off. Nothing from it lands until you turn it back on.' };
}

/** Remove a door and its receipts. Leads it already brought stay on the board. */
export async function removeConnection(id: unknown): Promise<IntakeResult> {
  const member = await manager();
  if (!member) return REFUSED;
  if (typeof id !== 'string') return { ok: false, error: 'That connection is not yours.' };
  const { count } = await prisma.studioLeadConnection.deleteMany({ where: { id, studioId: member.studioId } });
  if (count === 0) return { ok: false, error: 'That connection is not yours.' };
  return { ok: true, message: 'Removed. The leads it brought are still on your board.' };
}

/** Try a failed Meta lead again. */
export async function retryFailedLead(eventId: unknown): Promise<IntakeResult> {
  const member = await manager();
  if (!member) return REFUSED;
  if (typeof eventId !== 'string') return { ok: false, error: 'That lead is not one that can be tried again.' };
  const r = await retryMetaEvent(member.studioId, eventId);
  if (!r.ok) return r;
  return { ok: true, message: r.outcome === 'duplicate' ? 'Done: they were already on your board, so it is on their timeline.' : 'Done: the lead is in your pool.' };
}
