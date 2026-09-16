'use server';

import { revalidatePath } from 'next/cache';
import { setConsultationStatus, recordOutcome } from '@/modules/consultation/request';
// `setConsultationStatus` is still used by `scheduleCallAction` below.
import {
  createIntroduction,
  proposeAppointment,
  type AppointmentKindName,
} from '@/modules/studio/introduction';

export type OutcomeResult = { ok: true } | { ok: false; error: string };

/**
 * The end of an expert call, in one action.
 *
 * ## Why these three things are one action
 *
 * Recording the outcome, making the introduction and booking the first meeting
 * are three writes, and they are one decision. Split across three forms, the
 * expert does the first and forgets the rest — and the two that get forgotten
 * are the ones the business runs on. `recordOutcome` has existed in the
 * codebase with no UI calling it at all, which is exactly what that looks like.
 *
 * It is deliberately not a transaction. If the introduction succeeds and the
 * appointment fails, the right outcome is an introduction with no meeting
 * booked yet — not the introduction being rolled back and the customer waiting
 * on a handoff that already happened on the phone.
 */
export async function completeCallAction(input: {
  consultationId: string;
  recommendedStudioId: string;
  matchWasCorrect: boolean;
  notes: string;
  briefId: string;
  introduce: boolean;
  releaseContact: boolean;
  appointmentKind?: AppointmentKindName;
  appointmentAt?: string;
  appointmentLocation?: string;
}): Promise<OutcomeResult> {
  if (!input.recommendedStudioId) {
    return { ok: false, error: 'Say which studio you recommended.' };
  }
  if (input.notes.trim().length < 10) {
    return {
      ok: false,
      error: 'Write what happened. This is the only training data the matching engine ever gets.',
    };
  }

  /**
   * Check the meeting time BEFORE anything is written.
   *
   * `recordOutcome` sets the consultation to `completed`, and a completed
   * consultation no longer renders this form — so a failure after that point
   * left the call closed with no introduction and no screen anywhere to make
   * one. The likeliest trigger was entirely mundane: the expert types a time
   * that has already passed today, `proposeAppointment` refuses it, and the
   * handoff is stranded by a typo.
   *
   * Everything cheap enough to check first is now checked first. What cannot be
   * — a studio going inactive between two statements — is handled by the
   * recovery path on /ops/introductions rather than by pretending it cannot
   * happen.
   */
  if (input.appointmentAt && input.appointmentKind) {
    const when = new Date(input.appointmentAt);
    if (Number.isNaN(when.getTime())) {
      return { ok: false, error: 'That meeting date did not parse. Nothing has been saved.' };
    }
    if (when.getTime() < Date.now() - 60 * 60 * 1000) {
      return {
        ok: false,
        error: 'That meeting time has already passed. Nothing has been saved — fix the time and send again.',
      };
    }
  }

  const outcome = await recordOutcome(
    input.consultationId,
    input.recommendedStudioId,
    input.matchWasCorrect,
    input.notes.trim(),
  );
  // `recordOutcome` already sets the status to completed and stamps the expert,
  // so there is deliberately no `setConsultationStatus` call here — it would be
  // a second transaction and a duplicate audit row for the same fact.
  if (!outcome.ok) return { ok: false, error: 'Could not record the outcome.' };

  if (input.introduce) {
    const introduction = await createIntroduction({
      briefId: input.briefId,
      studioId: input.recommendedStudioId,
      consultationId: input.consultationId,
      releaseContact: input.releaseContact,
    });

    if (!introduction.ok) {
      // The call is recorded; only the handoff failed. Say precisely that,
      // because the expert needs to know which half to redo.
      return { ok: false, error: `Outcome saved, but the introduction did not: ${introduction.error}` };
    }

    if (input.appointmentAt && input.appointmentKind) {
      const appointment = await proposeAppointment({
        introductionId: introduction.id,
        kind: input.appointmentKind,
        startsAt: new Date(input.appointmentAt),
        location: input.appointmentLocation,
      });

      if (!appointment.ok) {
        return {
          ok: false,
          error: `Introduced, but the meeting did not save: ${appointment.error}`,
        };
      }
    }
  }

  revalidatePath('/ops/consultations');
  revalidatePath('/ops');
  return { ok: true };
}

export async function scheduleCallAction(
  consultationId: string,
  /** ISO datetime from the form. Optional so the button still works without one. */
  isoWhen?: string,
): Promise<OutcomeResult> {
  const when = isoWhen ? new Date(isoWhen) : undefined;
  if (when && Number.isNaN(when.getTime())) {
    return { ok: false, error: 'That date did not parse.' };
  }

  const result = await setConsultationStatus(consultationId, 'scheduled', undefined, when);
  if (!result.ok) return { ok: false, error: 'Could not update that.' };
  revalidatePath('/ops/consultations');
  revalidatePath('/ops');
  return { ok: true };
}
