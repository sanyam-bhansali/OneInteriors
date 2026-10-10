'use client';

/** The brief, its three matches and their quotes — what the quote and compare screens share. */

import { useMemo } from 'react';
import { filedRatesFor } from '@/data/filed-rates';
import { quotesFor, topMatches, type AppMatch, type AppQuote } from '@/modules/app/journey';
import type { Brief } from '@/modules/brief/types';
import type { AppData } from '@/app/app/data';
import { useBrief } from './ui';

export function useJourney(data: AppData): { brief: Brief | null; matches: AppMatch[]; quotes: AppQuote[] } {
  const [brief] = useBrief();
  return useMemo(() => {
    if (!brief?.completedAt) return { brief, matches: [], quotes: [] };
    const matches = topMatches(brief, data.studios, data.rates, filedRatesFor, data.allowUnverified);
    return { brief, matches, quotes: quotesFor(brief, matches, data.rates, filedRatesFor) };
  }, [brief, data]);
}
