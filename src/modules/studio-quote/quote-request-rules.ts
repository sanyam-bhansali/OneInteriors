/**
 * Quotation requests, the rules (owner, 22 Oct 2026; docs/studio-os/
 * QUOTE-REQUESTS.md). Pure (CONTRIBUTING §9.5): no Prisma, no `server-only`;
 * quote-requests.ts asks here and writes what it is told, the settings
 * screen asks here what the rule will do. Tested case by case in
 * tests/studio-quote-request-rules.test.ts.
 *
 * ## The owner's brief
 *
 * At Hauspire only Swarupa (Sales head) and Khushi (Sales rep) make
 * quotations. When a salesperson adds a floor plan to a lead, or presses
 * "Request quotation", a request is made and handed out IN TURNS — one to
 * Khushi, the next to Swarupa — so nobody builds the same quotation twice.
 *
 * ## Who builds (the turn order)
 *
 *  - **Default** (the studio's list is empty): every member whose sales
 *    role has "Builds quotations" (`quotes.build`), in the order they joined.
 *    A plain owner is NOT in the turns: the owner has every permission, but
 *    an owner who sells is rare and one who does not would be handed half of
 *    the studio's quotations. (sales-access.ts `buildersOf` counts owners;
 *    this deliberately does not.)
 *  - **"Who builds quotations"** (Settings → Team → Quotations): the owner or
 *    a sales admin lists people in turn order. Anyone on the list must be a
 *    salesperson whose role builds quotations, or an owner — listing the
 *    owner is how an owner who quotes joins the turns.
 *
 * Somebody suspended, invited and not yet in, or whose role lost the
 * permission keeps their PLACE in the order but is skipped; when they are
 * back they get their turns again without anybody else's moving.
 *
 * ## The cursor, and fairness
 *
 * The studio keeps one cursor: the builder the last request went to in turn
 * (`Studio.quoteTurnLastId`). The next request goes to the first builder
 * after them in the order, wrapping round. The cursor moves in the same
 * transaction as the insert, under a row lock, so two floor plans at the
 * same instant go to two different people.
 *
 * A reassignment (a head moving a request from Khushi to Swarupa) never
 * moves the cursor: it is a head's decision about one request, not a turn.
 * So the turns stay exactly as predictable as before — Khushi does not lose
 * her next turn because one of hers was moved, and Swarupa does not skip one
 * because she was handed an extra.
 *
 * ## States
 *
 * OPEN (handed out, not opened yet) → IN_PROGRESS (the builder opened it)
 * → DONE (the quotation was sent, or the builder marked it done). A head
 * may cancel; the lead being lost or put in the bin cancels it too. DONE and
 * CANCELLED are final: a new request is a new row. At most one OPEN or
 * IN_PROGRESS request per lead (a partial unique index); a second floor plan
 * adds itself to the open one.
 */

import { readSalesPermissions } from '@/modules/studio/sales-permissions';

export type QuoteRequestStatusName = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
export type QuoteRequestReasonName = 'FLOOR_PLAN' | 'REQUESTED';

export const ACTIVE_REQUEST_STATUSES: readonly QuoteRequestStatusName[] = ['OPEN', 'IN_PROGRESS'];

export const isActiveRequest = (status: QuoteRequestStatusName): boolean => status === 'OPEN' || status === 'IN_PROGRESS';

export const REQUEST_STATUS_LABELS: Record<QuoteRequestStatusName, string> = {
  OPEN: 'Not opened yet',
  IN_PROGRESS: 'Being built',
  DONE: 'Sent',
  CANCELLED: 'Cancelled',
};

export const REQUEST_REASON_LABELS: Record<QuoteRequestReasonName, string> = {
  FLOOR_PLAN: 'Floor plan added',
  REQUESTED: 'Quotation requested',
};

/** Twenty people building quotations is far more than a studio's sales team. */
export const MAX_BUILDERS = 20;

