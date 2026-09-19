import 'server-only';

/**
 * The other end of the pipe.
 *
 * Nothing in this product learns automatically, by decision. The point of
 * accumulating the journey is that **a person reads it and sets strategy** —
 * so the data has to leave the database easily and land somewhere you can
 * think in. A table nobody can get a spreadsheet out of is a table nobody
 * uses.
 *
 * ## One row per quote, not per brief
 *
 * A brief with four quotes is four rows, each repeating the brief columns.
 * That is wasteful and it is correct: it is the shape a pivot table wants. Ask
 * "average total by locality", "how often does the cheapest quote win", "which
 * line items get starred in Baner" — all of those are one pivot on this shape
 * and a join on any other.
 *
 * ## What is deliberately not in here
 *
 * Names, phone numbers and email addresses. This file is for understanding the
 * market, and the moment it carries contact details it becomes a thing that
 * must not be emailed, opened on a laptop in a café, or pasted into a
 * spreadsheet tool — which is to say, a thing nobody will use for the purpose
 * it exists for. The brief id is there if a specific row ever has to be traced
 * back by somebody with the access to do it.
 */

import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { getCurrentUser, hasRole } from '@/modules/auth/session';
import type { JourneyRow } from './journey-csv';

export type { JourneyRow } from './journey-csv';
export { toCsv } from './journey-csv';

const rupees = (paise: bigint | number | null): string =>
  paise === null ? '' : String(Math.round(Number(paise) / 100));

const date = (d: Date | null): string => (d ? d.toISOString().slice(0, 10) : '');

/**
 * Every quote ever generated, with its brief and its outcome beside it.
 *
 * `limit` is generous rather than paged: this is an export, read rarely, by
 * one person, and a partial export that silently stops at page one is worse
 * than a slow one.
 */
export async function journeyRows(limit = 5000): Promise<JourneyRow[]> {
  const user = await getCurrentUser();
  if (!hasRole(user, 'OPS')) return [];
  if (!hasDatabase()) return [];

  try {
    const quotes = await prisma.firstQuote.findMany({
      orderBy: { builtAt: 'desc' },
      take: limit,
      select: {
        briefId: true,
        totalPaise: true,
        lowPaise: true,
        highPaise: true,
        modularPaise: true,
        nonModularPaise: true,
        variancePct: true,
        kitchenRunMm: true,
        runSource: true,
        notPriced: true,
        ratesVersion: true,
        builtAt: true,
        studio: { select: { id: true, tradeName: true } },
        _count: { select: { lines: true } },
        brief: {
          select: {
            createdAt: true,
            completedAt: true,
            locality: true,
            propertyType: true,
            carpetAreaSqft: true,
            tier: true,
            budgetMinPaise: true,
            budgetMaxPaise: true,
            quoteDecision: {
              select: {
                comparedSlugs: true,
                starredCodes: true,
                wonByStudioId: true,
                outcomeSource: true,
                decidedAt: true,
              },
            },
          },
        },
      },
    });

    return quotes.map((q) => {
      const d = q.brief.quoteDecision;
      /* Blank, not "lost", when nothing is known. Most briefs never reach a
         decision, and writing a loss by inference would bias every figure
         anybody ever calculates from this file. */
      const outcome =
        d?.wonByStudioId == null
          ? ''
          : d.wonByStudioId === q.studio.id
            ? 'won'
            : 'another studio won';

      return {
        briefId: q.briefId,
        briefCreated: date(q.brief.createdAt),
        briefCompleted: date(q.brief.completedAt),
        locality: q.brief.locality ?? '',
        propertyType: q.brief.propertyType ?? '',
        carpetAreaSqft: q.brief.carpetAreaSqft?.toString() ?? '',
        tier: q.brief.tier ?? '',
        budgetMin: rupees(q.brief.budgetMinPaise),
        budgetMax: rupees(q.brief.budgetMaxPaise),

        studio: q.studio.tradeName,
        quoteTotal: rupees(q.totalPaise),
        quoteLow: rupees(q.lowPaise),
        quoteHigh: rupees(q.highPaise),
        modular: rupees(q.modularPaise),
        nonModular: rupees(q.nonModularPaise),
        variancePct: q.variancePct.toFixed(2),
        kitchenRunMm: q.kitchenRunMm?.toString() ?? '',
        runSource: q.runSource,
        linesQuoted: String(q._count.lines),
        notPriced: q.notPriced.join(' '),
        ratesVersion: q.ratesVersion,
        builtAt: date(q.builtAt),

        studiosCompared: (d?.comparedSlugs ?? []).join(' '),
        starredCodes: (d?.starredCodes ?? []).join(' '),
        outcome,
        outcomeSource: d?.outcomeSource ?? '',
        decidedAt: date(d?.decidedAt ?? null),
      };
    });
  } catch {
    return [];
  }
}

/** What has accumulated so far, so nobody has to ask the database. */
export async function journeySummary(): Promise<{
  quotes: number;
  briefsQuoted: number;
  comparisons: number;
  outcomes: number;
  placeholderRates: number;
} | null> {
  const user = await getCurrentUser();
  if (!hasRole(user, 'OPS')) return null;
  if (!hasDatabase()) return null;

  try {
    const [quotes, briefs, comparisons, outcomes, placeholder] = await Promise.all([
      prisma.firstQuote.count(),
      prisma.firstQuote.groupBy({ by: ['briefId'] }).then((g) => g.length),
      prisma.quoteDecision.count({ where: { comparedSlugs: { isEmpty: false } } }),
      prisma.quoteDecision.count({ where: { wonByStudioId: { not: null } } }),
      // While ratesAreReal() is false every row is priced on archive medians
      // wearing a studio's name. Worth a number on screen, so nobody averages
      // the placeholder period into the honest one later without noticing.
      prisma.firstQuote.count({ where: { ratesVersion: { startsWith: 'archive-median' } } }),
    ]);
    return {
      quotes,
      briefsQuoted: briefs,
      comparisons,
      outcomes,
      placeholderRates: placeholder,
    };
  } catch {
    return null;
  }
}
