import type { Metadata } from 'next';
import Link from 'next/link';
import { Container, Eyebrow } from '@/components/ui';
import { SiteHeader, SiteFooter } from '@/components/chrome';
import { DoodleGround } from '@/components/oi/DoodleGround';
import { ApplyForm } from '../ApplyForm';

export const metadata: Metadata = {
  title: 'Apply — tell us about your practice',
  robots: { index: false, follow: false },
};

/**
 * The form. The pitch is at `/apply`.
 *
 * ## Side by side, not stacked
 *
 * This was a full-width block of context and then the form underneath it,
 * which meant the whole introduction scrolled away the moment somebody
 * started typing — and the first field sat below the fold on a laptop.
 *
 * It is now two columns: **why we are asking on the left, the questions
 * on the right**. The left column is `sticky`, so the promise ("nothing
 * here is published", "a week either way") stays in view for the whole
 * application rather than being something they read once and lose.
 *
 * Below `lg` it stacks, because two columns on a phone is one narrow
 * column twice.
 *
 * Deliberately still plain: no hero, no photograph, no second argument.
 * Whoever is here has already decided, and the page's only remaining job
 * is to not lose them.
 *
 * The back link matters more than it looks. Somebody wanting to re-read a
 * claim before committing, who finds no way back, closes the tab instead.
 */
export default function ApplyStartPage() {
  return (
    <div className="oi-tactile oi-quick">
      <SiteHeader />

      <main className="relative">
        <DoodleGround className="text-[var(--ink)]" opacity={0.04} />

        <Container size="wide" className="relative">
          <div className="grid grid-cols-1 gap-8 py-7 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14 lg:py-9">
            {/* ── Left: why we are asking. Sticky. ─────────────── */}
            <div className="lg:sticky lg:top-8 lg:self-start">
              <Link
                href="/apply"
                className="mb-6 inline-block text-[13.5px] text-[var(--color-ink-2)] underline underline-offset-4 hover:text-[var(--color-ink)]"
              >
                ← Back to what this is
              </Link>

              <Eyebrow>Applying to One Interiors</Eyebrow>
              <h1 className="h1 mb-4 max-w-[16ch]">Tell us about your practice.</h1>
              <p className="m-0 mb-6 max-w-[42ch] text-[16px] leading-relaxed text-[var(--color-ink-2)]">
                About ten minutes. Nothing here is published — this is between you and us. We
                reply within a week either way, with a reason.
              </p>

              {/* The shape of the ask, before the first field. Fifteen
                  fields look like a wall; five required and ten optional
                  looks like ten minutes. It stays on screen now rather
                  than scrolling away at the first keystroke. */}
              <div className="max-w-[42ch] border-l-2 border-[var(--color-petrol)] pl-5">
                <p className="m-0 mb-1.5 text-[15.5px] font-bold leading-snug text-[var(--color-ink)]">
                  Five things are required.
                </p>
                <p className="m-0 text-[15px] leading-relaxed text-[var(--color-ink-2)]">
                  The studio&rsquo;s name, your name, an email, a mobile number, and the areas you
                  work in. Everything else is marked optional — it helps us understand you, and
                  you can leave it blank.
                </p>
              </div>
            </div>

            {/* ── Right: the questions. ────────────────────────── */}
            <div className="min-w-0">
              <ApplyForm />
            </div>
          </div>
        </Container>
      </main>

      <SiteFooter />
    </div>
  );
}
