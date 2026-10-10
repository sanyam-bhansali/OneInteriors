import 'server-only';

/**
 * Keep what the app showed a customer: their matches (Match rows, the same
 * engine and version /match stores) and each matched studio's first quote
 * (FirstQuote rows). Before this the app ranked and priced only in the
 * browser, so an app customer's expert call fell back to another price list
 * than the one they had read (review, 11 Oct).
 */

import { prisma } from '@/lib/prisma';
import { filedRatesFor } from '@/data/filed-rates';
import { getCurrentUser } from '@/modules/auth/session';
import { readAnonKey } from '@/modules/brief/repository';
import { storeMatches } from '@/modules/matching/store';
import { recordFirstQuoteForBrief } from '@/modules/quotation/journey-repository';
import { homeShapeFor } from '@/modules/quotation/first-quote';
import type { Brief } from '@/modules/brief/types';
import type { AppData } from '@/app/app/data';
import { topMatches, quotesFor } from './journey';

async function myBriefId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (user) {
    const row = await prisma.brief.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (row) return row.id;
  }
  const anonKey = await readAnonKey();
  if (!anonKey) return null;
  return (await prisma.brief.findUnique({ where: { anonKey }, select: { id: true } }))?.id ?? null;
}

export async function recordJourney(brief: Brief, data: AppData): Promise<void> {
  try {
    const briefId = await myBriefId();
    if (!briefId) return;
    const matched = topMatches(brief, data.studios, data.rates, filedRatesFor, data.allowUnverified);
    if (matched.length === 0) return;
    await storeMatches(briefId, matched.map((m) => m.match));
    const shape = homeShapeFor(brief);
    const plan = shape.plan
      ? { fileName: shape.plan.fileName, kitchenRunMm: shape.plan.kitchenRunMm, source: 'floor_plan' as const, shared: shape.plan.shared }
      : { fileName: null, kitchenRunMm: null, source: 'standard' as const };
    for (const q of quotesFor(brief, matched, data.rates, filedRatesFor)) {
      await recordFirstQuoteForBrief(briefId, { studioSlug: q.slug, quote: q.quote, plan });
    }
  } catch (error) {
    console.error('[app] recordJourney failed', error instanceof Error ? error.name : 'unknown');
  }
}
