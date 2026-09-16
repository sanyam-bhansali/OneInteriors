import 'server-only';

/**
 * Introductions and the meetings that follow them.
 *
 * The pure halves live in `introduction-access.ts` (who may see a customer's
 * details) and `appointment-rules.ts` (what may happen to an appointment).
 * Those two hold every decision worth testing; this file is Postgres, auth and
 * audit.
 *
 * ## The rule that shapes this whole module
 *
 * An introduction is created by a person, never by a code path a customer can
 * trigger. If reaching some threshold in the product could introduce you to a
 * studio, the expert call would stop being the gate — and the expert call being
 * the gate is the entire quality mechanic and the reason the fee exists.
 */

import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { requireRole, getCurrentUser } from '@/modules/auth/session';
import { canSeeContact, contactState, type ContactState } from './introduction-access';
import {
  canTransition,
  validateTransition,
  type AppointmentKindName,
  type AppointmentStatusName,
  type NoShowPartyName,
} from './appointment-rules';

export type IntroResult = { ok: true; id: string } | { ok: false; error: string };
export type ActionResult = { ok: true } | { ok: false; error: string };

export {
  canSeeContact,
  contactState,
  redactContact,
} from './introduction-access';
export type { ContactState } from './introduction-access';
export {
  KIND_LABELS,
  STATUS_LABELS,
  formatSlot,
  groupByDay,
  needsOutcome,
  upcoming,
  isTerminal,
  hasPassed,
} from './appointment-rules';
export type {
  AppointmentKindName,
  AppointmentStatusName,
  NoShowPartyName,
} from './appointment-rules';

// ── Creating the introduction ──────────────────────────────────

/**
 * Hand a customer to a studio.
 *
 * `releaseContact` defaults to true because that is the normal case — the
 * expert has just been on the phone and the customer has said yes. Passing
 * false is for the case where they want to think about it: the studio learns a
 * brief is coming and nothing about who.
 */
export async function createIntroduction(input: {
  briefId: string;
  studioId: string;
  consultationId?: string;
  releaseContact?: boolean;
}): Promise<IntroResult> {
  const actor = await requireRole('OPS');
  if (!hasDatabase()) return { ok: false, error: 'No database on this deployment.' };

  const { briefId, studioId } = input;
  if (!briefId || !studioId) return { ok: false, error: 'Need a brief and a studio.' };

  const studio = await prisma.studio.findUnique({
    where: { id: studioId },
    select: { id: true, tradeName: true, status: true },
  });
  if (!studio) return { ok: false, error: 'No such studio.' };

  /**
   * A paused or unapproved studio cannot be introduced to anybody. The matching
   * engine already refuses to show them; an introduction made by hand would
   * walk straight around that filter, which is exactly the kind of exception
   * that turns a rule into a guideline.
   */
  if (studio.status !== 'ACTIVE') {
    return { ok: false, error: `${studio.tradeName} is not active. Approve or resume them first.` };
  }

  const releaseContact = input.releaseContact !== false;

  try {
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.introduction.upsert({
        where: { briefId_studioId: { briefId, studioId } },
        create: {
          briefId,
          studioId,
          consultationId: input.consultationId ?? null,
          introducedById: actor.id,
          contactReleasedAt: releaseContact ? new Date() : null,
        },
        // Re-introducing after a withdrawal is a deliberate act and clears it.
        // Anything else about the row stays as it was: the original
        // `introducedAt` is the date this relationship began.
        update: {
          withdrawnAt: null,
          withdrawnReason: null,
          ...(releaseContact ? { contactReleasedAt: new Date() } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'introduction.create',
          entityType: 'Introduction',
          entityId: created.id,
          after: { briefId, studioId, releaseContact },
        },
      });

      return created;
    });

    return { ok: true, id: row.id };
  } catch (error) {
    console.error('[introduction] create failed', error);
    return { ok: false, error: 'That did not save.' };
  }
}

/** Release contact details on an introduction made without them. */
export async function releaseContactDetails(introductionId: string): Promise<ActionResult> {
  const actor = await requireRole('OPS');

  try {
    await prisma.$transaction(async (tx) => {
      await tx.introduction.update({
        where: { id: introductionId },
        data: { contactReleasedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'introduction.release',
          entityType: 'Introduction',
          entityId: introductionId,
        },
      });
    });
    return { ok: true };
  } catch {
    return { ok: false, error: 'That did not save.' };
  }
}

/**
 * The customer changed their mind.
 *
 * Contact access ends immediately, and future appointments are cancelled —
 * leaving a confirmed meeting standing against a withdrawn introduction is how
 * a studio turns up at a door they are no longer welcome at.
 */
