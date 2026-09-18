'use server';

/**
 * The written read on a match.
 *
 * A server action rather than a client fetch, for the ordinary reason: the
 * Anthropic key is not `NEXT_PUBLIC_` and must never reach a browser bundle.
 * The client sends the brief and the studio id; the server holds the key.
 *
 * Deliberately one studio per call. Six matches are six independent requests
 * that can land as they finish, so the page fills in rather than waiting on
 * the slowest one — and a single failure costs one row's summary rather than
 * all of them.
 */

import { cachedRoster } from '@/modules/studio/roster-cache';
import { rankStudios } from '@/modules/matching/score';
import { explainMatch, type Explanation } from '@/modules/matching/explain';
import { showUnverifiedStudios } from '@/lib/env';
import type { Brief } from '@/modules/brief/types';

export async function explainAction(brief: Brief, studioId: string): Promise<Explanation> {
  const studios = await cachedRoster();
  const studio = studios.find((s) => s.id === studioId);

  if (!studio || brief.propertyType === null) {
    return { text: '', source: 'rules' };
  }

  // Re-rank on the server rather than trusting a score posted from the
  // browser. The breakdown feeds the prompt, and a score the client could
  // edit is a prompt the client could steer.
  const match = rankStudios(brief, studios, 99, {
    allowUnverified: showUnverifiedStudios(),
  }).find((m) => m.studioId === studioId);

  if (!match) return { text: '', source: 'rules' };

  return explainMatch(brief, studio, match);
}
