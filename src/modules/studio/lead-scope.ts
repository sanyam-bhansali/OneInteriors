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
 *
 * ## Sales roles and teams (owner, 22 Oct 2026)
 *
 * docs/studio-os/SALES-ROLES.md. A SALES member with a sales role reaches as
 * far as the role says: `leads` is their `leads.view` reach (own, their team
 * = everyone below them plus their team pools, or the studio), `pool` the
 * pools `leads.pool` lets them claim from, and `reach` / `team` tell the
 * screens which it is. Every write still asks `mayOnLead` with the lead's
 * owner AND its pool, so a wider view never means a wider write.
 *
 * ## Quotation requests (owner, 22 Oct 2026)
 *
 * docs/studio-os/QUOTE-REQUESTS.md. Someone who builds quotations
 * (`quote.build`) is handed requests in turns, often on a lead that is not
 * theirs (Khushi builds the quotation for Swarupa's lead). For those leads
 * only, and only for quoting: `quoteLeads` adds the leads with an open
 * request given to them, `quotes` / `quotesWritable` add those leads'
 * quotations (reading also keeps the ones they finished), and `mayOnLead`
 * lets `quote.write` through on a lead read by `leadForQuote`. The board,
 * the lists, the numbers and every other lead action stay exactly as their
 * reach says: `leads` is not widened.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { currentMember, type StudioMemberRef } from './access';
import { can, hasSalesRole, leadsVisibleTo, leadsWhereFor, poolVisibleTo, quotesVisibleTo, type LeadWriteAction, type StudioAction } from './roles';
import { STUDIO_POOL_ONLY, poolAccessOf, reachOf, reachWhere, type LeadFacts, type PoolAccess } from './sales-access';
import type { SalesReach } from './sales-permissions';

export interface LeadScope {
  member: StudioMemberRef;
  studioId: string;
  /** Every lead in the studio: owner, PM, or a sales role that sees everyone. */
  seesAll: boolean;
  /** How far their leads reach: 'all' (owner, PM), 'own' (a Phase 1 salesperson), or their sales role's `leads.view`. */
  reach: SalesReach;
  /** With team reach, their team (them and everyone below them); null otherwise. */
  team: readonly string[] | null;
  /** The pools they may list and claim from (sales-access.ts `PoolAccess`). */
  pools: PoolAccess;
  /** Add to every `studioClient` where (with `deletedAt: null`). */
  leads: Prisma.StudioClientWhereInput;
  /**
   * The pool this person may list and claim from (leads at scale, owner 12 Oct
   * 2026): unassigned leads in their studio. Reading the pool is a list to
   * claim from; writes still go through `leads` (their own) after a claim.
   */
  pool: Prisma.StudioClientWhereInput;
  /** May take pool leads for themselves (owner, PM, sales). */
  mayClaim: boolean;
  /** Add to every `studioQuote` where. */
  quotes: Prisma.StudioQuoteWhereInput;
  /**
   * The quotations they may CHANGE (sales roles, owner 22 Oct 2026): the
   * ones they see, narrowed to leads within their `quote.write` reach. The
   * same as `quotes` for owner, PM and a Phase 1 salesperson.
   */
  quotesWritable: Prisma.StudioQuoteWhereInput;
  /**
   * Quotation requests (owner, 22 Oct 2026): the leads with an open request
   * given to them to build, when they build quotations and do not already
   * see every lead; null otherwise. For quoting only (`leadForQuote`).
   */
  requested: Prisma.StudioClientWhereInput | null;
  /** `leads`, plus `requested`: the leads they may quote for. */
  quoteLeads: Prisma.StudioClientWhereInput;
}

/** A request given to this member that is still to build (OPEN or IN_PROGRESS). */
const OPEN_REQUEST = ['OPEN', 'IN_PROGRESS'] as const;

/** The signed-in member's lead scope, or null when they may not see leads (or nobody is signed in). */
export async function myLeadScope(): Promise<LeadScope | null> {
  const member = await currentMember();
  return member ? leadScopeFor(member) : null;
}

/** The scope for a member already read (pure apart from the member). Null when they may not see leads. */
export function leadScopeFor(member: StudioMemberRef): LeadScope | null {
  if (!can(member, 'lead.read', { assigned: true })) return null;
  const mayClaim = can(member, 'lead.claim');
  let reach: SalesReach = member.role === 'SALES' ? 'own' : 'all';
  let pools: PoolAccess = !mayClaim ? { kind: 'none' } : member.role === 'SALES' ? STUDIO_POOL_ONLY : { kind: 'all' };
  let team: readonly string[] | null = null;
  if (hasSalesRole(member)) {
    reach = reachOf(member.sales, 'leads.view') ?? 'own';
    pools = poolAccessOf(member.sales);
    team = reach === 'team' ? member.sales.subtree : null;
  }
  const baseQuotes = quotesVisibleTo(member);
  const writeReach = hasSalesRole(member) ? reachOf(member.sales, 'quotes.write') : null;
  const baseWritable: Prisma.StudioQuoteWhereInput =
    !hasSalesRole(member) || (writeReach === 'all' && reach === 'all')
      ? baseQuotes
      : { AND: [baseQuotes, { studioId: member.studioId, client: { AND: [leadsWhereFor(member, 'quote.write')], deletedAt: null } }] };
  /* Quotation requests: a builder who does not see every lead also quotes
     for the leads handed to them. Wrapped in AND so a caller's own OR (a
     search) can never replace it. */
  const builds = reach !== 'all' && can(member, 'quote.build');
  const requested: Prisma.StudioClientWhereInput | null = builds
    ? { studioId: member.studioId, deletedAt: null, quoteRequests: { some: { assignedToId: member.id, status: { in: [...OPEN_REQUEST] } } } }
    : null;
  const finished: Prisma.StudioClientWhereInput = { studioId: member.studioId, quoteRequests: { some: { assignedToId: member.id, status: { in: [...OPEN_REQUEST, 'DONE'] } } } };
  const quotes: Prisma.StudioQuoteWhereInput = builds ? { AND: [{ OR: [baseQuotes, { studioId: member.studioId, client: finished }] }] } : baseQuotes;
  const quotesWritable: Prisma.StudioQuoteWhereInput = requested
    ? { AND: [{ OR: [baseWritable, { studioId: member.studioId, client: requested }] }] }
    : baseWritable;
  const leads = leadsVisibleTo(member);
  return {
    member,
    studioId: member.studioId,
    seesAll: reach === 'all',
    reach,
    team,
    pools,
    leads,
    pool: poolVisibleTo(member),
    mayClaim,
    quotes,
    quotesWritable,
    requested,
    quoteLeads: requested ? { AND: [{ OR: [leads, requested] }] } : leads,
  };
}

/**
 * The leads this scope may take a per-lead action on: what they can see AND
 * the action's own reach (roles.ts `leadsWhereFor`). Every bulk or
 * fenced write uses it, so seeing a lead never alone lets anyone change it.
 */
export function fenceFor(scope: LeadScope, action: LeadWriteAction): Prisma.StudioClientWhereInput {
  return { AND: [scope.leads, leadsWhereFor(scope.member, action), { studioId: scope.studioId }] };
}

/**
 * The signed-in member's lead scope when they may take a studio-level lead
 * action at all (assign, delete, import, merge, export, analytics): the
 * scope, or null. The per-lead fence is still the caller's to apply.
 */
export async function scopeFor(action: StudioAction): Promise<LeadScope | null> {
  const scope = await myLeadScope();
  return scope && can(scope.member, action) ? scope : null;
}

/**
 * The scope the NUMBERS are counted in (sales roles and teams, owner
 * 22 Oct 2026): the dashboard, lead analytics, calling numbers, by campaign.
 * Owner, PM and a Phase 1 salesperson: their lead scope as it is. A sales
 * role: its `analytics.view` reach (team: their subtree's numbers only; all:
 * the studio's); without it, their own numbers. Counts only — the leads
 * behind a number still open through `leads` when tapped.
 */
export function analyticsScope(scope: LeadScope): LeadScope {
  const member = scope.member;
  if (!hasSalesRole(member)) return scope;
  const reach: SalesReach = reachOf(member.sales, 'analytics.view') ?? 'own';
  return {
    ...scope,
    reach,
    seesAll: reach === 'all',
    team: reach === 'team' ? member.sales.subtree : null,
    leads: reachWhere(member.sales, reach, member.studioId),
  };
}

/**
 * A lead as `can()` needs it: its owner and its pool. `requestedOfMe`
 * (quotation requests, owner 22 Oct 2026): read by `leadForQuote`, the lead
 * has an open request given to this member to build.
 */
export type LeadRef = { assignedToId: string | null; poolTeamId?: string | null; requestedOfMe?: boolean };

/**
 * Whether `can()` allows this lead action on this lead, for the scope's
 * member. Pass the lead's `poolTeamId` when it may be unassigned: without
 * it an unassigned lead reads as the studio pool (the narrowest answer).
 */
export function mayOnLead(scope: LeadScope, action: StudioAction, lead: LeadRef): boolean {
  /* Quotation requests: quoting a lead handed to them, whatever their lead reach. Nothing else. */
  if (lead.requestedOfMe === true && action === 'quote.write' && scope.requested !== null && can(scope.member, 'quote.build')) return true;
  const facts: LeadFacts = { assignedToId: lead.assignedToId, poolTeamId: lead.poolTeamId ?? null };
  return can(scope.member, action, { assigned: lead.assignedToId !== null && lead.assignedToId === scope.member.id, lead: facts });
}

/**
 * The one lead, if this scope may see it: the studio's for owner and PM, an
 * assigned one for a salesperson. Null otherwise (never "forbidden": that
 * would confirm the row exists). `LISTED`: the sample has a page too.
 */
export async function leadInScope(scope: LeadScope, clientId: string): Promise<{ id: string; assignedToId: string | null; poolTeamId: string | null; name: string } | null> {
  if (typeof clientId !== 'string' || clientId.length === 0 || clientId.length > 64) return null;
  return prisma.studioClient.findFirst({
    /* A spread is safe here: no sibling OR / AND for a team reach's OR to collide with. */
    where: { ...scope.leads, studioId: scope.studioId, id: clientId, deletedAt: null },
    select: { id: true, assignedToId: true, poolTeamId: true, name: true },
  });
}

/**
 * The one lead, for QUOTING (quotation requests, owner 22 Oct 2026): what
 * `leadInScope` finds, or else a lead with an open request given to this
 * member to build, marked `requestedOfMe` so `mayOnLead` lets
 * `quote.write` through on it (and nothing else). Null otherwise.
 */
export async function leadForQuote(
  scope: LeadScope,
  clientId: string,
): Promise<{ id: string; assignedToId: string | null; poolTeamId: string | null; name: string; requestedOfMe: boolean } | null> {
  const seen = await leadInScope(scope, clientId);
  if (seen) return { ...seen, requestedOfMe: false };
  if (!scope.requested || typeof clientId !== 'string' || clientId.length === 0 || clientId.length > 64) return null;
  const row = await prisma.studioClient.findFirst({
    where: { AND: [scope.requested], studioId: scope.studioId, id: clientId, deletedAt: null },
    select: { id: true, assignedToId: true, poolTeamId: true, name: true },
  });
  return row ? { ...row, requestedOfMe: true } : null;
}

/**
 * The studio id for CHANGING the board's shape and the lead doors: the
 * pipeline, the lead fields, lead sources and "New leads go to"
 * (`lead.settings`: owner, PM, a sales role with "Change lead settings";
 * owner 22 Oct 2026). Null for anyone else.
 */
export async function leadSettingsStudioId(): Promise<string | null> {
  const member = await currentMember();
  return member && can(member, 'lead.settings') ? member.studioId : null;
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
