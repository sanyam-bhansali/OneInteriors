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
import { loadBrief, readAnonKey } from '@/modules/brief/repository';
import { storeMatches } from '@/modules/matching/store';
import { recordFirstQuoteForBrief } from '@/modules/quotation/journey-repository';
import { homeShapeFor } from '@/modules/quotation/first-quote';
import type { Brief } from '@/modules/brief/types';
import type { AppData } from './app-data';
import { listedStudios, topMatches, quotesFor } from './journey';

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

export async function recordJourney(brief: Brief, data: AppData, knownBriefId?: string): Promise<void> {
  try {
    const briefId = knownBriefId ?? (await myBriefId());
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

export type SubmitResult = { ok: true; shortlisted: number } | { ok: false; status: 400 | 409; error: string };

/**
 * The phone app's "these are my studios" after verifying (POST
 * /api/app/v1/journey/submit): keep the matches and first quotes the brief
 * produced, exactly as the website's journey route does, and the studios
 * they chose as their shortlist, in their order, so ops and the expert read
 * the same quotes the customer did. Only listed studios; the expert makes
 * every introduction, so nothing here introduces anyone.
 */
export async function submitJourney(slugs: string[], data: AppData): Promise<SubmitResult> {
  const loaded = await loadBrief();
  if (!loaded.found || !loaded.id) return { ok: false, status: 409, error: 'We do not have your brief yet. Save it and try again.' };
  if (!loaded.brief.completedAt) return { ok: false, status: 409, error: 'Finish the questions first.' };
  const listed = listedStudios(data);
  const chosen = [...new Set(slugs)].map((slug) => listed.find((s) => s.slug === slug)).filter((s) => s !== undefined);
  if (slugs.length > 0 && chosen.length === 0) return { ok: false, status: 400, error: 'Those studios are not taking work just now.' };

  const briefId = loaded.id;
  await recordJourney(loaded.brief, data, briefId);
  const ids = chosen.map((s) => s.id);
  await prisma.$transaction([
    prisma.shortlist.deleteMany({ where: { briefId, studioId: { notIn: ids } } }),
    ...ids.map((studioId, position) =>
      prisma.shortlist.upsert({
        where: { briefId_studioId: { briefId, studioId } },
        create: { briefId, studioId, position },
        update: { position },
      }),
    ),
  ]);
  return { ok: true, shortlisted: ids.length };
}
