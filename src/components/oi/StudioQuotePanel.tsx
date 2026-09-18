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
  MAX_TO_COMPARE,
  MIN_TO_COMPARE,
  type Project,
} from '@/modules/quotation/project-store';
import { loadBrief } from '@/modules/brief/store';
import { QuoteFlow, QuoteDocument, type QuoteRequest } from './QuoteFlow';
import { Sheet, Quiet } from './index';

const BEDROOMS: Record<string, number> = {
  BHK_1: 1,
  BHK_2: 2,
  BHK_3: 3,
  BHK_4_PLUS: 4,
  VILLA: 4,
};

export function StudioQuotePanel({
  studioSlug,
  studioName,
}: {
  studioSlug: string;
  studioName: string;
}) {
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
      bhk: BEDROOMS[brief.propertyType ?? 'BHK_2'] ?? 2,
      carpetAreaSqft: brief.carpetAreaSqft ?? 850,
      bathrooms: Math.max(1, BEDROOMS[brief.propertyType ?? 'BHK_2'] ?? 2),
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
        <p className="oi-eyebrow m-0 mb-3">Your quote</p>
        <p className="m-0 mb-5 max-w-[52ch] text-[14.5px] leading-[1.6] text-[var(--ink2)]">
          Nine questions about your flat and we will price this studio on their own filed rates —
          in about ten seconds, with every line carrying a quantity.
        </p>
        <Quiet href="/quiz">Start the brief</Quiet>
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
              disabled={!inCompare && project.comparing.length >= MAX_TO_COMPARE}
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
              {inCompare ? 'In your comparison' : 'Add to compare'}
            </button>

            {project.comparing.length >= MIN_TO_COMPARE ? (
              <Link
                href="/compare"
                className="px-5 py-3 text-[14px] font-medium text-white no-underline"
                style={{ background: 'var(--acc-btn)' }}
              >
                Compare {project.comparing.length} line for line
              </Link>
            ) : (
              <span className="text-[13.5px] text-[var(--ink2)]">
                {quotedCount < 2
                  ? 'Price one more studio to compare them.'
                  : 'Add a second quote to compare.'}
              </span>
            )}

            <span className="oi-num text-[10.5px] uppercase tracking-[0.14em] text-[var(--ink2)]">
              Built {new Date(stored.builtAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
              })}
              {' · '}
              {formatINRCompact(stored.quote.totalPaise)}
            </span>
          </div>
        </>
      ) : (
        <QuoteFlow
          request={request}
          plan={project.plan}
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
