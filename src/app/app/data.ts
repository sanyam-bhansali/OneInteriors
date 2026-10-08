import 'server-only';

import { hasDatabase, showUnverifiedStudios } from '@/lib/env';
import { cachedRoster } from '@/modules/studio/roster-cache';
import { publicStudios } from '@/modules/studio/public';
import { resolveRatesForMany } from '@/modules/quotation/resolve-rates';
import { ratesAreReal } from '@/data/filed-rates';
import type { StudioRates } from '@/modules/quotation/catalogue';
import type { Studio } from '@/modules/studio/types';

export interface AppData {
  studios: Studio[];
  rates: Record<string, StudioRates>;
  allowUnverified: boolean;
  /** No database here (local, or SAMPLE_DATA_ONLY): nothing is saved or sent. */
  sample: boolean;
  /** False while studios are priced on pre-launch archive rates; the quote says so. */
  ratesReal: boolean;
}

/** What the matches, quote and compare screens rank and price with — the same as /match. */
export async function appData(): Promise<AppData> {
  const studios = await cachedRoster();
  const filed = await resolveRatesForMany(studios.map((s) => s.slug));
  return {
    studios: publicStudios(studios),
    rates: Object.fromEntries(Object.entries(filed).map(([slug, r]) => [slug, r.rates])),
    allowUnverified: showUnverifiedStudios(),
    sample: !hasDatabase(),
    ratesReal: ratesAreReal(),
  };
}
