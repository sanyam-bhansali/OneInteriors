'use client';

/**
 * Who fits your brief.
 *
 * ## What this screen was, and why it is not that any more
 *
 * It was four hundred and eighty lines: score rings, tier badges, factor
 * breakdowns, pills, a shortlist bar, an explanation of the engine. All of it
 * true, and together it asked somebody who wanted to know *who should do my
 * kitchen* to first learn how our matching works.
 *
 * A match screen has one job: hand over a short list, say why each one is on
 * it, and get out of the way. Everything else belongs on the studio's own
 * page, where somebody who has decided to look closely can look closely.
 *
 * So: one row per studio. A score, the reason it scored, and two doors —
 * read about them, or price them. Nothing else.
 *
 * ## Why the quote is offered here and not only inside the profile
 *
 * Because the impatient path is legitimate. Somebody who already knows they
 * want three numbers should get three numbers without reading three profiles
 * first. The quote lands in the studio's profile either way — this is a
 * shortcut to it, not a second home for it.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { loadBrief } from '@/modules/brief/store';
import { rankStudios, type MatchResult } from '@/modules/matching/score';
import { loadProject, saveProject, MAX_TO_COMPARE, MIN_TO_COMPARE, type Project } from '@/modules/quotation/project-store';
import { CHECK_COUNT } from '@/components/landing/checks';
import { formatINRCompact } from '@/lib/money';
import { AppFooter, AppHeader, Spine } from '@/components/oi/Chrome';
import { QuoteFlow, type QuoteRequest } from '@/components/oi/QuoteFlow';
import { Wrap, Chapter, Sheet, Quiet } from '@/components/oi';
import type { Studio } from '@/modules/studio/types';
import type { Brief } from '@/modules/brief/types';

/** Bedrooms by configuration, for the quote request. */
const BEDROOMS: Record<string, number> = {
  BHK_1: 1,
  BHK_2: 2,
  BHK_3: 3,
  BHK_4_PLUS: 4,
  VILLA: 4,
};

function ScoreRing({ score }: { score: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden className="flex-none">
      <circle cx="28" cy="28" r={r} fill="none" stroke="var(--line)" strokeWidth="3.5" />
      <circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        stroke="var(--sec)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={`${(score / 100) * c} ${c}`}
        transform="rotate(-90 28 28)"
      />
      <text x="28" y="32.5" textAnchor="middle" className="oi-num" fontSize="15" fill="var(--ink)">
        {score}
      </text>
    </svg>
  );
}

