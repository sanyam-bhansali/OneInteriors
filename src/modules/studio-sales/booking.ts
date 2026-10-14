import 'server-only';

/**
 * Record the booking advance, and refund it (Studio OS Phase 1,
 * docs/studio-os/PHASE-1-SALES.md §5). The rules are in booking-rules.ts.
 *
 * Recording a booking on a quotation's sales final:
 *  1. builds the project through the existing own-client path
 *     (project/own-project.ts `startOwnProject`, `createSignedProject`), with
 *     the payment stages agreed on the sales final, in rupees on its total;
 *  2. in the same transaction writes the advance as the first payment row
 *     (`HomeProjectPayment`, stage 0) with its event, and on the lead: the
 *     introduction (lead → quote → project is one chain), when, the column
 *     it came from, and the move to the studio's first WON column;
 *  3. invites the client to the app by SMS or email (never WhatsApp).
 *
 * Refunding: a correction row voids the advance (never an edit), the project
 * is marked cancelled (never deleted), the app invite stops working, the
 * quotation goes back to Sent, and the lead returns to the column it was in.
 *
 * Every query is scoped by the member's studio.
 */

import type { PaymentMode, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { fromDb, toDb } from '@/lib/money';
import { currentMember, ACCESS_ERRORS, type StudioMemberRef } from '@/modules/studio/access';
import { can } from '@/modules/studio/roles';
import { actingMember } from '@/modules/studio/lead-scope';
import { startOwnProject, istToday } from '@/modules/project/own-project';
import { recordEvent } from '@/modules/project/events';
import { lockProject, mirror } from '@/modules/project/payments-flow';
import { dayToDb } from '@/modules/project/working-days';
import { record } from '@/modules/studio-practice/events';
import { stageSummary } from '@/modules/studio-practice/event-copy';
import { readRevisionLines, readRevisionTotals, revisionLabel, sameLinesAs } from './revision-rules';
import { readStages, refundDaysOf, scheduleAmounts, templateOrDefault } from './payment-template';
import { snapshotOf } from './revisions';
import {
  bookedSummary,
  bookingRefusal,
  checkBookingInput,
  refundCheck,
  refundedSummary,
  type BookingInput,
} from './booking-rules';

export interface RecordBookingInput extends BookingInput {
  quoteId: string;
  customerName: unknown;
  customerPhone: unknown;
  customerEmail?: unknown;
}

export type BookingResult = { ok: true; projectId: string; clientId: string | null; invitedBy: string[] } | { ok: false; error: string };

const BOOKING_QUOTE = {
  id: true,
  number: true,
  status: true,
  stage: true,
  studioId: true,
  briefId: true,
  introductionId: true,
  clientId: true,
  clientName: true,
  clientPhone: true,
  clientEmail: true,
  feeBps: true,
  discountBps: true,
  onSpotPaise: true,
  onSpotLabel: true,
  bookingAdvancePaise: true,
  gstBps: true,
  phases: true,
  salesFinalSchedule: true,
  salesFinalRevision: { select: { n: true, lines: true, totals: true, totalPaise: true } },
  studio: { select: { paymentPhases: true, paymentTemplate: true } },
  client: {
    select: { id: true, name: true, phone: true, email: true, source: true, introductionId: true, deletedAt: true, stageId: true, bookedIntroductionId: true, assignedToId: true },
  },
  lines: {
    orderBy: { sortOrder: 'asc' as const },
    select: { room: true, product: true, code: true, unit: true, details: true, widthMm: true, heightMm: true, qtyMilli: true, ratePaise: true, amountPaise: true, note: true },
  },
} satisfies Prisma.StudioQuoteSelect;

/** What the booking form pre-fills, for a quotation with a sales final. */
export interface BookingDraft {
  quoteId: string;
  number: string;
  revision: string;
  totalPaise: number;
  bookingPaise: number;
  refundDays: number;
  stages: { label: string; note: string; amountPaise: number }[];
  customer: { name: string; phone: string; email: string };
  today: string;
  /** Why it cannot be recorded now, if it cannot. */
  blocked: string | null;
}

/** The booking form for one quotation, or null when the member may not record bookings or it is not theirs. */
export async function bookingDraft(member: StudioMemberRef | null, quoteId: string): Promise<BookingDraft | null> {
  if (!member || !can(member, 'booking.record')) return null;
  const q = await prisma.studioQuote.findFirst({ where: { id: quoteId, studioId: member.studioId }, select: BOOKING_QUOTE });
  if (!q || !q.salesFinalRevision) return null;
  const facts = await factsFor(q, 1);
  const schedule = readStages(q.salesFinalSchedule) ?? templateOrDefault(q.studio.paymentTemplate);
  const total = fromDb(q.salesFinalRevision.totalPaise);
  const amounts = scheduleAmounts(schedule, total);
  const stages = amounts.ok ? amounts.stages : [];
  return {
    quoteId: q.id,
    number: q.number,
    revision: revisionLabel(q.salesFinalRevision.n),
    totalPaise: total,
    bookingPaise: stages[0]?.amountPaise ?? 0,
    refundDays: refundDaysOf(schedule),
    stages: stages.map((s) => ({ label: s.label, note: s.note, amountPaise: s.amountPaise })),
    customer: {
      name: q.client?.name ?? q.clientName,
      phone: q.client?.phone ?? q.clientPhone ?? '',
      email: q.client?.email ?? q.clientEmail ?? '',
    },
    today: istToday(),
    blocked: amounts.ok ? bookingRefusal({ ...facts, amountPaise: 1 }) : amounts.error,
  };
}

type BookingQuote = Prisma.StudioQuoteGetPayload<{ select: typeof BOOKING_QUOTE }>;

async function factsFor(q: BookingQuote, amountPaise: number) {
  const schedule = readStages(q.salesFinalSchedule) ?? templateOrDefault(q.studio.paymentTemplate);
  const final = q.salesFinalRevision;
  const total = final ? fromDb(final.totalPaise) : 0;
  const amounts = final ? scheduleAmounts(schedule, total) : null;
  const snap = snapshotOf(q);
  const changed = final
    ? !sameLinesAs(readRevisionLines(final.lines), snap.lines) || readRevisionTotals(final.totals).totalPaise !== snap.totals.totalPaise
    : false;
  const live = await prisma.homeProject.findFirst({ where: { signedQuoteId: q.id, cancelledAt: null }, select: { id: true } });
  return {
    hasSalesFinal: final !== null,
    alreadyBooked: live !== null || Boolean(q.client?.bookedIntroductionId),
    changedSinceFinal: changed,
    fromOneInteriors: q.briefId !== null || q.introductionId !== null || q.client?.source === 'ONE_INTERIORS' || q.client?.introductionId != null,
    leadDeleted: q.client?.deletedAt != null,
    bookingStagePaise: amounts?.ok ? (amounts.stages[0]?.amountPaise ?? 0) : 0,
    amountPaise,
  };
}

/** The first WON column, in the studio's order — where a booked lead goes. */
async function firstWonStage(studioId: string): Promise<{ id: string; name: string } | null> {
  return prisma.studioStage.findFirst({ where: { studioId, kind: 'WON' }, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } });
}

