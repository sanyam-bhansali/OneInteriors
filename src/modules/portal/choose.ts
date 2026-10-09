import 'server-only';

/**
 * "Choose & sign" (v79 design, 9 Oct 2026): what happens between the expert
 * call and a signed project, from the customer's side.
 *
 *   1. Expert call      — the Consultation they booked.
 *   2. Meet studios     — the studios ops introduced after the call, and the
 *                         visits each studio proposed. The customer confirms
 *                         a proposed time here instead of through ops.
 *   3. Final quote      — the studio's own quotation, priced after measuring,
 *                         issued from its builder against the introduction.
 *   4. Sign             — the customer signs that quotation. The total and the
 *                         payment stages are locked onto their project, and
 *                         the tracker starts.
 *
 * Every read is scoped to the signed-in customer's own brief. Nothing here
 * lets a customer see another customer's introduction, quote or project.
 */

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/modules/auth/session';
import { readPhases, phaseAmounts } from '@/modules/studio/payment-phases';
import { readProfile } from '@/modules/studio/matching-profile';
import { computeTotals, type QuoteUnitName, type WorkCodeName } from '@/modules/studio-quote/pricing';
import { canTransition } from '@/modules/studio/appointment-rules';
import { durationFor } from './tracker';
import { fromDb } from '@/lib/money';

const VISIBLE_QUOTE = ['ISSUED', 'ACCEPTED'] as const;

export interface ChooseVisit {
  id: string;
  kind: 'FIRST_MEETING' | 'SITE_VISIT' | 'FOLLOW_UP';
  status: 'PROPOSED' | 'CONFIRMED' | 'COMPLETED';
  startsAt: string;
  location: string | null;
}

export interface ChooseStudio {
  introductionId: string;
  slug: string;
  name: string;
  visits: ChooseVisit[];
  /** Their final quote once issued: id, total before GST, when. */
  finalQuote: { id: string; totalPaise: number; issuedOn: string | null; accepted: boolean } | null;
}

export interface ChooseView {
  call: { scheduledFor: string | null; status: string } | null;
  studios: ChooseStudio[];
  /** Set once they have signed: which studio. */
  signedWith: string | null;
}

/** The customer's own live introductions — the scope every studio-quote read below is held to. */
async function myIntroductionIds(briefId: string): Promise<string[]> {
  const rows = await prisma.introduction.findMany({ where: { briefId, withdrawnAt: null }, select: { id: true } });
  return rows.map((r) => r.id);
}

async function myBriefId(): Promise<{ userId: string; briefId: string } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const brief = await prisma.brief.findUnique({ where: { userId: user.id }, select: { id: true } });
  return brief ? { userId: user.id, briefId: brief.id } : null;
}

export async function chooseView(): Promise<ChooseView | null> {
  const me = await myBriefId();
  if (!me) return null;

  const [call, intros] = await Promise.all([
    prisma.consultation.findFirst({
      where: { briefId: me.briefId, status: { in: ['scheduled', 'completed'] } },
      orderBy: { createdAt: 'desc' },
      select: { scheduledFor: true, status: true },
    }),
    prisma.introduction.findMany({
      where: { briefId: me.briefId, withdrawnAt: null },
      orderBy: { introducedAt: 'asc' },
      select: {
        id: true,
        studio: { select: { slug: true, tradeName: true } },
        homeProject: { select: { id: true } },
        appointments: {
          where: { status: { in: ['PROPOSED', 'CONFIRMED', 'COMPLETED'] } },
          orderBy: { startsAt: 'asc' },
          select: { id: true, kind: true, status: true, startsAt: true, location: true },
        },
      },
    }),
  ]);

  const quotes = intros.length
    ? await prisma.studioQuote.findMany({
        where: { introductionId: { in: intros.map((i) => i.id) }, status: { in: [...VISIBLE_QUOTE] } },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          introductionId: true,
          status: true,
          issuedOn: true,
          feeBps: true,
          discountBps: true,
          onSpotPaise: true,
          bookingAdvancePaise: true,
          lines: { select: { unit: true, code: true, ratePaise: true, amountPaise: true, widthMm: true, heightMm: true, qtyMilli: true } },
        },
      })
    : [];

  const studios: ChooseStudio[] = intros.map((i) => {
    const q = quotes.find((x) => x.introductionId === i.id);
    return {
      introductionId: i.id,
      slug: i.studio.slug,
      name: i.studio.tradeName,
      visits: i.appointments.map((a) => ({
        id: a.id,
        kind: a.kind,
        status: a.status as ChooseVisit['status'],
        startsAt: a.startsAt.toISOString(),
        location: a.location,
      })),
      finalQuote: q
        ? { id: q.id, totalPaise: totalOf(q).totalPaise, issuedOn: q.issuedOn?.toISOString() ?? null, accepted: q.status === 'ACCEPTED' }
        : null,
    };
  });

  return {
    call: call ? { scheduledFor: call.scheduledFor?.toISOString() ?? null, status: call.status } : null,
    studios,
    signedWith: intros.find((i) => i.homeProject)?.studio.tradeName ?? null,
  };
}

