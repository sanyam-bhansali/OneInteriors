import 'server-only';

/**
 * Whose leads the signed-in person may see (Studio OS Phase 1,
 * docs/studio-os/PHASE-1-SALES.md §7).
 *
 * `myStudioId()` (tenancy.ts) finds a studio only for an ACTIVE owner or
 * project manager, and every older office module starts there — so a
 * salesperson still finds nothing in any of them. The screens a salesperson
 * does open (Today, the board, a lead, quotations) start HERE instead, and
 * every query they run carries `scope.leads` or `scope.quotes`
 * (`roles.ts leadsVisibleTo / quotesVisibleTo`): the whole studio for owner
 * and PM, only the leads assigned to them for a salesperson. Both always
 * carry the studio id, so no role reaches another studio's rows.
 *
 * Returns null rather than throwing, like `myStudioId()`: these are
 * render-path reads.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { currentMember, type StudioMemberRef } from './access';
import { can, leadsVisibleTo, quotesVisibleTo, type StudioAction } from './roles';

export interface LeadScope {
  member: StudioMemberRef;
  studioId: string;
  /** Owner or PM: every lead. False for a salesperson (their own only). */
  seesAll: boolean;
  /** Add to every `studioClient` where (with `deletedAt: null`). */
  leads: Prisma.StudioClientWhereInput;
  /** Add to every `studioQuote` where. */
  quotes: Prisma.StudioQuoteWhereInput;
}

/** The signed-in member's lead scope, or null when they may not see leads (or nobody is signed in). */
export async function myLeadScope(): Promise<LeadScope | null> {
  const member = await currentMember();
  if (!member || !can(member, 'lead.read', { assigned: true })) return null;
  return {
    member,
    studioId: member.studioId,
    seesAll: member.role !== 'SALES',
    leads: leadsVisibleTo(member),
    quotes: quotesVisibleTo(member),
  };
}

/** Whether `can()` allows this lead action on this lead, for the scope's member. */
export function mayOnLead(scope: LeadScope, action: StudioAction, lead: { assignedToId: string | null }): boolean {
  return can(scope.member, action, { assigned: lead.assignedToId === scope.member.id });
}

/**
 * The one lead, if this scope may see it: the studio's for owner and PM, an
 * assigned one for a salesperson. Null otherwise (never "forbidden": that
 * would confirm the row exists). `LISTED`: the sample has a page too.
 */
export async function leadInScope(scope: LeadScope, clientId: string): Promise<{ id: string; assignedToId: string | null; name: string } | null> {
  if (typeof clientId !== 'string' || clientId.length === 0 || clientId.length > 64) return null;
  return prisma.studioClient.findFirst({
    where: { ...scope.leads, studioId: scope.studioId, id: clientId, deletedAt: null },
    select: { id: true, assignedToId: true, name: true },
  });
}

/**
 * The studio id for reading what quoting needs (products, branding, the
 * rates gate) — owner, PM and sales. Writes to those stay with
 * `myStudioId()`.
 */
export async function quotingStudioId(): Promise<string | null> {
  const member = await currentMember();
  return member && can(member, 'quote.write', { assigned: true }) ? member.studioId : null;
}

/** The signed-in member, as the author of a timeline line. Any active role. */
export async function actingMember(): Promise<{ id: string; name: string } | null> {
  try {
    const member = await currentMember();
    if (!member || member.status !== 'ACTIVE') return null;
    const row = await prisma.studioMember.findUnique({
      where: { id: member.id },
      select: { id: true, user: { select: { name: true, email: true, phone: true } } },
    });
    if (!row) return null;
    const name = row.user.name?.trim() || row.user.email?.split('@')[0] || 'Someone';
    return { id: row.id, name };
  } catch {
    return null;
  }
}

/**
 * The studio id for READING the board's shape — its columns and its own
 * fields — for anyone who may see leads (owner, PM, sales). Changing them
 * stays with `myStudioId()` (Settings).
 */
export async function leadStudioId(): Promise<string | null> {
  const scope = await myLeadScope();
  return scope?.studioId ?? null;
}
