import 'server-only';

import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { requireRole } from '@/modules/auth/session';
import { WINDOW_DAYS, isOutcome, isOverdue, needsFollowUp } from './follow-up';

export interface FollowUpRow {
  briefId: string;
  name: string | null;
  phone: string;
  email: string | null;
  locality: string | null;
  propertyType: string | null;
  tier: string | null;
  completedAt: Date;
  matches: number;
  outcome: string | null;
  note: string | null;
  tries: number;
  overdue: boolean;
}

/** Today's call list, oldest brief first. Ops only. */
export async function followUpList(now = new Date()): Promise<FollowUpRow[]> {
  await requireRole('OPS');
  if (!hasDatabase()) return [];
  const since = new Date(now.getTime() - WINDOW_DAYS * 86_400_000);
  const briefs = await prisma.brief.findMany({
    where: { completedAt: { gte: since }, contactPhone: { not: null }, consultations: { none: {} } },
    orderBy: { completedAt: 'asc' },
    take: 500,
    select: {
      id: true,
      contactName: true,
      contactPhone: true,
      contactEmail: true,
      locality: true,
      propertyType: true,
      tier: true,
      completedAt: true,
      followUpOutcome: true,
      followUpNote: true,
      followUpTries: true,
      followedUpAt: true,
      _count: { select: { matches: true } },
    },
  });
  return briefs
    .filter((b) =>
      needsFollowUp(
        {
          completedAt: b.completedAt,
          hasPhone: Boolean(b.contactPhone?.trim()),
          hasCall: false,
          outcome: b.followUpOutcome,
          followedUpAt: b.followedUpAt,
          tries: b.followUpTries,
        },
        now,
      ),
    )
    .map((b) => ({
      briefId: b.id,
      name: b.contactName,
      phone: b.contactPhone!,
      email: b.contactEmail,
      locality: b.locality,
      propertyType: b.propertyType,
      tier: b.tier,
      completedAt: b.completedAt!,
      matches: b._count.matches,
      outcome: b.followUpOutcome,
      note: b.followUpNote,
      tries: b.followUpTries,
      overdue: isOverdue({ completedAt: b.completedAt, outcome: b.followUpOutcome }, now),
    }));
}

export type FollowUpResult = { ok: true } | { ok: false; error: string };

/** Record what happened on the call. */
export async function recordFollowUp(briefId: string, outcome: unknown, note: string): Promise<FollowUpResult> {
  await requireRole('OPS');
  if (!isOutcome(outcome)) return { ok: false, error: 'Pick what happened on the call.' };
  const unanswered = outcome === 'NO_ANSWER' || outcome === 'CALL_BACK';
  await prisma.brief.update({
    where: { id: briefId },
    data: {
      followUpOutcome: outcome,
      followUpNote: note.trim().slice(0, 1000) || null,
      followedUpAt: new Date(),
      ...(unanswered ? { followUpTries: { increment: 1 } } : {}),
    },
  });
  return { ok: true };
}
