import 'server-only';

/**
 * Ranking on the server, the one way.
 *
 * The match page ranks in the browser with each studio's resolved rates, so
 * the budget priority reads the studio's quote for this home. Every server
 * surface that ranks — the written read, the expert page, a shared link —
 * must pass the same rates and the same gate, or it scores a different
 * brief and a customer sees two numbers for one studio. This is that one
 * place.
 */

import { showUnverifiedStudios } from '@/lib/env';
import { filedRatesFor } from '@/data/filed-rates';
import { resolveRatesForMany } from '@/modules/quotation/resolve-rates';
import type { Brief } from '@/modules/brief/types';
import type { Studio } from '@/modules/studio/types';
import { rankStudios, type MatchResult, type RankOptions } from './score';

export async function rankOnServer(
  brief: Brief,
  studios: Studio[],
  limit: number,
  /** `lang` changes only the sentences; stored and ops copies stay English. */
  extra: Pick<RankOptions, 'widen' | 'lang'> = {},
): Promise<MatchResult[]> {
  const resolved = await resolveRatesForMany(studios.map((s) => s.slug));
  return rankStudios(brief, studios, limit, {
    ...extra,
    allowUnverified: showUnverifiedStudios(),
    ratesFor: (slug) => resolved[slug]?.rates ?? filedRatesFor(slug),
  });
}
