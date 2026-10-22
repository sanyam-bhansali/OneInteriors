import 'server-only';

/**
 * Quotation requests, the screens (owner, 22 Oct 2026; docs/studio-os/
 * QUOTE-REQUESTS.md): Quotations → To build (the requests handed to me),
 * the heads' overview with reassign, the lead page's line and its "Request
 * quotation" button, and Settings → Team → Quotations ("Who builds
 * quotations"). The writes other modules call (make, link, close, settle)
 * are in quote-request-store.ts; the rules in quote-request-rules.ts.
 *
 * ## Who may do what
 *
 *  - **Request quotation** on a lead: whoever may work the lead
 *    (`lead.edit` on it): a salesperson on their own leads, a head within
 *    their reach, owner and PM.
 *  - **Open / mark done**: the builder it was handed to. Opening needs no
 *    lead reach: lead-scope.ts lets a builder quote the leads handed to them
 *    (`leadForQuote`, `quotesWritable`), and nothing more.
 *  - **Reassign / cancel**: a head over that lead — anyone with "Give leads
 *    to people" (`lead.assign`) reaching it (team or everyone), the owner and
 *    the PM. Whoever asked may also cancel their own request.
 *  - **Who builds quotations**: the owner, or a sales admin ("Manage the
 *    sales team").
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { currentMember } from '@/modules/studio/access';
import { actingMember, fenceFor, leadForQuote, leadInScope, mayOnLead, myLeadScope, type LeadScope } from '@/modules/studio/lead-scope';
import { can } from '@/modules/studio/roles';
import { record } from '@/modules/studio-practice/events';
import { signedLeadFileLinks } from '@/modules/storage/lead-files';
import { applyConfiguration, createQuote } from './quotes';
import { isConfigName } from './configure';
import {
  ACTIVE_REQUEST_STATUSES,
  REQUEST_REASON_LABELS,
  REQUEST_STATUS_LABELS,
  buildersNow,
  checkBuilderIds,
  checkReassign,
  describeBuilders,
  isActiveRequest,
  mayBeBuilder,
  nextInTurn,
  readBuilderIds,
  refusalFor,
  requestLine,
  requestedMessage,
  turnOrder,
  waitingFor,
  type QuoteRequestReasonName,
  type QuoteRequestStatusName,
} from './quote-request-rules';
import { builderTeam, openQuoteRequest, settleStale, tellBuilder } from './quote-request-store';

export type RequestResult = { ok: true; message: string } | { ok: false; error: string };

const ACTIVE = { in: [...ACTIVE_REQUEST_STATUSES] };
const NOT_YOURS = 'That request is not one of yours.';

const nameOf = (u: { name: string | null; email: string | null; phone?: string | null } | null | undefined): string =>
  u?.name?.trim() || u?.email?.split('@')[0] || u?.phone || 'Someone';

const USER = { select: { name: true, email: true, phone: true } } as const;

const REQUEST_SELECT = {
  id: true,
  status: true,
  reason: true,
  byTurn: true,
  note: true,
  cancelNote: true,
  createdAt: true,
  doneAt: true,
  requestedById: true,
  assignedToId: true,
  requestedBy: { select: { user: USER } },
  assignedTo: { select: { user: USER } },
  quote: { select: { id: true, number: true, status: true, _count: { select: { lines: true } } } },
  client: {
    select: { id: true, name: true, phone: true, society: true, locality: true, config: true, carpetSqft: true, assignedToId: true, poolTeamId: true, assignedTo: { select: { user: USER } } },
  },
} satisfies Prisma.StudioQuoteRequestSelect;

type RequestRow = Prisma.StudioQuoteRequestGetPayload<{ select: typeof REQUEST_SELECT }>;

export interface RequestPlan {
  id: string;
  name: string;
  url: string | null;
  isImage: boolean;
}

export interface RequestView {
  id: string;
  status: QuoteRequestStatusName;
  statusLabel: string;
  reasonLabel: string;
  lead: { id: string; name: string; society: string | null; config: string | null; carpetSqft: number | null; ownerName: string | null };
  plans: RequestPlan[];
  requestedByName: string | null;
  assignedToId: string | null;
  assignedName: string | null;
  byTurn: boolean;
  quote: { id: string; number: string; status: string; lines: number } | null;
  note: string | null;
  cancelNote: string | null;
  createdAt: Date;
  waiting: string;
  doneAt: Date | null;
}

async function plansFor(studioId: string, clientIds: string[]): Promise<Map<string, RequestPlan[]>> {
  const out = new Map<string, RequestPlan[]>();
  if (clientIds.length === 0) return out;
  const rows = await prisma.studioClientFile.findMany({
    where: { studioId, clientId: { in: clientIds }, kind: 'FLOOR_PLAN' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, clientId: true, name: true, storagePath: true, contentType: true },
    take: 300,
  });
  const links = await signedLeadFileLinks(rows.map((r) => r.storagePath));
  for (const r of rows) {
    const list = out.get(r.clientId) ?? [];
    if (list.length < 6) list.push({ id: r.id, name: r.name, url: links.get(r.storagePath) ?? null, isImage: r.contentType.startsWith('image/') });
    out.set(r.clientId, list);
  }
  return out;
}

function viewOf(r: RequestRow, plans: Map<string, RequestPlan[]>, now: Date): RequestView {
  return {
    id: r.id,
    status: r.status,
    statusLabel: REQUEST_STATUS_LABELS[r.status],
    reasonLabel: REQUEST_REASON_LABELS[r.reason as QuoteRequestReasonName],
    lead: {
      id: r.client.id,
      name: r.client.name,
      society: r.client.society ?? r.client.locality,
      config: r.client.config,
      carpetSqft: r.client.carpetSqft,
      ownerName: r.client.assignedTo ? nameOf(r.client.assignedTo.user) : null,
    },
    plans: plans.get(r.client.id) ?? [],
    requestedByName: r.requestedBy ? nameOf(r.requestedBy.user) : null,
    assignedToId: r.assignedToId,
    assignedName: r.assignedTo ? nameOf(r.assignedTo.user) : null,
    byTurn: r.byTurn,
    quote: r.quote ? { id: r.quote.id, number: r.quote.number, status: r.quote.status, lines: r.quote._count.lines } : null,
    note: r.note,
    cancelNote: r.cancelNote,
    createdAt: r.createdAt,
    waiting: waitingFor(r.createdAt, now),
    doneAt: r.doneAt,
  };
}

// ── To build ───────────────────────────────────────────────────

/** The requests handed to the signed-in member, oldest first (the one waiting longest is next). */
export async function myQuoteRequests(): Promise<RequestView[]> {
  const member = await currentMember();
  if (!member || member.status !== 'ACTIVE') return [];
  try {
    await settleStale(member.studioId);
    const rows = await prisma.studioQuoteRequest.findMany({
      where: { studioId: member.studioId, assignedToId: member.id, status: ACTIVE, client: { deletedAt: null } },
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: REQUEST_SELECT,
    });
    const plans = await plansFor(member.studioId, [...new Set(rows.map((r) => r.client.id))]);
    const now = new Date();
    return rows.map((r) => viewOf(r, plans, now));
  } catch (error) {
    console.error('[quote-requests] mine failed', error instanceof Error ? error.name : 'unknown');
    return [];
  }
}

