import 'server-only';

/**
 * Convert a lead (owner, 13 Nov 2026): "whenever the salesperson marks it as
 * converted they should have a mandatory requirement of selecting sales final
 * quotation and handover to design notes in detail, then once they move it a
 * new project should be created and Renuka needs to then assign it to a
 * designer." The rules are in `convert-rules.ts`.
 *
 * Who: whoever may mark a sales final on this lead (`quote.salesFinal`,
 * per lead: a salesperson on their own lead, PM and owner on any).
 *
 * What happens, in one transaction:
 *  1. the project is created from the sales final (its total and payment
 *     stages), exactly as Record booking builds it (`startOwnProject`);
 *  2. the handover becomes the sales notes the design tab shows;
 *  3. the lead is marked converted (`bookedIntroductionId`, `bookedAt`, the
 *     column it came from) and moved to the won column, with a timeline line.
 * No payment is written: the ₹25,000 booking advance is recorded later by
 * accounts, as the project's first payment (owner's choice, 13 Nov 2026).
 * Then the design head is told the project needs a designer (in the app and
 * by email); with no design head, the owner and PMs are told.
 */

import { prisma } from '@/lib/prisma';
import { fromDb } from '@/lib/money';
import { ACCESS_ERRORS } from '@/modules/studio/access';
import { myLeadScope, mayOnLead, actingMember } from '@/modules/studio/lead-scope';
import { startOwnProject, istToday } from '@/modules/project/own-project';
import { recordEvent } from '@/modules/project/events';
import { record } from '@/modules/studio-practice/events';
import { notify, notifyStudio } from '@/modules/notify/service';
import { readRevisionLines, readRevisionTerms, revisionLabel } from './revision-rules';
import { QUOTE_FOR_REVISION, markSalesFinal, restoreRevision, sameAsRevision } from './revisions';
import { readStages, scheduleAmounts, templateOrDefault } from './payment-template';
import { queueConversions } from './conversions';
import { bookingRefusal } from './booking-rules';
import { BOOKING_QUOTE, factsFor, firstWonStage } from './booking';
import { checkHandover } from './convert-rules';

export interface ConvertRevision {
  n: number;
  label: string;
  totalPaise: number;
  /** "12 Nov", when it was sent. */
  sentLabel: string;
  isSalesFinal: boolean;
}

export interface ConvertQuote {
  quoteId: string;
  number: string;
  /** Every revision sent, oldest first, with its final value. */
  revisions: ConvertRevision[];
  /** Why no revision of this quotation can be picked, if none can. */
  blocked: string | null;
}

export interface ConvertScreen {
  name: string;
  quotes: ConvertQuote[];
  /** What is picked when the dialog opens: the sales final if there is one, else the newest revision. */
  picked: { quoteId: string; n: number } | null;
  /** The notes written with a sales final, to start the handover from. */
  notes: string;
  /** Why the lead cannot be converted at all (no quotation sent, no mobile). */
  blocked: string | null;
}

const LEAD_SELECT = {
  id: true,
  name: true,
  phone: true,
  email: true,
  stageId: true,
  assignedToId: true,
  poolTeamId: true,
  bookedAt: true,
  deletedAt: true,
} as const;

async function leadFor(clientId: unknown) {
  const scope = await myLeadScope();
  if (!scope || typeof clientId !== 'string' || clientId.length > 64) return null;
  const lead = await prisma.studioClient.findFirst({ where: { AND: [scope.leads, { id: clientId, studioId: scope.studioId, deletedAt: null }] }, select: LEAD_SELECT });
  if (!lead || !mayOnLead(scope, 'quote.salesFinal', lead)) return null;
  return { scope, lead };
}

const day = (d: Date) => d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' });

/**
 * Why a quotation cannot be converted on, whatever revision is picked
 * (owner, 14 Nov 2026: any revision may be picked; the sales final is set
 * from it, so "no sales final" and "changed since" no longer apply).
 */
function quoteRefusal(facts: Awaited<ReturnType<typeof factsFor>>, stage: string): string | null {
  if (stage === 'DESIGN') return 'This is a design quotation; convert on a sales quotation.';
  return bookingRefusal({ ...facts, hasSalesFinal: true, changedSinceFinal: false, amountPaise: 0 });
}

