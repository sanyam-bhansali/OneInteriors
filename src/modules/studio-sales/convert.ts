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
import { revisionLabel } from './revision-rules';
import { readStages, scheduleAmounts, templateOrDefault } from './payment-template';
import { queueConversions } from './conversions';
import { bookingRefusal } from './booking-rules';
import { BOOKING_QUOTE, factsFor, firstWonStage } from './booking';
import { checkHandover } from './convert-rules';

export interface ConvertChoice {
  quoteId: string;
  number: string;
  revision: string;
  totalPaise: number;
  /** Why this quotation cannot be converted on, if it cannot. */
  blocked: string | null;
}

export interface ConvertScreen {
  name: string;
  quotes: ConvertChoice[];
  /** The notes written with the sales final, to start the handover from. */
  notes: string;
  /** Why the lead cannot be converted at all (no sales final yet, no mobile). */
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

/** What the Convert dialog shows for one lead, or null when this member may not convert it. */
export async function convertScreen(clientId: unknown): Promise<ConvertScreen | null> {
  const found = await leadFor(clientId);
  if (!found) return null;
  const { scope, lead } = found;
  const quotes = await prisma.studioQuote.findMany({
    where: { studioId: scope.studioId, clientId: lead.id, salesFinalRevisionId: { not: null } },
    orderBy: { salesFinalAt: 'desc' },
    select: BOOKING_QUOTE,
  });
  const choices: ConvertChoice[] = [];
  for (const q of quotes) {
    const facts = await factsFor(q, 0);
    choices.push({
      quoteId: q.id,
      number: q.number,
      revision: revisionLabel(q.salesFinalRevision!.n),
      totalPaise: fromDb(q.salesFinalRevision!.totalPaise),
      blocked: bookingRefusal({ ...facts, amountPaise: 0 }),
    });
  }
  const notes = (
    await prisma.studioQuote.findFirst({ where: { studioId: scope.studioId, clientId: lead.id, salesFinalRevisionId: { not: null } }, orderBy: { salesFinalAt: 'desc' }, select: { salesFinalNotes: true } })
  )?.salesFinalNotes;
  const blocked = lead.bookedAt
    ? 'This lead is already converted.'
    : choices.length === 0
      ? 'Mark a sales final on one of this lead’s quotations first (open the quotation → Revisions → Mark as sales final).'
      : !lead.phone
        ? 'Add the client’s mobile number to the lead first: the project and the client’s app need it.'
        : null;
  return { name: lead.name, quotes: choices, notes: notes ?? '', blocked };
}

export type ConvertResult = { ok: true; projectId: string; stage: string | null } | { ok: false; error: string };

/** Convert one lead: pick the sales-final quotation, write the handover, and the project starts. */
export async function convertLead(input: { clientId: unknown; quoteId: unknown; handover: unknown; stageId?: unknown }, now = new Date()): Promise<ConvertResult> {
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
  if (!quoteId) return { ok: false, error: 'Pick the sales-final quotation.' };
  const q = await prisma.studioQuote.findFirst({ where: { id: quoteId, studioId, clientId: lead.id }, select: BOOKING_QUOTE });
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
