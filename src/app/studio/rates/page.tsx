import Link from 'next/link';
import type { Metadata } from 'next';
import { Container } from '@/components/ui';
import { currentStudio } from '@/modules/studio/onboarding';
import { myRateCard } from '@/modules/quotation/rate-card';
import { CATEGORY, RATE_CATEGORIES, missingCoreRates } from '@/modules/quotation/categories';
import { paiseToRupees } from '@/lib/money';
import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { RateCardForm } from '../onboarding/RateCardForm';

export const metadata: Metadata = {
  title: 'Your rates',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * The rate card, outside the onboarding wizard.
 *
 * ## Why this page had to exist
 *
 * The rate card was only reachable at `/studio/onboarding/rates` — a step in a
 * five-part setup flow, framed with "← All steps" and next/previous links, and
 * absent from the navigation entirely once a studio went live.
 *
 * So a studio that raised its modular rate in March had no route to tell us. It
 * would either give up, or quietly keep quoting customers at last year's
 * prices through us while charging this year's prices directly — and a quote
 * that is wrong by the time anyone acts on it is precisely the failure this
 * whole product exists to prevent. We publish these numbers on a customer's
 * comparison screen. They have to be the studio's real ones, today.
 *
 * Same form, same action, different frame: setup asks "fill this in", this asks
 * "is this still right".
 */
export default async function RatesPage() {
  const context = await currentStudio();

  if (!context) {
    return (
      <main className="py-16">
        <Container size="wide">
          <h1 className="h1 mb-4">No studio on this account</h1>
          <p className="m-0 text-[16px] leading-relaxed text-[var(--color-ink-2)]">
            This sign-in is not linked to a studio yet.
          </p>
        </Container>
      </main>
    );
  }

  const card = await myRateCard();
  // `null` rather than `undefined` for an unset rate — `RateCardForm` types its
  // values as `number | null`, and an absent key would render as an
  // uncontrolled input that React then complains about on first keystroke.
  const values = Object.fromEntries(
    RATE_CATEGORIES.map((category) => {
      const stored = card[category];
      if (stored === undefined) return [category, null];
      // Design fee is stored as basis points; everything else as paise.
      return [category, CATEGORY[category].unit === 'percent' ? stored / 100 : paiseToRupees(stored)];
    }),
  ) as Record<string, number | null>;

  const missing = missingCoreRates(card);
  const lastChanged = await lastUpdated(context.studio.id);
  const live = context.studio.status === 'ACTIVE';

  return (
    <main className="py-10">
      {/* Why this page is why-on-the-left, numbers-on-the-right: a rate card is
          a column of figures, and a column of figures next to a column of
          explanation is the only arrangement where you can read the reasoning
          while you type the number. Stacked, the reasoning is scrolled past. */}
      <Container size="wide">
        <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <div className="lg:sticky lg:top-8 lg:self-start">
        <p className="label m-0 mb-2">Your rates</p>
        <h1 className="h1 mb-3">
          {missing.length === 0 ? 'What we quote you at.' : 'Your rate card is incomplete.'}
        </h1>

        <p className="m-0 mb-4 max-w-[42ch] text-[15.5px] leading-relaxed text-[var(--color-ink-2)]">
          {missing.length === 0 ? (
            <>
              Every indicative quote a customer sees with your name on it is built from these
              numbers and nothing else. We never mark them up, and we never average them with
              anyone else&rsquo;s.
            </>
          ) : live ? (
            <>
              Until every core rate is entered we cannot quote you to anybody — you are still shown
              in matches, but the quote line stays blank, which reads worse than not appearing at
              all.
            </>
          ) : (
            /* A studio still in setup is not shown to anybody at all, so telling
               them their quote line is blank describes a situation they are not
               in and quietly implies they are already live. */
            <>
              These are the last thing needed before your profile can go to verification. Nothing
              here is visible to anyone until you are live.
            </>
          )}
        </p>

        {/* The thing that makes a studio come back to this page. Without a
            visible date, nobody ever revisits a rate card — and a card nobody
            revisits is a card that goes stale silently. */}
        <div className="mb-0 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-[12px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-5 py-4">
          <span className="text-[14.5px] text-[var(--color-ink-2)]">
            <span className="label mr-2">Last changed</span>
            {lastChanged
              ? lastChanged.toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })
              : 'never'}
          </span>
          {lastChanged && monthsSince(lastChanged) >= 6 ? (
            <span className="text-[13.5px] text-[var(--color-brass)]">
              Over six months ago. Material prices have almost certainly moved.
            </span>
          ) : null}
        </div>
          </div>

          <div className="max-w-[46rem]">
        <RateCardForm values={values} />

        <div className="mt-10 rounded-[12px] border border-[var(--color-rule)] bg-[var(--color-paper-3)] p-6">
          <p className="label m-0 mb-2">Who sees these</p>
          <p className="m-0 max-w-[64ch] text-[14.5px] leading-relaxed text-[var(--color-ink-2)]">
            Customers see the totals these produce, broken into the same categories every studio is
            broken into — that is what makes two quotes comparable. They never see the rates
            themselves, and neither does any other studio. We do not publish averages or
            benchmarks: with a roster this size, &ldquo;the median&rdquo; would just be telling
            each of you what the other charges.
          </p>
          <p className="m-0 mt-3 text-[14px] leading-relaxed text-[var(--color-ink-3)]">
            Changing a rate here does not change a quote a customer has already been shown. Those
            are kept as they were sent.
          </p>
        </div>

        <p className="m-0 mt-8 text-[14px] text-[var(--color-ink-3)]">
          <Link href="/studio/listing" className="text-[var(--color-petrol)]">
            Back to your listing
          </Link>
        </p>
          </div>
        </div>
      </Container>
    </main>
  );
}

/** When any rate was last touched. Null when the card has never been saved. */
async function lastUpdated(studioId: string): Promise<Date | null> {
  if (!hasDatabase()) return null;
  try {
    const row = await prisma.rateCardItem.findFirst({
      where: { studioId },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });
    return row?.updatedAt ?? null;
  } catch {
    return null;
  }
}

function monthsSince(date: Date): number {
  return (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24 * 30);
}
