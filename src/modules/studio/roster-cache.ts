import 'server-only';

/**
 * The public roster, cached across requests.
 *
 * ## Why this exists
 *
 * `/quiz`, `/match` and `/studios` all render per request so that approving a
 * studio makes it visible without a deploy, and so a database problem can
 * never fail a build. But the roster is the *same handful of rows for every
 * visitor* — fetching it again for each one is pure latency, and the latency
 * is not small: Vercel runs the function in one region and Supabase holds the
 * data in another, so a cold request pays a connection handshake plus a query
 * across that distance before a single byte of HTML is written.
 *
 * So the query is cached for a minute and shared by everyone. The first
 * visitor after a change waits; the rest do not.
 *
 * ## Why a minute
 *
 * Short enough that a studio approved during a call appears while you are
 * still on it. Long enough that a burst of traffic is one query rather than
 * hundreds. And `revalidateRoster()` clears it immediately on approval, so the
 * window only matters for changes made directly in the database.
 */

import { unstable_cache, revalidateTag } from 'next/cache';
import { studioRepository } from './repository';
import type { Studio, StudioQuery } from './types';

const TAG = 'roster';
const TTL_SECONDS = 60;

/**
 * Active studios, cached.
 *
 * Only the `activeOnly` roster is cached: it is the one every customer-facing
 * page asks for, and it is the one that is identical for everybody. Ops
 * queries stay uncached because they read statuses that must never be stale.
 */
export const cachedRoster = unstable_cache(
  async (): Promise<Studio[]> => studioRepository.list({ activeOnly: true }),
  ['roster', 'active'],
  { revalidate: TTL_SECONDS, tags: [TAG] },
);

/**
 * Drop the cache. Call after anything that changes who is visible — approving
 * a studio, suspending one, editing a published profile.
 */
export async function revalidateRoster(): Promise<void> {
  revalidateTag(TAG);
}

/** Uncached, for ops and for queries that are not the plain public roster. */
export function listStudios(query: StudioQuery): Promise<Studio[]> {
  return studioRepository.list(query);
}
