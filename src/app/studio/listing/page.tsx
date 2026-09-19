import { isLive } from '@/modules/studio/features';
import { ComingSoon } from '../ComingSoon';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Container, TierBadge } from '@/components/ui';
import { currentStudio } from '@/modules/studio/onboarding';
import { studioRepository } from '@/modules/studio/repository';
import { assessTier } from '@/modules/verification/tiers';
import { readDraft } from '@/modules/studio/profile-draft-store';
import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { CapacityForm } from './CapacityForm';

export const metadata: Metadata = {
  title: 'Your listing',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Everything a studio owns about how it appears — in one place.
 *
 * ## Why this page is a hub and not a form
 *
 * Rates, portfolio and profile copy each had their own nav item, which is three
 * of six slots spent on things a studio touches a few times a year. Merging them
 * into one long page would have traded six nav items for one page with four
 * forms stacked on it, which is the same problem wearing a different hat.
 *
 * So this is a contents page: four rows, each saying what state that part is in,
 * each a link. The work still happens on the focused pages — a rate card is a
 * concentration task and deserves a screen of its own. What changes is that a
 * studio now has one answer to "where do I change how I look", instead of
 * needing to already know which of three pages holds the thing they want.
 *
 * The two settings that belong to the listing rather than to a form — how much
 * work they will take, and what badge they carry — sit at the bottom, because
 * one is a single field and the other is read-only.
 */
export default async function ListingPage() {
  /* Not in the pilot. The rail already stops linking here; this stops a
     bookmark or a typed URL reaching a screen we are not standing behind
     yet. Flip the flag in modules/studio/features.ts to ship it. */
  if (!isLive('listing')) return <ComingSoon feature="listing" />;

  const context = await currentStudio();

  if (!context) {
    return (
      <main className="py-16">
        <Container size="default">
          <h1 className="display mb-4 text-[clamp(1.9rem,4vw,2.6rem)] leading-[1.05]">
            No studio on this account
          </h1>
          <p className="m-0 text-[16px] leading-relaxed text-[var(--color-ink-2)]">
            This sign-in is not linked to a studio yet.
          </p>
        </Container>
      </main>
    );
  }

  const { studio } = context;
  const live = studio.status === 'ACTIVE';

  const [full, draft, ratesChanged] = await Promise.all([
    studioRepository.bySlug(studio.slug),
    readDraft(),
    lastRateChange(studio.id),
  ]);

  const assessment = full ? assessTier(full) : null;

  return (
    <main className="py-14 sm:py-20">
      <Container size="default">
        <p className="label m-0 mb-3">Your listing</p>
        <h1 className="display mb-4 text-[clamp(1.9rem,4vw,2.6rem)] leading-[1.05]">
          What a customer sees.
        </h1>
        <p className="m-0 mb-12 max-w-[54ch] text-[17px] leading-relaxed text-[var(--color-ink-2)]">
          {live ? (
            <>
              All of this is live.{' '}
              <Link href={`/studios/${studio.slug}`} className="text-[var(--color-petrol)]">
                Open your public profile
              </Link>{' '}
              to read it the way they do.
            </>
          ) : (
            <>None of this is visible to anyone yet. It goes live when we finish verifying you.</>
          )}
        </p>

        <div className="flex flex-col">
          <Row
            href="/studio/work"
            title="Your work"
            state={
              studio.portfolioCount === 0
                ? 'Nothing added yet'
                : `${studio.portfolioCount} project${studio.portfolioCount === 1 ? '' : 's'}`
            }
            needsYou={studio.portfolioCount < 3}
          >
            The projects a customer reads before deciding to meet you — and the only thing here
            you can change that moves where you rank.
          </Row>

          <Row
            href="/studio/rates"
            title="Your rates"
            state={
              studio.missingRates.length > 0
                ? `${studio.missingRates.length} still to enter`
                : ratesChanged
                  ? `Last changed ${ratesChanged.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`
                  : 'Complete'
            }
            needsYou={studio.missingRates.length > 0 || staleBy(ratesChanged)}
          >
            Private to you. Every quote with your name on it is built from these and nothing else —
            we never mark them up and never average them with anyone.
          </Row>

          <Row
            href="/studio/onboarding/profile"
            title="Your details"
            state={`${studio.localities.length} area${studio.localities.length === 1 ? '' : 's'}`}
            needsYou={false}
          >
            How you describe what you do, the areas you cover, and the size of project you take.
          </Row>

          <Row
            href="/studio/profile"
            title="Profile copy"
            state={
              draft === null
                ? 'Not written'
                : draft.approvedAt
                  ? 'Approved and live'
                  : 'Draft waiting on you'
            }
            needsYou={draft !== null && !draft.approvedAt}
          >
            An optional first draft of your description, written from the projects you have
            entered. You edit it until it sounds like you.
          </Row>
        </div>

        {/* ── Capacity ── */}
        <section className="mt-14 border-t border-[var(--color-rule)] pt-10">
          <h2 className="m-0 mb-2 font-[family-name:var(--font-display)] text-[22px] leading-tight">
            How much you can take
          </h2>
          <p className="m-0 mb-6 max-w-[54ch] text-[15.5px] leading-relaxed text-[var(--color-ink-2)]">
            When you reach this many projects in a month we stop showing you, and start again when
            the month turns. Leave it blank if you would rather we never did that.
          </p>
          <CapacityForm current={full?.capacityPerMonth ?? null} />
        </section>

        {/* ── Standing ── */}
        {assessment ? (
          <section className="mt-14 border-t border-[var(--color-rule)] pt-10">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <TierBadge tier={assessment.tier} />
              <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-[var(--color-ink-3)]">
                your badge
              </span>
            </div>

            {assessment.expired.length > 0 ? (
              <p className="m-0 mb-4 max-w-[56ch] border-l-2 border-[var(--color-atrisk)] pl-4 text-[15.5px] leading-relaxed text-[var(--color-ink)]">
                {assessment.expired.length} of your checks{' '}
                {assessment.expired.length === 1 ? 'has' : 'have'} lapsed. We will call you to
                arrange the redo — nothing for you to do until then.
              </p>
            ) : null}

            {assessment.blockers.length === 0 ? (
              <p className="m-0 max-w-[56ch] text-[15.5px] leading-relaxed text-[var(--color-ink-2)]">
                Top of the ladder. Everything we can check about a studio, we have checked.
              </p>
            ) : (
              <>
                <p className="m-0 mb-2 max-w-[56ch] text-[15.5px] leading-relaxed text-[var(--color-ink-2)]">
                  For the next badge up:
                </p>
                <ul className="m-0 mb-3 flex list-none flex-col gap-1.5 p-0">
                  {assessment.blockers.map((blocker) => (
                    <li
                      key={blocker}
                      className="text-[15px] leading-snug text-[var(--color-ink-2)] before:mr-2 before:text-[var(--color-ink-3)] before:content-['·']"
                    >
                      {blocker}
                    </li>
                  ))}
                </ul>
                <p className="m-0 max-w-[56ch] text-[14px] leading-relaxed text-[var(--color-ink-3)]">
                  {assessment.tier === 'UNVERIFIED' || assessment.tier === 'LISTED'
                    ? 'Most of these are ours to do rather than yours — reference calls we make, sites we visit. Where we need something from you, we will ask.'
                    : 'These come from projects delivered through us, so they fill in as you finish work. Nothing to submit.'}
                </p>
              </>
            )}
          </section>
        ) : null}
      </Container>
    </main>
  );
}

/**
 * One row of the contents page.
 *
 * `needsYou` marks it rather than sorting it. Reordering rows by urgency means
 * the page is in a different order every visit, and a studio that has learned
 * where rates live should not have to re-read the page to find them.
 */
function Row({
  href,
  title,
  state,
  needsYou,
  children,
}: {
  href: string;
  title: string;
  state: string;
  needsYou: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group block border-t border-[var(--color-rule)] py-6 no-underline last:border-b"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <span className="font-[family-name:var(--font-display)] text-[21px] leading-tight text-[var(--color-ink)] group-hover:text-[var(--color-petrol)]">
          {title}
        </span>
        <span
          className={`text-[14.5px] ${needsYou ? 'text-[var(--color-brass)]' : 'text-[var(--color-ink-3)]'}`}
        >
          {state}
        </span>
      </div>
      <p className="m-0 mt-1.5 max-w-[58ch] text-[15px] leading-relaxed text-[var(--color-ink-2)]">
        {children}
      </p>
    </Link>
  );
}

async function lastRateChange(studioId: string): Promise<Date | null> {
  if (!hasDatabase()) return null;
  try {
    const row = await prisma.rateCardItem.findFirst({
      where: { studioId },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });
    return row?.updatedAt ?? null;
  } catch {
    return null;
  }
}

/** Six months without a change. Material prices will have moved. */
function staleBy(date: Date | null): boolean {
  if (!date) return false;
  return Date.now() - date.getTime() > 1000 * 60 * 60 * 24 * 30 * 6;
}
