import 'server-only';

/**
 * Quotation requests, the writes other modules call (owner, 22 Oct 2026;
 * docs/studio-os/QUOTE-REQUESTS.md): make or extend a request and hand it
 * out in turns, link a new draft to it, close it when the quotation is
 * sent, and cancel the ones whose lead was lost or binned. The rules are
 * pure, in quote-request-rules.ts.
 *
 * Kept apart from quote-requests.ts (the screens' reads and actions) so
 * quotes.ts and leads.ts can call these without an import cycle: nothing
 * here imports quotes.ts.
 *
 * None of these checks who is asking: every caller has already checked the
 * lead or the quotation is theirs to act on. Each never throws: a floor plan
 * that could not make its request is still attached, a quotation whose
 * request could not close was still sent.
 *
 * Notifications go to studio staff only (notify/service.ts `notify`, to a
 * member's own account). A customer never hears of a request.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { notify } from '@/modules/notify/service';
import { record } from '@/modules/studio-practice/events';
import {
  ACTIVE_REQUEST_STATUSES,
  nextInTurn,
  readBuilderIds,
  staleNote,
  turnOrder,
  withFile,
  type BuilderMember,
  type QuoteRequestReasonName,
} from './quote-request-rules';

type Db = Prisma.TransactionClient | typeof prisma;

const ACTIVE = { in: [...ACTIVE_REQUEST_STATUSES] };

const nameOf = (u: { name: string | null; email: string | null; phone?: string | null } | null | undefined): string =>
  u?.name?.trim() || u?.email?.split('@')[0] || u?.phone || 'Someone';

/** The studio's team, as the turns need it, in the order they joined. */
export async function builderTeam(studioId: string, db: Db = prisma): Promise<BuilderMember[]> {
  const rows = await db.studioMember.findMany({
    where: { studioId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, role: true, status: true, salesRole: { select: { permissions: true } }, user: { select: { name: true, email: true, phone: true } } },
  });
  return rows.map((r) => ({ id: r.id, name: nameOf(r.user), role: r.role, status: r.status, salesPermissions: r.salesRole?.permissions ?? null }));
}

export interface OpenRequestInput {
  studioId: string;
  clientId: string;
  reason: QuoteRequestReasonName;
  /** The member who added the plan or pressed the button. */
  by: { id: string; name: string } | null;
  /** The floor plan that came with it (FLOOR_PLAN). */
  fileId?: string | null;
  note?: string | null;
}

export type OpenRequestResult =
  | { ok: true; created: boolean; requestId: string; assignedToId: string | null; assignedName: string | null }
  | { ok: false; error: string };

const isUniqueClash = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

/**
 * Make the lead's request, or add to the open one. A new request goes to
 * whoever's turn it is: the studio row is locked (SELECT … FOR UPDATE), the
 * next builder after the cursor is picked, the request inserted and the
 * cursor moved, all in one transaction — so two at once go to two people.
 * The partial unique index (one open request per lead) catches two presses
 * on the same lead; the loser joins the winner's request.
 */