export function MatchClient({
  studios,
  allowUnverified,
}: {
  studios: Studio[];
  allowUnverified: boolean;
}) {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [project, setProject] = useState<Project>({ plan: null, quotes: {}, comparing: [] });
  const [quoting, setQuoting] = useState<QuoteRequest | null>(null);

  useEffect(() => {
    setBrief(loadBrief());
    setProject(loadProject());
  }, []);

  /**
   * A brief with nothing in it is not a brief.
   *
   * `rankStudios` will happily score an empty one — it returned five studios
   * at 100, 80, 70, 38 and 7 off a single factor out of six. Those are the
   * roster in arbitrary order wearing numbers, and a perfect score derived
   * from nothing is precisely the unearned figure this product exists to
   * argue against. So the list is gated on the brief, not on the list.
   */
  const briefed = brief !== null && brief.propertyType !== null;

  const matches = useMemo(
    () => (briefed && brief ? rankStudios(brief, studios, 6, { allowUnverified }) : []),
    [briefed, brief, studios, allowUnverified],
  );

  const byId = useMemo(() => new Map(studios.map((s) => [s.id, s])), [studios]);

  const update = (next: Project) => {
    setProject(next);
    saveProject(next);
  };

  const requestFor = (studio: Studio): QuoteRequest => ({
    studioSlug: studio.slug,
    studioName: studio.tradeName,
    bhk: BEDROOMS[brief?.propertyType ?? 'BHK_2'] ?? 2,
    carpetAreaSqft: brief?.carpetAreaSqft ?? 850,
    // One bathroom per bedroom is what the archive's flats overwhelmingly
    // have, and the vanity is the only line it drives.
    bathrooms: Math.max(1, BEDROOMS[brief?.propertyType ?? 'BHK_2'] ?? 2),
  });

  // ── The quote, over everything ──
  if (quoting) {
    const built = project.quotes[quoting.studioSlug];
    return (
      <div className="oi-app min-h-dvh bg-[var(--bg)]">
        <AppHeader />
        <Wrap className="py-10">
          <button
            type="button"
            onClick={() => setQuoting(null)}
            className="oi-num mb-8 cursor-pointer border-0 bg-transparent p-0 text-[11px] uppercase tracking-[0.16em] text-[var(--ink2)] hover:text-[var(--ink)]"
          >
            ← Back to your matches
          </button>

          <QuoteFlow
            request={quoting}
            plan={project.plan}
            onBuilt={(quote, plan) => {
              update({
                ...project,
                plan,
                quotes: {
                  ...project.quotes,
                  [quoting.studioSlug]: {
                    studioSlug: quoting.studioSlug,
                    studioName: quoting.studioName,
                    builtAt: new Date().toISOString(),
                    quote,
                  },
                },
              });
            }}
          />

          {built ? (
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Quiet href={`/studios/${quoting.studioSlug}`}>
                See this on {quoting.studioName}&rsquo;s page
              </Quiet>
              <button
                type="button"
                onClick={() => setQuoting(null)}
                className="cursor-pointer border-0 bg-transparent p-0 text-[13.5px] text-[var(--ink2)] underline hover:text-[var(--ink)]"
              >
                Price another studio
              </button>
            </div>
          ) : null}
        </Wrap>
        <AppFooter />
      </div>
    );
  }

  const quoted = Object.values(project.quotes);
  const comparing = project.comparing;

  return (
    <div className="oi-app min-h-dvh bg-[var(--bg)]">
      <AppHeader />
      <Spine
        at="match"
        facts={[
          ...(briefed && brief?.propertyType
            ? [{ id: 'brief' as const, fact: `${BEDROOMS[brief.propertyType] ?? 2} BHK` }]
            : []),
          ...(briefed ? [{ id: 'match' as const, fact: `${matches.length} fit` }] : []),
          ...(quoted.length > 0
            ? [{ id: 'quote' as const, fact: `${quoted.length} priced` }]
            : []),
          ...(comparing.length >= MIN_TO_COMPARE
            ? [{ id: 'compare' as const, fact: `${comparing.length} selected` }]
            : []),
        ]}
      />

      <Wrap className="py-12">
        <Chapter
          eyebrow="Who fits"
          title={
            !briefed
              ? 'Tell us about your flat first.'
              : matches.length === 0
                ? 'Nobody on the roster fits this brief.'
                : `${matches.length} of the fourteen fit your brief.`
          }
          aside={
            <p className="oi-num m-0 whitespace-nowrap text-[10.5px] uppercase tracking-[0.18em] text-[var(--ink2)]">
              Nobody can pay to sit higher
            </p>
          }
        >
          Scored on your answers — locality, scope, budget band, style, household — and on how many
          of the {CHECK_COUNT} checks they have cleared. Open one to read it properly, or price it
          straight away.
        </Chapter>

        {!briefed ? (
          <Sheet className="p-8">
            <p className="m-0 mb-4 max-w-[54ch] text-[15px] leading-[1.6]">
              Scoring studios against an empty brief would give you the roster in an arbitrary
              order with numbers on it. Nine questions, about two minutes, and these become real.
            </p>
            <Quiet href="/quiz">Start the brief</Quiet>
          </Sheet>
        ) : matches.length === 0 ? (
          <Sheet className="p-8">
            <p className="m-0 mb-4 max-w-[54ch] text-[15px] leading-[1.6]">
              Nothing on the roster matches this brief — usually the locality or the budget band.
              Widening either is the quickest fix.
            </p>
            <Quiet href="/quiz">Change your answers</Quiet>
          </Sheet>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {matches.map((match: MatchResult) => {
              const studio = byId.get(match.studioId);
              if (!studio) return null;

              const stored = project.quotes[studio.slug];
              const inCompare = comparing.includes(studio.slug);
              const cleared = studio.checks.filter((c) => c.result === 'PASS').length;

              return (
                <Sheet as="li" key={studio.id} className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
                    <ScoreRing score={match.score} />

                    <div className="min-w-0 flex-1">
                      <h2 className="oi-display m-0 mb-1.5 text-[21px]">{studio.tradeName}</h2>
                      {/* The reason, not the breakdown. One sentence a person
                          can agree or disagree with. */}
                      <p className="m-0 mb-2.5 max-w-[56ch] text-[14px] leading-[1.5] text-[var(--ink2)]">
                        {match.reasoning[0] ?? 'Matched on your locality and scope.'}
                      </p>
                      <p className="oi-num m-0 text-[10.5px] uppercase tracking-[0.14em] text-[var(--ink2)]">
                        <span style={{ color: 'var(--sec-ink)' }}>
                          {cleared}/{CHECK_COUNT} checks
                        </span>
                        {studio.completedProjects > 0
                          ? ` · ${studio.completedProjects} projects finished`
                          : ''}
                        {/* How much of the score is actually evidenced. A 94
                            built on two of six factors is not the same claim
                            as a 94 built on six, and showing the denominator
                            is the difference between a score and a number. */}
                        {` · scored on ${match.factorsScored} of ${match.factorsTotal}`}
                      </p>
                    </div>

                    <div className="flex flex-none flex-wrap items-center gap-3">
                      {stored ? (
                        <>
                          <span className="oi-num text-[17px]">
                            {formatINRCompact(stored.quote.totalPaise)}
                          </span>
                          <button
                            type="button"
                            disabled={!inCompare && comparing.length >= MAX_TO_COMPARE}
                            onClick={() =>
                              update({
                                ...project,
                                comparing: inCompare
                                  ? comparing.filter((s) => s !== studio.slug)
                                  : [...comparing, studio.slug],
                              })
                            }
                            className="cursor-pointer border px-4 py-2.5 text-[13.5px] font-medium transition-colors disabled:opacity-40"
                            style={{
                              borderColor: inCompare ? 'var(--acc)' : 'var(--line)',
                              background: inCompare ? 'var(--acc-wash)' : 'var(--card)',
                              color: 'var(--ink)',
                            }}
                          >
                            {inCompare ? 'In compare' : 'Add to compare'}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setQuoting(requestFor(studio))}
                          className="cursor-pointer px-5 py-2.5 text-[13.5px] font-medium text-white transition-colors"
                          style={{ background: 'var(--acc-btn)' }}
                        >
                          Get a quote
                        </button>
                      )}

                      <Link
                        href={`/studios/${studio.slug}`}
                        className="text-[13.5px] text-[var(--ink2)] underline hover:text-[var(--ink)]"
                      >
                        {stored ? 'Open profile' : 'Look properly'}
                      </Link>
                    </div>
                  </div>
                </Sheet>
              );
            })}
          </ul>
        )}
      </Wrap>

      {/* The compare bar. Appears only once there is something to compare,
          and says what is missing rather than sitting there disabled. */}
      {quoted.length > 0 ? (
        <div className="sticky bottom-0 z-20 border-t border-[var(--line)] bg-[var(--card)]/95 backdrop-blur">
          <Wrap>
            <div className="flex flex-wrap items-center justify-between gap-4 py-4">
              <p className="m-0 text-[13.5px] text-[var(--ink2)]">
                <span className="oi-num text-[var(--ink)]">{comparing.length}</span> selected ·{' '}
                {comparing.length < MIN_TO_COMPARE
                  ? 'pick one more to put them side by side'
                  : 'ready to compare line for line'}
              </p>
              {comparing.length >= MIN_TO_COMPARE ? (
                <Link
                  href="/compare"
                  className="px-5 py-2.5 text-[13.5px] font-medium text-white no-underline"
                  style={{ background: 'var(--acc-btn)' }}
                >
                  Compare {comparing.length}
                </Link>
              ) : null}
            </div>
          </Wrap>
        </div>
      ) : null}

      <AppFooter />
    </div>
  );
}