/**
 * Record the booking advance (`booking.record`: accounts, owner, PM).
 * Creates the project, the payment entry, the app invite and the timeline
 * line; moves the lead to the first WON column.
 */
export async function recordBooking(input: RecordBookingInput, now = new Date()): Promise<BookingResult> {
  const member = await currentMember();
  if (!member) return { ok: false, error: ACCESS_ERRORS.signIn };
  if (!can(member, 'booking.record')) return { ok: false, error: ACCESS_ERRORS.notYourRole };
  const studioId = member.studioId;
  const by = await actingMember();

  const checked = checkBookingInput(input, now);
  if (!checked.ok) return checked;
  const pay = checked.value;

  const quoteId = String(input.quoteId ?? '').slice(0, 64);
  const q = await prisma.studioQuote.findFirst({ where: { id: quoteId, studioId }, select: BOOKING_QUOTE });
  if (!q) return { ok: false, error: 'That quotation is not one of yours.' };
  const refusal = bookingRefusal(await factsFor(q, pay.amountPaise));
  if (refusal) return { ok: false, error: refusal };

  const final = q.salesFinalRevision!;
  const schedule = readStages(q.salesFinalSchedule) ?? templateOrDefault(q.studio.paymentTemplate);
  const contract = fromDb(final.totalPaise);
  const amounts = scheduleAmounts(schedule, contract);
  if (!amounts.ok) return { ok: false, error: amounts.error };
  const won = await firstWonStage(studioId);
  const lead = q.client;
  const revision = revisionLabel(final.n);

  const started = await startOwnProject(
    member,
    {
      quoteId: q.id,
      startOn: istToday(now),
      customer: { name: String(input.customerName ?? ''), phone: String(input.customerPhone ?? ''), email: input.customerEmail ? String(input.customerEmail) : null },
    },
    now,
    {
      action: 'booking.record',
      contractPaise: contract,
      stages: amounts.stages.map((s) => ({ label: s.label, pct: null, amountPaise: s.amountPaise })),
      onCreated: async (tx, project) => {
        await lockProject(tx, project.id);
        const row = await tx.homeProjectPayment.create({
          data: {
            projectId: project.id,
            stageIndex: 0,
            amountPaise: toDb(pay.amountPaise),
            receivedOn: dayToDb(pay.receivedOn),
            mode: pay.mode as PaymentMode,
            note: pay.reference ? `Booking advance · ${pay.reference}` : 'Booking advance',
            recordedById: member.userId,
          },
          select: { id: true },
        });
        await recordEvent(tx, {
          projectId: project.id,
          type: 'payment.recorded',
          actor: { type: 'STUDIO', id: member.userId },
          refId: row.id,
          payload: { stageIndex: 0, amountPaise: pay.amountPaise, mode: pay.mode, receipt: false, booking: true },
        });
        await mirror(tx, project.id);
        if (!lead) return;
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
          // Looked up before the transaction: inside it, record() must not use another connection.
          by,
          studioId,
          clientId: lead.id,
          kind: 'BOOKED',
          summary: bookedSummary(pay.amountPaise, pay.mode, q.number, revision) + (won ? ` Moved to ${won.name}.` : ''),
          meta: { quoteId: q.id, projectId: project.id, introductionId: project.introductionId, fromStageId: lead.stageId, toStageId: won?.id ?? null },
        });
      },
    },
  );
  if (!started.ok) return started;
  return { ok: true, projectId: started.projectId, clientId: lead?.id ?? null, invitedBy: started.invite.sentVia };
}

