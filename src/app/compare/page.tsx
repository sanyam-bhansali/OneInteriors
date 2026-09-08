import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Container, Button, Eyebrow } from '@/components/ui';
import { SiteHeader, SiteFooter } from '@/components/chrome';
import { formatINR, formatINRCompact } from '@/lib/money';
import { loadBrief } from '@/modules/brief/repository';
import { getCurrentUser } from '@/modules/auth/session';
import { studioRepository } from '@/modules/studio/repository';
import { rankStudios } from '@/modules/matching/score';
import { quoteBrief } from '@/modules/quotation/generate';
import { compareQuotes } from '@/modules/quotation/price';
import { record } from '@/modules/analytics/record';

export const metadata: Metadata = {
  title: 'Compare quotes',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const MAX_COMPARE = 4;

export default async function ComparePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in?next=/compare&reason=quotes');

  const { brief, found } = await loadBrief();
  if (!found || !brief.completedAt) redirect('/quiz');

  const studios = await studioRepository.list();
  const ranked = rankStudios(brief, studios).slice(0, MAX_COMPARE);
  const result = await quoteBrief(brief, ranked.map((r) => r.studioId));

  if (!result.ok) redirect('/quotes');

  await record('compare.view', { studios: result.quotes.length });

  const comparison = compareQuotes(
    result.quotes.map((q) => ({ studioId: q.studioId, quote: q.quote })),
  );
  const { summary } = result;

  return (
    <>
      <SiteHeader />

      <main className="py-10 sm:py-14">
        <Container size="wide">
          <Eyebrow>OneCompare</Eyebrow>
          <h1 className="display mb-8 max-w-[22ch] text-[clamp(2rem,4.5vw,3.2rem)] leading-[1.02]">
            Side by side, line by line.
          </h1>

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

            {/* Said here, on the screen where the temptation to pick on price
                is highest. */}
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

          <div className="flex flex-wrap items-center gap-5 border-t border-[var(--color-rule)] pt-8">
            <Button href="/expert" size="lg">
              Talk it through with our expert
            </Button>
            <span className="max-w-[44ch] text-[14.5px] leading-relaxed text-[var(--color-ink-3)]">
              Pick the studios you want to discuss. We read everything beforehand, and we arrange
              the meeting afterwards.
            </span>
          </div>
        </Container>
      </main>

      <SiteFooter />
    </>
  );
}
