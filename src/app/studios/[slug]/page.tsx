import { notFound } from 'next/navigation';
import { showUnverifiedStudios } from '@/lib/env';
import type { Metadata } from 'next';
import { StartCta } from '@/components/StartCta';
import { StudioQuotePanel } from '@/components/oi/StudioQuotePanel';
import { StyleScene } from '@/components/art/StyleScene';
import { PlanFragment } from '@/components/art/PlanFragment';
import { AppHeader, AppFooter } from '@/components/oi/Chrome';
import { Wrap, Chapter, Sheet, Quiet } from '@/components/oi';
import { studioRepository } from '@/modules/studio/repository';
import { record } from '@/modules/analytics/record';
import { formatINRCompact } from '@/lib/money';
import { Verified } from './Verified';
import { Record as TrackRecord } from './Record';
import {
  TIER_CHECKS,
  TIER_DESCRIPTIONS,
  TIER_LABELS,
  describeDelivery,
} from '@/modules/studio/types';
import { PROPERTY_LABELS, SCOPE_LABELS, STYLE_LABELS } from '@/modules/brief/types';

/**
 * A studio's profile, in the language `/match` established.
 *
 * ## Why this page was rebuilt
 *
 * It was carrying two palettes that physically touched: the identity, record,
 * checks and work read `--color-*` from the landing-page system, and a single
 * bolted-on quote section read `--bg` / `--card` / `--acc` from `.oi-app`.
 * A reader arriving from their matches crossed a visible language boundary
 * mid-page, on the one screen where they are deciding whether to believe us.
 *
 * It is now one palette — `.oi-app .oi-quick`, the same as `/match` — and the
 * sections are the same surfaces: glass, mono evidence, ticks that count in.
 * See docs/DESIGN-LANGUAGE.md.
 *
 * ## The order is the argument
 *
 * Who they are → what they would charge you → what they have actually
 * delivered → what we checked → what they have built. Price sits second
 * because it is what somebody arriving from their matches came for, and
 * everything after it exists to say whether the number is worth anything.
 *
 * The checks are the largest section on the page on purpose. `/match` shows
 * six ticks beside a card and promises "+7 more on their profile"; this is
 * where that is kept, and the verification file is the only asset here a
 * competitor cannot buy from a KYC vendor.
 *
 * ## One quote, not two
 *
 * This page used to render `StudioQuotePanel` AND `StudioQuotation` — two
 * components, two pricing engines, two totals that could disagree, under two
 * headings, in two design languages. It also made the sign-in gate
 * decorative, since the gated one sat directly below a panel that had already
 * shown a full quote to nobody in particular.
 *
 * `StudioQuotePanel` survives: it is the documented direction (generate here,
 * read here, send to `/compare` deliberately) and it feeds the comparison
 * screen. `StudioQuotation` is deleted.
 *
 * ## What is deliberately still wrong
 *
 * This was a styling pass. `docs/FINDINGS.md` lists what it did not fix —
 * most importantly that quotes are priced on archive rates wearing each
 * studio's name (P1.1), and that a PAUSED studio still 404s rather than
 * saying it is full this month (P2.1).
 */

/**
 * Explicit, because the default is easy to lose to a later refactor and this
 * page depends on it: a slug that was not pre-rendered still renders on
 * demand. That is what lets `allSlugs()` fall back to an empty list when the
 * database is unreachable at build time without the site losing every studio
 * profile — and what gives a newly approved studio a page before the next
 * deploy.
 */
export const dynamicParams = true;

/**
 * And rendered per request, so an approved studio's profile is live the moment
 * ops flips them to ACTIVE — and so a database problem during `next build`
 * cannot fail the deploy.
 */
export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  const slugs = await studioRepository.allSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const studio = await studioRepository.bySlug(slug);
  if (!studio) return {};
  return {
    title: studio.tradeName,
    description: `${studio.tradeName} — ${describeDelivery(studio)} Verified by One Interiors.`,
  };
}

