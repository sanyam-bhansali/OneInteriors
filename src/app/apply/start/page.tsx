import type { Metadata } from 'next';
import Link from 'next/link';
import { Container, Eyebrow } from '@/components/ui';
import { SiteHeader, SiteFooter } from '@/components/chrome';
import { ApplyForm } from '../ApplyForm';

export const metadata: Metadata = {
  title: 'Apply — tell us about your practice',
  robots: { index: false, follow: false },
};

/**
 * The form. The pitch is at `/apply`.
 *
 * Deliberately plain: no hero, no photograph, no second argument. Whoever is
 * here has already decided, and the page's only remaining job is to not lose
 * them. Anything competing for attention now is working against us.
 *
 * The back link matters more than it looks. Somebody who scrolls up wanting to
 * re-read a claim before committing, and finds no way back, closes the tab
 * instead.
 */
export default function ApplyStartPage() {
  return (
    <>
      <SiteHeader />

      <main>
        <section className="border-b border-[var(--color-rule)] py-10 sm:py-12">
          <Container size="wide">
            <Link
              href="/apply"
              className="mb-6 inline-block text-[13.5px] text-[var(--color-ink-2)] underline underline-offset-4 hover:text-[var(--color-ink)]"
            >
              ← Back to what this is
            </Link>

            <Eyebrow>Applying to One Interiors</Eyebrow>
            <h1 className="h1 mb-4 max-w-[20ch]">Tell us about your practice.</h1>
            <p className="m-0 max-w-[52ch] text-[16px] leading-relaxed text-[var(--color-ink-2)]">
              About ten minutes. Nothing here is published — this is between you and us. We reply
              within a week either way, with a reason.
            </p>
          </Container>
        </section>

        {/* `wide`, not `narrow`. The form lays itself out in two columns — what
            we are asking for on the left, the boxes on the right — so it needs
            the width the header above already uses. In a 672px column it
            collapses to a single stack of full-width pills adrift in an empty
            screen. */}
        <section className="py-12 sm:py-16">
          <Container size="wide">
            <ApplyForm />
          </Container>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
