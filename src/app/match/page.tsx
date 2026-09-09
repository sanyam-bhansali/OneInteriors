import type { Metadata } from 'next';
import { cachedRoster } from '@/modules/studio/roster-cache';
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
  return <MatchClient studios={studios} />;
}