/** Floor plans kept on one request. A lead with more is a lead to call. */
export const MAX_REQUEST_FILES = 10;

/** One member, as the turns need them. `salesPermissions` is their sales role's stored JSON, or null. */
export interface BuilderMember {
  id: string;
  name: string;
  role: string;
  status: string;
  salesPermissions: unknown;
}

const hasBuildKey = (m: BuilderMember): boolean => m.role === 'SALES' && readSalesPermissions(m.salesPermissions)['quotes.build'] === true;

/**
 * Whether this member may be on the turn list at all, active or not: a
 * salesperson whose role builds quotations, or (only when the studio lists
 * them) an owner.
 */
export function mayBeBuilder(m: BuilderMember, listed: boolean): boolean {
  if (hasBuildKey(m)) return true;
  return listed && m.role === 'OWNER';
}

/** Whether this member gets turns right now. */
export const buildsNow = (m: BuilderMember, listed: boolean): boolean => m.status === 'ACTIVE' && mayBeBuilder(m, listed);

/** The studio's stored list, repaired: strings only, no repeats, capped. */
export function readBuilderIds(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : [];
  return [...new Set(list.filter((v): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64))].slice(0, MAX_BUILDERS);
}

export interface TurnSeat {
  id: string;
  name: string;
  /** Gets a turn now (active, and still allowed to build). */
  eligible: boolean;
}

/**
 * The turn order, every seat in it, eligible or not (a seat keeps its place
 * while its person is away). `members` comes in the order they joined.
 * With a list: the list's order, ids no longer on the team dropped. Without:
 * every salesperson whose role builds quotations, any status.
 */
export function turnOrder(members: readonly BuilderMember[], listedIds: readonly string[]): TurnSeat[] {
  if (listedIds.length > 0) {
    const byId = new Map(members.map((m) => [m.id, m]));
    return listedIds
      .map((id) => byId.get(id))
      .filter((m): m is BuilderMember => !!m && mayBeBuilder(m, true))
      .map((m) => ({ id: m.id, name: m.name, eligible: buildsNow(m, true) }));
  }
  return members.filter((m) => mayBeBuilder(m, false)).map((m) => ({ id: m.id, name: m.name, eligible: buildsNow(m, false) }));
}

/** The people who build quotations now, in turn order. */
export const buildersNow = (members: readonly BuilderMember[], listedIds: readonly string[]): TurnSeat[] => turnOrder(members, listedIds).filter((s) => s.eligible);

/**
 * Whose turn it is: the first eligible seat after `lastId`, wrapping round.
 * A cursor not in the order (never set, or that person left the list) starts
 * from the top. Null when nobody builds quotations now.
 */
export function nextInTurn(order: readonly TurnSeat[], lastId: string | null): TurnSeat | null {
  if (!order.some((s) => s.eligible)) return null;
  const at = lastId ? order.findIndex((s) => s.id === lastId) : -1;
  for (let step = 1; step <= order.length; step++) {
    const seat = order[(at + step + order.length) % order.length]!;
    if (seat.eligible) return seat;
  }
  return null;
}

/**
 * Hand out several requests in a row from one cursor (what the turns do
 * over a day). Each pick moves the cursor; used by the tests and the
 * settings screen's "next up" line.
 */
export function turnsFrom(order: readonly TurnSeat[], lastId: string | null, n: number): { picks: string[]; lastId: string | null } {
  const picks: string[] = [];
  let cursor = lastId;
  for (let i = 0; i < n; i++) {
    const seat = nextInTurn(order, cursor);
    if (!seat) break;
    picks.push(seat.id);
    cursor = seat.id;
  }
  return { picks, lastId: cursor };
}

// ── States ─────────────────────────────────────────────────────

export type QuoteRequestEvent =
  /** The builder opened it. */
  | 'start'
  /** The quotation was sent, or the builder marked it done. */
  | 'done'
  /** A head cancelled it, or the lead was lost or binned. */
  | 'cancel'
  /** A head gave it to another builder: back to not opened. */
  | 'reassign'
  /** Another floor plan on the same lead joined it. */
  | 'extend';

