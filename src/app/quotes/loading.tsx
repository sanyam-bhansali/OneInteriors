import { Container } from '@/components/ui';
import { SiteHeader, SiteFooter } from '@/components/chrome';
import { JourneyNav } from '@/components/JourneyNav';
import { waitLine } from '@/lib/wait-lines';

/**
 * What the customer sees while their quotes are actually being priced.
 *
 * ## Why this is not a spinner
 *
 * Instant results are trusted less than results you watched being produced —
 * Buell and Norton called it the labour illusion, and it holds up: people rate
 * the same answer as more valuable, and the service as more competent, when the
 * work is visible. A quote for nine lakh rupees that materialises in a blink
 * reads as a lookup table, which is exactly what our competitors' "instant
 * estimates" are and exactly what we need not to be mistaken for.
 *
 * ## Why it is honest
 *
 * Nothing here is padded. This is Next's own Suspense fallback for the route,
 * so it appears for precisely as long as the server actually takes — reading
 * the brief, estimating quantities, and pricing them against each studio's own
 * rate card, which is genuinely what those lines describe. If the work finishes
 * in 200ms the customer sees this for 200ms.
 *
 * That distinction matters more than it sounds. A progress bar that crawls
 * while nothing happens is the same lie as a quote that is not really from the
 * studio's rates, and a customer who catches us at the small one has every
 * reason to disbelieve the large one.
 */
export default function QuotesLoading() {
  return (
    <>
      <SiteHeader />
      {/* Default `reached`, matching the loaded page exactly, so the nav does
          not jump when content arrives. */}
      <JourneyNav />

      <main className="py-16 sm:py-24">
        <Container size="narrow">
          <p className="m-0 mb-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.15em] text-[var(--color-petrol)]">
            Pricing your home
          </p>
          <h1 className="m-0 mb-8 max-w-[18ch] font-[family-name:var(--font-display)] text-[clamp(1.9rem,4vw,2.8rem)] font-normal leading-[1.06] tracking-[-0.02em] text-[var(--color-ink)]">
            Every studio is quoting you from their own rates.
          </h1>

          <ol className="m-0 flex list-none flex-col gap-0 p-0">
            <Step n="01" label="Reading your brief" />
            <Step n="02" label="Working out quantities for your carpet area" />
            <Step n="03" label="Pricing each line against each studio's rate card" />
            <Step n="04" label="Checking what we had to assume" />
          </ol>

          {/* The wait is the one moment on this page where nothing is at stake,
              which makes it the only place a joke belongs. It sits UNDER the
              four steps rather than replacing them: the steps are the evidence
              that real work is happening, and trading that for a gag would be
              swapping the thing that earns trust for the thing that decorates
              it. Never on a failure screen, and never next to a number — see
              wait-lines.ts. */}
          <p className="m-0 mt-10 max-w-[54ch] border-l-2 border-[var(--color-brass)] pl-5 font-[family-name:var(--font-display)] text-[19px] leading-[1.45] text-[var(--color-ink-2)]">
            {waitLine('quotes')}
          </p>

          <p className="m-0 mt-9 max-w-[52ch] text-[14.5px] leading-[1.6] text-[var(--color-ink-3)]">
            No studio has been told who you are. Nothing is sent to anyone until you ask an expert
            for an introduction.
          </p>
        </Container>
      </main>

      <SiteFooter />
    </>
  );
}

/**
 * The staggered reveal is CSS only.
 *
 * A client component with timers would be claiming to know how long each stage
 * takes, which we do not, and would keep running after the page was ready.
 * These simply fade in over the first couple of seconds and stop — if the
 * quotes arrive first, the whole thing is replaced mid-animation, which is the
 * correct outcome and looks like speed rather than a broken sequence.
 */
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
