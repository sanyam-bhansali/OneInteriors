import 'server-only';

/**
 * "Your home" — the customer's own portal (plan §10). Everything they have
 * with us after the brief: their matches as ranked, the booked call, the
 * studio we introduced them to and the meetings since, their room boards,
 * and where they stand for each benefit.
 *
 * Reads never throw into the page; a failure shows an empty section.
 */

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/modules/auth/session';
import { splitReasoning } from '@/modules/matching/store';
import { checkCheckIn, checkInDue, communicationRating, type CheckInInput } from '@/modules/studio/check-in';
import { stageOf, type Stage } from './benefits';

export interface HomeMatch {
  studioName: string;
  studioSlug: string;
  score: number;
  measured: string;
  firstReason: string | null;
}

export interface HomeIntroduction {
  id: string;
  studioName: string;
  studioSlug: string;
  introducedAt: Date;
  meetings: { kind: string; status: string; startsAt: Date; location: string | null }[];
  checkInDue: boolean;
  checkedIn: boolean;
}

export interface YourHome {
  matches: HomeMatch[];
  introductions: HomeIntroduction[];
  stage: Stage;
}

export async function yourHome(briefId: string | null, briefDone: boolean, now = new Date()): Promise<YourHome> {
  const empty: YourHome = { matches: [], introductions: [], stage: stageOf({ briefDone, callBooked: false, introduced: false, signed: false }) };
  if (!briefId) return empty;
  try {
    const [matches, intros, calls, decision, handedOver] = await Promise.all([
      prisma.match.findMany({
        where: { briefId },
        orderBy: { score: 'desc' },
        take: 6,
        include: { studio: { select: { tradeName: true, slug: true } } },
      }),
      prisma.introduction.findMany({
        where: { briefId, withdrawnAt: null },
        orderBy: { introducedAt: 'desc' },
        include: {
          studio: { select: { tradeName: true, slug: true } },
          appointments: { orderBy: { startsAt: 'asc' }, select: { kind: true, status: true, startsAt: true, location: true } },
          checkIn: { select: { id: true } },
        },
      }),
      prisma.consultation.count({ where: { briefId, status: { in: ['scheduled', 'completed'] } } }),
      prisma.quoteDecision.findUnique({ where: { briefId }, select: { wonByStudioId: true } }),
      prisma.homeProject.count({ where: { introduction: { briefId }, doneStages: { has: 'HANDOVER' } } }),
    ]);
    return {
      matches: matches.map((m) => ({
        studioName: m.studio.tradeName,
        studioSlug: m.studio.slug,
        score: Math.round(m.score),
        measured: `${m.factorsScored} of ${m.factorsTotal}`,
        firstReason: splitReasoning(m.reasoning)[0] ?? null,
      })),
      introductions: intros.map((i) => ({
        id: i.id,
        studioName: i.studio.tradeName,
        studioSlug: i.studio.slug,
        introducedAt: i.introducedAt,
        meetings: i.appointments.map((a) => ({ kind: a.kind, status: a.status, startsAt: a.startsAt, location: a.location })),
        checkInDue: checkInDue(i.appointments, Boolean(i.checkIn), now),
        checkedIn: Boolean(i.checkIn),
      })),
      stage: stageOf({
        briefDone,
        callBooked: calls > 0,
        introduced: intros.length > 0,
        signed: Boolean(decision?.wonByStudioId),
        handedOver: handedOver > 0,
      }),
    };
  } catch (error) {
    console.error('[home] could not read', error instanceof Error ? error.name : 'unknown');
    return empty;
  }
}

export type CheckInResult = { ok: true } | { ok: false; errors: Record<string, string> };

/**
 * Record the check-in, then refresh the studio's communication rating from
 * every check-in it has — once there are enough (check-in.ts).
 *
 * Ownership, not existence: the introduction must be on the signed-in
 * customer's own brief. The same answer whether it is missing or not theirs.
 */
export async function submitCheckIn(introductionId: string, input: CheckInInput): Promise<CheckInResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, errors: { form: 'Sign in to answer.' } };
  const errors = checkCheckIn(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const intro = await prisma.introduction.findFirst({
    where: { id: introductionId, brief: { userId: user.id } },
    select: { id: true, studioId: true, checkIn: { select: { id: true } } },
  });
  if (!intro) return { ok: false, errors: { form: 'We could not find that introduction.' } };
  if (intro.checkIn) return { ok: true };

  await prisma.meetingCheckIn.create({
    data: {
      introductionId: intro.id,
      matched: input.matched,
      communication: input.communication,
      note: input.note.trim() || null,
    },
  });

  const all = await prisma.meetingCheckIn.findMany({
    where: { introduction: { studioId: intro.studioId } },
    select: { communication: true },
    take: 500,
  });
  const rating = communicationRating(all.map((c) => c.communication));
  if (rating !== null) {
    await prisma.studio.update({ where: { id: intro.studioId }, data: { communicationRating: rating } });
  }
  return { ok: true };
}
