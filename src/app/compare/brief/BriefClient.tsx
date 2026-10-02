'use client';

/**
 * The comparison brief — one page, to print, save as PDF or hand to family
 * (plan §17.1). Everything on it is already on /compare; this is the same
 * facts in the order someone reads a single sheet: who it is for, who fits,
 * what it costs, where the money differs, and what to ask.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatINRCompact } from '@/lib/money';
import { compareMany } from '@/modules/quotation/first-quote';
import { deterministicSummary } from '@/modules/quotation/compare-insights';
import { loadProject, MIN_TO_COMPARE, type Project } from '@/modules/quotation/project-store';
import { loadBrief } from '@/modules/brief/store';
import { localityLabel, propertyLabel, type Brief } from '@/modules/brief/types';
import { cleanName } from '@/modules/brief/steps';
import { scopePhrase, selectionOf } from '@/modules/quotation/scope';
import { rankStudios, type MatchResult } from '@/modules/matching/score';
import { filedRatesFor, ratesAreReal } from '@/data/filed-rates';
import type { Studio } from '@/modules/studio/types';
import type { StudioRates } from '@/modules/quotation/catalogue';
import { Mark } from '@/components/brand';
import { ExplainDifferences, FitBlock, MaterialPrices, RoomPrices } from '../CompareInsights';

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
      }).map((r) => [r.studioId, r]),
    );
  }, [brief, roster, allowUnverified, filedRates]);

  if (!project) return null;
  if (entries.length < MIN_TO_COMPARE) {
    return (
      <p className="m-0 text-[15px]">
        Put at least two quotes side by side first. <Link href="/compare">Back to compare</Link>
      </p>
    );
  }

  const summary = deterministicSummary(entries, compareMany(entries));
  const who = brief
    ? [cleanName(brief.contactName), propertyLabel(brief.propertyType), localityLabel(brief.locality), scopePhrase(selectionOf(brief))]
        .filter(Boolean)
        .join(' · ')
    : null;
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <article>
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-[var(--ink)] pb-5">
        <div>
          <p className="oi-eyebrow m-0 mb-2">Comparison brief · {today}</p>
          <h1 className="oi-display m-0 text-[clamp(1.6rem,1.3rem+1.2vw,2.2rem)]">
            {entries.map((e) => e.name).join(' · ')}
          </h1>
          {who ? <p className="m-0 mt-2 text-[14px] text-[var(--ink2)]">Prepared for {who}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="cursor-pointer border border-[var(--line)] bg-transparent px-4 py-2 text-[13px] text-[var(--ink)] print:hidden"
        >
          Print or save as PDF
        </button>
      </header>

      {!ratesAreReal() ? (
        <p className="oi-label m-0 mb-6">Pre-launch — priced on archive rates, not each studio&rsquo;s own filed card</p>
      ) : null}

      <p className="m-0 mb-6 max-w-[68ch] text-[16px] leading-[1.6]">{summary.headline}</p>

      <FitBlock entries={entries} studios={roster} matches={fit} />

      <div className="mb-10 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(12rem,1fr))' }}>
        {entries.map((e) => (
          <div key={e.slug} className="border-t border-[var(--line)] pt-3">
            <p className="m-0 text-[15px] font-semibold">{e.name}</p>
            <p className="oi-num m-0 mt-1 text-[22px]">{formatINRCompact(e.quote.totalPaise)}</p>
            <p className="oi-label m-0 mt-1">
              {formatINRCompact(e.quote.lowPaise)}–{formatINRCompact(e.quote.highPaise)}
            </p>
          </div>
        ))}
      </div>

      <RoomPrices entries={entries} />
      <MaterialPrices entries={entries} />
      <ExplainDifferences slugs={entries.map((e) => e.slug)} brief={brief} plan={project.plan} />

      <section className="mb-10">
        <p className="oi-eyebrow m-0 mb-3">Worth asking every studio</p>
        <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5">
          {summary.questions.map((q) => (
            <li key={q} className="text-[14.5px]">
              {q}
            </li>
          ))}
        </ul>
      </section>

      <footer className="flex items-center gap-2 border-t border-[var(--ink)] pt-4 text-[12.5px] text-[var(--ink2)]">
        <Mark className="h-[14px] w-[14px] text-[var(--ink)]" />
        One Interiors — every studio priced on the same lines and sizes. No studio pays to be shown.
      </footer>
    </article>
  );
}
