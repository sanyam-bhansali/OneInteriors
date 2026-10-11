import 'server-only';

import { loadBrief } from '@/modules/brief/repository';
import { cachedRoster } from '@/modules/studio/roster-cache';
import { resolveRatesForMany } from '@/modules/quotation/resolve-rates';
import { filedRatesFor } from '@/data/filed-rates';
import { quotesForStudios } from '@/modules/app/journey';

/**
 * Their first quote from this studio, before GST — what the final quote is
 * compared against. Priced the same way the app priced it, on the same rate
 * card, so the comparison is like for like. Null when it cannot be priced.
 */
export async function firstBeforeGst(slug: string): Promise<number | null> {
  const { brief, found } = await loadBrief();
  if (!found) return null;
  const studio = (await cachedRoster()).find((s) => s.slug === slug);
  if (!studio) return null;
  const rates = await resolveRatesForMany([slug]);
  const [q] = quotesForStudios(brief, [studio], { [slug]: rates[slug]!.rates }, filedRatesFor);
  return q ? q.quote.totalPaise - q.quote.gstPaise : null;
}
