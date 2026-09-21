import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Container } from '@/components/ui';
import { fromDb, paiseToLakhs } from '@/lib/money';
import {
  currentStudio,
  listProjects,
  onboardingProgress,
  ONBOARDING_STEPS,
  STEP_LABELS,
  STEP_BLURBS,
  MIN_PORTFOLIO_PROJECTS,
  type OnboardingStep,
} from '@/modules/studio/onboarding';
import { ProfileForm } from '../ProfileForm';
import { RegistrationForm } from '../RegistrationForm';
import { PortfolioForm } from '../PortfolioForm';
import { ReviewPanel } from '../ReviewPanel';
import { RateCardForm } from '../RateCardForm';
import { myRateCard } from '@/modules/quotation/rate-card';
import { CATEGORY, RATE_CATEGORIES } from '@/modules/quotation/categories';
import { paiseToRupees } from '@/lib/money';

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return ONBOARDING_STEPS.map((step) => ({ step }));
}

function isStep(value: string): value is OnboardingStep {
  return (ONBOARDING_STEPS as readonly string[]).includes(value);
}

export default async function OnboardingStepPage({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  const { step } = await params;
  if (!isStep(step)) notFound();

  const context = await currentStudio();
  if (!context) notFound();

  const { studio } = context;
  const { steps } = onboardingProgress(studio);
  const index = ONBOARDING_STEPS.indexOf(step);
  const next = ONBOARDING_STEPS[index + 1];
  const previous = ONBOARDING_STEPS[index - 1];

  return (
    /**
     * `wide`, with the step's own identity in a sticky left rail.
     *
     * These four forms were the longest stacks of full-width controls in the
     * product, in a 672px column — a studio filling in "team size: 8" got a box
     * forty characters across, and had to scroll past the heading to remember
     * which step they were on. The rail fixes both: it consumes the width that
     * was empty, and it keeps "Step 2 of 5" in view while you work.
     */
    <main className="py-10">
      <Container size="wide">
        <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
          <div className="lg:sticky lg:top-8 lg:self-start">
            <Link
              href="/studio"
              className="label mb-6 inline-block text-[var(--color-ink-3)] no-underline hover:text-[var(--color-ink)]"
            >
              ← All steps
            </Link>

            <p className="label m-0 mb-2">
              Step {index + 1} of {ONBOARDING_STEPS.length}
            </p>
            <h1 className="h1 mb-3">{STEP_LABELS[step]}</h1>
            <p className="m-0 max-w-[40ch] text-[15.5px] leading-relaxed text-[var(--color-ink-2)]">
              {STEP_BLURBS[step]}
            </p>
          </div>

          <div className="max-w-[46rem]">

        {step === 'profile' ? (
          <ProfileForm
            defaults={{
              about: studio.about,
              localities: studio.localities,
              website: studio.website,
              instagram: studio.instagram,
              yearsActive: studio.yearsActive,
              teamSize: studio.teamSize,
              minLakhs: studio.minProjectPaise ? paiseToLakhs(fromDb(studio.minProjectPaise)) : null,
              maxLakhs: studio.maxProjectPaise ? paiseToLakhs(fromDb(studio.maxProjectPaise)) : null,
            }}
          />
        ) : null}

        {step === 'registration' ? (
          <RegistrationForm
            gstin={studio.gstin}
            notApplicable={studio.gstinNotApplicable}
            note={studio.gstinNote}
          />
        ) : null}

        {step === 'portfolio' ? (
          <PortfolioForm
            minimum={MIN_PORTFOLIO_PROJECTS}
            shortfallNote={studio.portfolioShortfallNote}
            projects={(await listProjects()).map((p) => ({
              id: p.id,
              title: p.title,
              locality: p.locality,
              styleTags: p.styleTags,
              // BigInt cannot cross the server/client boundary — convert here.
              valuePaise: p.valuePaise === null ? null : fromDb(p.valuePaise),
              completedOn: p.completedOn ? p.completedOn.toISOString() : null,
              isRender: p.isRender,
            }))}
          />
        ) : null}

        {step === 'rates' ? (
          <RateCardForm values={await rateCardValues()} />
        ) : null}

        {step === 'review' ? (
          <ReviewPanel
            ready={steps.filter((s) => s.step !== 'review').every((s) => s.done)}
            alreadySubmitted={studio.submittedForReview}
            missing={steps
              .filter((s) => s.step !== 'review' && !s.done)
              .flatMap((s) => s.missing)}
          />
        ) : null}

            <nav className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--color-rule)] pt-6">
          {previous ? (
            <Link
              href={`/studio/onboarding/${previous}`}
              className="text-[14.5px] text-[var(--color-ink-3)] no-underline hover:text-[var(--color-ink)]"
            >
              ← {STEP_LABELS[previous]}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              href={`/studio/onboarding/${next}`}
              className="text-[14.5px] text-[var(--color-petrol)] no-underline hover:underline"
            >
              {STEP_LABELS[next]} →
            </Link>
          ) : (
            <span />
          )}
            </nav>
          </div>
        </div>
      </Container>
    </main>
  );
}

/**
 * Rates for the editor, in the units a studio typed them in: rupees for money,
 * whole percent for the design fee. Basis points are a storage detail and must
 * never surface in a form field.
 */
async function rateCardValues(): Promise<Record<string, number | null>> {
  const card = await myRateCard();
  const values: Record<string, number | null> = {};

  for (const category of RATE_CATEGORIES) {
    const stored = card[category];
    if (stored === undefined || stored === null) {
      values[category] = null;
      continue;
    }
    values[category] =
      CATEGORY[category].unit === 'percent' ? stored / 100 : paiseToRupees(stored);
  }

  return values;
}