export type RefundResult = { ok: true } | { ok: false; error: string; askLate?: boolean };

/**
 * Refund a lead's booking. Within the refund days: accounts, owner or PM;
 * later: the owner, after saying so (`lateConfirmed`).
 */
export async function refundBooking(input: { clientId: string; reason?: unknown; lateConfirmed?: boolean }, now = new Date()): Promise<RefundResult> {
  const member = await currentMember();
  if (!member) return { ok: false, error: ACCESS_ERRORS.signIn };
  if (!can(member, 'booking.refund')) return { ok: false, error: ACCESS_ERRORS.notYourRole };
  const studioId = member.studioId;
  const by = await actingMember();

  const lead = await prisma.studioClient.findFirst({
    where: { id: String(input.clientId ?? '').slice(0, 64), studioId },
    select: { id: true, name: true, bookedIntroductionId: true, bookedAt: true, preBookingStageId: true, stageId: true, stage: { select: { name: true } } },
  });
  if (!lead?.bookedIntroductionId || !lead.bookedAt) return { ok: false, error: 'This lead has no booking to refund.' };
  const project = await prisma.homeProject.findFirst({
    where: { introductionId: lead.bookedIntroductionId, introduction: { studioId } },
    select: { id: true, cancelledAt: true, signedQuoteId: true },
  });
  if (!project) return { ok: false, error: 'The project for this booking was not found.' };
  const quote = project.signedQuoteId
    ? await prisma.studioQuote.findFirst({ where: { id: project.signedQuoteId, studioId }, select: { id: true, salesFinalSchedule: true, studio: { select: { paymentTemplate: true } } } })
    : null;
  const schedule = readStages(quote?.salesFinalSchedule) ?? templateOrDefault(quote?.studio.paymentTemplate);

  const check = refundCheck(
    { role: member.role, bookedAt: lead.bookedAt, refundDays: refundDaysOf(schedule), cancelled: project.cancelledAt !== null, lateConfirmed: input.lateConfirmed === true },
    now,
  );
  if (!check.ok) return check;
  const reason = typeof input.reason === 'string' ? input.reason.trim().replace(/\s+/g, ' ').slice(0, 200) || null : null;

  const back =
    (lead.preBookingStageId
      ? await prisma.studioStage.findFirst({ where: { id: lead.preBookingStageId, studioId }, select: { id: true, name: true } })
      : null) ??
    (await prisma.studioStage.findFirst({ where: { studioId, kind: 'OPEN' }, orderBy: [{ isIntake: 'desc' }, { sortOrder: 'asc' }], select: { id: true, name: true } }));

  let refunded = 0;
  await prisma.$transaction(async (tx) => {
    await lockProject(tx, project.id);
    const rows = await tx.homeProjectPayment.findMany({
      where: { projectId: project.id, stageIndex: 0, corrections: { none: {} }, amountPaise: { gt: 0 } },
      select: { id: true, amountPaise: true, receivedOn: true, mode: true },
    });
    const actor = { type: 'STUDIO' as const, id: member.userId };
    for (const r of rows) {
      refunded += fromDb(r.amountPaise);
      const fix = await tx.homeProjectPayment.create({
        data: {
          projectId: project.id,
          stageIndex: 0,
          amountPaise: BigInt(0),
          receivedOn: r.receivedOn,
          mode: r.mode,
          note: `Booking refunded${reason ? ` · ${reason}` : ''}`,
          recordedById: member.userId,
          correctsId: r.id,
        },
        select: { id: true },
      });
      await recordEvent(tx, { projectId: project.id, type: 'payment.corrected', actor, refId: fix.id, payload: { stageIndex: 0, amountPaise: 0, corrects: r.id, refund: true } });
    }
    await mirror(tx, project.id);
    /* Cancelled, kept. `signedQuoteId` is let go so the quotation is free
       again (it is unique on projects); the event keeps which one it was. */
    await tx.homeProject.update({
      where: { id: project.id },
      data: { cancelledAt: now, cancelReason: reason ?? 'Booking refunded', signedQuoteId: null },
    });
    await recordEvent(tx, { projectId: project.id, type: 'project.cancelled', actor, refId: project.signedQuoteId, payload: { late: check.late, refundedPaise: refunded } });
    await tx.homeProjectInvite.updateMany({ where: { projectId: project.id, revokedAt: null }, data: { revokedAt: now } });
    if (quote) await tx.studioQuote.updateMany({ where: { id: quote.id, studioId }, data: { status: 'ISSUED' } });
    await tx.studioClient.updateMany({
      where: { id: lead.id, studioId },
      data: { bookedIntroductionId: null, bookedAt: null, preBookingStageId: null, ...(back ? { stageId: back.id } : {}) },
    });
    await record({
      db: tx,
      by,
      studioId,
      clientId: lead.id,
      kind: 'REFUNDED',
      summary: refundedSummary(refunded, check.late, reason) + (back ? ` ${stageSummary(lead.stage.name, back.name)}.` : ''),
      meta: { projectId: project.id, introductionId: lead.bookedIntroductionId, quoteId: quote?.id ?? null, late: check.late, toStageId: back?.id ?? null },
    });
  });
  return { ok: true };
}