/** Whether this scope oversees requests at all: owner, PM, a head who gives leads to people. */
const oversees = (scope: LeadScope): boolean => can(scope.member, 'lead.assign');

export interface RequestsOverview {
  /** Open, oldest first. */
  open: RequestView[];
  /** Done or cancelled in the last fortnight, newest first. */
  recent: RequestView[];
  /** Who a request may be given to now, in turn order. */
  builders: { id: string; name: string }[];
  /** Who is up next in turn. */
  nextUp: string | null;
  rule: string;
}

/**
 * The heads' "Requests": every request on a lead within their reach to give
 * leads out (owner and PM: the studio), with who builds quotations, for
 * reassigning. Null for anyone who does not oversee.
 */
export async function requestsOverview(): Promise<RequestsOverview | null> {
  const scope = await myLeadScope();
  if (!scope || !oversees(scope)) return null;
  const studioId = scope.studioId;
  try {
    await settleStale(studioId);
    const fence = fenceFor(scope, 'lead.assign');
    const since = new Date(Date.now() - 14 * 86_400_000);
    const [open, recent, team, studio] = await Promise.all([
      prisma.studioQuoteRequest.findMany({ where: { studioId, status: ACTIVE, client: { AND: [fence] } }, orderBy: { createdAt: 'asc' }, take: 200, select: REQUEST_SELECT }),
      prisma.studioQuoteRequest.findMany({
        where: { studioId, status: { in: ['DONE', 'CANCELLED'] }, updatedAt: { gte: since }, client: { AND: [fence] } },
        orderBy: { updatedAt: 'desc' },
        take: 50,
        select: REQUEST_SELECT,
      }),
      builderTeam(studioId),
      prisma.studio.findUnique({ where: { id: studioId }, select: { quoteBuilderIds: true, quoteTurnLastId: true } }),
    ]);
    const plans = await plansFor(studioId, [...new Set(open.map((r) => r.client.id))]);
    const now = new Date();
    const listed = readBuilderIds(studio?.quoteBuilderIds);
    const order = turnOrder(team, listed);
    return {
      open: open.map((r) => viewOf(r, plans, now)),
      recent: recent.map((r) => viewOf(r, new Map(), now)),
      builders: order.filter((s) => s.eligible).map((s) => ({ id: s.id, name: s.name })),
      nextUp: nextInTurn(order, studio?.quoteTurnLastId ?? null)?.name ?? null,
      rule: describeBuilders(team, listed),
    };
  } catch (error) {
    console.error('[quote-requests] overview failed', error instanceof Error ? error.name : 'unknown');
    return null;
  }
}

