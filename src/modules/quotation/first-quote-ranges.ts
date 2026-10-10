import 'server-only';

/**
 * Each studio's first-quote range for a brief, from the one price list
 * (`resolve-rates.ts` — the studio's product master once approved).
 *
 * For the expert page when no quote was stored for this brief (finished on
 * another device). It replaced `quoteBrief`, which priced from the older
 * six-line rate card and so could show the expert a different number from
 * the one the customer had read (review, 11 Oct).
 */

import type { Brief } from '@/modules/brief/types';
import type { Studio } from '@/modules/studio/types';
import { buildFirstQuote, homeShapeFor } from './first-quote';
import { resolveRatesForMany } from './resolve-rates';
import { hasRates } from './rate-policy';

export type RangeResult =
  | {
      ok: true;
      quotes: { studioId: string; studioName: string; quote: { lowPaise: number; highPaise: number } }[];
      skipped: { name: string }[];
    }
  | { ok: false };

export async function firstQuoteRanges(brief: Brief, studioIds: string[], roster: Studio[]): Promise<RangeResult> {
  const studios = studioIds.map((id) => roster.find((s) => s.id === id)).filter((s): s is Studio => Boolean(s));
  if (studios.length === 0) return { ok: false };
  const rates = await resolveRatesForMany(studios.map((s) => s.slug));
  const shape = homeShapeFor(brief);
  const quotes: Extract<RangeResult, { ok: true }>['quotes'] = [];
  const skipped: { name: string }[] = [];
  for (const s of studios) {
    const r = rates[s.slug]?.rates;
    if (!r || !hasRates(r)) {
      skipped.push({ name: s.tradeName });
      continue;
    }
    const q = buildFirstQuote(
      {
        ...shape,
        kitchenRunMm: shape.plan?.kitchenRunMm ?? null,
        runSource: shape.plan ? 'floor_plan' : 'standard',
        curatedDiscountPct: s.matchingProfile?.curatedDiscountPct ?? null,
      },
      r,
    );
    quotes.push({ studioId: s.id, studioName: s.tradeName, quote: { lowPaise: q.lowPaise, highPaise: q.highPaise } });
  }
  return quotes.length > 0 ? { ok: true, quotes, skipped } : { ok: false };
}
