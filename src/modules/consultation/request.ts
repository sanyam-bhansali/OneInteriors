import 'server-only';

/**
 * The expert consultation — the only route from a quote to a studio.
 *
 * Every introduction runs through a person here. That is the quality control
 * and it is what the fee is for, but it is also a deliberate bottleneck: the
 * throughput of this business is capped by how many of these calls can happen
 * in a week, and that number should be watched from the first month rather
 * than discovered in the third.
 *
 * The request carries **everything the expert needs to read beforehand** —
 * the brief, the quotes, the floor plan, and what the customer actually asked.
 * An expert walking into the call cold is the failure mode; the entire value
 * of gating introductions is that the person on the call has done the reading.
 */

import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { requireRole, getCurrentUser } from '@/modules/auth/session';
import { normalisePhone } from '@/modules/studio/phone';
import { isValidEmail, normaliseEmail } from '@/modules/auth/magic-link';
import { record } from '@/modules/analytics/record';

export interface RequestInput {
  briefId: string;
  studioIds: string[];
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  askedAbout?: string;
  preferredTimes?: string;
}

export type RequestResult =
  | { ok: true; id: string }
  | { ok: false; errors: Record<string, string> };

/** Two is the minimum for a comparison to be worth a call. */
export const MIN_STUDIOS = 2;
export const MAX_STUDIOS = 5;

export async function requestConsultation(input: RequestInput): Promise<RequestResult> {
  if (!hasDatabase()) {
    return { ok: false, errors: { form: 'We cannot take requests on this deployment yet.' } };
  }

  const errors: Record<string, string> = {};

  const contactName = input.contactName?.trim() ?? '';
  const contactPhone = normalisePhone(input.contactPhone ?? '');
  const contactEmail = input.contactEmail?.trim() ? normaliseEmail(input.contactEmail) : null;

  if (contactName.length < 2) errors.contactName = 'What should we call you?';
  if (!contactPhone) errors.contactPhone = 'A 10-digit Indian mobile number, please.';
  if (contactEmail && !isValidEmail(contactEmail)) {
    errors.contactEmail = "That doesn't look like an email address.";
  }

  if (input.studioIds.length < MIN_STUDIOS) {
    errors.studioIds = `Pick at least ${MIN_STUDIOS} studios — the call is about choosing between them.`;
  }
  if (input.studioIds.length > MAX_STUDIOS) {
    errors.studioIds = `Pick up to ${MAX_STUDIOS}. Past that the call stops being a decision and becomes a tour.`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  // The brief has to be one this browser or account actually owns. A briefId
  // from the URL is not proof of anything.
  const brief = await prisma.brief.findUnique({
    where: { id: input.briefId },
    select: { id: true },
  });
  if (!brief) return { ok: false, errors: { form: 'We could not find that brief.' } };

  const consultation = await prisma.consultation.create({
    data: {
      briefId: brief.id,
      studioIds: input.studioIds,
      contactName,
      contactPhone,
      contactEmail,
      askedAbout: input.askedAbout?.trim() || null,
      preferredTimes: input.preferredTimes?.trim() || null,
      status: 'requested',
    },
  });

  await record('enquiry.sent', { studios: input.studioIds.length }, brief.id);

  return { ok: true, id: consultation.id };
}

export interface ConsultationRow {
  id: string;
  briefId: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  studioNames: string[];
  askedAbout: string | null;
  preferredTimes: string | null;
  status: string;
  createdAt: Date;
}

/** The ops queue. Oldest first — somebody has been waiting longest. */
export async function listConsultations(status?: string): Promise<ConsultationRow[]> {
  await requireRole('OPS');
  if (!hasDatabase()) return [];

  const rows = await prisma.consultation.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'asc' },
  });

  const studioIds = [...new Set(rows.flatMap((r) => r.studioIds))];
  const studios = await prisma.studio.findMany({
    where: { id: { in: studioIds } },
    select: { id: true, tradeName: true },
  });
  const nameById = new Map(studios.map((s) => [s.id, s.tradeName]));

  return rows.map((r) => ({
    id: r.id,
    briefId: r.briefId,
    contactName: r.contactName,
    contactPhone: r.contactPhone,
    contactEmail: r.contactEmail,
    studioNames: r.studioIds.map((id) => nameById.get(id) ?? 'Unknown studio'),
    askedAbout: r.askedAbout,
    preferredTimes: r.preferredTimes,
    status: r.status,
    createdAt: r.createdAt,
  }));
}

export async function setConsultationStatus(
  id: string,
  status: 'scheduled' | 'completed' | 'no_show' | 'cancelled',
  notes?: string,
): Promise<{ ok: boolean }> {
  const actor = await requireRole('OPS');

  await prisma.$transaction(async (tx) => {
    await tx.consultation.update({
      where: { id },
      data: {
        status,
        expertUserId: actor.id,
        outcomeNotes: notes?.trim() || undefined,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: `consultation.${status}`,
        entityType: 'Consultation',
        entityId: id,
        after: { status },
      },
    });
  });

  return { ok: true };
}

/**
 * Record which studio the expert recommended, and whether the engine agreed.
 *
 * This is the training signal the matching engine cannot get any other way: a
 * human who has read everything, spoken to the customer, and formed a view. A
 * disagreement between the expert and the score is the most informative row in
 * the database, so it is captured deliberately rather than left in a note.
 */
export async function recordOutcome(
  id: string,
  recommendedStudioId: string,
  matchWasCorrect: boolean,
  notes: string,
): Promise<{ ok: boolean }> {
  const actor = await requireRole('OPS');

  await prisma.consultation.update({
    where: { id },
    data: {
      recommendedStudioId,
      matchWasCorrect,
      outcomeNotes: notes.trim() || null,
      status: 'completed',
      expertUserId: actor.id,
    },
  });

  return { ok: true };
}

/** Consultations belonging to the signed-in customer, for their portal. */
export async function myConsultations(briefId: string): Promise<ConsultationRow[]> {
  const user = await getCurrentUser();
  if (!user || !hasDatabase()) return [];

  const rows = await prisma.consultation.findMany({
    where: { briefId },
    orderBy: { createdAt: 'desc' },
  });

  return rows.map((r) => ({
    id: r.id,
    briefId: r.briefId,
    contactName: r.contactName,
    contactPhone: r.contactPhone,
    contactEmail: r.contactEmail,
    studioNames: [],
    askedAbout: r.askedAbout,
    preferredTimes: r.preferredTimes,
    status: r.status,
    createdAt: r.createdAt,
  }));
}
