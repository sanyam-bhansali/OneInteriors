import Link from 'next/link';
import type { Metadata } from 'next';
import { Container, TierBadge, Pill, Button } from '@/components/ui';
import { PlanFragment } from '@/components/art/PlanFragment';
import { SiteHeader, SiteFooter } from '@/components/chrome';
import { cachedRoster } from '@/modules/studio/roster-cache';
import { formatINRCompact } from '@/lib/money';
import { describeDelivery } from '@/modules/studio/types';
import { PUNE_LOCALITIES } from '@/modules/brief/types';

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
            <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2 lg:grid-cols-3">
              {ordered.map((s) => (
                <li key={s.id} className="lift flex flex-col border border-[var(--color-rule)] bg-[var(--color-paper-2)]">
                  <PlanFragment
                    seed={s.id}
                    styles={s.portfolio.flatMap((p) => p.styleTags)}
                    className="block h-28 w-full"
                  />
                  <div className="flex flex-1 flex-col gap-3 border-t border-[var(--color-rule)] p-5">
                    <div>
                      <h2 className="h3 mb-2">
                        <Link
                          href={`/studios/${s.slug}`}
                          className="text-[var(--color-ink)] no-underline hover:text-[var(--color-petrol)]"
                        >
                          {s.tradeName}
                        </Link>
                      </h2>
                      <TierBadge tier={s.tier} />
                    </div>

                    <p className="m-0 text-[14px] leading-snug text-[var(--color-ink-2)]">
                      {describeDelivery(s)}
                    </p>

                    <div className="mt-auto flex flex-wrap gap-1.5 border-t border-[var(--color-rule-soft)] pt-3">
                      {s.minProjectPaise && s.maxProjectPaise ? (
                        <Pill>
                          {formatINRCompact(s.minProjectPaise)}–{formatINRCompact(s.maxProjectPaise)}
                        </Pill>
                      ) : null}
                      <Pill>{s.localities.length} areas</Pill>
                    </div>

                    <p className="m-0 text-[12px] leading-snug text-[var(--color-ink-3)]">
                      {s.localities
                        .map((l) => PUNE_LOCALITIES.find((p) => p.slug === l)?.label ?? l)
                        .join(' · ')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

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