// ── The lead page ──────────────────────────────────────────────

export interface LeadRequestState {
  /** The open request, else the newest one (or null: none ever). */
  request: { id: string; status: QuoteRequestStatusName; line: string; waiting: string; assignedToId: string | null; quoteId: string | null } | null;
  may: { request: boolean; reassign: boolean; cancel: boolean; done: boolean };
  builders: { id: string; name: string }[];
}

/** The lead page's quotation-request line and buttons. Null when the person may not see the lead. */
export async function leadRequestState(clientId: string): Promise<LeadRequestState | null> {
  const scope = await myLeadScope();
  if (!scope) return null;
  const lead = await leadInScope(scope, String(clientId ?? ''));
  if (!lead) return null;
  const studioId = scope.studioId;
  try {
    await settleStale(studioId);
    const [row, facts] = await Promise.all([
      prisma.studioQuoteRequest.findFirst({
        where: { studioId, clientId: lead.id },
        orderBy: [{ createdAt: 'desc' }],
        select: { id: true, status: true, createdAt: true, assignedToId: true, requestedById: true, quoteId: true, cancelNote: true, assignedTo: { select: { user: USER } } },
      }),
      prisma.studioClient.findFirst({ where: { id: lead.id, studioId }, select: { introductionId: true, source: true } }),
    ]);
    const fromOneInteriors = facts ? facts.introductionId !== null || facts.source === 'ONE_INTERIORS' : false;
    const active = row ? isActiveRequest(row.status) : false;
    const mayAssign = mayOnLead(scope, 'lead.assign', lead);
    const mine = row?.assignedToId === scope.member.id;
    let builders: { id: string; name: string }[] = [];
    if (mayAssign && active) {
      const [team, studio] = await Promise.all([builderTeam(studioId), prisma.studio.findUnique({ where: { id: studioId }, select: { quoteBuilderIds: true } })]);
      builders = buildersNow(team, readBuilderIds(studio?.quoteBuilderIds)).map((s) => ({ id: s.id, name: s.name }));
    }
    return {
      request: row
        ? {
            id: row.id,
            status: row.status,
            line: requestLine({ status: row.status, assignedName: row.assignedTo ? nameOf(row.assignedTo.user) : null, mine, cancelNote: row.cancelNote }),
            waiting: waitingFor(row.createdAt, new Date()),
            assignedToId: row.assignedToId,
            quoteId: row.quoteId,
          }
        : null,
      may: {
        request: !active && !fromOneInteriors && mayOnLead(scope, 'lead.edit', lead),
        reassign: active && mayAssign,
        cancel: active && (mayAssign || row?.requestedById === scope.member.id),
        done: active && (mine || mayAssign),
      },
      builders,
    };
  } catch (error) {
    console.error('[quote-requests] lead state failed', error instanceof Error ? error.name : 'unknown');
    return null;
  }
}

