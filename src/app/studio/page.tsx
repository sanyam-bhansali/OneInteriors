import Link from 'next/link';
import type { Metadata } from 'next';
import { Container, Pill } from '@/components/ui';
import { currentStudio, onboardingProgress, STEP_LABELS, STEP_BLURBS } from '@/modules/studio/onboarding';

export const metadata: Metadata = {
  title: 'Your studio',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function StudioHome() {
  const context = await currentStudio();

  if (!context) {
    return (
      <main className="py-16">
        <Container size="narrow">
          <h1 className="h1 mb-4">No studio on this account</h1>
          <p className="m-0 text-[16px] leading-relaxed text-[var(--color-ink-2)]">
            This sign-in is not linked to a studio yet. If you have just been approved and are
            seeing this, tell us — it is our mistake to fix, not yours.
          </p>
        </Container>
      </main>
    );
  }

  const { studio } = context;
  const { steps, done, total, complete } = onboardingProgress(studio);

  return (
    <main className="py-10">
      <Container size="default">
        <p className="label m-0 mb-2">{studio.tradeName}</p>

        {studio.submittedForReview ? (
          <>
            <h1 className="h1 mb-4">With us now.</h1>
            <p className="m-0 mb-8 max-w-[58ch] text-[17px] leading-relaxed text-[var(--color-ink-2)]">
              You have finished your side. We are verifying — company records, GST filing history,
              two reference calls and a visit to two completed sites. That takes about a week, and
              we will call you either way. You can still edit anything below while we work.
            </p>
          </>
        ) : (
          <>
            <h1 className="h1 mb-4">
              {done === 0 ? 'Welcome. Four steps.' : `${total - done} step${total - done === 1 ? '' : 's'} to go.`}
            </h1>
            <p className="m-0 mb-8 max-w-[58ch] text-[17px] leading-relaxed text-[var(--color-ink-2)]">
              This is the part only you can do. Take your time over the description and the
              projects — those are what a customer actually reads before deciding to meet you.
              Everything saves as you go.
            </p>
          </>
        )}

        <ol className="m-0 mb-10 flex list-none flex-col gap-3 p-0">
          {steps.map((s, i) => (
            <li key={s.step}>
              <Link
                href={`/studio/onboarding/${s.step}`}
                className="flex items-start gap-4 rounded-[12px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-5 no-underline transition-colors hover:border-[var(--color-ink-3)]"
              >
                <span
                  className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full font-[family-name:var(--font-mono)] text-[11px] ${
                    s.done
                      ? 'bg-[var(--color-ontrack)] text-white'
                      : 'border border-[var(--color-rule)] text-[var(--color-ink-3)]'
                  }`}
                  aria-hidden="true"
                >
                  {s.done ? '✓' : String(i + 1).padStart(2, '0')}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="mb-1 flex flex-wrap items-baseline gap-3">
                    <span className="font-[family-name:var(--font-display)] text-[20px] leading-none text-[var(--color-ink)]">
                      {STEP_LABELS[s.step]}
                    </span>
                    {s.done ? <Pill tone="ontrack">Done</Pill> : null}
                  </span>
                  <span className="block text-[14.5px] leading-relaxed text-[var(--color-ink-2)]">
                    {STEP_BLURBS[s.step]}
                  </span>
                  {s.missing.length > 0 ? (
                    <span className="mt-1.5 block text-[13.5px] text-[var(--color-ink-3)]">
                      Still needed: {s.missing.join(', ')}.
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ol>

        {/* The studio must never be able to mistake "I finished the form" for
            "I am live". Said plainly, on the page they spend the most time on. */}
        <div className="rounded-[12px] border border-[var(--color-rule)] bg-[var(--color-paper-3)] p-6">
          <p className="label m-0 mb-2">What this does and does not do</p>
          <p className="m-0 max-w-[64ch] text-[14.5px] leading-relaxed text-[var(--color-ink-2)]">
            Finishing these steps sends your profile to us for verification. It does not put you in
            front of customers — that happens after we have checked the registrations, called two
            of your past clients and visited two completed sites. Nothing you write here is public
            until you have seen the finished profile and approved it.
          </p>
          {complete && !studio.submittedForReview ? (
            <p className="m-0 mt-4 text-[14.5px] font-bold text-[var(--color-petrol)]">
              Everything is filled in — the last step is to send it to us.
            </p>
          ) : null}
        </div>
      </Container>
    </main>
  );
}
