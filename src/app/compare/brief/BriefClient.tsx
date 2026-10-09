'use client';

/**
 * The comparison brief — one page, to print, save as PDF or hand to family
 * (plan §17.1). Everything on it is already on /compare; this is the same
 * facts in the order someone reads a single sheet: who it is for, who fits,
 * what it costs, where the money differs, and what to ask.
 */

import { useEffect, useMemo, useState } from 'react';
import { Pill, PillButton } from '@/components/home/parts';
import { formatINRCompact } from '@/lib/money';
import { compareMany } from '@/modules/quotation/first-quote';
import { deterministicSummary } from '@/modules/quotation/compare-insights';
import { loadProject, MIN_TO_COMPARE, type Project } from '@/modules/quotation/project-store';
import { loadBrief } from '@/modules/brief/store';
import { localityLabel, type Brief } from '@/modules/brief/types';
import { cleanName } from '@/modules/brief/steps';
import { scopePhrase, selectionOf } from '@/modules/quotation/scope';
import { rankStudios, type MatchResult } from '@/modules/matching/score';
import { filedRatesFor, ratesAreReal } from '@/data/filed-rates';
import type { Studio } from '@/modules/studio/types';
import type { StudioRates } from '@/modules/quotation/catalogue';
import { Mark } from '@/components/brand';
import { Dot, ExplainDifferences, FitBlock, MaterialPrices, RoomPrices } from '../CompareInsights';
import { useLang, useSiteT } from '@/components/app/i18n';
import { COMPARE_DICT } from '@/modules/i18n/site/compare';
import { PROPERTY_TX, lbl } from '@/modules/i18n/site/labels';

export function BriefClient({
  studios: roster,
  allowUnverified,
  filedRates,
}: {
  studios: Studio[];
  allowUnverified: boolean;
  filedRates: Record<string, StudioRates>;
}) {
  const [project, setProject] = useState<Project | null>(null);
  const [brief, setBrief] = useState<Brief | null>(null);
  const t = useSiteT(COMPARE_DICT);
  const lang = useLang();

  useEffect(() => {
    setProject(loadProject());
    const b = loadBrief();
    setBrief(b.propertyType ? b : null);
  }, []);

  const entries = useMemo(
    () =>
      project
        ? project.comparing
            .map((slug) => project.quotes[slug])
            .filter((q): q is NonNullable<typeof q> => q !== undefined)
            .map((q) => ({ slug: q.studioSlug, name: q.studioName, quote: q.quote }))
        : [],
    [project],
  );

  const fit = useMemo(() => {
    if (!brief) return new Map<string, MatchResult>();
    return new Map(
      rankStudios(brief, roster, 99, {
        allowUnverified,
        ratesFor: (slug) => filedRates[slug] ?? filedRatesFor(slug),
        lang,
      }).map((r) => [r.studioId, r]),
    );
  }, [brief, roster, allowUnverified, filedRates, lang]);

  if (!project) return null;
  if (entries.length < MIN_TO_COMPARE) {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <p className="m-0 text-[16px]">{t('brief.needTwo')}</p>
        <Pill href="/compare" tone="line">
          {t('brief.backToCompare')}
        </Pill>
      </div>
    );
  }

  const summary = deterministicSummary(entries, compareMany(entries));
  const who = brief
    ? [cleanName(brief.contactName), lbl(lang, PROPERTY_TX, brief.propertyType), localityLabel(brief.locality), scopePhrase(selectionOf(brief))]
        .filter(Boolean)
        .join(' · ')
    : null;
  const today = new Date().toLocaleDateString(lang === 'en' ? 'en-IN' : `${lang}-IN`, { day: 'numeric', month: 'long', year: 'numeric' });
  const cheapest = Math.min(...entries.map((e) => e.quote.totalPaise));

  /* No scroll reveals and no rising words on this page: a block that had not
     scrolled into view when the reader pressed Print would come out blank.
     Sizes step down on paper (`print:!…` — the landing's type classes are
     unlayered and win over a plain utility). */
  return (
    <article>
      <header className="mb-[clamp(32px,5vw,56px)] flex flex-wrap items-end justify-between gap-6 print:mb-6 print:border-b print:border-black print:pb-4">
        <div className="min-w-0 max-w-[900px]">
          <p className="eyebrow">{t('brief.eyebrow', { date: today })}</p>
          <h1 className="h-l print:!text-[26px] print:!leading-tight">{entries.map((e) => e.name).join(' · ')}</h1>
          {who ? <p className="lede print:!mt-2 print:!text-[13px]">{t('brief.preparedFor', { who })}</p> : null}
        </div>
        {/* The wrapper hides it on paper: the pill's own display wins over a utility. */}
        <span className="print:hidden">
          <PillButton tone="dark" onClick={() => window.print()}>
            {t('brief.print')}
          </PillButton>
        </span>
      </header>

      {!ratesAreReal() ? (
        <p className="m-0 mb-6 flex items-baseline gap-2 text-[13.5px] font-medium text-[var(--accent-ink)]">
          <Dot />
          {t('prelaunch')}
        </p>
      ) : null}

      <p className="m-0 mb-[clamp(28px,4vw,48px)] max-w-[60ch] text-[clamp(1.1rem,1rem+0.5vw,1.4rem)] font-medium leading-[1.4] tracking-[-0.015em] print:mb-6 print:text-[15px]">
        {summary.headline}
      </p>

      <FitBlock entries={entries} studios={roster} matches={fit} />

      <div
        className="mb-6 grid gap-3 sm:gap-4 print:gap-2"
        style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(12rem,100%),1fr))' }}
      >
        {entries.map((e) => (
          <div
            key={e.slug}
            className="flow-card break-inside-avoid print:!rounded-none print:!p-0 print:!pt-3 print:border-t print:border-black"
            style={e.quote.totalPaise === cheapest ? { background: 'var(--mint)' } : undefined}
          >
            <p className="m-0 text-[17px] font-medium leading-tight tracking-[-0.01em]">{e.name}</p>
            <p className="m-0 mt-5 text-[clamp(1.8rem,1.4rem+1.4vw,2.6rem)] font-medium leading-none tracking-[-0.04em] tabular-nums print:mt-2 print:!text-[22px]">
              {formatINRCompact(e.quote.totalPaise)}
            </p>
            <p className="m-0 mt-2 text-[13.5px] text-[var(--ink-2)] tabular-nums">
              {formatINRCompact(e.quote.lowPaise)}–{formatINRCompact(e.quote.highPaise)}
            </p>
          </div>
        ))}
      </div>

      <RoomPrices entries={entries} />
      <MaterialPrices entries={entries} />
      <ExplainDifferences slugs={entries.map((e) => e.slug)} brief={brief} plan={project.plan} />

      <section className="flow-card mb-[clamp(32px,5vw,56px)] break-inside-avoid print:!rounded-none print:!px-0">
        <h2 className="h-m">{t('worthAsking')}</h2>
        <ul className="m-0 mt-5 flex list-none flex-col gap-2.5 p-0">
          {summary.questions.map((q) => (
            <li key={q} className="flex items-baseline gap-2.5 text-[15px] leading-snug">
              <Dot size={6} />
              {q}
            </li>
          ))}
        </ul>
      </section>

      <footer className="flex items-center gap-2 border-t border-[var(--line)] pt-4 text-[13px] text-[var(--ink-2)] print:border-black">
        <Mark className="h-[14px] w-[14px] text-[var(--ink)]" />
        {t('brief.footer')}
      </footer>
    </article>
  );
}
