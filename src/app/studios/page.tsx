import type { Metadata } from 'next';
import { Container, Button } from '@/components/ui';
import { SiteHeader, SiteFooter } from '@/components/chrome';
import { cachedRoster } from '@/modules/studio/roster-cache';
import { describeDelivery } from '@/modules/studio/types';
import { RosterList } from './RosterList';

export const metadata: Metadata = {
  title: 'Studios',
  description: 'Every interior studio we have verified in Pune, with their delivery record.',
};

/** Per request: the roster must not be frozen into a build. See /match. */
export const dynamic = 'force-dynamic';

export default async function StudiosPage() {
  const STUDIOS = await cachedRoster();
  // Proven first, then by delivery record. No studio can buy this position.
  const ordered = [...STUDIOS].sort((a, b) => {
    const tierRank = { PROVEN: 0, VERIFIED: 1, LISTED: 2, UNVERIFIED: 3 };
    const t = tierRank[a.tier] - tierRank[b.tier];
    if (t !== 0) return t;
    return b.completedProjects - a.completedProjects;
  });

  return (
    <>
      <SiteHeader />

      <main>
        <section className="border-b border-[var(--color-rule)] py-10 sm:py-14">
          <Container>
            <p className="m-0 mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-[var(--color-ink-3)]">
              The roster · Pune
            </p>
            <h1 className="display mb-5 max-w-[15ch]">
              {STUDIOS.length} studios. That is the whole list.
            </h1>
            <p className="m-0 max-w-[58ch] text-[17px] leading-relaxed text-[var(--color-ink-2)]">
              We keep the roster deliberately small and closed. Every studio here has been through
              the same checks, and the ones with a delivery record have it published below —
              including where it is poor.
            </p>
          </Container>
        </section>

        <section className="py-10">
          <Container>
            {/* Narrowed in the browser — the roster is small and already on the
                page. `describeDelivery` runs here, on the server, so the client
                bundle carries the sentence rather than the whole studio record
                it was derived from. */}
            <RosterList
              studios={ordered.map((s) => ({
                id: s.id,
                slug: s.slug,
                tradeName: s.tradeName,
                tier: s.tier,
                delivery: describeDelivery(s),
                localities: s.localities,
                styleTags: Array.from(new Set(s.portfolio.flatMap((p) => p.styleTags))),
                minProjectPaise: s.minProjectPaise,
                maxProjectPaise: s.maxProjectPaise,
              }))}
            />

            <div className="mt-10 border-t border-[var(--color-rule)] pt-8">
              <h2 className="h2 mb-3">
                Not sure which one?
              </h2>
              <p className="m-0 mb-6 max-w-[52ch] text-[var(--color-ink-2)]">
                Nine questions and we will rank them for your home, with the reasoning shown.
              </p>
              <Button href="/quiz" size="lg">
                Start
              </Button>
            </div>
          </Container>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
