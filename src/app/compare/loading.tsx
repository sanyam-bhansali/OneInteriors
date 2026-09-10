import { Container } from '@/components/ui';
import { SiteHeader, SiteFooter } from '@/components/chrome';
import { JourneyNav } from '@/components/JourneyNav';
import { waitLine } from '@/lib/wait-lines';

/**
 * The wait while the comparison is assembled.
 *
 * Same shape as the quotes reveal and for the same reason — this route
 * re-prices every quote and then runs the written summary over them, which is
 * real work and worth showing rather than hiding behind a blank screen.
 *
 * The lines differ, though, and that is the point. By this screen the customer
 * has four numbers in front of them and is about to weigh them, so the live
 * question has changed from "is this a trick" to "why not just take the
 * cheapest" — which is the single most commercially dangerous thought in the
 * funnel, because choosing on price alone is exactly how people end up with the
 * studio that stops answering in month four. See wait-lines.ts.
 */
export default function CompareLoading() {
  return (
    <>
      <SiteHeader />
      {/* Default `reached`, matching the loaded page exactly, so the nav does
          not jump when content arrives. */}
      <JourneyNav />

      <main className="py-16 sm:py-24">
        <Container size="narrow">
          <p className="m-0 mb-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.15em] text-[var(--color-petrol)]">
            Putting them side by side
          </p>
          <h1 className="m-0 mb-8 max-w-[20ch] font-[family-name:var(--font-display)] text-[clamp(1.9rem,4vw,2.8rem)] font-normal leading-[1.06] tracking-[-0.02em] text-[var(--color-ink)]">
            Same categories, same units, across every quote.
          </h1>

          <ol className="m-0 flex list-none flex-col gap-0 p-0">
            <Step n="01" label="Matching each studio's lines to the same categories" />
            <Step n="02" label="Finding where they genuinely differ" />
            <Step n="03" label="Checking which gaps are bigger than the margin of error" />
            <Step n="04" label="Writing up what the differences actually mean" />
          </ol>

          <p className="m-0 mt-10 max-w-[54ch] border-l-2 border-[var(--color-brass)] pl-5 font-[family-name:var(--font-display)] text-[19px] leading-[1.45] text-[var(--color-ink-2)]">
            {waitLine('compare')}
          </p>

          <p className="m-0 mt-9 max-w-[52ch] text-[14.5px] leading-[1.6] text-[var(--color-ink-3)]">
            The read that follows is arithmetic, not opinion. Judgement comes on the expert call.
          </p>
        </Container>
      </main>

      <SiteFooter />
    </>
  );
}

function Step({ n, label }: { n: string; label: string }) {
  const delay = (Number(n) - 1) * 420;
  return (
    <li
      className="quote-step grid grid-cols-[2.5rem_minmax(0,1fr)] items-baseline gap-3 border-b border-[var(--color-rule)] py-3.5 last:border-b-0"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-[var(--color-brass)]">
        {n}
      </span>
      <span className="text-[15.5px] leading-snug text-[var(--color-ink-2)]">{label}</span>
    </li>
  );
}