/** What the Convert dialog shows for one lead, or null when this member may not convert it. */
export async function convertScreen(clientId: unknown): Promise<ConvertScreen | null> {
  const found = await leadFor(clientId);
  if (!found) return null;
  const { scope, lead } = found;
  const rows = await prisma.studioQuote.findMany({
    where: { studioId: scope.studioId, clientId: lead.id, scopeForProjectId: null },
    orderBy: { createdAt: 'desc' },
    select: { ...BOOKING_QUOTE, salesFinalRevisionId: true, salesFinalAt: true, salesFinalNotes: true, revisions: { orderBy: { n: 'asc' }, select: { id: true, n: true, totalPaise: true, sentAt: true } } },
  });
  const quotes: ConvertQuote[] = [];
  let picked: ConvertScreen['picked'] = null;
  let notes = '';
  for (const q of rows) {
    const blocked = q.revisions.length === 0 ? 'Not sent yet: send it to the client first, then it can be picked.' : quoteRefusal(await factsFor(q, 0), q.stage);
    quotes.push({
      quoteId: q.id,
      number: q.number,
      blocked,
      revisions: q.revisions.map((r) => ({ n: r.n, label: revisionLabel(r.n), totalPaise: fromDb(r.totalPaise), sentLabel: day(r.sentAt), isSalesFinal: r.id === q.salesFinalRevisionId })),
    });
    if (!blocked) {
      const final = q.revisions.find((r) => r.id === q.salesFinalRevisionId);
      if (final && (!picked || !notes)) {
        picked = { quoteId: q.id, n: final.n };
        notes = q.salesFinalNotes ?? '';
      }
    }
  }
  if (!picked) {
    const open = quotes.find((q) => !q.blocked && q.revisions.length > 0);
    if (open) picked = { quoteId: open.quoteId, n: open.revisions[open.revisions.length - 1]!.n };
  }
  const blocked = lead.bookedAt
    ? 'This lead is already converted.'
    : !quotes.some((q) => !q.blocked)
      ? 'Send one of this lead’s quotations to the client first; then pick its revision here.'
      : !lead.phone
        ? 'Add the client’s mobile number to the lead first: the project and the client’s app need it.'
        : null;
  return { name: lead.name, quotes, picked, notes, blocked };
}

export type ConvertResult = { ok: true; projectId: string; stage: string | null } | { ok: false; error: string };

/**
 * Convert one lead: pick any revision of any of its quotations, write the
 * handover, and the project starts. The picked revision becomes the sales
 * final there and then (owner, 14 Nov 2026); when the quotation has moved on
 * since that revision, it is first put back to what that revision said, so
 * the project is built from exactly what the client was sent.
 */