export default async function StudioProfile({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const studio = await studioRepository.bySlug(slug);
  if (!studio) notFound();

  /* A public profile is for a studio that is actually on the roster.
     `bySlug` has no status filter, so an ONBOARDING, SUSPENDED or REMOVED
     studio's page was served to anyone who knew the slug — including its
     legal name and its GSTIN, rendered further down — while every other
     customer surface honours `activeOnly`. A slug is guessable from a trade
     name, and a rejected applicant's registration details are not ours to
     publish.

     `notFound()` rather than a message: the same answer for "no such studio"
     and "not live", because distinguishing them tells a stranger that a named
     business applied to us and did not make it.

     PAUSED is wrongly caught by this and should not be — see FINDINGS P2.1. */
  if (studio.status !== 'ACTIVE' && !showUnverifiedStudios()) notFound();

  /**
   * The second stage of the studio's own funnel: someone saw them in results
   * and opened the profile.
   *
   * `studioSlug` rather than an id, because the prop guard allows slugs and
   * refuses anything that reads like a person — and a slug is what the studio
   * dashboard queries on.
   */
  await record('studio.view', { studioSlug: slug });

  const totalChecks = TIER_CHECKS.LISTED.length + TIER_CHECKS.VERIFIED.length;
  const passed = studio.checks.filter((c) => c.result === 'PASS').length;

  /* Where they work. The roster card has said this from the beginning and the
     profile never did — so the one page devoted to a studio was the one place
     that did not say whether they come to your part of the city. */
  const where = [...studio.localities.slice(0, 4)];
  const band =
    studio.minProjectPaise && studio.maxProjectPaise
      ? `${formatINRCompact(studio.minProjectPaise)}–${formatINRCompact(studio.maxProjectPaise)}`
      : null;

  return (
    <div className="oi-app oi-quick min-h-dvh bg-[var(--bg)]">
      <AppHeader />

      <main>
        {/* ── Identity ──
            The drawing is a band ABOVE the card, not behind it, and that is a
            contrast decision rather than a compositional one.

            It was behind the glass first, which looked better and was
            unshippable: the palettes these drawings are generated from run
            down to #22201E, so at 0.72 alpha the ground under the card's own
            secondary text computed 3.87:1 — a fail, on a ground that changes
            with whichever studio you are looking at. That is precisely what
            the alpha floor in globals.css exists to prevent, and stacking art
            under the text re-introduced it by the back door.

            Above the card, every figure on this page is the measured
            0.72-over-Raw-Silk composite that docs/DESIGN-LANGUAGE.md §4 is
            computed against: ink2 5.56:1, acc-ink 5.76:1, sec-ink 5.19:1. */}
        <section>
          <div className="oi-band">
            <PlanFragment
              seed={studio.id}
              styles={studio.portfolio.flatMap((p) => p.styleTags)}
              className="block h-20 w-full sm:h-24"
            />
          </div>

          <Wrap className="relative -mt-8 pb-12">
            <div className="oi-pane p-[clamp(22px,3vw,34px)]">
              <p className="oi-eyebrow m-0 mb-4">
                {TIER_LABELS[studio.tier]} · {passed} of {totalChecks} checks passed
              </p>

              <h1 className="oi-display q-h1 m-0 text-[var(--ink)]">{studio.tradeName}</h1>

              <p className="q-body m-0 mt-4 max-w-[58ch] text-[var(--ink2)]">{studio.about}</p>

              {/* The facts that decide whether to read on, in mono because
                  every one of them is a measured value. */}
              <div className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-[var(--line)] pt-6 sm:grid-cols-4">
                <Fact
                  label="Works in"
                  value={where.length > 0 ? where.join(' · ') : studio.city}
                />
                <Fact label="Years active" value={studio.yearsActive ? `${studio.yearsActive}` : null} />
                <Fact label="Team" value={studio.teamSize ? `${studio.teamSize} people` : null} />
                <Fact label="Projects they take" value={band} />
              </div>

              {/* Resume-aware. Someone reaching this profile from their own
                  matches is mid-funnel; a hard link to /quiz would restart
                  them. There is deliberately no way to contact the studio from
                  here — every introduction runs through the expert. */}
              <div className="mt-7">
                <StartCta size="md" />
              </div>
            </div>
          </Wrap>
        </section>

        {/* ── The quote ──
            Second, because it is what somebody arriving from their matches
            came for. Everything below it exists to say whether the number is
            worth anything. */}
        <section className="border-y border-[var(--line)] py-12">
          <Wrap>
            <StudioQuotePanel studioSlug={studio.slug} studioName={studio.tradeName} />
          </Wrap>
        </section>

        {/* ── Track record ── */}
        <section className="py-14">
          <Wrap>
            <Chapter
              eyebrow="Track record"
              title="What they have actually delivered."
              aside={
                <span className="oi-num text-[10.5px] uppercase tracking-[0.14em] text-[var(--ink2)]">
                  Computed from milestone approvals
                </span>
              }
            />

            <Sheet className="p-[clamp(20px,2.6vw,30px)]">
              <TrackRecord
                completedProjects={studio.completedProjects}
                avgVarianceDays={studio.avgVarianceDays}
                upheldDisputes={studio.upheldDisputes}
                specComplianceRate={studio.specComplianceRate}
              />

              {/* One line, not two. describeDelivery() already states there
                  is no record; the sentence that followed it explained the
                  same fact at length, and the four cells above had each
                  already named their own missing measurement. Three ways of
                  saying nothing has been measured is two too many. */}
              <p className="q-small m-0 mt-8 max-w-[58ch] border-t border-[var(--line)] pt-5 text-[var(--ink2)]">
                {describeDelivery(studio)}
              </p>
            </Sheet>
          </Wrap>
        </section>

        {/* ── What we verified — the payoff ──
            The largest section on the page. /match promises "+N more on their
            profile"; this is where it is kept. */}
        <section className="border-y border-[var(--line)] py-14">
          <Wrap>
            <Chapter
              eyebrow="What we verified"
              title={`${totalChecks} checks, each with a source and a date.`}
              aside={
                <span className="oi-num text-[10.5px] uppercase tracking-[0.14em] text-[var(--ink2)]">
                  {passed} passed · {totalChecks - passed} outstanding
                </span>
              }
            >
              {TIER_DESCRIPTIONS[studio.tier]}
            </Chapter>

            <Verified checks={studio.checks} tier={TIER_LABELS[studio.tier]} />

            <div className="mt-10 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3 border-t border-[var(--line)] pt-5">
              {studio.gstin ? (
                <p className="oi-label m-0">
                  GSTIN {studio.gstin} · verifiable free on the GST portal, by you, today
                </p>
              ) : (
                <span />
              )}
              {/* The "interior design is unregulated in India" argument was a
                  paragraph at the top of this section, before the reader had
                  seen any evidence. It is a good argument and it belongs where
                  somebody who has just read the file might want it — and in
                  full on /verification, which is a page we already have. */}
              <Quiet href="/verification">Why we check these, and what it does not prove</Quiet>
            </div>
          </Wrap>
        </section>

        {/* ── Their work ── */}
        <section className="py-14">
          <Wrap>
            <Chapter
              eyebrow="Their work"
              title={
                studio.portfolio.length > 0
                  ? `${studio.portfolio.length} projects, with budgets and timelines attached.`
                  : 'No projects published yet.'
              }
            />

            {studio.portfolio.length === 0 ? (
              /* An empty list under a "0 projects" heading is how a page looks
                 broken. This says which of the two it is. */
              <Sheet className="p-8">
                <p className="q-body m-0 max-w-[54ch] text-[var(--ink2)]">
                  This studio has not published any completed projects to us yet. That is normal for
                  a studio newly on the roster, and it is why the record above is empty too — we do
                  not fill either in from anything they tell us.
                </p>
                <div className="mt-5">
                  <Quiet href="/studios">See the rest of the roster</Quiet>
                </div>
              </Sheet>
            ) : (
              <ul className="m-0 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
                {studio.portfolio.map((p) => {
                  /* Honest about the picture. The old page stamped "photo
                     pending" on every card regardless of `images` and
                     `isRender` — a present value rendering as missing, which
                     is the product's own rule inverted. */
                  const hasPhoto = p.images.length > 0;
                  const stamp = hasPhoto
                    ? p.isRender
                      ? 'Render by the studio'
                      : 'Their photograph'
                    : 'Drawing · photo to come';

                  return (
                    <li key={p.id} className="oi-pane overflow-hidden">
                      <div className="relative">
                        <StyleScene
                          tag={p.styleTags[0] ?? 'contemporary-minimal'}
                          className="block aspect-[4/3] w-full"
                        />
                        <span className="oi-stamp">{stamp}</span>
                      </div>

                      <div className="flex flex-col gap-3 border-t border-[var(--line)] p-5">
                        <h3 className="oi-display m-0 text-[16px] leading-snug text-[var(--ink)]">
                          {p.title}
                        </h3>

                        <p className="oi-label m-0">
                          {[
                            p.locality,
                            p.propertyType ? PROPERTY_LABELS[p.propertyType] : null,
                            p.scope ? SCOPE_LABELS[p.scope] : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>

                        <dl className="m-0 flex flex-wrap gap-x-7 gap-y-2 border-t border-[var(--line)] pt-3">
                          <Spec
                            label="Value"
                            value={p.valuePaise ? formatINRCompact(p.valuePaise) : null}
                          />
                          <Spec
                            label="Took"
                            value={p.durationDays ? `${p.durationDays} days` : null}
                          />
                        </dl>

                        {p.styleTags.length > 0 ? (
                          <p className="q-small m-0 text-[var(--ink2)]">
                            {p.styleTags.map((t) => STYLE_LABELS[t]).join(' · ')}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Wrap>
        </section>
      </main>

      <AppFooter />
    </div>
  );
}

/** One measured value in the identity card. Unmeasured renders as unmeasured. */
function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <p
        className="oi-num m-0 text-[14px] leading-snug"
        style={{ color: value ? 'var(--ink)' : 'var(--ink2)' }}
      >
        {value ?? '—'}
      </p>
      <p className="oi-label m-0 mt-1.5">{value ? label : `${label} — not stated`}</p>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="oi-label m-0">{label}</dt>
      <dd className="oi-num m-0 mt-1 text-[14px] text-[var(--ink)]">{value}</dd>
    </div>
  );
}
