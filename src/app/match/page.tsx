import type { Metadata } from 'next';
import { publicStudios } from '@/modules/studio/public';
import { cachedRoster } from '@/modules/studio/roster-cache';
import { showUnverifiedStudios } from '@/lib/env';
import { resolveRatesForMany } from '@/modules/quotation/resolve-rates';
import { MatchClient } from './MatchClient';
import { loadBrief } from '@/modules/brief/repository';
import { rankStudios } from '@/modules/matching/score';
import { storeMatches } from '@/modules/matching/store';
import { after } from 'next/server';
import { filedRatesFor } from '@/data/filed-rates';

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
  const [studios, saved] = await Promise.all([cachedRoster(), loadBrief()]);

  /**
   * Decided here, on the server, and passed down.
   *
   * `MatchClient` ranks in the browser, and `DEV_SHOW_UNVERIFIED_STUDIOS` is
   * deliberately not `NEXT_PUBLIC_` — the gate that decides which studios reach
   * a customer belongs on the server and nowhere a visitor can edit it. So the
   * server reads it and hands down the answer, rather than the client reading a
   * variable that would be `undefined` in the bundle.
   */
  /**
   * Resolved on the server, per studio, and handed down.
   *
   * Same reasoning as `allowUnverified` above: the ranking runs in the
   * browser but the rates live in Postgres, and a client component cannot
   * read them. A studio that has not filed an archive resolves to the
   * placeholder table, so this changes nothing for the roster as it stands
   * and everything for a studio the moment ops approves their rates.
   */
  const filedRates = await resolveRatesForMany(studios.map((s) => s.slug));
  const allowUnverified = showUnverifiedStudios();

  /**
   * One score, computed once, stored (plan §5.8).
   *
   * The brief we hold is ranked here, on the same rates and gate the page
   * uses, and written as `Match` rows with the engine version — after the
   * response, so the page never waits on it. The browser's ranking of the
   * same brief is identical by construction (tests/matching-v2.test.ts holds
   * it to that), and the stored rows are what a studio's dashboard, ops and
   * any later audit read. A row from an older engine is never rewritten.
   */
  const savedId = saved.found && saved.brief.completedAt ? saved.id : undefined;
  if (savedId) {
    const ranked = rankStudios(saved.brief, studios, 6, {
      allowUnverified,
      ratesFor: (slug) => filedRates[slug]?.rates ?? filedRatesFor(slug),
    });
    after(() => storeMatches(savedId, ranked));
  }

  return (
    <MatchClient
      studios={publicStudios(studios)}
      allowUnverified={allowUnverified}
      /* The brief as we hold it, for a tab that has none — a new tab, another
         device after signing in. sessionStorage is per tab, so without this
         the page told somebody with a finished brief to start one. */
      savedBrief={saved.found && saved.brief.completedAt ? saved.brief : null}
      filedRates={Object.fromEntries(
        Object.entries(filedRates).map(([slug, r]) => [slug, r.rates]),
      )}
    />
  );
}
