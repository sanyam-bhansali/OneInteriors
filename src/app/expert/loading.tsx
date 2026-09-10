import { Container } from '@/components/ui';
import { SiteHeader, SiteFooter } from '@/components/chrome';
import { JourneyNav } from '@/components/JourneyNav';
import { waitLine } from '@/lib/wait-lines';

/**
 * The wait before the expert request form.
 *
 * The shortest of the three, on purpose. This route re-prices in order to show
 * the customer which studios they are choosing between, but by now they have
 * seen the numbers twice and narrating the pricing again would be padding —
 * and padding is the exact thing the labour illusion stops being honest at.
 *
 * The live objection here is different again, and it is the one that stops
 * people booking: *is this going to be a sales call?* Everyone reading this has
 * been on the other kind. So the line names what will not happen. See
 * wait-lines.ts.
 */
export default function ExpertLoading() {
  return (
    <>
      <SiteHeader />
      {/* Default `reached`, matching the loaded page exactly. A loading screen
          that shows fewer tabs than the page behind it makes the nav jump the
          moment content arrives, which reads as a glitch. */}
      <JourneyNav />

      <main className="py-16 sm:py-24">
        <Container size="narrow">
          <p className="m-0 mb-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.15em] text-[var(--color-petrol)]">
            OneExpert
          </p>
          <h1 className="m-0 mb-8 max-w-[20ch] font-[family-name:var(--font-display)] text-[clamp(1.9rem,4vw,2.8rem)] font-normal leading-[1.06] tracking-[-0.02em] text-[var(--color-ink)]">
            Gathering everything we will have read before we ring you.
          </h1>

          <p className="m-0 max-w-[54ch] border-l-2 border-[var(--color-brass)] pl-5 font-[family-name:var(--font-display)] text-[19px] leading-[1.45] text-[var(--color-ink-2)]">
            {waitLine('expert')}
          </p>
        </Container>
      </main>

      <SiteFooter />
    </>
  );
}
