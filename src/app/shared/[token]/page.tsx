import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Container, Button, Eyebrow } from '@/components/ui';
import { SiteFooter } from '@/components/chrome';
import { Wordmark } from '@/components/brand';
import Link from 'next/link';
import { formatINR, formatINRCompact } from '@/lib/money';
import { briefByShareToken } from '@/modules/brief/share';
import { cachedRoster } from '@/modules/studio/roster-cache';
import { rankStudios } from '@/modules/matching/score';
import { quoteBrief } from '@/modules/quotation/generate';
import { compareQuotes } from '@/modules/quotation/price';
import { record } from '@/modules/analytics/record';
import { PROPERTY_LABELS, SCOPE_LABELS, STYLE_LABELS } from '@/modules/brief/types';

/**
 * The read-only comparison, for the person who was not on the call.
 *
 * ## What is deliberately absent
 *
 * Everything that would let a reader act, and everything that identifies the
 * sender. There is no expert request, no sign-in prompt on the quotes, no
 * "change an answer", and no studio contact route — the same rule that holds
 * on every other page holds harder here, because the holder of this URL is
 * someone we have never met.
 *
 * There is exactly one call to action, at the bottom, and it starts a brief of
 * their own. If a spouse reads this and wants to engage, they engage as
 * themselves.
 *
 * ## Why it re-prices rather than reading stored quotes
 *
 * The numbers a spouse sees must be the numbers the customer sees. Storing a
 * snapshot would drift the moment a studio changed a rate, and the two of them
 * comparing different figures over dinner is worse than either figure being
 * slightly stale.
 */