type QuoteRowForTotals = {
  feeBps: number;
  discountBps: number;
  onSpotPaise: bigint;
  bookingAdvancePaise: bigint;
  lines: { unit: string; code: string; ratePaise: bigint; amountPaise: bigint; widthMm: number | null; heightMm: number | null; qtyMilli: number | null }[];
};

function totalOf(q: QuoteRowForTotals) {
  return computeTotals(
    q.lines.map((l) => ({
      unit: l.unit as QuoteUnitName,
      code: l.code as WorkCodeName,
      ratePaise: fromDb(l.ratePaise),
      amountPaise: fromDb(l.amountPaise),
      widthMm: l.widthMm,
      heightMm: l.heightMm,
      qtyMilli: l.qtyMilli,
    })),
    {
      feeBps: q.feeBps,
      discountBps: q.discountBps,
      onSpotPaise: fromDb(q.onSpotPaise),
      bookingAdvancePaise: fromDb(q.bookingAdvancePaise),
    },
  );
}

// ── The final quote, for reading and signing ───────────────────

export interface FinalQuoteView {
  id: string;
  studioName: string;
  studioSlug: string;
  number: string;
  issuedOn: string | null;
  accepted: boolean;
  rooms: { room: string; amountPaise: number; lines: { product: string; details: string | null; amountPaise: number }[] }[];
  lineCount: number;
  workPaise: number;
  feePaise: number;
  discountPaise: number;
  onSpotPaise: number;
  /** What they pay the studio, before GST — studio quotations carry no GST line. */
  totalPaise: number;
  terms: string | null;
  handoverDays: number;
  /** The studio's filed stages, or the stages on its own quotation when it filed none. */
  stages: { label: string; pct: number | null; amountPaise: number }[];
  /** Their first quote for this studio, before GST — null when it cannot be priced now. */
  firstBeforeGstPaise: number | null;
}

/** One final quote the signed-in customer may read: issued, and on their own introduction. */
export async function finalQuoteView(quoteId: string, firstBeforeGst: (slug: string) => Promise<number | null>): Promise<FinalQuoteView | null> {
  const me = await myBriefId();
  if (!me) return null;
  const mine = await myIntroductionIds(me.briefId);
  const q = await prisma.studioQuote.findFirst({
    // Scoped to this customer's own introductions in the query itself.
    where: { id: quoteId, status: { in: [...VISIBLE_QUOTE] }, introductionId: { in: mine } },
    select: {
      id: true,
      number: true,
      status: true,
      issuedOn: true,
      introductionId: true,
      feeBps: true,
      discountBps: true,
      onSpotPaise: true,
      bookingAdvancePaise: true,
      terms: true,
      studio: { select: { slug: true, tradeName: true, paymentPhases: true, matchingProfile: true } },
      lines: {
        orderBy: { sortOrder: 'asc' },
        select: { room: true, product: true, details: true, unit: true, code: true, ratePaise: true, amountPaise: true, widthMm: true, heightMm: true, qtyMilli: true },
      },
    },
  });
  if (!q?.introductionId) return null;
  const intro = await prisma.introduction.findFirst({
    where: { id: q.introductionId, briefId: me.briefId, withdrawnAt: null },
    select: { brief: { select: { scope: true } } },
  });
  if (!intro) return null;

  const totals = totalOf(q);
  const rooms = new Map<string, FinalQuoteView['rooms'][number]>();
  for (const l of q.lines) {
    const amount = fromDb(l.amountPaise);
    const r = rooms.get(l.room) ?? { room: l.room, amountPaise: 0, lines: [] };
    r.amountPaise += amount;
    r.lines.push({ product: l.product, details: l.details, amountPaise: amount });
    rooms.set(l.room, r);
  }

  const phases = readPhases(q.studio.paymentPhases);
  const stages = phases
    ? phaseAmounts(phases, totals.totalPaise).map((p) => ({ label: p.label, pct: p.pct, amountPaise: p.amountPaise }))
    : totals.stages.map((s) => ({ label: s.label, pct: null, amountPaise: s.amountPaise }));

  return {
    id: q.id,
    studioName: q.studio.tradeName,
    studioSlug: q.studio.slug,
    number: q.number,
    issuedOn: q.issuedOn?.toISOString() ?? null,
    accepted: q.status === 'ACCEPTED',
    rooms: [...rooms.values()],
    lineCount: q.lines.length,
    workPaise: totals.workPaise,
    feePaise: totals.feePaise,
    discountPaise: totals.discountPaise,
    onSpotPaise: totals.onSpotPaise,
    totalPaise: totals.totalPaise,
    terms: q.terms,
    handoverDays: durationFor(intro.brief.scope, readProfile(q.studio.matchingProfile).durationDays),
    stages,
    firstBeforeGstPaise: await firstBeforeGst(q.studio.slug).catch(() => null),
  };
}