export async function withdrawIntroduction(
  introductionId: string,
  reason: string,
): Promise<ActionResult> {
  const actor = await requireRole('OPS');

  const trimmed = reason.trim();
  if (trimmed.length < 8) {
    return { ok: false, error: 'Say why. The studio will ask, and you will not remember.' };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.introduction.update({
        where: { id: introductionId },
        data: { withdrawnAt: new Date(), withdrawnReason: trimmed },
      });

      await tx.appointment.updateMany({
        where: { introductionId, status: { in: ['PROPOSED', 'CONFIRMED'] } },
        data: { status: 'CANCELLED' },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'introduction.withdraw',
          entityType: 'Introduction',
          entityId: introductionId,
          after: { reason: trimmed },
        },
      });
    });
    return { ok: true };
  } catch {
    return { ok: false, error: 'That did not save.' };
  }
}

// ── Appointments ───────────────────────────────────────────────

/**
 * Propose a meeting or site visit.
 *
 * Either side may propose; only ops confirms on the customer's behalf, because
 * the customer has no account-side scheduling surface yet and the copy promises
 * we arrange it.
 */
export async function proposeAppointment(input: {
  introductionId: string;
  kind: AppointmentKindName;
  startsAt: Date;
  durationMins?: number;
  location?: string;
}): Promise<IntroResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Sign in first.' };

  if (Number.isNaN(input.startsAt.getTime())) {
    return { ok: false, error: 'That date did not parse.' };
  }
  if (input.startsAt.getTime() < Date.now() - 60 * 60 * 1000) {
    return { ok: false, error: 'That time is in the past.' };
  }

  const duration = input.durationMins ?? 60;
  if (!Number.isInteger(duration) || duration < 15 || duration > 480) {
    return { ok: false, error: 'Somewhere between 15 minutes and eight hours.' };
  }

  const introduction = await prisma.introduction.findUnique({
    where: { id: input.introductionId },
    select: { id: true, studioId: true, withdrawnAt: true },
  });
  if (!introduction) return { ok: false, error: 'No such introduction.' };
  if (introduction.withdrawnAt) {
    return { ok: false, error: 'That introduction has been withdrawn.' };
  }

  /**
   * A studio may only touch its own. Ops may touch any. Everyone else, no.
   *
   * Written as "not ops" rather than "is studio" deliberately. CUSTOMER is the
   * default role for every account in the system, so gating on
   * `role === 'STUDIO'` let every signed-in customer fall past the check
   * entirely and post an appointment onto any introduction they could name —
   * and this is reachable from a server action, which is directly invocable.
   * The allow-list has to be the narrow set, never the denied one.
   */
  if (user.role !== 'OPS' && user.role !== 'ADMIN') {
    const member = await prisma.studioMember.findUnique({
      where: { userId: user.id },
      select: { studioId: true },
    });
    if (member?.studioId !== introduction.studioId) {
      return { ok: false, error: 'That is not your introduction.' };
    }
  }

  try {
    const created = await prisma.appointment.create({
      data: {
        introductionId: input.introductionId,
        kind: input.kind,
        startsAt: input.startsAt,
        durationMins: duration,
        location: input.location?.trim() || null,
        proposedById: user.id,
      },
    });
    return { ok: true, id: created.id };
  } catch (error) {
    console.error('[appointment] propose failed', error);
    return { ok: false, error: 'That did not save.' };
  }
}

/**
 * Move an appointment along.
 *
 * The transition rules are pure and live in `appointment-rules.ts`; this checks
 * who is asking and writes. A studio cannot mark a no-show — that fact ends up
 * in their own delivery record and both sides will have a view of what
 * happened.
 */
export async function setAppointmentStatus(
  appointmentId: string,
  to: AppointmentStatusName,
  options: { noShowBy?: NoShowPartyName | null; notes?: string } = {},
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Sign in first.' };

  const actor = user.role === 'OPS' || user.role === 'ADMIN' ? 'OPS' : 'STUDIO';

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      status: true,
      introduction: { select: { studioId: true } },
    },
  });
  if (!appointment) return { ok: false, error: 'No such appointment.' };

  if (actor === 'STUDIO') {
    const member = await prisma.studioMember.findUnique({
      where: { userId: user.id },
      select: { studioId: true },
    });
    if (member?.studioId !== appointment.introduction.studioId) {
      return { ok: false, error: 'That is not your appointment.' };
    }
  }

  const from = appointment.status as AppointmentStatusName;

  if (!canTransition(from, to, actor)) {
    // The two failure modes read very differently to the person hitting them,
    // so they get different sentences.
    if (canTransition(from, to, 'OPS')) {
      return { ok: false, error: 'Tell us instead — we record that one, so both sides are heard.' };
    }
    return { ok: false, error: `Cannot go from ${from.toLowerCase()} to ${to.toLowerCase()}.` };
  }

  const noShowBy = options.noShowBy ?? null;
  const valid = validateTransition(to, noShowBy);
  if (!valid.ok) return valid;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status: to,
          noShowBy,
          confirmedAt: to === 'CONFIRMED' ? new Date() : undefined,
          // Ops notes only. A studio's words never land in an internal field.
          ...(actor === 'OPS' && options.notes ? { notes: options.notes.trim() } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: `appointment.${to.toLowerCase()}`,
          entityType: 'Appointment',
          entityId: appointmentId,
          before: { status: from },
          after: { status: to, noShowBy },
        },
      });
    });
    return { ok: true };
  } catch (error) {
    console.error('[appointment] status change failed', error);
    return { ok: false, error: 'That did not save.' };
  }
}