export interface LeadBooking {
  projectId: string;
  bookedAt: Date;
  cancelled: boolean;
  advancePaise: number;
  refundDays: number;
  /** Days left to refund without the owner; negative once past. */
  daysLeft: number;
  payments: { label: string; amountPaise: number }[];
}

/** The booking on a lead the caller may already see, for the lead page. */
export async function bookingForLead(studioId: string, lead: { bookedIntroductionId: string | null; bookedAt: Date | null }, now = new Date()): Promise<LeadBooking | null> {
  if (!lead.bookedIntroductionId || !lead.bookedAt) return null;
  const project = await prisma.homeProject.findFirst({
    where: { introductionId: lead.bookedIntroductionId, introduction: { studioId } },
    select: {
      id: true,
      cancelledAt: true,
      paymentPhases: true,
      signedQuoteId: true,
      payments: { where: { stageIndex: 0, corrections: { none: {} } }, select: { amountPaise: true } },
    },
  });
  if (!project) return null;
  const quote = project.signedQuoteId
    ? await prisma.studioQuote.findFirst({ where: { id: project.signedQuoteId, studioId }, select: { salesFinalSchedule: true, studio: { select: { paymentTemplate: true } } } })
    : null;
  const refundDays = refundDaysOf(readStages(quote?.salesFinalSchedule) ?? templateOrDefault(quote?.studio.paymentTemplate));
  const phases = Array.isArray(project.paymentPhases) ? (project.paymentPhases as { label?: unknown; amountPaise?: unknown }[]) : [];
  const days = Math.floor((now.getTime() - lead.bookedAt.getTime()) / 86_400_000);
  return {
    projectId: project.id,
    bookedAt: lead.bookedAt,
    cancelled: project.cancelledAt !== null,
    advancePaise: project.payments.reduce((n, p) => n + fromDb(p.amountPaise), 0),
    refundDays,
    daysLeft: refundDays - days,
    payments: phases.map((p) => ({ label: typeof p.label === 'string' ? p.label : 'Stage', amountPaise: typeof p.amountPaise === 'number' ? p.amountPaise : 0 })),
  };
}

