import 'server-only';

/**
 * Producing and storing quotes for a brief.
 *
 * A quote is **immutable once written**. Re-quoting after the customer changes
 * their brief creates a new row; the old one stays. "That is not what you
 * quoted" has to be answerable with a record, not a memory — and the customer
 * portal shows every version they were ever shown.
 */

import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { fromDb, toDb, type Paise } from '@/lib/money';
import { studioRepository } from '@/modules/studio/repository';
import { estimate, tooThinToQuote } from './estimate';
import { priceEstimate, compareQuotes, type PricedQuote } from './price';
import { rateCardFor } from './rate-card';
import { studioTierFrom, type Tier } from './tiers';
import { summarise, type Summary } from './summary';
import type { Brief } from '@/modules/brief/types';

export interface StudioQuote {
  studioId: string;
  studioSlug: string;
  studioName: string;
  tier: Tier;
  quote: PricedQuote;
}

export type QuoteSetResult =
  | { ok: true; quotes: StudioQuote[]; summary: Summary; skipped: { name: string; reason: string }[] }
  | { ok: false; reason: 'brief_too_thin' | 'no_studios' };

/**
 * Quote a brief against a set of studios.
 *
 * A studio that cannot be quoted is **named in `skipped`** rather than dropped
 * silently — a customer who picked five studios and sees three quotes deserves
 * to know why, and "they have not published rates for this work" is a fact
 * about the studio worth knowing.
 */
export async function quoteBrief(
  brief: Brief,
  studioIds: string[],
): Promise<QuoteSetResult> {
  if (tooThinToQuote(brief)) return { ok: false, reason: 'brief_too_thin' };
  if (studioIds.length === 0) return { ok: false, reason: 'no_studios' };

  const workings = estimate({
    propertyType: brief.propertyType,
    carpetAreaSqft: brief.carpetAreaSqft,
    scope: brief.scope,
  });

  const quotes: StudioQuote[] = [];
  const skipped: { name: string; reason: string }[] = [];

  for (const studioId of studioIds) {
    const studio = await studioRepository.byId(studioId);
    if (!studio) continue;

    const rates = await rateCardFor(studioId);
    const priced = priceEstimate(workings, rates);

    if (!priced.ok) {
      skipped.push({
        name: studio.tradeName,
        reason: 'They have not published rates for all of this work yet.',
      });
      continue;
    }

    quotes.push({
      studioId,
      studioSlug: studio.slug,
      studioName: studio.tradeName,
      tier: studioTierFrom(priced.quote.totalPaise, workings.carpetAreaSqft),
      quote: priced.quote,
    });
  }

  if (quotes.length === 0) return { ok: false, reason: 'no_studios' };

  // Cheapest first. Order here is presentation only — the summary is what says
  // whether the ordering means anything, and it refuses to when bands overlap.
  quotes.sort((a, b) => a.quote.totalPaise - b.quote.totalPaise);

  const comparison = compareQuotes(quotes.map((q) => ({ studioId: q.studioId, quote: q.quote })));
  const summary = summarise(
    quotes.map((q) => ({ studioId: q.studioId, studioName: q.studioName, quote: q.quote })),
    comparison,
  );

  return { ok: true, quotes, summary, skipped };
}

/**
 * Persist a set of quotes against a stored brief.
 *
 * Best-effort: a failed write costs the record, never the customer's view of
 * their own quote. The screen renders from the computed result either way.
 */
export async function storeQuotes(briefId: string, quotes: StudioQuote[]): Promise<void> {
  if (!hasDatabase()) return;

  try {
    for (const entry of quotes) {
      await prisma.quotation.create({
        data: {
          briefId,
          studioId: entry.studioId,
          kind: 'INDICATIVE',
          status: 'SENT',
          subtotalPaise: toDb(entry.quote.subtotalPaise),
          gstPaise: toDb(entry.quote.gstPaise),
          totalPaise: toDb(entry.quote.totalPaise),
          variancePct: entry.quote.variancePct * 100,
          assumptions: entry.quote.assumptions.join('\n'),
          lineItems: {
            create: entry.quote.lines.map((line, position) => ({
              category: line.category,
              description: line.assumption,
              unit: line.unit,
              quantity: line.quantity,
              ratePaise: toDb(line.ratePaise),
              amountPaise: toDb(line.amountPaise),
              position,
            })),
          },
        },
      });
    }
  } catch {
    /* See the note above. */
  }
}

export interface StoredQuote {
  id: string;
  studioId: string;
  studioName: string;
  studioSlug: string;
  totalPaise: Paise;
  variancePct: number;
  createdAt: Date;
}

/** Every quote ever shown for this brief, newest first. The revision history. */
export async function quoteHistory(briefId: string): Promise<StoredQuote[]> {
  if (!hasDatabase()) return [];

  const rows = await prisma.quotation.findMany({
    where: { briefId },
    include: { studio: { select: { tradeName: true, slug: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return rows.map((r) => ({
    id: r.id,
    studioId: r.studioId,
    studioName: r.studio.tradeName,
    studioSlug: r.studio.slug,
    totalPaise: fromDb(r.totalPaise),
    variancePct: r.variancePct ?? 15,
    createdAt: r.createdAt,
  }));
}
