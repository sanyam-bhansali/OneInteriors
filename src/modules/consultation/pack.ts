import 'server-only';

/**
 * The expert's pack — everything the customer did, for the call (plan §9).
 *
 * Every answer (answers.ts), and for each studio they want to talk about:
 * the stored match with its reasoning, the quote exactly as they saw it, and
 * whether they compared it. Plus the lines they starred. Every compared
 * studio is shown the same way, whatever it scored — the expert is there to
 * help choose, not to sell any one of them.
 *
 * Read on the ops page, which is staff-only. Never throws into the page.
 */

import { prisma } from '@/lib/prisma';
import { fromDb } from '@/lib/money';
import { ITEM } from '@/modules/quotation/catalogue';
import { rowToBrief } from '@/modules/brief/mapping';
import { splitReasoning } from '@/modules/matching/store';
import { briefAnswers, type Answer } from './answers';

export interface PackStudio {
  id: string;
  name: string;
  slug: string;
  match: { score: number; measured: string; reasoning: string[]; engineVersion: string } | null;
  quote: { totalPaise: number; lowPaise: number; highPaise: number; notPriced: number; kitchen: string } | null;
  compared: boolean;
}

export interface ExpertPack {
  answers: Answer[];
  studios: PackStudio[];
  starred: string[];
}

export interface SeenQuote {
  studioId: string;
  studioName: string;
  lowPaise: number;
  highPaise: number;
  compared: boolean;
}

/**
 * The quotes this customer was shown, for the expert page (plan §9): the
 * studios they compared first, then the rest in their ranked order. Empty
 * when nothing is stored — a brief finished on another device — and the page
 * falls back to pricing afresh.
 */
export async function quotesAsSeen(briefId: string, rankedIds: string[]): Promise<SeenQuote[]> {
  try {
    const [quotes, decision] = await Promise.all([
      prisma.firstQuote.findMany({
        where: { briefId },
        include: { studio: { select: { tradeName: true, slug: true, status: true, pausedAt: true } } },
      }),
      prisma.quoteDecision.findUnique({ where: { briefId }, select: { comparedSlugs: true } }),
    ]);
    const compared = decision?.comparedSlugs ?? [];
    const rank = (id: string) => {
      const i = rankedIds.indexOf(id);
      return i === -1 ? 999 : i;
    };
    return quotes
      // A studio paused or gone since cannot take the call's outcome.
      .filter((q) => q.studio.status === 'ACTIVE' && !q.studio.pausedAt)
      .map((q) => ({
        studioId: q.studioId,
        studioName: q.studio.tradeName,
        lowPaise: fromDb(q.lowPaise),
        highPaise: fromDb(q.highPaise),
        compared: compared.includes(q.studio.slug),
        slugOrder: compared.indexOf(q.studio.slug),
      }))
      .sort((a, b) =>
        a.compared !== b.compared
          ? a.compared ? -1 : 1
          : a.compared
            ? a.slugOrder - b.slugOrder
            : rank(a.studioId) - rank(b.studioId),
      )
      .map(({ slugOrder: _slugOrder, ...q }) => q);
  } catch {
    return [];
  }
}

const KITCHEN: Record<string, string> = {
  STANDARD: 'standard kitchen',
  CUSTOMER: 'kitchen they measured',
  FLOOR_PLAN: 'kitchen from their plan',
};

export async function expertPack(briefId: string, studioIds: string[]): Promise<ExpertPack | null> {
  try {
    const [row, studios, matches, quotes, decision] = await Promise.all([
      prisma.brief.findUnique({ where: { id: briefId } }),
      prisma.studio.findMany({ where: { id: { in: studioIds } }, select: { id: true, tradeName: true, slug: true } }),
      prisma.match.findMany({ where: { briefId, studioId: { in: studioIds } } }),
      prisma.firstQuote.findMany({ where: { briefId, studioId: { in: studioIds } } }),
      prisma.quoteDecision.findUnique({ where: { briefId } }),
    ]);
    if (!row) return null;
    const compared = new Set(decision?.comparedSlugs ?? []);
    return {
      answers: briefAnswers(rowToBrief(row)),
      studios: studioIds
        .map((id) => studios.find((s) => s.id === id))
        .filter((s): s is NonNullable<typeof s> => Boolean(s))
        .map((s) => {
          const m = matches.find((x) => x.studioId === s.id);
          const q = quotes.find((x) => x.studioId === s.id);
          return {
            id: s.id,
            name: s.tradeName,
            slug: s.slug,
            match: m
              ? {
                  score: Math.round(m.score),
                  measured: `${m.factorsScored} of ${m.factorsTotal}`,
                  reasoning: splitReasoning(m.reasoning),
                  engineVersion: m.engineVersion,
                }
              : null,
            quote: q
              ? {
                  totalPaise: fromDb(q.totalPaise),
                  lowPaise: fromDb(q.lowPaise),
                  highPaise: fromDb(q.highPaise),
                  notPriced: q.notPriced.length,
                  kitchen: KITCHEN[q.runSource] ?? 'kitchen',
                }
              : null,
            compared: compared.has(s.slug),
          };
        }),
      starred: (decision?.starredCodes ?? []).map((c) => ITEM[c]?.label ?? c),
    };
  } catch (error) {
    console.error('[expert] pack unavailable', error instanceof Error ? error.name : 'unknown');
    return null;
  }
}
