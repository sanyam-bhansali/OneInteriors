import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Container, Button, Eyebrow, Pill } from '@/components/ui';
import { SiteHeader, SiteFooter } from '@/components/chrome';
import { formatINR, formatINRCompact } from '@/lib/money';
import { loadBrief } from '@/modules/brief/repository';
import { getCurrentUser } from '@/modules/auth/session';
import { studioRepository } from '@/modules/studio/repository';
import { rankStudios } from '@/modules/matching/score';
import { quoteBrief, storeQuotes } from '@/modules/quotation/generate';
import { TIER } from '@/modules/quotation/tiers';
import { record } from '@/modules/analytics/record';
import { JourneyNav } from '@/components/JourneyNav';

export const metadata: Metadata = {
  title: 'Your quotes',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/** How many studios we quote without being asked. */
const DEFAULT_QUOTES = 4;

export default async function QuotesPage() {
  const { brief, found } = await loadBrief();

  // The sign-in gate. Everything before this — quiz, reveal, matches — is
  // anonymous; the quote is where we ask, because a quote is a real number
  // from a real business and it should belong to an account that can come back
  // to it.
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in?next=/quotes&reason=quotes');

  // Deliberately NOT a redirect to /quiz. Someone who just answered nine
  // questions and gets silently returned to question one assumes the product
  // ate their answers — which is exactly what it looks like. Say what is
  // missing instead.
  const briefIncomplete = !found || !brief.completedAt;

  if (briefIncomplete) {
    return (
      <>
        <SiteHeader />
        <JourneyNav reached={1} />
        <main className="py-16">
          <Container size="narrow">
            <h1 className="h1 mb-4">We do not have your brief yet.</h1>
            <p className="m-0 mb-8 max-w-[54ch] text-[17px] leading-relaxed text-[var(--color-ink-2)]">
              Either it was not finished, or it was answered in a different browser and has not
              caught up with this sign-in yet. Nine questions, three minutes, and your quotes
              follow immediately.
            </p>
            <Button href="/quiz" size="lg">Answer the questions</Button>
          </Container>
        </main>
        <SiteFooter />
      </>
    );
  }

  const studios = await studioRepository.list();
  const ranked = rankStudios(brief, studios).slice(0, DEFAULT_QUOTES);

  const result = await quoteBrief(
    brief,
    ranked.map((r) => r.studioId),
  );

  if (!result.ok) {
    return (
      <>
        <SiteHeader />
        <JourneyNav reached={2} />
        <main className="py-16">
          <Container size="narrow">
            <h1 className="h1 mb-4">
              {result.reason === 'brief_too_thin'
                ? 'We need a little more first.'
                : 'No studio can quote this yet.'}
            </h1>
            <p className="m-0 mb-8 text-[17px] leading-relaxed text-[var(--color-ink-2)]">
              {result.reason === 'brief_too_thin' ? (
                <>
                  Without your property type or carpet area, any number we produced would carry a
                  range so wide it would mislead you more than help. Two more answers fixes it.
                </>
              ) : (
                <>
                  The studios matching your brief have not published rates for all of this work
                  yet. That is our gap to close, not yours — we are onboarding, and this will
                  resolve within days rather than weeks.
                </>
              )}
            </p>
            <Button href="/quiz" size="lg">
              {result.reason === 'brief_too_thin' ? 'Finish your brief' : 'Review your brief'}
            </Button>
          </Container>
        </main>
        <SiteFooter />
      </>
    );
  }

  await record('quote.view', { studios: result.quotes.length });
  if (found) await storeQuotes((await briefId()) ?? '', result.quotes);

  return (
    <>
      <SiteHeader />
      <JourneyNav />

      <main className="py-10 sm:py-14">
        <Container size="wide">
          <Eyebrow>OneQuote</Eyebrow>
          <h1 className="display mb-4 max-w-[20ch] text-[clamp(2rem,4.5vw,3.2rem)] leading-[1.02]">
            {result.quotes.length} quotes, from each studio&rsquo;s own rates.
          </h1>
          <p className="lede mb-3 max-w-[62ch]">
            Nobody has seen your flat yet, so each of these is a range rather than a price. The
            band widens or narrows with how much you have told us — not with how confident the
            studio is.
          </p>

          <p className="m-0 mb-10 max-w-[62ch] text-[14.5px] leading-relaxed text-[var(--color-ink-3)]">
            We do not mark these up, and a studio cannot pay to appear here or to appear first.
          </p>

          <div className="mb-10 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {result.quotes.map((entry) => (
              <article
                key={entry.studioId}
                className="flex flex-col rounded-[16px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-7"
              >
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="h2 mb-1 text-[24px]">{entry.studioName}</h2>
                    <Pill tone="petrol">{TIER[entry.tier].label}</Pill>
                  </div>
                  <Link
                    href={`/studios/${entry.studioSlug}`}
                    className="text-[14px] text-[var(--color-petrol)] no-underline hover:underline"
                  >
                    Their work →
                  </Link>
                </div>

                <p className="m-0 mb-1 font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] text-[var(--color-ink-3)]">
                  Likely range, including GST
                </p>
                <p className="m-0 mb-6 font-[family-name:var(--font-display)] text-[32px] leading-none text-[var(--color-ink)]">
                  {formatINRCompact(entry.quote.lowPaise)} – {formatINRCompact(entry.quote.highPaise)}
                </p>

                <table className="mb-5 w-full border-collapse text-[14px]">
                  <tbody>
                    {entry.quote.lines.map((line) => (
                      <tr key={line.category} className="border-b border-[var(--color-rule-soft)]">
                        <td className="py-2 pr-3 text-[var(--color-ink-2)]">{line.label}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-[var(--color-ink-3)]">
                          {line.quantity} {line.unit}
                        </td>
                        <td className="py-2 text-right tabular-nums text-[var(--color-ink)]">
                          {formatINR(line.amountPaise)}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td className="py-2 pr-3 text-[var(--color-ink-3)]">GST at 18%</td>
                      <td />
                      <td className="py-2 text-right tabular-nums text-[var(--color-ink-3)]">
                        {formatINR(entry.quote.gstPaise)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <details className="mt-auto">
                  <summary className="cursor-pointer font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.11em] text-[var(--color-petrol)]">
                    What we assumed ({entry.quote.assumptions.length})
                  </summary>
                  <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
                    {entry.quote.assumptions.map((a, i) => (
                      <li
                        key={i}
                        className="border-l-2 border-[var(--color-rule)] pl-3 text-[13.5px] leading-snug text-[var(--color-ink-2)]"
                      >
                        {a}
                      </li>
                    ))}
                  </ul>
                </details>
              </article>
            ))}
          </div>

          {result.skipped.length > 0 ? (
            <div className="mb-10 rounded-[12px] border border-[var(--color-rule)] bg-[var(--color-paper-3)] p-5">
              <p className="label m-0 mb-2">Not quoted</p>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {result.skipped.map((s) => (
                  <li key={s.name} className="text-[14px] text-[var(--color-ink-2)]">
                    <strong>{s.name}</strong> — {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-5 border-t border-[var(--color-rule)] pt-8">
            <Button href="/compare" size="lg">
              Compare them side by side
            </Button>
            <span className="text-[14.5px] text-[var(--color-ink-3)]">
              With a written summary of what the differences actually mean.
            </span>
          </div>
        </Container>
      </main>

      <SiteFooter />
    </>
  );
}

/** The stored brief's id, for attaching quotes and consultations. */
async function briefId(): Promise<string | null> {
  const { prisma } = await import('@/lib/prisma');
  const { readAnonKey } = await import('@/modules/brief/repository');
  const user = await getCurrentUser();

  if (user) {
    const row = await prisma.brief.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (row) return row.id;
  }
  const anonKey = await readAnonKey();
  if (!anonKey) return null;
  const row = await prisma.brief.findUnique({ where: { anonKey }, select: { id: true } });
  return row?.id ?? null;
}
