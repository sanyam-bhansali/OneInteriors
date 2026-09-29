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