/** The status after `event`, or null when the request cannot take it (DONE and CANCELLED are final). */
export function nextStatus(from: QuoteRequestStatusName, event: QuoteRequestEvent): QuoteRequestStatusName | null {
  if (!isActiveRequest(from)) return null;
  switch (event) {
    case 'start':
      return 'IN_PROGRESS';
    case 'done':
      return 'DONE';
    case 'cancel':
      return 'CANCELLED';
    case 'reassign':
      return 'OPEN';
    case 'extend':
      return from;
  }
}

const FINAL_WORDS: Record<'DONE' | 'CANCELLED', string> = {
  DONE: 'This request is done already.',
  CANCELLED: 'This request was cancelled.',
};

/** Why a request in this status cannot take this event, or null when it can. */
export function refusalFor(from: QuoteRequestStatusName, event: QuoteRequestEvent): string | null {
  if (nextStatus(from, event) !== null) return null;
  return from === 'DONE' || from === 'CANCELLED' ? FINAL_WORDS[from] : 'That cannot be done to this request.';
}

export type ReassignCheck = { ok: true; memberId: string; name: string } | { ok: false; error: string };

/**
 * A head giving a request to someone else: open, to somebody who builds
 * quotations now, and not to the person who has it.
 */
export function checkReassign(input: { status: QuoteRequestStatusName; currentId: string | null; targetId: unknown }, builders: readonly TurnSeat[]): ReassignCheck {
  const refusal = refusalFor(input.status, 'reassign');
  if (refusal) return { ok: false, error: refusal };
  const id = typeof input.targetId === 'string' ? input.targetId : '';
  const seat = builders.find((s) => s.id === id && s.eligible);
  if (!seat) return { ok: false, error: 'Pick someone who builds quotations.' };
  if (seat.id === input.currentId) return { ok: false, error: `${seat.name} has it already.` };
  return { ok: true, memberId: seat.id, name: seat.name };
}

// ── "Who builds quotations" ────────────────────────────────────

export type BuilderListCheck = { ok: true; ids: string[] } | { ok: false; error: string };

/**
 * The list the owner or a sales admin saved. Empty is allowed: it means
 * "everyone whose role builds quotations". Everyone on it must be on the
 * team, active, and a salesperson whose role builds quotations or an owner.
 */
export function checkBuilderIds(input: unknown, members: readonly BuilderMember[]): BuilderListCheck {
  if (!Array.isArray(input)) return { ok: false, error: 'Pick who builds quotations.' };
  const ids = [...new Set(input.filter((v): v is string => typeof v === 'string' && v.length > 0))];
  if (ids.length > MAX_BUILDERS) return { ok: false, error: `${MAX_BUILDERS} people is the most who can take turns.` };
  const byId = new Map(members.map((m) => [m.id, m]));
  for (const id of ids) {
    const m = byId.get(id);
    if (!m) return { ok: false, error: 'Someone on the list is not on your team.' };
    if (!mayBeBuilder(m, true)) return { ok: false, error: `${m.name} cannot build quotations: give their sales role "Builds quotations" first.` };
    if (m.status !== 'ACTIVE') return { ok: false, error: `${m.name} is not active, so cannot take turns.` };
  }
  return { ok: true, ids };
}

/** What the settings screen says the rule does now, in one sentence. */
export function describeBuilders(members: readonly BuilderMember[], listedIds: readonly string[]): string {
  const now = buildersNow(members, listedIds);
  if (now.length === 0) {
    return listedIds.length > 0
      ? 'Nobody on your list can build quotations right now, so requests wait, unassigned, for a head to hand out.'
      : 'Nobody builds quotations yet: give a sales role "Builds quotations", or pick people below. Until then requests wait, unassigned.';
  }
  const names = now.map((s) => s.name);
  if (names.length === 1) return `Every quotation request goes to ${names[0]}.`;
  return `Quotation requests go to ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} in turn.`;
}

