import 'server-only';

/**
 * The signed-in customer's home, read for the phone app's "Me" header and
 * for GEIO's facts: their brief, and their project once a studio is signed.
 *
 * A family member has no brief of their own; their home is the one on the
 * project they joined, so they read that brief instead.
 */

import { prisma } from '@/lib/prisma';
import { fromDb } from '@/lib/money';
import { hasDatabase } from '@/lib/env';
import { customerProjects } from '@/modules/portal/project-store';
import { notifyOps } from '@/modules/notify/service';
import { briefFacts, geioFacts, projectFacts, type GeioFacts } from './geio-facts';
import { homeSummary, type HomeBrief } from './home-summary';

const HOME_FIELDS = {
  propertyType: true,
  carpetAreaSqft: true,
  locality: true,
  society: true,
  scope: true,
  scopeRooms: true,
  tier: true,
  budgetMinPaise: true,
  budgetMaxPaise: true,
  possessionStatus: true,
  possessionOn: true,
} as const;

export async function homeBriefFor(userId: string): Promise<HomeBrief | null> {
  const own = await prisma.brief.findUnique({ where: { userId }, select: HOME_FIELDS });
  const row =
    own ??
    (await prisma.brief.findFirst({
      where: { introductions: { some: { homeProject: { family: { some: { userId, joinedAt: { not: null }, removedAt: null } } } } } },
      orderBy: { updatedAt: 'desc' },
      select: HOME_FIELDS,
    }));
  if (!row) return null;
  return {
    ...row,
    budgetMinPaise: row.budgetMinPaise === null ? null : fromDb(row.budgetMinPaise),
    budgetMaxPaise: row.budgetMaxPaise === null ? null : fromDb(row.budgetMaxPaise),
    possessionOn: row.possessionOn?.toISOString() ?? null,
  };
}

/**
 * What GEIO is told for this person: their project and brief when signed in,
 * the labelled example only when nobody is (or there is no database to read).
 */
export async function geioFactsFor(userId: string | null, expert: string, now = new Date()): Promise<GeioFacts> {
  if (!userId || !hasDatabase()) return geioFacts(expert);
  const [projects, brief] = await Promise.all([customerProjects(userId, now, { links: false }), homeBriefFor(userId)]);
  const project = projects[0];
  return project ? projectFacts(expert, project, brief, now) : briefFacts(expert, brief, now);
}

/**
 * GEIO passed a question to the expert: tell ops, so the promise in the
 * answer ("I have passed your question to your expert") is kept. There is no
 * model for an expert's inbox yet and a Consultation is a booked call, not a
 * note, so this goes as an ops notice — in the app's list and by email — with
 * the note the model wrote for the expert. Never for the signed-out sample.
 */
export async function handOverToExpert(user: { id: string; name: string | null; phone: string | null }, note: string): Promise<void> {
  const home = homeSummary(await homeBriefFor(user.id).catch(() => null));
  await notifyOps({
    kind: 'geio-handover',
    customer: user.name?.trim() || user.phone || 'A customer',
    home: home?.label ?? null,
    note,
  });
}