export async function openQuoteRequest(input: OpenRequestInput): Promise<OpenRequestResult> {
  const { studioId, clientId } = input;
  try {
    const lead = await prisma.studioClient.findFirst({
      where: { id: clientId, studioId },
      select: { id: true, name: true, deletedAt: true, isDemo: true, stage: { select: { kind: true } } },
    });
    if (!lead) return { ok: false, error: 'That lead is not one of yours.' };
    /* The sample lead is for trying things: nobody is handed a real request for it. */
    if (lead.isDemo) return { ok: false, error: 'This is the sample lead: quotation requests are for real leads.' };
    const stale = staleNote({ deletedAt: lead.deletedAt, stageKind: lead.stage?.kind ?? null });
    if (stale) return { ok: false, error: `${stale.replace(/\.$/, '')}, so there is no quotation to build.` };
    await settleStale(studioId);

    const note = typeof input.note === 'string' ? input.note.trim().replace(/\s+/g, ' ').slice(0, 300) || null : null;
    const fileId = typeof input.fileId === 'string' && input.fileId ? input.fileId : null;

    const run = () =>
      prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "studios" WHERE "id" = ${studioId} FOR UPDATE`;
        const open = await tx.studioQuoteRequest.findFirst({
          where: { studioId, clientId, status: ACTIVE },
          select: { id: true, fileIds: true, note: true, assignedToId: true, assignedTo: { select: { user: { select: { name: true, email: true, phone: true } } } } },
        });
        if (open) {
          const files = withFile(open.fileIds, fileId);
          if (files.length !== open.fileIds.length || (note && !open.note)) {
            await tx.studioQuoteRequest.update({ where: { id: open.id }, data: { fileIds: files, ...(note && !open.note ? { note } : {}) } });
          }
          return { created: false, requestId: open.id, assignedToId: open.assignedToId, assignedName: open.assignedTo ? nameOf(open.assignedTo.user) : null };
        }
        const studio = await tx.studio.findUnique({ where: { id: studioId }, select: { quoteBuilderIds: true, quoteTurnLastId: true } });
        const order = turnOrder(await builderTeam(studioId, tx), readBuilderIds(studio?.quoteBuilderIds));
        const next = nextInTurn(order, studio?.quoteTurnLastId ?? null);
        const draft = await tx.studioQuote.findFirst({ where: { studioId, clientId, status: 'DRAFT' }, orderBy: { updatedAt: 'desc' }, select: { id: true } });
        const row = await tx.studioQuoteRequest.create({
          data: {
            studioId,
            clientId,
            reason: input.reason,
            requestedById: input.by?.id ?? null,
            assignedToId: next?.id ?? null,
            byTurn: true,
            quoteId: draft?.id ?? null,
            fileIds: withFile([], fileId),
            note,
          },
          select: { id: true },
        });
        if (next) await tx.studio.update({ where: { id: studioId }, data: { quoteTurnLastId: next.id } });
        return { created: true, requestId: row.id, assignedToId: next?.id ?? null, assignedName: next?.name ?? null };
      });

    let done: Awaited<ReturnType<typeof run>>;
    try {
      done = await run();
    } catch (error) {
      if (!isUniqueClash(error)) throw error;
      done = await run();
    }

    if (done.created) {
      await record({
        studioId,
        clientId,
        kind: 'QUOTED',
        summary: done.assignedName
          ? `Quotation requested (${input.reason === 'FLOOR_PLAN' ? 'floor plan added' : 'asked for'}): ${done.assignedName} builds it, in turn`
          : 'Quotation requested: nobody builds quotations yet, so it waits for a head to hand it out',
        meta: { quoteRequestId: done.requestId, assignedToId: done.assignedToId },
        ...(input.by ? { by: input.by } : {}),
      });
      if (done.assignedToId && done.assignedToId !== input.by?.id) {
        await tellBuilder(done.assignedToId, { clientId, name: lead.name, by: input.by?.name ?? null, how: 'TURN', why: input.reason });
      }
    }
    return { ok: true, ...done };
  } catch (error) {
    console.error('[quote-requests] open failed', error instanceof Error ? error.name : 'unknown');
    return { ok: false, error: 'The request did not save. Try again.' };
  }
}

/** Tell a builder a request is theirs: their inbox (and push or email), never a customer. */
export async function tellBuilder(
  memberId: string,
  e: { clientId: string; name: string; by: string | null; how: 'TURN' | 'REASSIGNED'; why: QuoteRequestReasonName },
): Promise<void> {
  const to = await prisma.studioMember.findUnique({ where: { id: memberId }, select: { userId: true, status: true } }).catch(() => null);
  if (!to || to.status !== 'ACTIVE') return;
  await notify(to.userId, { kind: 'quote-request', clientId: e.clientId, name: e.name, by: e.by, how: e.how, why: e.why });
}

/**
 * A draft quotation was just made for this lead (the floor plan's first
 * quote, "New quotation", the First quote page): the open request without a
 * draft builds on it. Called by quotes.ts `createQuote`.
 */
export async function linkDraftToRequest(studioId: string, clientId: string, quoteId: string): Promise<void> {
  try {
    await prisma.studioQuoteRequest.updateMany({ where: { studioId, clientId, status: ACTIVE, quoteId: null }, data: { quoteId } });
  } catch (error) {
    console.error('[quote-requests] link draft failed', error instanceof Error ? error.name : 'unknown');
  }
}

/**
 * The quotation was sent (quotes.ts `setQuoteStatus` → ISSUED, or "Send
 * again"): the lead's open request is DONE, with this quotation on it, and
 * whoever asked is told (unless they sent it themselves).
 */
export async function completeRequestForQuote(studioId: string, quoteId: string, by: { id: string; name: string } | null): Promise<void> {
  try {
    const quote = await prisma.studioQuote.findFirst({ where: { id: quoteId, studioId }, select: { clientId: true, number: true } });
    if (!quote?.clientId) return;
    const open = await prisma.studioQuoteRequest.findFirst({
      where: { studioId, clientId: quote.clientId, status: ACTIVE },
      select: { id: true, requestedById: true, client: { select: { name: true } } },
    });
    if (!open) return;
    const { count } = await prisma.studioQuoteRequest.updateMany({
      where: { id: open.id, status: ACTIVE },
      data: { status: 'DONE', quoteId, doneAt: new Date() },
    });
    if (count === 0) return;
    await record({
      studioId,
      clientId: quote.clientId,
      kind: 'QUOTED',
      summary: `Quotation request done: ${quote.number} sent${by ? ` by ${by.name}` : ''}`,
      meta: { quoteRequestId: open.id, quoteId },
      ...(by ? { by } : {}),
    });
    if (open.requestedById && open.requestedById !== by?.id) {
      const to = await prisma.studioMember.findUnique({ where: { id: open.requestedById }, select: { userId: true, status: true } });
      if (to?.status === 'ACTIVE') {
        await notify(to.userId, { kind: 'quote-request-done', clientId: quote.clientId, name: open.client.name, by: by?.name ?? null, number: quote.number });
      }
    }
  } catch (error) {
    console.error('[quote-requests] complete failed', error instanceof Error ? error.name : 'unknown');
  }
}

/**
 * Cancel the studio's open requests whose lead was lost or put in the bin,
 * with the reason. Run whenever requests are read or made, so every way a
 * lead is lost or binned is covered (quote-request-rules.ts `staleNote`).
 * A lead restored from the bin keeps its cancelled request; the salesperson
 * presses "Request quotation" again.
 */
export async function settleStale(studioId: string): Promise<void> {
  try {
    const rows = await prisma.studioQuoteRequest.findMany({
      where: { studioId, status: ACTIVE, client: { OR: [{ deletedAt: { not: null } }, { stage: { kind: 'LOST' } }] } },
      select: { id: true, clientId: true, client: { select: { deletedAt: true, stage: { select: { kind: true } } } } },
      take: 200,
    });
    for (const r of rows) {
      const why = staleNote({ deletedAt: r.client.deletedAt, stageKind: r.client.stage?.kind ?? null });
      if (!why) continue;
      const { count } = await prisma.studioQuoteRequest.updateMany({ where: { id: r.id, status: ACTIVE }, data: { status: 'CANCELLED', cancelNote: why, doneAt: new Date() } });
      if (count > 0) await record({ studioId, clientId: r.clientId, kind: 'QUOTED', summary: `Quotation request cancelled: ${why.replace(/\.$/, '').toLowerCase()}`, by: null });
    }
  } catch (error) {
    console.error('[quote-requests] settle failed', error instanceof Error ? error.name : 'unknown');
  }
}

/** How many requests this member has to build, for the To build tab's badge. Lost and binned leads do not count. */
export async function toBuildCount(member: { id: string; studioId: string }): Promise<number> {
  try {
    return await prisma.studioQuoteRequest.count({
      where: { studioId: member.studioId, assignedToId: member.id, status: ACTIVE, client: { deletedAt: null, stage: { kind: { not: 'LOST' } } } },
    });
  } catch {
    return 0;
  }
}
