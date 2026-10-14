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
import { getCurrentUser, type AuthUser } from '@/modules/auth/session';
import { readPhases } from '@/modules/studio/payment-phases';
import { readProfile } from '@/modules/studio/matching-profile';
import { computeTotals, type QuoteUnitName, type WorkCodeName } from '@/modules/studio-quote/pricing';
import { canTransition } from '@/modules/studio/appointment-rules';
import { durationFor } from './tracker';
import { notifyStudio } from '@/modules/notify/service';
import { fromDb } from '@/lib/money';
import { tellOpsAssured } from './plan-store';
import { createSignedProject, PLAN_TX } from './plan-write';
import type { PlanName } from './plans';
import { designPlanInput } from '@/modules/studio-design/plan-input';

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

async function myBriefId(): Promise<{ userId: string; user: AuthUser; briefId: string } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const brief = await prisma.brief.findUnique({ where: { userId: user.id }, select: { id: true } });
  return brief ? { userId: user.id, user, briefId: brief.id } : null;
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
        source: true,
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

  /* A studio's own client is not a studio One Interiors introduced: it is
     never offered under "Meet studios", only counted as who they signed with. */
  const introduced = intros.filter((i) => i.source === 'ONE_INTERIORS');
  const quotes = introduced.length
    ? await prisma.studioQuote.findMany({
        where: { introductionId: { in: introduced.map((i) => i.id) }, status: { in: [...VISIBLE_QUOTE] } },
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
          gstBps: true,
          phases: true,
          studio: { select: { paymentPhases: true } },
          lines: { select: { unit: true, code: true, ratePaise: true, amountPaise: true, widthMm: true, heightMm: true, qtyMilli: true } },
        },
      })
    : [];

  const studios: ChooseStudio[] = introduced.map((i) => {
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
        ? { id: q.id, totalPaise: quoteTotals(q).beforeTaxPaise, issuedOn: q.issuedOn?.toISOString() ?? null, accepted: q.status === 'ACCEPTED' }
        : null,
    };
  });

  return {
    call: call ? { scheduledFor: call.scheduledFor?.toISOString() ?? null, status: call.status } : null,
    studios,
    signedWith: intros.find((i) => i.homeProject)?.studio.tradeName ?? null,
  };
}

export type QuoteRowForTotals = {
  feeBps: number;
  discountBps: number;
  onSpotPaise: bigint;
  bookingAdvancePaise: bigint;
  gstBps: number;
  phases: unknown;
  studio: { paymentPhases: unknown };
  lines: { unit: string; code: string; ratePaise: bigint; amountPaise: bigint; widthMm: number | null; heightMm: number | null; qtyMilli: number | null }[];
};

