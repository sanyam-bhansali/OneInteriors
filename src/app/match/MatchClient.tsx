'use client';

/**
 * Reveal + marketplace.
 *
 * The reveal comes BEFORE any signup. Proving we understood the brief is what
 * earns the phone number — asking first is the single most common way this
 * funnel leaks.
 *
 * The list is capped. Houzz's failure mode in India is showing everyone; the
 * scarcity of options IS the value we're selling.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Container, Button, TierBadge, ScoreRing, Pill } from '@/components/ui';
import { SiteHeader, SiteFooter } from '@/components/chrome';
import { formatINRCompact } from '@/lib/money';
import {
  EMPTY_BRIEF,
  PRIORITY_LABELS,
  PROPERTY_LABELS,
  PUNE_LOCALITIES,
  STYLE_LABELS,
  isBriefComplete,
  type Brief,
} from '@/modules/brief/types';
import { loadBrief } from '@/modules/brief/store';
import { rankStudios, type MatchResult } from '@/modules/matching/score';
import type { Studio } from '@/modules/studio/types';
import { PlanFragment } from '@/components/art/PlanFragment';
import { StyleScene, MaterialSwatches } from '@/components/art/StyleScene';

/** Substyle strength, shown as bars rather than a number — it's a feel, not a measurement. */
function StrengthBars({ level }: { level: number }) {
  return (
    <span className="flex items-end gap-[3px]" aria-label={`Strength ${level} of 4`}>
      {[1, 2, 3, 4].map((n) => (
        <span
          key={n}
          className={`w-[4px] rounded-[1px] ${
            n <= level ? 'bg-[var(--color-terracotta)]' : 'bg-[var(--color-rule)]'
          }`}
          style={{ height: `${5 + n * 3}px` }}
        />
      ))}
    </span>
  );
}

