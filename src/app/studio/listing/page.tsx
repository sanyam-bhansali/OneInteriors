import { isLive } from '@/modules/studio/features';
import { ComingSoon } from '../ComingSoon';
import Link from 'next/link';
import type { Metadata } from 'next';
import { TierBadge } from '@/components/ui';
import { currentStudio } from '@/modules/studio/onboarding';
import { studioRepository } from '@/modules/studio/repository';
import { assessTier } from '@/modules/verification/tiers';
import { readDraft } from '@/modules/studio/profile-draft-store';
import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { CapacityForm } from './CapacityForm';
import '../office-ui.css';
import './listing.css';

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
      <main className="content ox-page">
        <div className="empty">
          <b>No studio on this account</b>
          <span className="muted sm">This sign-in is not linked to a studio yet.</span>
        </div>
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
    <main className="content ox-page">
      <div className="phead">
        <div>
          <span className="eyebrow">Your listing</span>
          <h1>What a customer sees.</h1>
          <p className="muted" style={{ maxWidth: '62ch' }}>
            {live ? (
              <>
                All of this is live.{' '}
                <Link href={`/studios/${studio.slug}`} className="ox-link">
                  Open your public profile
                </Link>{' '}
                to read it the way they do.
              </>
            ) : (
              <>None of this is visible to anyone yet. It goes live when we finish verifying you.</>
            )}
          </p>
        </div>
        {live ? (
          <span className="chip good">
            <span className="dot" />
            Live
          </span>
        ) : (
          <span className="chip warn">
            <span className="dot" />
            Not live yet
          </span>
        )}
      </div>

      <div className="cols">
        <div className="colmain">
          <nav className="ilist" aria-label="Your listing">
            <Row
              href="/studio/work"
              title="Your work"
              state={studio.portfolioCount === 0 ? 'Nothing added yet' : `${studio.portfolioCount} project${studio.portfolioCount === 1 ? '' : 's'}`}
              needsYou={studio.portfolioCount < 3}
            >
              The projects a customer reads before deciding to meet you — and the only thing here you can change that moves where you rank.
            </Row>

            <Row
              href="/studio/products"
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
              Private to you. Every quote with your name on it is built from these and nothing else — we never mark them up and never average them with anyone.
            </Row>

            <Row href="/studio/onboarding/profile" title="Your details" state={`${studio.localities.length} area${studio.localities.length === 1 ? '' : 's'}`} needsYou={false}>
              How you describe what you do, the areas you cover, and the size of project you take.
            </Row>

            <Row
              href="/studio/profile"
              title="Profile copy"
              state={draft === null ? 'Not written' : draft.approvedAt ? 'Approved and live' : 'Draft waiting on you'}
              needsYou={draft !== null && !draft.approvedAt}
            >
              An optional first draft of your description, written from the projects you have entered. You edit it until it sounds like you.
            </Row>
          </nav>

          {/* ── Capacity ── */}
          <section className="card" aria-labelledby="h-cap">
            <div className="chead">
              <div>
                <h2 id="h-cap">How much you can take</h2>
                <span className="muted sm" style={{ display: 'block', maxWidth: '58ch' }}>
                  When you reach this many projects in a month we stop showing you, and start again when the month turns. Leave it blank if you would rather we never did
                  that.
                </span>
              </div>
            </div>
            <CapacityForm current={full?.capacityPerMonth ?? null} />
          </section>
        </div>

        <div className="colside">
          {/* ── Standing ── */}
          {assessment ? (
            <section className="card" aria-labelledby="h-badge">
              <div className="chead">
                <h2 id="h-badge">Your badge</h2>
                <TierBadge tier={assessment.tier} />
              </div>

              {assessment.expired.length > 0 ? (
                <span className="chip bad" style={{ whiteSpace: 'normal', minHeight: 34, alignSelf: 'flex-start' }}>
                  <span className="dot" />
                  {assessment.expired.length} of your checks {assessment.expired.length === 1 ? 'has' : 'have'} lapsed. We will call you to arrange the redo — nothing for
                  you to do until then.
                </span>
              ) : null}

              {assessment.blockers.length === 0 ? (
                <span className="chip good" style={{ whiteSpace: 'normal', minHeight: 34, alignSelf: 'flex-start' }}>
                  <span className="dot" />
                  Top of the ladder. Everything we can check about a studio, we have checked.
                </span>
              ) : (
                <>
                  <span className="lbl">For the next badge up</span>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {assessment.blockers.map((blocker) => (
                      <li key={blocker} className="why">
                        <span aria-hidden="true">·</span>
                        <span>{blocker}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="empty" style={{ padding: 14 }}>
                    <span className="muted sm">
                      {assessment.tier === 'UNVERIFIED' || assessment.tier === 'LISTED'
                        ? 'Most of these are ours to do rather than yours — reference calls we make, sites we visit. Where we need something from you, we will ask.'
                        : 'These come from projects delivered through us, so they fill in as you finish work. Nothing to submit.'}
                    </span>
                  </div>
                </>
              )}
            </section>
          ) : null}
        </div>
      </div>
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
function Row({ href, title, state, needsYou, children }: { href: string; title: string; state: string; needsYou: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className="irow">
      <span className="hstack" style={{ justifyContent: 'space-between' }}>
        <b style={{ fontSize: 16 }}>{title}</b>
        <span className={needsYou ? 'chip warn' : 'chip'}>
          {needsYou ? <span className="dot" /> : null}
          {state}
        </span>
      </span>
      <span className="muted sm" style={{ maxWidth: '62ch' }}>
        {children}
      </span>
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