/** A studio quote's totals and payment stages, exactly as the customer's final quote shows them. Also used by project/own-project.ts. */
export function quoteTotals(q: QuoteRowForTotals) {
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
      gstBps: q.gstBps,
      // The schedule the studio's own builder shows (`quotePhases`).
      phases: readPhases(q.phases) ?? readPhases(q.studio.paymentPhases),
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
  onSpotLabel: string | null;
  /** After every discount, before GST — what compares with the first quote. */
  beforeTaxPaise: number;
  /** Zero when the studio quoted without GST. */
  gstPaise: number;
  /** What they pay the studio, GST included when the studio charges it. */
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
  /* A studio's own client signed outside the app: their quote carries no
     introduction (it is the studio's own work), so it is theirs to read
     because it is the signed quote of a project on their own brief. The
     Locker's agreement and quotation open this page. */
  const ownSigned = await prisma.homeProject.findFirst({
    where: { signedQuoteId: quoteId, introduction: { briefId: me.briefId, withdrawnAt: null, source: 'STUDIO_OWN_CLIENT' } },
    select: { introductionId: true },
  });
  const q = await prisma.studioQuote.findFirst({
    // Scoped to this customer's own introductions (or their own signed project) in the query itself.
    where: ownSigned
      ? { id: quoteId, status: 'ACCEPTED' }
      : { id: quoteId, status: { in: [...VISIBLE_QUOTE] }, introductionId: { in: mine } },
    select: {
      id: true,
      number: true,
      status: true,
      issuedOn: true,
      introductionId: true,
      feeBps: true,
      discountBps: true,
      onSpotPaise: true,
      onSpotLabel: true,
      bookingAdvancePaise: true,
      gstBps: true,
      phases: true,
      terms: true,
      studio: { select: { slug: true, tradeName: true, paymentPhases: true, matchingProfile: true } },
      lines: {
        orderBy: { sortOrder: 'asc' },
        select: { room: true, product: true, details: true, unit: true, code: true, ratePaise: true, amountPaise: true, widthMm: true, heightMm: true, qtyMilli: true },
      },
    },
  });
  const introductionId = ownSigned?.introductionId ?? q?.introductionId;
  if (!q || !introductionId) return null;
  const intro = await prisma.introduction.findFirst({
    where: { id: introductionId, briefId: me.briefId, withdrawnAt: null },
    select: { brief: { select: { scope: true } }, homeProject: { select: { totalDays: true } } },
  });
  if (!intro) return null;

  const totals = quoteTotals(q);
  const rooms = new Map<string, FinalQuoteView['rooms'][number]>();
  for (const l of q.lines) {
    const amount = fromDb(l.amountPaise);
    const r = rooms.get(l.room) ?? { room: l.room, amountPaise: 0, lines: [] };
    r.amountPaise += amount;
    r.lines.push({ product: l.product, details: l.details, amountPaise: amount });
    rooms.set(l.room, r);
  }

  const stages = totals.stages.map((s) => ({ label: s.label, pct: s.pct ?? null, amountPaise: s.amountPaise }));

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
    onSpotLabel: q.onSpotLabel,
    beforeTaxPaise: totals.beforeTaxPaise,
    gstPaise: totals.gstPaise,
    totalPaise: totals.totalPaise,
    terms: q.terms,
    handoverDays:
      ownSigned && intro.homeProject ? intro.homeProject.totalDays : durationFor(intro.brief.scope, readProfile(q.studio.matchingProfile).durationDays),
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
 *
 * In the same transaction it builds the project's plan from the signed
 * lines (quote-to-plan.ts: the five stages, each room's checklist, the
 * materials) and files the agreement and the signed quotation in the
 * customer's Locker (documents.ts `signedQuoteDocs`). If any of it fails,
 * nothing is signed.
 */
export async function signFinalQuote(
  view: FinalQuoteView,
  /** Basic, or Assured — which only registers interest: the project starts on Basic and ops is told (portal/plans.ts). */
  plan: PlanName = 'basic',
): Promise<ChooseResult & { projectId?: string }> {
  const me = await myBriefId();
  if (!me) return { ok: false, error: 'Sign in first.' };
  if (view.accepted) return { ok: false, error: 'This quote is already signed.' };

  const mine = await myIntroductionIds(me.briefId);
  const q = await prisma.studioQuote.findFirst({
    where: { id: view.id, status: 'ISSUED', introductionId: { in: mine } },
    select: {
      id: true,
      introductionId: true,
      studioId: true,
      number: true,
      clientName: true,
      lines: { orderBy: { sortOrder: 'asc' }, select: { id: true, room: true, product: true, details: true, code: true } },
    },
  });
  if (!q?.introductionId) return { ok: false, error: 'This quote is no longer open for signing.' };
  const intro = await prisma.introduction.findFirst({
    where: { id: q.introductionId, briefId: me.briefId, withdrawnAt: null },
    select: { id: true, briefId: true, homeProject: { select: { id: true } } },
  });
  if (!intro) return { ok: false, error: 'This quote is not on your project.' };
  if (intro.homeProject) return { ok: false, error: 'You have already signed with this studio.' };

  const now = new Date();
  const startOn = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // Studio OS Phase 2: the studio's design steps and the flat size, for the DESIGN stage.
  const design = await designPlanInput(q.studioId, { briefId: intro.briefId });

  try {
    const project = await prisma.$transaction(async (tx) => {
      // The stages as signed, with their rupee amounts, so a later change to
      // the studio's schedule never rewrites what this customer agreed to.
      // Split again over the total with `splitAcross` (quote-to-plan.ts), so
      // they sum to the contract exactly: the same figures the quote showed.
      // The same code builds a studio's own client's project (plan-write.ts).
      const created = await createSignedProject(tx, {
        introductionId: intro.id,
        quote: { id: q.id, number: q.number, lines: q.lines },
        startOn,
        totalDays: view.handoverDays,
        contractPaise: view.totalPaise,
        stages: view.stages.map((s) => ({ label: s.label, pct: s.pct, amountPaise: s.amountPaise })),
        signedAt: now,
        filedById: me.userId,
        assuredRequestedAt: plan === 'assured' ? now : null,
        design,
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
          after: { totalPaise: view.totalPaise, projectId: created.id, plan },
        },
      });
      return created;
    }, PLAN_TX);
    // The studio hears at once — inbox and email (notify/service.ts).
    void notifyStudio(q.studioId, {
      kind: 'quote-signed',
      quoteId: q.id,
      client: q.clientName,
      number: q.number,
      totalPaise: view.totalPaise,
    });
    if (plan === 'assured') void tellOpsAssured(me.user, view.studioName, true);
    return { ok: true, projectId: project.id };
  } catch (error) {
    console.error('[choose] sign failed', error);
    return { ok: false, error: 'That did not go through. Nothing was signed; try again.' };
  }
}