// ── Reads ──────────────────────────────────────────────────────

export interface StudioAppointment {
  id: string;
  introductionId: string;
  kind: AppointmentKindName;
  status: AppointmentStatusName;
  startsAt: Date;
  durationMins: number;
  location: string | null;
  noShowBy: NoShowPartyName | null;
  /** Null whenever the release rule says so. Never a placeholder. */
  customerName: string | null;
  customerPhone: string | null;
  /** Why the details are hidden, when they are. */
  contact: ContactState;
  /** Always safe to show — this is the brief, not the person. */
  locality: string | null;
  propertyType: string | null;
}

/**
 * One studio's calendar.
 *
 * The contact redaction happens HERE, at the module boundary, not in the page.
 * By the time a value reaches JSX it has been spread through two objects and
 * the guarantee is gone; a component that forgets to branch should get a null,
 * not a name.
 */
export async function myAppointments(options: { from?: Date; to?: Date } = {}): Promise<
  StudioAppointment[]
> {
  /**
   * `getCurrentUser`, deliberately, and NOT `requireRole`.
   *
   * `requireRole` throws. This is a read called while a page renders, and Next
   * renders a layout and its page in parallel — so the throw beats the layout's
   * redirect and the visitor gets a 500 where they should have got a sign-in
   * screen. That exact bug took /ops down once already; the fix there was to
   * remove the throwing guard from every render-path read, and the same applies
   * here.
   *
   * The layout is the gate. This returns nothing to anyone who is not a studio,
   * which is the correct behaviour for a read even when the gate is missing.
   */
  const user = await getCurrentUser();
  if (!user || !hasDatabase()) return [];

  const member = await prisma.studioMember.findUnique({
    where: { userId: user.id },
    select: { studioId: true },
  });
  if (!member) return [];

  const rows = await prisma.appointment.findMany({
    where: {
      introduction: { studioId: member.studioId },
      ...(options.from || options.to
        ? { startsAt: { ...(options.from ? { gte: options.from } : {}), ...(options.to ? { lte: options.to } : {}) } }
        : {}),
    },
    orderBy: { startsAt: 'asc' },
    select: {
      id: true,
      kind: true,
      status: true,
      startsAt: true,
      durationMins: true,
      location: true,
      noShowBy: true,
      introductionId: true,
      introduction: {
        select: {
          contactReleasedAt: true,
          withdrawnAt: true,
          consultationId: true,
          brief: { select: { locality: true, propertyType: true } },
        },
      },
    },
  });

  /**
   * The contact details come from the consultation this introduction actually
   * came out of, not from whichever is newest on the brief.
   *
   * Same person either way today, since a brief has one customer — but
   * `Introduction.consultationId` records exactly which call produced the
   * handoff, and reading "the latest one" instead would quietly break the day a
   * customer books a second call with different contact details.
   *
   * A separate query because `consultationId` is a plain column with no
   * relation, so it cannot be nested.
   */
  const consultationIds = rows
    .map((row) => row.introduction.consultationId)
    .filter((id): id is string => id !== null);

  const consultations =
    consultationIds.length === 0
      ? []
      : await prisma.consultation.findMany({
          where: { id: { in: consultationIds } },
          select: { id: true, contactName: true, contactPhone: true },
        });

  const byId = new Map(consultations.map((c) => [c.id, c]));

  return rows.map((row) => {
    const visible = canSeeContact(row.introduction);
    const consultation = row.introduction.consultationId
      ? byId.get(row.introduction.consultationId)
      : undefined;

    return {
      id: row.id,
      introductionId: row.introductionId,
      kind: row.kind as AppointmentKindName,
      status: row.status as AppointmentStatusName,
      startsAt: row.startsAt,
      durationMins: row.durationMins,
      location: row.location,
      noShowBy: row.noShowBy as NoShowPartyName | null,
      customerName: visible ? (consultation?.contactName ?? null) : null,
      customerPhone: visible ? (consultation?.contactPhone ?? null) : null,
      contact: contactState(row.introduction),
      locality: row.introduction.brief.locality,
      propertyType: row.introduction.brief.propertyType,
    };
  });
}

/** How many introductions this studio has had, and how many still stand. */
export async function introductionCounts(
  studioId: string,
  since: Date,
): Promise<{ total: number; withdrawn: number }> {
  if (!hasDatabase()) return { total: 0, withdrawn: 0 };

  try {
    const [total, withdrawn] = await Promise.all([
      prisma.introduction.count({ where: { studioId, introducedAt: { gte: since } } }),
      prisma.introduction.count({
        where: { studioId, introducedAt: { gte: since }, withdrawnAt: { not: null } },
      }),
    ]);
    return { total, withdrawn };
  } catch {
    return { total: 0, withdrawn: 0 };
  }
}