// ── Joining an open request ────────────────────────────────────

/** A floor plan joins the open request: kept once, newest last, capped. */
export function withFile(fileIds: readonly string[], fileId: string | null): string[] {
  const list = [...fileIds];
  if (fileId && !list.includes(fileId)) list.push(fileId);
  return list.slice(-MAX_REQUEST_FILES);
}

/**
 * Whether adding a floor plan makes a request by itself, or why not. The
 * button ("Request quotation") is the way round each of these.
 *  - One Interiors introduced the client: their quotation is the final
 *    quote on the lead page, which they sign in the app.
 *  - The lead is booked: the quotation is agreed.
 *  - A quotation was sent already: a new plan is a revision for whoever
 *    is working the lead, not a fresh quotation in turns.
 */
export function autoRequestSkip(lead: { fromOneInteriors: boolean; booked: boolean; sentQuotes: number }): string | null {
  if (lead.fromOneInteriors) return 'One Interiors introduced this client: their quotation is the final quote on the lead page.';
  if (lead.booked) return 'This client is booked.';
  if (lead.sentQuotes > 0) return 'A quotation was sent already. Press "Request quotation" for a new one.';
  return null;
}

// ── Lost and binned leads ──────────────────────────────────────

/**
 * Why an open request on this lead should close by itself, or null. The
 * owner's choice (22 Oct 2026): a lost or binned lead's request is
 * CANCELLED, with the reason, rather than left in someone's "To build".
 * Checked whenever requests are read or made (quote-requests.ts
 * `settleStale`), so every way a lead is lost or binned — the board, a call
 * outcome, bulk, a merge — is covered without a hook in each.
 */
export function staleNote(lead: { deletedAt: Date | null; stageKind: string | null }): string | null {
  if (lead.deletedAt) return 'The lead was put in the bin.';
  if (lead.stageKind === 'LOST') return 'The lead was lost.';
  return null;
}

// ── Words ──────────────────────────────────────────────────────

export interface RequestFacts {
  status: QuoteRequestStatusName;
  assignedName: string | null;
  /** The person looking is the one building it. */
  mine: boolean;
  cancelNote?: string | null;
}

/** The lead page's line: "Quotation being built by Khushi". */
export function requestLine(r: RequestFacts): string {
  const who = r.assignedName ?? 'someone';
  switch (r.status) {
    case 'OPEN':
      if (!r.assignedName) return 'Quotation requested. Nobody builds quotations yet, so a head needs to hand it out.';
      return r.mine ? 'You are to build this quotation. Open it from Quotations, To build.' : `Quotation being built by ${who} (not opened yet).`;
    case 'IN_PROGRESS':
      return r.mine ? 'You are building this quotation.' : `Quotation being built by ${who}.`;
    case 'DONE':
      return r.mine ? 'You sent this quotation.' : `Quotation built and sent by ${who}.`;
    case 'CANCELLED':
      return `Quotation request cancelled${r.cancelNote ? `: ${r.cancelNote.replace(/\.$/, '')}` : ''}.`;
  }
}

/** "Waiting 3 h", for To build and the overview. */
export function waitingFor(since: Date, now: Date): string {
  const mins = Math.max(0, Math.floor((now.getTime() - since.getTime()) / 60_000));
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day' : `${days} days`;
}

/** The answer to "Request quotation", in words. */
export function requestedMessage(r: { created: boolean; assignedName: string | null; mine: boolean }): string {
  if (!r.assignedName) return r.created ? 'Requested. Nobody builds quotations yet, so it waits for a head to hand it out.' : 'A request is open already, waiting for a head to hand it out.';
  if (r.mine) return r.created ? 'Requested. It came to you in turn: it is in Quotations, To build.' : 'You are building this one already.';
  return r.created ? `Requested. ${r.assignedName} builds it (their turn) and has been told.` : `${r.assignedName} is building this one already.`;
}
