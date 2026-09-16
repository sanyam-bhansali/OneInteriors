import 'server-only';

/**
 * The ops side of an introduction.
 *
 * ## Why this file had to exist
 *
 * `createIntroduction` was called from exactly one place and then nothing ever
 * looked at the row again. `withdrawIntroduction` and `releaseContactDetails`
 * had no caller anywhere in the codebase — two functions written against real
 * situations (a customer changes their mind; an expert introduces without
 * releasing contact details and the customer later says yes) with no route to
 * either.
 *
 * So the moment the handoff was made, ops went blind: no screen said who had
 * been introduced, whether a meeting had been arranged, or whether anybody had
 * turned up. The studio held every control and we held none — on the one event
 * the business charges a fee for.
 *
 * ## The rule this file keeps
 *
 * Ops sees everything about the RELATIONSHIP and nothing a studio wrote in
 * private. Contact details appear here because ops released them and will be
 * asked to release them again; a studio's own notes do not appear here at all,
 * and there is no query in this file that could return one.
 */

import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { getCurrentUser, hasRole } from '@/modules/auth/session';
import { contactState, type ContactState } from './introduction-access';
import type { AppointmentKindName, AppointmentStatusName } from './appointment-rules';
import { whatItNeeds, type IntroductionNeed } from './introduction-needs';

// The pure half lives next door so Vitest can reach it — CONTRIBUTING §9.5.
export { whatItNeeds, NEED_LABEL } from './introduction-needs';
export type { IntroductionNeed } from './introduction-needs';

export interface OpsAppointment {
  id: string;
  kind: AppointmentKindName;
  status: AppointmentStatusName;
  startsAt: Date;
  durationMins: number;
  location: string | null;
  noShowBy: string | null;
}

export interface OpsIntroduction {
  id: string;
  introducedAt: Date;
  withdrawnAt: Date | null;
  withdrawnReason: string | null;
  contactReleasedAt: Date | null;
  contact: ContactState;

  studioId: string;
  studioName: string;
  studioSlug: string;

  briefId: string;
  customerName: string | null;
  customerPhone: string | null;
  locality: string | null;
  propertyType: string | null;

  appointments: OpsAppointment[];

  /**
   * What, if anything, this row is waiting on us for. Null when nothing is.
   *
   * Computed here rather than in the page so the overview count and the list
   * can never disagree about what "needs you" means — that disagreement is the
   * defect where a badge says 3 and the screen shows 5.
   */
  needs: IntroductionNeed | null;
}

/**
 * Every introduction, newest first.
 *
 * `hasRole` and not `requireRole`: this is a render-path read, and
 * `requireRole` throws — which races the layout's redirect and produces a 500
 * where a redirect belongs. The same mistake was live on two other ops pages
 * until today.
 */
export async function listIntroductions(limit = 100): Promise<OpsIntroduction[]> {
  const user = await getCurrentUser();
  if (!hasRole(user, 'OPS')) return [];
  if (!hasDatabase()) return [];

  try {
    const rows = await prisma.introduction.findMany({
      orderBy: { introducedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        briefId: true,
        introducedAt: true,
        withdrawnAt: true,
        withdrawnReason: true,
        contactReleasedAt: true,
        consultationId: true,
        studio: { select: { id: true, tradeName: true, slug: true } },
        brief: { select: { locality: true, propertyType: true } },
        appointments: {
          orderBy: { startsAt: 'asc' },
          select: {
            id: true,
            kind: true,
            status: true,
            startsAt: true,
            durationMins: true,
            location: true,
            noShowBy: true,
          },
        },
      },
    });

    /**
     * Contact details come from the consultation the introduction came out of,
     * the same way the studio's own calendar reads them — `Introduction`
     * carries a plain `consultationId` with no relation, so it cannot be
     * nested and has to be a second query.
     */
    const consultationIds = rows
      .map((r) => r.consultationId)
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
      const consultation = row.consultationId ? byId.get(row.consultationId) : undefined;
      const appointments = row.appointments.map((a) => ({
        id: a.id,
        kind: a.kind as AppointmentKindName,
        status: a.status as AppointmentStatusName,
        startsAt: a.startsAt,
        durationMins: a.durationMins,
        location: a.location,
        noShowBy: a.noShowBy as string | null,
      }));

      return {
        id: row.id,
        introducedAt: row.introducedAt,
        withdrawnAt: row.withdrawnAt,
        withdrawnReason: row.withdrawnReason,
        contactReleasedAt: row.contactReleasedAt,
        contact: contactState(row),
        studioId: row.studio.id,
        studioName: row.studio.tradeName,
        studioSlug: row.studio.slug,
        briefId: row.briefId,
        // Ops released these and may be asked to release them again, so ops
        // sees them. The studio's view is redacted by `canSeeContact`; this is
        // the other side of the same rule, not an exception to it.
        customerName: consultation?.contactName ?? null,
        customerPhone: consultation?.contactPhone ?? null,
        locality: row.brief.locality,
        propertyType: row.brief.propertyType,
        appointments,
        needs: whatItNeeds(row.withdrawnAt, appointments),
      };
    });
  } catch (error) {
    console.error('[ops] listIntroductions failed', error);
    return [];
  }
}

/** How many introductions are waiting on us. For the overview. */
export async function introductionsNeedingUs(): Promise<number> {
  const rows = await listIntroductions(200);
  return rows.filter((r) => r.needs !== null).length;
}

/**
 * Which of these briefs have an introduction at all.
 *
 * Used by the calls page to spot a completed call that produced no handoff —
 * the state the customer experiences as being promised a studio on the phone
 * and then never hearing from one.
 *
 * A withdrawn introduction still counts as made. The question this answers is
 * "did the handoff happen", not "is it still running"; a withdrawal is a later
 * event with its own record, and folding the two together would put every
 * cancelled customer back in the queue as unfinished work.
 */
export async function introducedBriefIds(briefIds: string[]): Promise<Set<string>> {
  if (briefIds.length === 0 || !hasDatabase()) return new Set();

  const user = await getCurrentUser();
  if (!hasRole(user, 'OPS')) return new Set();

  try {
    const rows = await prisma.introduction.findMany({
      where: { briefId: { in: [...new Set(briefIds)] } },
      select: { briefId: true },
    });
    return new Set(rows.map((r) => r.briefId));
  } catch {
    // Falling back to "everything looks introduced" rather than flagging every
    // completed call as broken. A false alarm on every row trains people to
    // ignore the one that is real.
    return new Set(briefIds);
  }
}