export async function convertLead(input: { clientId: unknown; quoteId: unknown; n: unknown; handover: unknown; stageId?: unknown }, now = new Date()): Promise<ConvertResult> {
  const found = await leadFor(input.clientId);
  if (!found) return { ok: false, error: ACCESS_ERRORS.notYourRole };
  const { scope, lead } = found;
  const member = scope.member;
  const studioId = scope.studioId;
  if (lead.bookedAt) return { ok: false, error: 'This lead is already converted.' };
  if (!lead.phone) return { ok: false, error: 'Add the client’s mobile number to the lead first: the project and the client’s app need it.' };

  const handover = checkHandover(input.handover);
  if (!handover.ok) return handover;

  const quoteId = typeof input.quoteId === 'string' ? input.quoteId.slice(0, 64) : '';
  const n = typeof input.n === 'number' && Number.isInteger(input.n) && input.n > 0 ? input.n : null;
  if (!quoteId || n === null) return { ok: false, error: 'Pick the quotation revision that is the sales final.' };
  const first = await prisma.studioQuote.findFirst({ where: { id: quoteId, studioId, clientId: lead.id }, select: { ...BOOKING_QUOTE, salesFinalNotes: true } });
  if (!first) return { ok: false, error: 'That quotation is not this lead’s.' };
  const before = quoteRefusal(await factsFor(first, 0), first.stage);
  if (before) return { ok: false, error: before };
  const rev = await prisma.studioQuoteRevision.findFirst({ where: { quoteId: first.id, studioId, n }, select: { n: true, lines: true, terms: true } });
  if (!rev) return { ok: false, error: 'That revision is not on this quotation.' };

  /* The quotation says what the picked revision said, then that revision is the sales final. */
  const current = await prisma.studioQuote.findFirst({ where: { id: first.id, studioId }, select: QUOTE_FOR_REVISION });
  if (current && !sameAsRevision(current, rev)) {
    await prisma.$transaction((tx) => restoreRevision(tx, { quoteId: first.id, studioId, lines: readRevisionLines(rev.lines), terms: readRevisionTerms(rev.terms) }));
  }
  if (first.salesFinalRevision?.n !== n) {
    const stages = readStages(first.salesFinalSchedule) ?? templateOrDefault(first.studio.paymentTemplate);
    const marked = await markSalesFinal(first.id, n, stages, { notes: handover.value, fromConvert: true });
    if (!marked.ok) return marked;
  }

  const q = await prisma.studioQuote.findFirst({ where: { id: first.id, studioId }, select: BOOKING_QUOTE });
  if (!q) return { ok: false, error: 'That quotation is not this lead’s.' };
  const refusal = bookingRefusal({ ...(await factsFor(q, 0)), amountPaise: 0 });
  if (refusal) return { ok: false, error: refusal };

  const final = q.salesFinalRevision!;
  const contract = fromDb(final.totalPaise);
  const amounts = scheduleAmounts(readStages(q.salesFinalSchedule) ?? templateOrDefault(q.studio.paymentTemplate), contract);
  if (!amounts.ok) return { ok: false, error: amounts.error };

  /* The won column: the one it was dropped on, if that is a won column; else the first. */
  const asked =
    typeof input.stageId === 'string' ? await prisma.studioStage.findFirst({ where: { id: input.stageId.slice(0, 64), studioId, kind: 'WON' }, select: { id: true, name: true } }) : null;
  const won = asked ?? (await firstWonStage(studioId));
  const by = await actingMember();
  const revision = revisionLabel(final.n);

  const started = await startOwnProject(
    member,
    { quoteId: q.id, startOn: istToday(now), customer: { name: lead.name, phone: lead.phone, email: lead.email } },
    now,
    {
      leadChecked: true,
      contractPaise: contract,
      stages: amounts.stages.map((s) => ({ label: s.label, pct: null, amountPaise: s.amountPaise })),
      onCreated: async (tx, project) => {
        /* The handover is what the design tab reads as "From sales" (studio-design/store.ts). */
        await tx.studioQuote.updateMany({ where: { id: q.id, studioId }, data: { salesFinalNotes: handover.value } });
        await recordEvent(tx, {
          projectId: project.id,
          type: 'project.converted',
          actor: { type: 'STUDIO', id: member.userId },
          refId: q.id,
          payload: { clientId: lead.id, quote: q.number, revision, handoverChars: handover.value.length },
        });
        await tx.studioClient.updateMany({
          where: { id: lead.id, studioId },
          data: {
            bookedIntroductionId: project.introductionId,
            bookedAt: now,
            preBookingStageId: lead.stageId,
            ...(won ? { stageId: won.id, lostReason: null } : {}),
          },
        });
        await record({
          db: tx,
          by,
          studioId,
          clientId: lead.id,
          kind: 'BOOKED',
          summary: `Converted on ${q.number} (${revision}). Project started; the booking advance is to be recorded by accounts.${won ? ` Moved to ${won.name}.` : ''}`,
          meta: { quoteId: q.id, projectId: project.id, introductionId: project.introductionId, fromStageId: lead.stageId, toStageId: won?.id ?? null, converted: true },
        });
      },
    },
  );
  if (!started.ok) return started;

  if (won && lead.stageId !== won.id) await queueConversions(studioId, [{ clientId: lead.id, toStageId: won.id }]);
  await tellDesignHeads(studioId, { kind: 'project-needs-designer', projectId: started.projectId, client: lead.name, by: by?.name ?? null });
  return { ok: true, projectId: started.projectId, stage: won?.name ?? null };
}

/** The design heads hear it; a studio with none tells its owner and PMs. Never fails the convert. */
async function tellDesignHeads(studioId: string, event: { kind: 'project-needs-designer'; projectId: string; client: string; by: string | null }): Promise<void> {
  try {
    const heads = await prisma.studioMember.findMany({ where: { studioId, designHead: true, status: 'ACTIVE' }, select: { userId: true } });
    if (heads.length === 0) await notifyStudio(studioId, event);
    else await Promise.all(heads.map((h) => notify(h.userId, event, { email: true })));
  } catch (error) {
    console.error('[convert] design head not told', error instanceof Error ? error.message : 'unknown');
  }
}
