import type { Metadata } from 'next';
import { cachedRoster } from '@/modules/studio/roster-cache';
import { showUnverifiedStudios } from '@/lib/env';
import { MatchClient } from './MatchClient';

export const metadata: Metadata = {
  title: 'Your matches',
  description: 'Studios ranked for your home, with the reasoning shown.',
};

/**
 * Rendered per request, not at build time.
 *
 * Two reasons, and the second is the one that actually matters:
 *
 *  1. **The roster changes without a deploy.** Pre-rendering bakes the list of
 *     studios into the build, so a studio approved on Tuesday would not appear
 *     to any customer until the next push. Approval has to be enough.
 *  2. **A build must not depend on the database.** Reading studios during
 *     `next build` means a bad connection string, a rotated password or a
 *     Supabase maintenance window fails the deploy outright — which is exactly
 *     how this page took production down.
 */
export const dynamic = 'force-dynamic';

export default async function MatchPage() {
  const studios = await cachedRoster();

  /**
   * Decided here, on the server, and passed down.
   *
   * `MatchClient` ranks in the browser, and `DEV_SHOW_UNVERIFIED_STUDIOS` is
   * deliberately not `NEXT_PUBLIC_` — the gate that decides which studios reach
   * a customer belongs on the server and nowhere a visitor can edit it. So the
   * server reads it and hands down the answer, rather than the client reading a
   * variable that would be `undefined` in the bundle.
   */
  return <MatchClient studios={studios} allowUnverified={showUnverifiedStudios()} />;
}