export const metadata: Metadata = {
  title: 'A comparison shared with you',
  // Never indexed. The URL is a bearer token; a search engine that crawls one
  // has published somebody's budget.
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = 'force-dynamic';

const MAX_COMPARE = 4;

export default async function SharedPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const shared = await briefByShareToken(token);
  // A missing token, a revoked one and a malformed one are all 404. Telling a
  // stranger that a link "has been revoked" confirms it was once real.
  if (!shared) notFound();

  const { brief } = shared;

  const studios = await cachedRoster();
  const ranked = rankStudios(brief, studios).slice(0, MAX_COMPARE);
  const result = await quoteBrief(
    brief,
    ranked.map((r) => r.studioId),
  );

  if (!result.ok) notFound();

  await record('share.view', { studios: result.quotes.length });

  const comparison = compareQuotes(
    result.quotes.map((q) => ({ studioId: q.studioId, quote: q.quote })),
  );
  const { summary } = result;

  const home = brief.propertyType ? PROPERTY_LABELS[brief.propertyType] : 'A home';
  const scope = brief.scope ? SCOPE_LABELS[brief.scope] : null;

  return (
    <>
      {/* Not SiteHeader. That header carries a "Start"/"Continue" button wired
          to this browser's own brief, which for a recipient is either empty or,
          worse, their own unrelated one. A shared document gets a masthead, not
          the app chrome. */}
      <header className="border-b border-[var(--color-rule)] bg-[var(--color-paper)]">
        <Container size="wide">
          <div className="flex items-center justify-between gap-4 py-4">
            <Link href="/" className="no-underline" aria-label="One Interiors, home">
              <Wordmark />
            </Link>
            <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-[var(--color-ink-3)]">
              Shared with you · read only
            </span>
          </div>
        </Container>
      </header>

      <main className="py-10 sm:py-14">
        <Container size="wide">
          <Eyebrow>OneCompare</Eyebrow>
          <h1 className="display mb-4 max-w-[24ch] text-[clamp(2rem,4.5vw,3.2rem)] leading-[1.02]">
            Someone has shared their interior quotes with you.
          </h1>

          <p className="m-0 mb-3 max-w-[62ch] text-[17px] leading-[1.65] text-[var(--color-ink-2)]">
            {home}
            {brief.carpetAreaSqft ? `, ${brief.carpetAreaSqft} sqft` : ''}
            {scope ? ` · ${scope}` : ''}
            {brief.styleLikes.length
              ? ` · leaning ${brief.styleLikes.map((t) => STYLE_LABELS[t]).join(' and ')}`
              : ''}
            . Below is what {result.quotes.length} verified Pune studios would charge, priced from
            each studio&rsquo;s own rates.
          </p>

          <p className="m-0 mb-10 max-w-[62ch] text-[14.5px] leading-[1.6] text-[var(--color-ink-3)]">
            Nobody has visited the flat, so every figure is a range rather than a price. We do not
            add anything to these numbers, and no studio can pay to appear here or to appear first.
          </p>

          {/* ── Our read ─────────────────────────────────── */}
          <div className="mb-10 rounded-[16px] border-l-[3px] border-[var(--color-brass)] bg-[var(--color-paper-2)] p-7">
            <p className="label m-0 mb-3">What we make of it</p>
            <p className="m-0 mb-5 font-[family-name:var(--font-display)] text-[23px] leading-snug text-[var(--color-ink)]">
              {summary.headline}
            </p>
            <ul className="m-0 mb-6 flex list-none flex-col gap-3 p-0">
              {summary.points.map((point, i) => (
                <li
                  key={i}
                  className="max-w-[70ch] text-[15px] leading-relaxed text-[var(--color-ink-2)]"
                >
                  {point}
                </li>
              ))}
            </ul>

            <p className="label m-0 mb-2">Worth asking on the call</p>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {summary.questions.map((q, i) => (
                <li
                  key={i}
                  className="grid max-w-[70ch] grid-cols-[16px_minmax(0,1fr)] gap-2.5 text-[14.5px] leading-relaxed text-[var(--color-ink-2)]"
                >
                  <span aria-hidden="true" className="text-[var(--color-brass)]">
                    ?
                  </span>
                  {q}
                </li>
              ))}
            </ul>

            <p className="m-0 mt-6 max-w-[70ch] border-t border-[var(--color-rule)] pt-4 text-[13.5px] leading-relaxed text-[var(--color-ink-3)]">
              This read is generated from the numbers on this page, not written by anyone who has
              met these studios. It is arithmetic, deliberately — the expert call is where
              judgement comes in.
            </p>
          </div>

          {/* ── The table ────────────────────────────────── */}
          <div className="mb-10 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[14.5px]">
              <thead>
                <tr className="border-b-2 border-[var(--color-ink)]">
                  <th className="py-3 pr-4 text-left font-normal text-[var(--color-ink-3)]">
                    Category
                  </th>
                  {result.quotes.map((q) => (
                    <th key={q.studioId} className="py-3 pl-4 text-right">
                      <span className="block font-[family-name:var(--font-display)] text-[18px] font-normal text-[var(--color-ink)]">
                        {q.studioName}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparison.map((row) => (
                  <tr key={row.category} className="border-b border-[var(--color-rule-soft)]">
                    <td className="py-3 pr-4 text-[var(--color-ink-2)]">
                      {row.label}
                      {row.spreadPaise > 0 ? (
                        <span className="ml-2 font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.1em] text-[var(--color-ink-3)]">
                          {formatINRCompact(row.spreadPaise)} apart
                        </span>
                      ) : null}
                    </td>
                    {result.quotes.map((q) => {
                      const amount = row.amounts[q.studioId];
                      const isLowest = row.lowestStudioId === q.studioId;
                      return (
                        <td
                          key={q.studioId}
                          className={`py-3 pl-4 text-right tabular-nums ${
                            isLowest ? 'text-[var(--color-ontrack)]' : 'text-[var(--color-ink)]'
                          }`}
                        >
                          {amount === null ? (
                            <span className="text-[13px] italic text-[var(--color-ink-3)]">
                              Not priced
                            </span>
                          ) : (
                            formatINR(amount)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}

                <tr className="border-t-2 border-[var(--color-ink)]">
                  <td className="py-4 pr-4 font-bold text-[var(--color-ink)]">
                    Likely range, with GST
                  </td>
                  {result.quotes.map((q) => (
                    <td key={q.studioId} className="py-4 pl-4 text-right">
                      <span className="block font-[family-name:var(--font-display)] text-[19px] text-[var(--color-ink)]">
                        {formatINRCompact(q.quote.lowPaise)}–{formatINRCompact(q.quote.highPaise)}
                      </span>
                      <span className="block font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.1em] text-[var(--color-ink-3)]">
                        ±{Math.round(q.quote.variancePct * 100)}%
                      </span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* The only action on the page, and it starts something of their own
              rather than acting on somebody else's brief. */}
          <div className="flex flex-wrap items-center gap-5 border-t border-[var(--color-rule)] pt-8">
            <Button href="/quiz" size="lg">
              Get quotes for your own home
            </Button>
            <span className="max-w-[46ch] text-[14.5px] leading-relaxed text-[var(--color-ink-3)]">
              Nine questions, three minutes. Whoever sent you this will not be told that you
              opened it.
            </span>
          </div>
        </Container>
      </main>

      <SiteFooter />
    </>
  );
}