/** "Request quotation" on the lead. */
export async function requestQuotation(clientId: string, note: unknown): Promise<RequestResult> {
  const scope = await myLeadScope();
  if (!scope) return { ok: false, error: 'Sign in as your studio first.' };
  const lead = await leadInScope(scope, String(clientId ?? ''));
  if (!lead) return { ok: false, error: 'That lead is not one of yours.' };
  if (!mayOnLead(scope, 'lead.edit', lead)) return { ok: false, error: 'Your role in the studio does not include that. Ask your studio owner.' };
  const facts = await prisma.studioClient.findFirst({ where: { id: lead.id, studioId: scope.studioId }, select: { introductionId: true, source: true } });
  if (facts && (facts.introductionId !== null || facts.source === 'ONE_INTERIORS')) {
    return { ok: false, error: 'One Interiors introduced this client: use "Make the final quote" on this page, so they can read and sign it in the app.' };
  }
  const by = await actingMember();
  const r = await openQuoteRequest({ studioId: scope.studioId, clientId: lead.id, reason: 'REQUESTED', by, note: typeof note === 'string' ? note : null });
  if (!r.ok) return r;
  return { ok: true, message: requestedMessage({ created: r.created, assignedName: r.assignedName, mine: r.assignedToId === scope.member.id }) };
}

// ── The builder's buttons ──────────────────────────────────────

async function loadRequest(id: string, studioId: string) {
  if (typeof id !== 'string' || id.length === 0 || id.length > 64) return null;
  return prisma.studioQuoteRequest.findFirst({
    where: { id, studioId },
    select: {
      id: true,
      status: true,
      assignedToId: true,
      requestedById: true,
      quoteId: true,
      clientId: true,
      quote: { select: { id: true } },
      client: { select: { id: true, name: true, assignedToId: true, poolTeamId: true } },
    },
  });
}

/**
 * The builder opens a request: it becomes IN_PROGRESS, and they land in the
 * builder on its draft — the first quote built from the floor plan when
 * there is one, else a draft made now from the lead (and its read plan),
 * exactly as "New quotation" on the lead makes it.
 */
export async function startRequest(requestId: string): Promise<{ ok: true; quoteId: string } | { ok: false; error: string }> {
  const scope = await myLeadScope();
  if (!scope) return { ok: false, error: 'Sign in as your studio first.' };
  const req = await loadRequest(String(requestId ?? ''), scope.studioId);
  if (!req || req.assignedToId !== scope.member.id) return { ok: false, error: NOT_YOURS };
  const refusal = refusalFor(req.status, 'start');
  if (refusal) return { ok: false, error: refusal };

  let quoteId = req.quote?.id ?? null;
  if (!quoteId) {
    const made = await draftFor(scope, req.clientId);
    if (!made.ok) return made;
    quoteId = made.id;
  }
  await prisma.studioQuoteRequest.updateMany({
    where: { id: req.id, status: ACTIVE },
    data: { status: 'IN_PROGRESS', quoteId },
  });
  return { ok: true, quoteId };
}

