import 'server-only';

import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import type { JourneyCounts } from './journey';

const EMPTY: JourneyCounts = {
  started: 0,
  finished: 0,
  leftNumber: 0,
  matched: 0,
  callBooked: 0,
  callDone: 0,
  introduced: 0,
  signed: 0,
};

/** The journey for briefs started in the last `days` days. Never throws. */
export async function journeyCounts(days = 30): Promise<JourneyCounts> {
  if (!hasDatabase()) return EMPTY;
  const cohort = { createdAt: { gte: new Date(Date.now() - days * 86_400_000) } };
  try {
    const [started, finished, leftNumber, matched, callBooked, callDone, introduced, signed] = await Promise.all([
      prisma.brief.count({ where: cohort }),
      prisma.brief.count({ where: { ...cohort, completedAt: { not: null } } }),
      prisma.brief.count({ where: { ...cohort, completedAt: { not: null }, contactPhone: { not: null } } }),
      prisma.brief.count({ where: { ...cohort, matches: { some: {} } } }),
      prisma.brief.count({
        where: { ...cohort, consultations: { some: { status: { in: ['requested', 'scheduled', 'completed'] } } } },
      }),
      prisma.brief.count({ where: { ...cohort, consultations: { some: { status: 'completed' } } } }),
      prisma.brief.count({ where: { ...cohort, introductions: { some: { withdrawnAt: null } } } }),
      prisma.brief.count({ where: { ...cohort, quoteDecision: { is: { wonByStudioId: { not: null } } } } }),
    ]);
    return { started, finished, leftNumber, matched, callBooked, callDone, introduced, signed };
  } catch (error) {
    console.error('[journey] counts unavailable', error instanceof Error ? error.name : 'unknown');
    return EMPTY;
  }
}