export function MatchClient({ studios }: { studios: Studio[] }) {
  const [brief, setBrief] = useState<Brief>(EMPTY_BRIEF);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setBrief(loadBrief());
    setHydrated(true);
  }, []);

  const matches = useMemo(
    () => (hydrated ? rankStudios(brief, studios, 9) : []),
    [brief, hydrated, studios],
  );
  const primary = brief.styleLikes[0] ?? null;

  if (!hydrated) return null;

  if (!isBriefComplete(brief)) {
    return (
      <>
        <SiteHeader />
        <main className="py-16">
          <Container size="narrow">
            <h1 className="h1 mb-3">
              We don&rsquo;t have your brief yet
            </h1>
            <p className="mb-6 text-[var(--color-ink-2)]">
              The nine questions take about three minutes, and you can change any answer afterwards.
            </p>
            <Button href="/quiz" size="lg">
              Start
            </Button>
          </Container>
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <SiteHeader />

      <main>
        {/* Style reveal — the payoff for nine questions, and the moment that
            earns the phone number later. Comprehension before the ask. */}
        <section className="border-b border-[var(--color-rule)] py-12 sm:py-16">
          <Container size="wide">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,44%)] lg:gap-14">
              <div className="rise">
                <p className="m-0 mb-4 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-[var(--color-ink-3)]">
                  Your style
                </p>
                <h1 className="display mb-6 max-w-[15ch]">
                  Going by what you picked, your home leans{' '}
                  <span className="text-[var(--color-terracotta)] underline decoration-[var(--color-terracotta)]/40 decoration-2 underline-offset-[6px]">
                    {primary ? STYLE_LABELS[primary] : 'Contemporary'}
                  </span>
                  .
                </h1>

                <p className="m-0 mb-7 max-w-[52ch] text-[16.5px] leading-relaxed text-[var(--color-ink-2)]">
                  {summarise(brief)}
                </p>

                {brief.styleLikes.length > 1 ? (
                  <div className="mb-7">
                    <p className="m-0 mb-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.13em] text-[var(--color-ink-3)]">
                      With a bit of
                    </p>
                    <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                      {brief.styleLikes.slice(1).map((t, i) => (
                        <li key={t} className="flex items-center gap-3">
                          <span className="min-w-[150px] text-[14.5px] text-[var(--color-ink)]">
                            {STYLE_LABELS[t]}
                          </span>
                          <StrengthBars level={i === 0 ? 3 : 2} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
                  <p className="m-0">
                    <span className="tabular font-[family-name:var(--font-display)] text-[40px] leading-none text-[var(--color-petrol)]">
                      {matches.length}
                    </span>
                    <span className="ml-2 text-[15px] text-[var(--color-ink-2)]">
                      studios match you
                    </span>
                  </p>
                  <Link
                    href="/quiz"
                    className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.11em] text-[var(--color-petrol)]"
                  >
                    Change an answer
                  </Link>
                </div>
              </div>

              {/* The rooms they actually chose, played back. */}
              <div className="rise rise-2">
                <div className="grid grid-cols-2 gap-3">
                  {brief.styleLikes.slice(0, 3).map((t, i) => (
                    <div
                      key={t}
                      className={`overflow-hidden rounded-[10px] border border-[var(--color-rule)] ${
                        i === 0 ? 'col-span-2' : ''
                      }`}
                    >
                      <StyleScene tag={t} className={`block w-full ${i === 0 ? 'aspect-[16/9]' : 'aspect-[4/3]'}`} />
                      <div className="bg-[var(--color-paper-2)] px-3 py-2">
                        <p className="m-0 text-[12.5px] font-bold leading-tight">{STYLE_LABELS[t]}</p>
                        {i === 0 ? <MaterialSwatches tag={t} className="mt-1.5" /> : null}
                      </div>
                    </div>
                  ))}
                </div>
                {brief.styleDislikes.length > 0 ? (
                  <p className="m-0 mt-3 text-[13.5px] leading-snug text-[var(--color-ink-3)]">
                    You ruled out {brief.styleDislikes.map((t) => STYLE_LABELS[t]).join(' and ')} — no
                    studio below leans that way.
                  </p>
                ) : null}
              </div>
            </div>
          </Container>
        </section>

        {/* Results */}
        <section className="py-10 sm:py-12">
          <Container size="wide">
            {matches.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                <p className="m-0 mb-6 max-w-[60ch] text-[15px] text-[var(--color-ink-2)]">
                  Ranked by fit, not by what anyone paid us — no studio can buy placement here.
                  Scores are calculated only from factors we could actually measure, and each card
                  says how many that was.
                </p>
                <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2">
                  {matches.map((m) => (
                    <StudioCard key={m.studioId} match={m} studio={studios.find((s) => s.id === m.studioId)!} />
                  ))}
                </ul>
              </>
            )}
          </Container>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

function StudioCard({ match, studio }: { match: MatchResult; studio: Studio }) {

  const partial = match.factorsScored < match.factorsTotal;

  return (
    <li className="lift flex flex-col border border-[var(--color-rule)] bg-[var(--color-paper-2)]">
      <PlanFragment
        seed={studio.id}
        styles={studio.portfolio.flatMap((p) => p.styleTags)}
        className="block h-28 w-full"
      />

      <div className="flex flex-1 flex-col gap-4 border-t border-[var(--color-rule)] p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="m-0 mb-1.5 text-[17px] font-bold leading-snug">
              <Link
                href={`/studios/${studio.slug}`}
                className="text-[var(--color-ink)] no-underline hover:text-[var(--color-petrol)]"
              >
                {studio.tradeName}
              </Link>
            </h2>
            <TierBadge tier={studio.tier} />
          </div>
          <div className="shrink-0 text-center">
            <ScoreRing score={match.score} />
            <p
              className={`m-0 mt-1 font-[family-name:var(--font-mono)] text-[9px] uppercase leading-tight tracking-[0.08em] ${
                partial ? 'text-[var(--color-brass)]' : 'text-[var(--color-ink-3)]'
              }`}
            >
              {match.factorsScored} of {match.factorsTotal}
              <br />
              factors
            </p>
          </div>
        </div>

        {/* Reasoning — the customer's own words quoted back, including the
            unflattering line. This is the part that makes the score credible. */}
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {match.reasoning.slice(0, 3).map((line, i) => (
            <li key={i} className="text-[14px] leading-snug text-[var(--color-ink-2)]">
              {line}
            </li>
          ))}
        </ul>

        <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-[var(--color-rule)] pt-4">
          <Pill tone={studio.avgVarianceDays === null ? 'neutral' : studio.avgVarianceDays <= 10 ? 'ontrack' : 'atrisk'}>
            {studio.avgVarianceDays === null
              ? 'No record yet'
              : `${studio.avgVarianceDays > 0 ? '+' : ''}${Math.round(studio.avgVarianceDays)} days avg`}
          </Pill>
          {studio.minProjectPaise && studio.maxProjectPaise ? (
            <Pill>
              {formatINRCompact(studio.minProjectPaise)}–{formatINRCompact(studio.maxProjectPaise)}
            </Pill>
          ) : null}
          {studio.upheldDisputes > 0 ? <Pill tone="atrisk">{studio.upheldDisputes} dispute upheld</Pill> : null}
          <Link
            href={`/studios/${studio.slug}`}
            className="ml-auto font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-[var(--color-petrol)]"
          >
            Full profile →
          </Link>
        </div>
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="max-w-[54ch] border-l-2 border-[var(--color-brass)] pl-5">
      <h2 className="h2 mb-3">
        No studio in our Pune roster fits this brief.
      </h2>
      <p className="mb-4 text-[var(--color-ink-2)]">
        We keep the roster small and only show studios we have actually verified, so sometimes the
        honest answer is that we do not have the right one for you yet. We would rather say that
        than show you a weak match.
      </p>
      <Button href="/quiz" variant="secondary">
        Adjust your brief
      </Button>
    </div>
  );
}

/** One sentence in the customer's own terms. Proof we read the brief. */
function summarise(brief: Brief): string {
  const parts: string[] = [];

  const home = brief.propertyType ? PROPERTY_LABELS[brief.propertyType] : 'A home';
  const loc = PUNE_LOCALITIES.find((l) => l.slug === brief.locality)?.label;
  parts.push(loc ? `${home} in ${loc}` : home);

  if (brief.household) {
    const h = brief.household;
    const people = h.adults + h.children + h.elderly;
    parts.push(`for ${people === 1 ? 'one person' : `a household of ${people}`}`);
    if (h.children > 0) parts.push('with young children');
  }

  const sentence1 = `${parts.join(' ')}.`;

  const bits: string[] = [];
  if (brief.styleLikes.length) {
    bits.push(`You want ${brief.styleLikes.map((t) => STYLE_LABELS[t]).join(' and ').toLowerCase()}`);
  }
  if (brief.styleDislikes.length) {
    bits.push(`not ${brief.styleDislikes.map((t) => STYLE_LABELS[t]).join(' or ').toLowerCase()}`);
  }
  if (brief.priorityRanking.length >= 2) {
    const first = PRIORITY_LABELS[brief.priorityRanking[0]].toLowerCase();
    const last = PRIORITY_LABELS[brief.priorityRanking[3] ?? brief.priorityRanking[1]].toLowerCase();
    bits.push(`and you would trade ${last} for ${first}`);
  }

  return bits.length ? `${sentence1} ${bits.join(', ')}.` : sentence1;
}