/** A draft for the request's lead, filled from the lead and its newest read floor plan (leads.ts `newQuoteForLead`, for a builder). */
async function draftFor(scope: LeadScope, clientId: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const found = await leadForQuote(scope, clientId);
  if (!found || !mayOnLead(scope, 'quote.write', found)) return { ok: false, error: 'That lead is not one of yours.' };
  const studioId = scope.studioId;
  const lead = await prisma.studioClient.findFirst({
    where: { id: found.id, studioId, deletedAt: null },
    select: { id: true, name: true, phone: true, email: true, society: true, config: true, carpetSqft: true },
  });
  if (!lead) return { ok: false, error: 'That lead is not one of yours.' };
  const plan = await prisma.studioClientFile
    .findFirst({ where: { studioId, clientId: lead.id, kind: 'FLOOR_PLAN', reading: { not: Prisma.AnyNull } }, orderBy: { createdAt: 'desc' }, select: { id: true, reading: true } })
    .catch(() => null);
  const reading = (plan?.reading ?? null) as { bathrooms?: number; kitchenRunMm?: number | null; bedrooms?: number; carpetAreaSqft?: number | null; hasStudy?: boolean } | null;
  const config = lead.config ?? (reading?.bedrooms ? `${Math.min(4, Math.max(1, reading.bedrooms))} BHK` : null);
  const created = await createQuote({
    clientName: lead.name,
    clientPhone: lead.phone ?? undefined,
    society: lead.society ?? undefined,
    config: config ?? undefined,
    carpetSqft: lead.carpetSqft ?? reading?.carpetAreaSqft ?? undefined,
    clientId: lead.id,
  });
  if (!created.ok) return created;
  if (lead.email) await prisma.studioQuote.updateMany({ where: { id: created.id, studioId }, data: { clientEmail: lead.email } });
  if (plan && reading) {
    await prisma.studioQuotePlan.upsert({ where: { quoteId: created.id }, create: { quoteId: created.id, studioId, fileId: plan.id }, update: { fileId: plan.id } });
  }
  if (isConfigName(config)) {
    await applyConfiguration({
      quoteId: created.id,
      home: {
        config,
        kitchenRunMm: reading?.kitchenRunMm ?? null,
        bathrooms: reading?.bathrooms ?? (config === '1 BHK' ? 1 : 2),
        study: reading?.hasStudy === true,
        usePlan: reading !== null,
      },
    });
  }
  return { ok: true, id: created.id };
}

/** Whether the signed-in person heads this request's lead (reassign, cancel, mark done for someone). */
function headsIt(scope: LeadScope, client: { assignedToId: string | null; poolTeamId: string | null }): boolean {
  return mayOnLead(scope, 'lead.assign', client);
}

/** "Mark done": the builder (or a head) closes it without sending from here — sent by hand, or not needed. */
export async function finishRequest(requestId: string): Promise<RequestResult> {
  const scope = await myLeadScope();
  if (!scope) return { ok: false, error: 'Sign in as your studio first.' };
  const req = await loadRequest(String(requestId ?? ''), scope.studioId);
  if (!req || (req.assignedToId !== scope.member.id && !headsIt(scope, req.client))) return { ok: false, error: NOT_YOURS };
  const refusal = refusalFor(req.status, 'done');
  if (refusal) return { ok: false, error: refusal };
  const { count } = await prisma.studioQuoteRequest.updateMany({ where: { id: req.id, status: ACTIVE }, data: { status: 'DONE', doneAt: new Date() } });
  if (count === 0) return { ok: false, error: 'This request changed meanwhile. Refresh and look again.' };
  const by = await actingMember();
  await record({ studioId: scope.studioId, clientId: req.clientId, kind: 'QUOTED', summary: `Quotation request marked done${by ? ` by ${by.name}` : ''}`, meta: { quoteRequestId: req.id } });
  return { ok: true, message: 'Marked done.' };
}

/** A head gives a request to another builder. The turn cursor does not move (quote-request-rules.ts, "fairness"). */
export async function reassignRequest(requestId: string, memberId: unknown): Promise<RequestResult> {
  const scope = await myLeadScope();
  if (!scope) return { ok: false, error: 'Sign in as your studio first.' };
  const studioId = scope.studioId;
  const req = await loadRequest(String(requestId ?? ''), studioId);
  if (!req || !headsIt(scope, req.client)) return { ok: false, error: 'Only a head over this lead can hand its quotation to someone else.' };
  const [team, studio] = await Promise.all([builderTeam(studioId), prisma.studio.findUnique({ where: { id: studioId }, select: { quoteBuilderIds: true } })]);
  const check = checkReassign({ status: req.status, currentId: req.assignedToId, targetId: memberId }, buildersNow(team, readBuilderIds(studio?.quoteBuilderIds)));
  if (!check.ok) return check;
  const { count } = await prisma.studioQuoteRequest.updateMany({
    where: { id: req.id, status: ACTIVE, assignedToId: req.assignedToId },
    data: { assignedToId: check.memberId, status: 'OPEN', byTurn: false },
  });
  if (count === 0) return { ok: false, error: 'This request changed meanwhile. Refresh and look again.' };
  const by = await actingMember();
  await record({ studioId, clientId: req.clientId, kind: 'QUOTED', summary: `Quotation request handed to ${check.name}${by ? ` by ${by.name}` : ''}`, meta: { quoteRequestId: req.id, assignedToId: check.memberId } });
  if (check.memberId !== by?.id) await tellBuilder(check.memberId, { clientId: req.clientId, name: req.client.name, by: by?.name ?? null, how: 'REASSIGNED', why: 'REQUESTED' });
  return { ok: true, message: `${check.name} builds it now, and has been told.` };
}

