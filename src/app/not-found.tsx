import Link from 'next/link';
import type { Metadata } from 'next';
import { Container, Eyebrow } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Not here yet',
  robots: { index: false, follow: false },
};

/**
 * What a visitor sees when a page is not there.
 *
 * ## Why this file exists at all
 *
 * There was no `not-found.tsx`, so every miss fell through to Next's built-in
 * page — a bare "404: This page could not be found." in the framework's own
 * font, on white, with no way back. A studio owner who mistypes a URL, or
 * lands on `ops.` when they meant `studio.`, met something that looked like
 * the site was broken rather than like the site had an answer.
 *
 * ## The one thing that must not change
 *
 * **The HTTP status is still 404.** Next sets it automatically for this file,
 * and nothing here overrides it. That matters more than it looks: a soft 404 —
 * this body served under a 200 — was live on three routes in September and had
 * Google indexing "page not found" as real pages. Warm words, honest status.
 *
 * ## Why it does not promise a specific page is coming
 *
 * "We are working on it" is true of the product and false of a mistyped URL,
 * and a message that greets a typo with "coming soon" is a small lie told
 * hundreds of times. So the tone is warm and the claim is about us building
 * generally, never about this address in particular.
 *
 * ## Why there is no site header
 *
 * This page renders on all three hosts — the apex, `studio.` and `ops.` — and
 * the customer navigation does not exist on two of them. One link home is
 * correct everywhere; a nav bar would be wrong twice out of three times.
 */
export default function NotFound() {
  return (
    <main className="relative flex min-h-[80vh] items-center overflow-hidden">
      <div className="grid-ground grid-ground-fade absolute inset-0" aria-hidden="true" />

      <Container size="narrow" className="relative py-20">
        <Eyebrow>Nothing at this address</Eyebrow>

        <h1 className="display mb-6 max-w-[16ch]">
          Good things take time{' '}
          <span aria-hidden="true" className="text-[var(--color-petrol)]">
            :)
          </span>
        </h1>

        <p className="lede mb-4 max-w-[46ch]">
          This page is not here. Either the address has a typo in it, or it is something we have
          not built yet.
        </p>

        <p className="m-0 mb-10 max-w-[48ch] text-[16px] leading-relaxed text-[var(--color-ink-2)]">
          We are a small team putting this together carefully rather than quickly, and there is
          more of it arriving. In the meantime, everything that does exist starts from the front
          page.
        </p>

        <Link
          href="/"
          className="inline-block rounded-full bg-[var(--color-petrol)] px-7 py-3.5 text-[16px] font-medium text-[var(--color-paper)] no-underline hover:bg-[var(--color-petrol-deep)]"
        >
          Back to the start
        </Link>

        {/* No "email us if this was our fault" line, and its absence is
            deliberate rather than an oversight.

            `hello@oneinteriors.in` cannot RECEIVE mail — the domain has no MX
            record at all (docs/CLOUDFLARE.md, Stage 6a). We can send from it
            through Resend; anything sent to it disappears. An address printed
            on the error page is the one a frustrated person actually uses, and
            having that message vanish is worse than never inviting it.

            Add the line back the moment Email Routing is switched on. */}
      </Container>
    </main>
  );
}
