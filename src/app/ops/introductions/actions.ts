'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/modules/auth/session';
import { recordOutcome } from '@/modules/quotation/journey-repository';
import {
  releaseContactDetails,
  withdrawIntroduction,
  setAppointmentStatus,
  proposeAppointment,
  type AppointmentKindName,
} from '@/modules/studio/introduction';

/**
 * The controls ops is documented as owning.
 *
 * Three of these call functions that had been sitting in `introduction.ts` with
 * no caller anywhere — `releaseContactDetails`, `withdrawIntroduction`, and the
 * ops half of `setAppointmentStatus`. The module comment says "only ops
 * confirms on the customer's behalf, because the customer has no account-side
 * scheduling surface"; until now no ops surface could confirm anything either,
 * so that sentence described nobody.
 *
 * Every one of these re-checks the role inside the module it calls. The page
 * hiding a button is a courtesy, not the control.
 */

export type Result = { ok: true } | { ok: false; error: string };

function done(): Result {
  revalidatePath('/ops/introductions');
  revalidatePath('/ops');
  return { ok: true };
}

/** The customer has said yes. Let the studio see who they are. */
export async function releaseContactAction(introductionId: string): Promise<Result> {
  const result = await releaseContactDetails(introductionId);
  if (!result.ok) return result;
  return done();
}

/**
 * The customer changed their mind.
 *
 * The reason is required by the module — eight characters minimum — and it is
 * required for a practical reason rather than a bureaucratic one: the studio
 * will ring and ask, and by then nobody remembers.
 */
export async function withdrawAction(
  introductionId: string,
  reason: string,
): Promise<Result> {
  const result = await withdrawIntroduction(introductionId, reason);
  if (!result.ok) return result;
  return done();
}

/** Confirm a time the studio proposed, on the customer's behalf. */
export async function confirmAppointmentAction(appointmentId: string): Promise<Result> {
  const result = await setAppointmentStatus(appointmentId, 'CONFIRMED');
  if (!result.ok) return result;
  return done();
}

/**
 * Say how a meeting went.
 *
 * `NO_SHOW` requires naming who did not turn up, which `validateTransition`
 * enforces — and only ops can record one at all, because it lands in a studio's
 * permanent delivery record and a studio marking its own customer absent is not
 * evidence of anything.
 */
export async function closeAppointmentAction(
  appointmentId: string,
  outcome: 'COMPLETED' | 'NO_SHOW' | 'CANCELLED',
  noShowBy?: 'STUDIO' | 'CUSTOMER',
  notes?: string,
): Promise<Result> {
  const result = await setAppointmentStatus(appointmentId, outcome, {
    noShowBy: outcome === 'NO_SHOW' ? (noShowBy ?? null) : null,
    notes,
  });
  if (!result.ok) return result;
  return done();
}

/**
 * Arrange the meeting, from our side.
 *
 * The recovery path for the case that used to strand a consultation: the expert
 * finished the call, the introduction was made, and the meeting failed to save.
 * Before this there was no second chance anywhere in the product.
 */
export async function arrangeAction(input: {
  introductionId: string;
  kind: AppointmentKindName;
  startsAt: string;
  location?: string;
}): Promise<Result> {
  const when = new Date(input.startsAt);
  if (Number.isNaN(when.getTime())) {
    return { ok: false, error: 'That date did not parse.' };
  }

  const result = await proposeAppointment({
    introductionId: input.introductionId,
    kind: input.kind,
    startsAt: when,
    location: input.location,
  });
  if (!result.ok) return { ok: false, error: result.error };
  return done();
}

/**
 * This studio got the work.
 *
 * The column every stored quote exists to eventually fill. Without it we have
 * a record of what we priced and no record of what worked — homework nobody
 * marks — and the question the business actually has to answer one day is
 * which quotes turned into projects and what those had in common.
 *
 * Ops records it because ops is the only party who reliably finds out. The
 * studio knows, but a studio marking its own win in its own CRM is a claim
 * about money it owes us, and the source is stored precisely so the two can be
 * told apart later.
 *
 * There is deliberately no "mark as lost". Most briefs never reach a decision
 * at all, and a screen with a Lost button gets one pressed on every quiet row
 * — after which the data says we lose nearly everything. Silence stays
 * silence.
 */
export async function recordWonAction(introductionId: string): Promise<Result> {
  await requireRole('OPS');

  const intro = await prisma.introduction.findUnique({
    where: { id: introductionId },
    select: { briefId: true, studioId: true, withdrawnAt: true },
  });
  if (!intro) return { ok: false, error: 'That introduction no longer exists.' };
  if (intro.withdrawnAt) {
    return {
      ok: false,
      error: 'This introduction was withdrawn. It cannot also be the one that won.',
    };
  }

  await recordOutcome({
    briefId: intro.briefId,
    wonByStudioId: intro.studioId,
    source: 'OPS_RECORDED',
  });

  return done();
}
