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
import { requireRole, getCurrentUser, hasRole } from '@/modules/auth/session';
import { readAnonKey } from '@/modules/brief/repository';
import { normalisePhone } from '@/modules/studio/phone';
import { isValidEmail, normaliseEmail } from '@/modules/auth/magic-link';
import { record } from '@/modules/analytics/record';
import { missingCoreRates } from '@/modules/quotation/categories';

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

/**
 * How many studios could actually be quoted today.
 *
 * ## Why this exists, and why it is not a constant
 *
 * `MIN_STUDIOS = 2` is a good rule that nearly killed the launch. On a roster
 * of two, one studio with an incomplete rate card leaves exactly one quotable
 * studio — and `/expert` then rendered a single checkbox above a permanently
 * greyed-out button, with copy asking the customer to pick two. No error, no
 * explanation, and no way for anybody to request a call. The first customer
 * would simply have bounced, and nothing in our logs would have said why.
 *
 * The rule is right whenever it can be satisfied and wrong when it cannot. A
 * call with one studio is still worth having; it is a different call, and the
 * copy says so. So the minimum is `min(MIN_STUDIOS, what exists)` — enforced on
 * the server, because the page passing its own minimum would be a client
 * deciding its own validation.
 *
 * Counted against `missingCoreRates`, the same gate onboarding uses, so a
 * studio that this says is quotable is one the quote engine will also accept.
 */
export async function quotableStudioCount(): Promise<number> {
  if (!hasDatabase()) return 0;

  try {
    const studios = await prisma.studio.findMany({
      where: { status: 'ACTIVE', pausedAt: null },
      select: { id: true, rateCard: { select: { category: true, ratePaise: true } } },
    });

    return studios.filter((s) => {
      const rates: Partial<Record<string, number>> = {};
      for (const item of s.rateCard) rates[item.category] = Number(item.ratePaise);
      return missingCoreRates(rates as never).length === 0;
    }).length;
  } catch {
    // Falling back to the strict minimum rather than to zero: a failure here
    // must not silently relax a rule, and it must not block every request
    // either. Two is what the rule was before this function existed.
    return MIN_STUDIOS;
  }
}

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

  // The minimum is whatever the roster can actually offer — see
  // `quotableStudioCount`. On a full roster this is 2 and nothing changes.
  const available = await quotableStudioCount();
  const min = Math.max(1, Math.min(MIN_STUDIOS, available));

  if (input.studioIds.length < min) {
    errors.studioIds =
      min === 1
        ? 'Pick the studio you want to talk about.'
        : `Pick at least ${min} studios — the call is about choosing between them.`;
  }
  if (input.studioIds.length > MAX_STUDIOS) {
    errors.studioIds = `Pick up to ${MAX_STUDIOS}. Past that the call stops being a decision and becomes a tour.`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  /* OWNERSHIP, not existence.
     This was `findUnique({ where: { id } })` — which proves a brief exists and
     nothing else — sitting directly under a comment promising it proved
     ownership. Anyone who learned a brief id could attach their own name,
     phone and email to a stranger's brief and drop it in the expert queue,
     from an action with no authentication at all. Resolved the way
     `signedUrlFor` does it: the signed-in user, or the anon cookie this
     browser is actually carrying. */
  const requester = await getCurrentUser();
  const anonKey = await readAnonKey();

  const owners = [
    ...(requester ? [{ userId: requester.id }] : []),
    ...(anonKey ? [{ anonKey }] : []),
  ];

  const brief =
    owners.length === 0
      ? null
      : await prisma.brief.findFirst({
          where: { id: input.briefId, OR: owners },
          select: { id: true },
        });

  /* The same message whether it is missing or simply not theirs. Telling a
     stranger that a brief exists but belongs to somebody else is a disclosure
     in itself. */
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
  /**
   * Paired with `studioNames` by index.
   *
   * Needed since the expert can now record which studio they recommended and
   * create the introduction from the same form — and that write takes an id.
   * Kept alongside the names rather than replacing them because the card reads
   * better with names and the form needs ids.
   */
  studioIds: string[];
  askedAbout: string | null;
  preferredTimes: string | null;
  status: string;
  /** When the call is booked for, once somebody has set a time. */
  scheduledFor: Date | null;
  createdAt: Date;
}

/**
 * The ops queue. Oldest first — somebody has been waiting longest.
 *
 * `hasRole` and not `requireRole`, for the reason written out three times
 * elsewhere in this codebase and missed here: `requireRole` THROWS, this is
 * awaited during a page render, and Next renders a layout and its page in
 * parallel — so the throw beats `/ops/layout.tsx`'s redirect and a signed-out
 * visitor gets a stack trace instead of the sign-in screen.
 *
 * It was worse than that. `DEV_OPS_NO_AUTH=1` makes the layout return children
 * with no user at all, so this page — the busiest one ops has — was the single
 * route where the dev bypass produced a guaranteed 500.
 *
 * Returning an empty list is both safe and correct: the layout is the gate, and
 * a non-ops caller has no consultations by definition.
 */
export async function listConsultations(status?: string): Promise<ConsultationRow[]> {
  const user = await getCurrentUser();
  if (!hasRole(user, 'OPS')) return [];
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
    studioIds: r.studioIds,
    askedAbout: r.askedAbout,
    preferredTimes: r.preferredTimes,
    status: r.status,
    scheduledFor: r.scheduledFor,
    createdAt: r.createdAt,
  }));
}

export async function setConsultationStatus(
  id: string,
  status: 'scheduled' | 'completed' | 'no_show' | 'cancelled',
  notes?: string,
  /**
   * When the call is actually booked for.
   *
   * `scheduledFor` sat in the schema with no writer anywhere, which meant
   * marking a call "scheduled" recorded that a decision had been made and not
   * what the decision was. Ops could not see when their own calls were, and the
   * overview's queue counted rows that never moved.
   */
  scheduledFor?: Date,
): Promise<{ ok: boolean }> {
  const actor = await requireRole('OPS');

  await prisma.$transaction(async (tx) => {
    await tx.consultation.update({
      where: { id },
      data: {
        status,
        expertUserId: actor.id,
        outcomeNotes: notes?.trim() || undefined,
        ...(scheduledFor && !Number.isNaN(scheduledFor.getTime()) ? { scheduledFor } : {}),
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
/**
 * Consultations on a brief — the caller's own brief, and nobody else's.
 *
 * This took a briefId and checked only that SOMEBODY was signed in, then
 * returned `contactName`, `contactPhone` and `contactEmail`. Its one caller
 * happened to pass the caller's own id, so it was not exploitable — but it
 * was one new action away from a cross-customer PII read, which is not a
 * margin worth keeping.
 */
export async function myConsultations(briefId: string): Promise<ConsultationRow[]> {
  const user = await getCurrentUser();
  if (!user || !hasDatabase()) return [];

  const rows = await prisma.consultation.findMany({
    where: {
      briefId,
      /* Scoped to the caller. See the header. */
      brief: {
        OR: [
          ...(user ? [{ userId: user.id }] : []),
          ...((await readAnonKey()) ? [{ anonKey: (await readAnonKey())! }] : []),
        ],
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return rows.map((r) => ({
    id: r.id,
    briefId: r.briefId,
    contactName: r.contactName,
    contactPhone: r.contactPhone,
    contactEmail: r.contactEmail,
    studioNames: [],
    studioIds: r.studioIds,
    askedAbout: r.askedAbout,
    preferredTimes: r.preferredTimes,
    status: r.status,
    scheduledFor: r.scheduledFor,
    createdAt: r.createdAt,
  }));
}
