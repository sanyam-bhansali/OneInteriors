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
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatINRCompact } from '@/lib/money';
import {
  loadProject,
  saveProject,
  MIN_TO_COMPARE,
  type Project,
} from '@/modules/quotation/project-store';
import { loadBrief } from '@/modules/brief/store';
import { QuoteFlow, QuoteDocument, type QuoteRequest } from './QuoteFlow';
import { homeShapeFor } from '@/modules/quotation/first-quote';
import { Sheet, Quiet } from './index';
import { useLang, useSiteT } from '@/components/app/i18n';
import { OI_DICT } from '@/modules/i18n/site/oi';

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
      <Sheet className="p-6">
        <p className="oi-eyebrow m-0 mb-3">{t('panel.eyebrow')}</p>
        <p className="m-0 mb-5 max-w-[52ch] text-[14.5px] leading-[1.6] text-[var(--ink2)]">
          {t('panel.noBrief')}
        </p>
        <Quiet href="/quiz">{t('panel.start')}</Quiet>
      </Sheet>
    );
  }

  return (
    <section id="quote" className="flex flex-col gap-5">
      {stored ? (
        <>
          <QuoteDocument
            quote={stored.quote}
            studioName={studioName}
            plan={project.plan ?? { fileName: null, kitchenRunMm: null, source: 'standard' }}
          />

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() =>
                update({
                  ...project,
                  comparing: inCompare
                    ? project.comparing.filter((s) => s !== studioSlug)
                    : [...project.comparing, studioSlug],
                })
              }
              className="cursor-pointer border px-5 py-3 text-[14px] font-medium transition-colors disabled:opacity-40"
              style={{
                borderColor: inCompare ? 'var(--acc)' : 'var(--line)',
                background: inCompare ? 'var(--acc-wash)' : 'var(--card)',
              }}
            >
              {inCompare ? t('panel.inCompare') : t('panel.addCompare')}
            </button>

            {project.comparing.length >= MIN_TO_COMPARE ? (
              <Link
                href="/compare"
                className="px-5 py-3 text-[14px] font-medium text-white no-underline"
                style={{ background: 'var(--acc-btn)' }}
              >
                {t('panel.compareN', { n: project.comparing.length })}
              </Link>
            ) : (
              <span className="text-[13.5px] text-[var(--ink2)]">
                {quotedCount < 2
                  ? t('panel.priceOneMore')
                  : t('panel.addSecond')}
              </span>
            )}

            <span className="oi-num text-[10.5px] uppercase tracking-[0.14em] text-[var(--ink2)]">
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
