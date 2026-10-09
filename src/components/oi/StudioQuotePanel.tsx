'use client';

/**
 * The quote, on the studio's own page.
 *
 * ## Why here and nowhere else
 *
 * A quote is that studio's pricing. It belongs under their work, their
 * checks and their record — the things that say whether the number is worth
 * anything — and not on a shared screen that collects everybody's.
 *
 * The old `/quotes` page put three studios' numbers in a list, which invites
 * the one comparison that should never be made casually: the totals, without
 * the materials underneath them. That comparison belongs on `/compare`, where
 * every line sits next to its spec and the gap gets explained. Two quotes
 * ₹1.25 L apart are usually not both more expensive; one has thicker board in
 * it, and a list of totals hides exactly that.
 *
 * So: generate it here, read it here, and send it to compare deliberately.
 *
 * The studio's page is not on the landing canvas, but the quote is the same
 * document as on /match (owner, 10 Oct 2026: the landing's look through the
 * flow). So this carries `cb cb-part` itself — the landing's tokens, type
 * and pills for what it renders, nothing for the page around it.
 */

import { useEffect, useState } from 'react';
import { formatINRCompact } from '@/lib/money';
import { Pill } from '@/components/home/parts';
import {
  loadProject,
  saveProject,
  MIN_TO_COMPARE,
  type Project,
} from '@/modules/quotation/project-store';
import { loadBrief } from '@/modules/brief/store';
import { QuoteFlow, QuoteDocument, type QuoteRequest } from './QuoteFlow';
import { homeShapeFor } from '@/modules/quotation/first-quote';
import { useLang, useSiteT } from '@/components/app/i18n';
import { OI_DICT } from '@/modules/i18n/site/oi';

/** A `.cb` part sits on the page's own ground and never clips its children. */
const CB_PART = { background: 'transparent', overflowX: 'visible' } as const;

export function StudioQuotePanel({
  studioSlug,
  studioName,
}: {
  studioSlug: string;
  studioName: string;
}) {
  const t = useSiteT(OI_DICT);
  const lang = useLang();
  const [project, setProject] = useState<Project | null>(null);
  const [request, setRequest] = useState<QuoteRequest | null>(null);
  const [briefed, setBriefed] = useState(false);

  useEffect(() => {
    const brief = loadBrief();
    setBriefed(brief.propertyType !== null);
    setProject(loadProject());
    setRequest({
      studioSlug,
      studioName,
      ...homeShapeFor(brief),
    });
  }, [studioSlug, studioName]);

  // Nothing renders until the browser has read storage. Showing "no quote yet"
  // for a frame to somebody who has one is worse than showing nothing.
  if (!project || !request) return null;

  const stored = project.quotes[studioSlug];
  const inCompare = project.comparing.includes(studioSlug);
  const quotedCount = Object.keys(project.quotes).length;

  const update = (next: Project) => {
    setProject(next);
    saveProject(next);
  };

  if (!briefed) {
    return (
      <div className="cb cb-part" style={CB_PART}>
        <div className="flow-card">
          <p className="eyebrow">{t('panel.eyebrow')}</p>
          <p className="m-0 mb-6 max-w-[52ch] text-[15.5px] leading-[1.6] text-[var(--ink-2)]">
            {t('panel.noBrief')}
          </p>
          <Pill href="/quiz" arrow>
            {t('panel.start')}
          </Pill>
        </div>
      </div>
    );
  }

  return (
    <section id="quote" className="cb cb-part flex flex-col gap-5" style={CB_PART}>
      {stored ? (
        <>
          <QuoteDocument
            quote={stored.quote}
            studioName={studioName}
            plan={project.plan ?? { fileName: null, kitchenRunMm: null, source: 'standard' }}
          />

          <div className="flex flex-wrap items-center gap-3">
            {/* A choice you toggle, so the flow's option pill — ink while it is in. */}
            <button
              type="button"
              aria-pressed={inCompare}
              onClick={() =>
                update({
                  ...project,
                  comparing: inCompare
                    ? project.comparing.filter((s) => s !== studioSlug)
                    : [...project.comparing, studioSlug],
                })
              }
              className="flow-opt"
            >
              {inCompare ? t('panel.inCompare') : t('panel.addCompare')}
            </button>

            {project.comparing.length >= MIN_TO_COMPARE ? (
              <Pill href="/compare" arrow>
                {t('panel.compareN', { n: project.comparing.length })}
              </Pill>
            ) : (
              <span className="text-[14px] text-[var(--ink-2)]">
                {quotedCount < 2
                  ? t('panel.priceOneMore')
                  : t('panel.addSecond')}
              </span>
            )}

            <span className="text-[13px] tabular-nums text-[var(--ink-2)]">
              {t('panel.built', {
                date: new Date(stored.builtAt).toLocaleDateString(lang === 'en' ? 'en-IN' : `${lang}-IN`, {
                  day: 'numeric',
                  month: 'short',
                }),
              })}
              {' · '}
              {formatINRCompact(stored.quote.totalPaise)}
            </span>
          </div>
        </>
      ) : (
        <QuoteFlow
          request={request}
          plan={request.plan ?? project.plan}
          onBuilt={(quote, plan) =>
            update({
              ...project,
              plan,
              quotes: {
                ...project.quotes,
                [studioSlug]: {
                  studioSlug,
                  studioName,
                  builtAt: new Date().toISOString(),
                  quote,
                },
              },
            })
          }
        />
      )}
    </section>
  );
}