// ── Confirming a visit ─────────────────────────────────────────

export type ChooseResult = { ok: true } | { ok: false; error: string };

/** The customer confirms (or declines) a time the studio proposed, on their own introduction. */
export async function answerVisit(appointmentId: string, to: 'CONFIRMED' | 'CANCELLED'): Promise<ChooseResult> {
  const me = await myBriefId();
  if (!me) return { ok: false, error: 'Sign in first.' };
  const a = await prisma.appointment.findFirst({
    where: { id: appointmentId, introduction: { briefId: me.briefId, withdrawnAt: null } },
    select: { id: true, status: true },
  });
  if (!a) return { ok: false, error: 'That visit is not on your project.' };
  if (a.status !== 'PROPOSED' || !canTransition('PROPOSED', to, 'CUSTOMER')) {
    return { ok: false, error: 'That visit has already been settled.' };
  }
  await prisma.$transaction([
    prisma.appointment.update({
      where: { id: a.id },
      data: { status: to, confirmedAt: to === 'CONFIRMED' ? new Date() : undefined },
    }),
    prisma.auditLog.create({
      data: {
        actorId: me.userId,
        action: `appointment.${to.toLowerCase()}`,
        entityType: 'Appointment',
        entityId: a.id,
        before: { status: 'PROPOSED' },
        after: { status: to, by: 'CUSTOMER' },
      },
    }),
  ]);
  return { ok: true };
}

// ── Signing ────────────────────────────────────────────────────

/**
 * Sign the final quote. The caller has already checked the customer's code
 * and that they ticked the agreement. Locks the total and the payment stages
 * onto a new project, marks the quotation accepted, records the win, and
 * starts the tracker today.
 */
export async function signFinalQuote(view: FinalQuoteView): Promise<ChooseResult & { projectId?: string }> {
  const me = await myBriefId();
  if (!me) return { ok: false, error: 'Sign in first.' };
  if (view.accepted) return { ok: false, error: 'This quote is already signed.' };

  const mine = await myIntroductionIds(me.briefId);
  const q = await prisma.studioQuote.findFirst({
    where: { id: view.id, status: 'ISSUED', introductionId: { in: mine } },
    select: { id: true, introductionId: true, studioId: true },
  });
  if (!q?.introductionId) return { ok: false, error: 'This quote is no longer open for signing.' };
  const intro = await prisma.introduction.findFirst({
    where: { id: q.introductionId, briefId: me.briefId, withdrawnAt: null },
    select: { id: true, briefId: true, homeProject: { select: { id: true } } },
  });
  if (!intro) return { ok: false, error: 'This quote is not on your project.' };
  if (intro.homeProject) return { ok: false, error: 'You have already signed with this studio.' };

  // The stages as signed, with their rupee amounts, so a later change to the
  // studio's schedule never rewrites what this customer agreed to.
  const stages = view.stages.map((s) => ({ label: s.label, pct: s.pct, amountPaise: s.amountPaise }));
  const now = new Date();
  const startOn = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  try {
    const project = await prisma.$transaction(async (tx) => {
      await tx.studioQuote.update({ where: { id: q.id }, data: { status: 'ACCEPTED' } });
      const created = await tx.homeProject.create({
        data: {
          introductionId: intro.id,
          startOn,
          totalDays: view.handoverDays,
          signedAt: now,
          signedQuoteId: q.id,
          contractPaise: BigInt(view.totalPaise),
          paymentPhases: stages,
        },
        select: { id: true },
      });
      await tx.quoteDecision.upsert({
        where: { briefId: intro.briefId },
        create: { briefId: intro.briefId, wonByStudioId: q.studioId, outcomeSource: 'CUSTOMER_REPORTED', decidedAt: now },
        update: { wonByStudioId: q.studioId, outcomeSource: 'CUSTOMER_REPORTED', decidedAt: now },
      });
      await tx.auditLog.create({
        data: {
          actorId: me.userId,
          action: 'quote.signed',
          entityType: 'StudioQuote',
          entityId: q.id,
          after: { totalPaise: view.totalPaise, projectId: created.id },
        },
      });
      return created;
    });
    return { ok: true, projectId: project.id };
  } catch (error) {
    console.error('[choose] sign failed', error);
    return { ok: false, error: 'That did not go through. Nothing was signed; try again.' };
  }
}