export interface BookingToRecord {
  quoteId: string;
  number: string;
  client: string;
  clientId: string | null;
  revision: string;
  totalPaise: number;
  markedAt: Date | null;
}

/** Sales finals with no booking yet, for accounts' desk. */
export async function bookingsToRecord(): Promise<BookingToRecord[]> {
  const member = await currentMember();
  if (!member || !can(member, 'booking.record')) return [];
  const studioId = member.studioId;
  const rows = await prisma.studioQuote.findMany({
    where: {
      studioId,
      salesFinalRevisionId: { not: null },
      introductionId: null,
      briefId: null,
      status: { in: ['ISSUED', 'ACCEPTED'] },
      OR: [{ clientId: null }, { client: { deletedAt: null, bookedIntroductionId: null, introductionId: null, source: { not: 'ONE_INTERIORS' } } }],
    },
    orderBy: { salesFinalAt: 'desc' },
    take: 50,
    select: { id: true, number: true, clientName: true, clientId: true, salesFinalAt: true, salesFinalRevision: { select: { n: true, totalPaise: true } } },
  });
  const started = await prisma.homeProject.findMany({
    where: { signedQuoteId: { in: rows.map((r) => r.id) }, cancelledAt: null, introduction: { studioId } },
    select: { signedQuoteId: true },
  });
  const taken = new Set(started.map((s) => s.signedQuoteId));
  return rows
    .filter((r) => !taken.has(r.id) && r.salesFinalRevision)
    .map((r) => ({
      quoteId: r.id,
      number: r.number,
      client: r.clientName,
      clientId: r.clientId,
      revision: revisionLabel(r.salesFinalRevision!.n),
      totalPaise: fromDb(r.salesFinalRevision!.totalPaise),
      markedAt: r.salesFinalAt,
    }));
}

export interface RecentBooking {
  clientId: string;
  name: string;
  booking: LeadBooking;
}

/** Bookings recorded in the last two weeks and still live, for the refund button on accounts' desk. */
export async function recentBookings(now = new Date()): Promise<RecentBooking[]> {
  const member = await currentMember();
  if (!member || !can(member, 'booking.refund')) return [];
  const rows = await prisma.studioClient.findMany({
    where: { studioId: member.studioId, deletedAt: null, bookedAt: { gte: new Date(now.getTime() - 14 * 86_400_000) }, bookedIntroductionId: { not: null } },
    orderBy: { bookedAt: 'desc' },
    take: 30,
    select: { id: true, name: true, bookedAt: true, bookedIntroductionId: true },
  });
  const out: RecentBooking[] = [];
  for (const r of rows) {
    const booking = await bookingForLead(member.studioId, r, now);
    if (booking && !booking.cancelled) out.push({ clientId: r.id, name: r.name, booking });
  }
  return out;
}