/** A head (or whoever asked) cancels a request. */
export async function cancelRequest(requestId: string): Promise<RequestResult> {
  const scope = await myLeadScope();
  if (!scope) return { ok: false, error: 'Sign in as your studio first.' };
  const req = await loadRequest(String(requestId ?? ''), scope.studioId);
  if (!req || (!headsIt(scope, req.client) && req.requestedById !== scope.member.id)) return { ok: false, error: NOT_YOURS };
  const refusal = refusalFor(req.status, 'cancel');
  if (refusal) return { ok: false, error: refusal };
  const by = await actingMember();
  const why = by ? `Cancelled by ${by.name}.` : 'Cancelled.';
  const { count } = await prisma.studioQuoteRequest.updateMany({ where: { id: req.id, status: ACTIVE }, data: { status: 'CANCELLED', cancelNote: why, doneAt: new Date() } });
  if (count === 0) return { ok: false, error: 'This request changed meanwhile. Refresh and look again.' };
  await record({ studioId: scope.studioId, clientId: req.clientId, kind: 'QUOTED', summary: 'Quotation request cancelled', meta: { quoteRequestId: req.id } });
  return { ok: true, message: 'Request cancelled.' };
}

// ── Settings → Team → Quotations ───────────────────────────────

export interface BuildersSettings {
  may: boolean;
  /** The studio's list (turn order); empty = everyone whose role builds quotations. */
  listed: string[];
  /** Everyone who could be on the list. `byRole`: in the turns by default (their sales role builds quotations). */
  candidates: { id: string; name: string; role: string; active: boolean; byRole: boolean }[];
  rule: string;
  nextUp: string | null;
}

/** Settings → Team → Quotations. Owner or a sales admin. */
export async function buildersSettings(): Promise<BuildersSettings | null> {
  const member = await currentMember();
  if (!member || member.status !== 'ACTIVE') return null;
  const may = can(member, 'team.manage') || can(member, 'team.sales');
  if (!may) return null;
  const [team, studio] = await Promise.all([
    builderTeam(member.studioId),
    prisma.studio.findUnique({ where: { id: member.studioId }, select: { quoteBuilderIds: true, quoteTurnLastId: true } }),
  ]);
  const listed = readBuilderIds(studio?.quoteBuilderIds);
  return {
    may,
    listed,
    candidates: team.filter((m) => mayBeBuilder(m, true)).map((m) => ({ id: m.id, name: m.name, role: m.role, active: m.status === 'ACTIVE', byRole: mayBeBuilder(m, false) })),
    rule: describeBuilders(team, listed),
    nextUp: nextInTurn(turnOrder(team, listed), studio?.quoteTurnLastId ?? null)?.name ?? null,
  };
}

/** Save "Who builds quotations": the turn order, or empty for everyone whose role builds quotations. */
export async function saveBuilders(ids: unknown): Promise<RequestResult> {
  const member = await currentMember();
  if (!member || !(can(member, 'team.manage') || can(member, 'team.sales'))) return { ok: false, error: 'Only your studio owner or a sales admin decides who builds quotations.' };
  const team = await builderTeam(member.studioId);
  const check = checkBuilderIds(ids, team);
  if (!check.ok) return check;
  await prisma.studio.update({ where: { id: member.studioId }, data: { quoteBuilderIds: check.ids } });
  return { ok: true, message: check.ids.length === 0 ? 'Saved. Everyone whose role builds quotations takes turns.' : `Saved. ${describeBuilders(team, check.ids)}` };
}
