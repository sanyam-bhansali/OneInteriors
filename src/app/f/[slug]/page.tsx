import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { formBySlug } from '@/modules/studio-practice/capture';
import { CaptureForm } from './CaptureForm';

export const dynamic = 'force-dynamic';

/**
 * A studio's public enquiry page.
 *
 * ## The first route in this product with no session at all
 *
 * Everything else under `src/app` either has a signed-in user or is a
 * marketing page that reads nothing. This takes input from a stranger and
 * writes a row, which is a different class of surface — see `capture.ts` for
 * what keeps that narrow.
 *
 * ## noindex, deliberately
 *
 * A studio's enquiry form competing with their own website in search results
 * is a disservice to the studio: their site is where their work is. This link
 * is for an Instagram bio, a WhatsApp message, a printed card — places
 * somebody already chose to follow.
 *
 * It also means a page that is off, or belongs to a paused studio, cannot
 * sit in an index advertising a studio we are not sending work to.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const form = await formBySlug(slug);

  return {
    title: form ? `${form.studioName} — enquiry` : 'Enquiry',
    robots: { index: false, follow: false },
  };
}

export default async function CapturePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const form = await formBySlug(slug);

  /* A slug that resolves to nothing 404s. A slug belonging to a studio that
     has switched the form OFF renders below, explaining itself — the studio
     chose that, and a dead link somebody printed on a card deserves a
     sentence rather than an error page. */
  if (!form) notFound();

  return (
    <div className="oi-tactile oi-quick min-h-dvh">
      <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col justify-center px-5 py-12">
        {form.active ? (
          <>
            <header className="mb-7">
              <p className="s-label m-0 mb-2 text-[var(--color-ink-2)]">{form.studioName}</p>
              <h1 className="m-0 mb-2.5 text-[28px] leading-[1.15] font-bold tracking-[-.015em] text-[var(--color-ink)]">
                {form.headline}
              </h1>
              <p className="m-0 max-w-[46ch] text-[15px] leading-relaxed text-[var(--color-ink-2)]">
                {form.blurb}
              </p>
            </header>

            <CaptureForm slug={form.slug} studioName={form.studioName} />

            {/* Said once, plainly, at the bottom. A stranger handing over a
                phone number is owed one sentence about where it goes, and
                burying it in a privacy link nobody opens is not that. */}
            <p className="m-0 mt-6 text-[12.5px] leading-relaxed text-[var(--color-ink-2)]">
              Your details go to {form.studioName} so they can call you back. One Interiors hosts
              this form and does not sell or pass on what you write here.
            </p>
          </>
        ) : (
          <div className="rounded-[16px] border border-[var(--color-rule)] bg-[var(--card)] px-6 py-8 text-center">
            <h1 className="m-0 mb-2 text-[20px] font-bold text-[var(--color-ink)]">
              {form.studioName} is not taking enquiries right now
            </h1>
            <p className="m-0 text-[14.5px] leading-relaxed text-[var(--color-ink-2)]">
              Good things take time — they have paused this form. Do try again in a little while.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
