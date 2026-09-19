import type { Metadata } from 'next';
import { journeySummary } from '@/modules/quotation/journey-export';
import { OpsHeader } from '../ui';

export const metadata: Metadata = { title: 'Data', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * What has accumulated, and how to get it out.
 *
 * Nothing in this product learns automatically. The whole reason the journey
 * is kept is that a person reads it and decides — so this screen has two jobs
 * and no others: say whether data is actually arriving, and hand over a CSV.
 *
 * The "asking the database whether it works" problem is real: a recording path
 * that fails silently by design, as `journey-repository.ts` does, needs one
 * place that shows a number going up. Otherwise the first sign of a broken
 * write is an empty export six months from now.
 */
export default async function OpsDataPage() {
  const summary = await journeySummary();

  return (
    <>
      <OpsHeader />
      <main className="mx-auto w-full max-w-[64rem] px-6 py-10">
        <h1 className="display m-0 mb-2 text-[28px]">Data</h1>
        <p className="m-0 mb-8 max-w-[62ch] text-[15px] leading-relaxed text-[var(--color-ink-2)]">
          Every quote the product has generated, what was compared, what was starred and how it
          ended. One row per quote — the shape a pivot table wants.
        </p>

        {!summary.ok ? (
          <p className="m-0 text-[15px] text-[var(--color-ink-3)]">
            {summary.reason === 'no-database'
              ? 'No database configured, so nothing is being recorded.'
              : 'Sign in with an ops account to see what has been recorded.'}
          </p>
        ) : (
          <>
            <dl className="m-0 mb-8 grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(9rem,1fr))' }}>
              <Stat label="Quotes kept" value={summary.quotes} />
              <Stat label="Briefs priced" value={summary.briefsQuoted} />
              <Stat label="Comparisons" value={summary.comparisons} />
              <Stat label="Outcomes known" value={summary.outcomes} />
            </dl>

            {/* The one number that will be misread in a year if it is not
                printed now. Every row built while ratesAreReal() is false is
                priced on archive medians wearing a studio's name. */}
            {summary.placeholderRates > 0 ? (
              <p className="m-0 mb-8 max-w-[62ch] border-l-[3px] border-[var(--color-brass)] pl-4 text-[14px] leading-relaxed text-[var(--color-ink-2)]">
                {summary.placeholderRates} of these were priced on archive medians rather than the
                studio&rsquo;s own filed rates. The <code>ratesVersion</code> column says which, so
                the placeholder period can be told apart from the real one rather than averaged
                into it.
              </p>
            ) : null}

            {/* A real anchor, not next/link. This points at a route handler
                that returns a file with a content-disposition header; client
                navigation would try to render the CSV as a page instead of
                saving it. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/ops/data/export"
              className="inline-flex items-center rounded-full bg-[var(--color-petrol)] px-6 py-3 text-[15px] font-medium text-[var(--color-paper)] no-underline"
            >
              Download CSV
            </a>
            {summary.outcomes === 0 && summary.quotes > 0 ? (
              <p className="m-0 mt-5 max-w-[62ch] text-[14px] leading-relaxed text-[var(--color-ink-3)]">
                No outcomes recorded yet. Quotes without outcomes describe what we priced and never
                what worked — mark the winner on an introduction as soon as you know.
              </p>
            ) : null}
          </>
        )}
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dd className="m-0 font-[family-name:var(--font-mono)] text-[30px] leading-none tabular-nums">
        {value.toLocaleString('en-IN')}
      </dd>
      <dt className="m-0 mt-2 text-[13px] text-[var(--color-ink-3)]">{label}</dt>
    </div>
  );
}
