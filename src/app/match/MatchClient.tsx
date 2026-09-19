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
import { loadBrief } from '@/modules/brief/store';
import { rankStudios, type MatchResult } from '@/modules/matching/score';
import {
  loadProject,
  saveProject,
  EMPTY_PROJECT,
  MIN_TO_COMPARE,
  type Project,
} from '@/modules/quotation/project-store';
import { CHECK_COUNT } from '@/components/landing/checks';
import { AppFooter, AppHeader, Spine } from '@/components/oi/Chrome';
import { QuoteFlow, type QuoteRequest } from '@/components/oi/QuoteFlow';
import { Wrap, Chapter, Sheet, Quiet } from '@/components/oi';
import { StudioCard } from './StudioCard';
import { MatchHero } from './MatchHero';
import { CompareBar } from './CompareBar';
import { useScrollFocus } from './useScrollFocus';
import { saveQuoteAction, saveDecisionAction } from './journey-actions';
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

export function MatchClient({
  studios,
  allowUnverified,
}: {
  studios: Studio[];
  allowUnverified: boolean;
}) {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [project, setProject] = useState<Project>(EMPTY_PROJECT);
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

  /* Depth of field down the list — whatever is near the middle of the
     viewport is in focus. Declared here with the other hooks because the
     quote view below returns early, and a hook after a conditional return
     is the classic order-of-hooks crash. */
  const { register, focus, open } = useScrollFocus<HTMLLIElement>(matches.length);

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
            seenQuestions={project.askedQuestions}
            onAsked={(id) =>
              update({
                ...project,
                askedQuestions: project.askedQuestions.includes(id)
                  ? project.askedQuestions
                  : [...project.askedQuestions, id],
              })
            }
            onBuilt={(quote, plan) => {
              /* The durable copy, written behind the screen.
                 Deliberately not awaited: sessionStorage below has already
                 put the quote in front of the customer, and a slow or
                 unreachable database must not hold up a document they are
                 looking at. If it fails we lose a row, which is where this
                 product was before the table existed. */
              void saveQuoteAction({ studioSlug: quoting.studioSlug, quote, plan });

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
    <div className="oi-app oi-quick min-h-dvh bg-[var(--bg)]">
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
        {briefed && matches.length > 0 ? (
          <MatchHero fit={matches.length} checkCount={CHECK_COUNT} />
        ) : (
          <Chapter
            eyebrow="Who fits"
            title={
              !briefed ? 'Tell us about your flat first.' : 'Nobody on the roster fits this brief.'
            }
          />
        )}

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
          <ul className="mx-auto m-0 mt-12 flex max-w-[40rem] list-none flex-col gap-6 p-0">
            {matches.map((match: MatchResult, i) => {
              const studio = byId.get(match.studioId);
              if (!studio || !brief) return null;

              const stored = project.quotes[studio.slug];

              return (
                <StudioCard
                  key={studio.id}
                  cardRef={register(i)}
                  focus={focus[i] ?? 'near'}
                  wingsOpen={open[i] ?? false}
                  studio={studio}
                  match={match}
                  brief={brief}
                  rank={i}
                  quotedTotalPaise={stored?.quote.totalPaise ?? null}
                  inCompare={comparing.includes(studio.slug)}
                  cachedRead={project.reads?.[studio.id]}
                  onRead={(id, read) =>
                    update({ ...project, reads: { ...project.reads, [id]: read } })
                  }
                  onQuote={() => setQuoting(requestFor(studio))}
                  onToggleCompare={() => {
                    const next = comparing.includes(studio.slug)
                      ? comparing.filter((x) => x !== studio.slug)
                      : [...comparing, studio.slug];
                    update({ ...project, comparing: next });
                    void saveDecisionAction({
                      comparedSlugs: next,
                      starredCodes: project.starred,
                    });
                  }}
                />
              );
            })}
          </ul>
        )}
      </Wrap>

      <CompareBar selected={comparing.length} minimum={MIN_TO_COMPARE} priced={quoted.length} />

      <AppFooter />
    </div>
  );
}
