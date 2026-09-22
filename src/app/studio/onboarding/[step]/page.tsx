import { notFound, redirect } from 'next/navigation';
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
  gateFor,
  firstIncomplete,
  type OnboardingStep,
} from '@/modules/studio/onboarding';
import { StepRail } from '../StepRail';
import { StepArrival } from '../StepArrival';
import { StepFooter } from '../StepFooter';
import { ProfileForm } from '../ProfileForm';
import { RegistrationForm } from '../RegistrationForm';
import { PortfolioForm } from '../PortfolioForm';
import { ReviewPanel } from '../ReviewPanel';
import { RateCardForm } from '../RateCardForm';
import { ArchivePanel, type ArchiveView } from '../ArchivePanel';
import { myArchive } from '@/modules/studio/quotation-archive-store';
import { quotationUploadEnabled } from '@/modules/storage/quotation-archive';
import { MIN_QUOTATIONS_FOR_RATES } from '@/modules/quotation/catalogue';
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
  searchParams,
}: {
  params: Promise<{ step: string }>;
  searchParams: Promise<{ done?: string | string[] }>;
}) {
  const { step } = await params;
  if (!isStep(step)) notFound();

  const context = await currentStudio();
  if (!context) notFound();

  const { studio } = context;
  const { steps } = onboardingProgress(studio);

  /**
   * The lock, enforced where it cannot be walked around.
   *
   * The rail renders a locked step as a non-link, which is the right shape
   * for the interface and is not a control: the URL is still typeable, still
   * bookmarkable, and still reachable from a stale tab left open before an
   * earlier step was emptied.
   *
   * So the gate is checked on the server on every request, and a locked step
   * bounces to whatever is genuinely next. `replace` rather than a push, so
   * the back button does not land somebody straight back on the locked page
   * they were just moved off.
   */
  if (gateFor(steps, step) === 'locked') {
    redirect(`/studio/onboarding/${firstIncomplete(steps)}`);
  }

  const index = ONBOARDING_STEPS.indexOf(step);
  const next = ONBOARDING_STEPS[index + 1];
  const previous = ONBOARDING_STEPS[index - 1];
  const status = steps[index]!;

  /**
   * "You just finished X" — checked against the data, not believed.
   *
   * `?done=` is a hint from the Continue link and nothing more. Anybody can
   * type it, and a stale tab can carry one for a step that has since been
   * emptied, so three things must hold before it is worth printing:
   *
   * - it names a real step (not a typo, not an array from `?done=a&done=b`)
   * - it is the step immediately before this one, so Continue is the only
   *   thing that can produce it
   * - that step genuinely passes `assessSteps` right now
   *
   * The last is the one that matters. Congratulating somebody for work they
   * have not done is worse than saying nothing, and it is precisely the
   * confusion the rest of this flow is built to avoid.
   */
  const doneParam = (await searchParams).done;
  const claimed = typeof doneParam === 'string' && isStep(doneParam) ? doneParam : null;
  const justFinished =
    claimed !== null && claimed === previous && steps[index - 1]?.done === true ? claimed : null;

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
            <StepRail steps={steps} current={step} />
          </div>

          <div className="max-w-[46rem]">
            {justFinished ? (
              <StepArrival
                finished={STEP_LABELS[justFinished]}
                /* Position, not completeness: "two steps after this one" is
                   true however much of them is already filled in, whereas a
                   count of what is outstanding would change under a studio
                   who had completed a later step out of order. */
                remaining={ONBOARDING_STEPS.length - index - 1}
              />
            ) : null}

            <header className="mb-7">
              <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="h1 m-0">{STEP_LABELS[step]}</h1>
                {/* "Saved" and "done" are two different claims, and this
                    codebase has already been bitten by conflating them: the
                    profile form once returned a green "Saved." for a blank
                    required field, so a studio was told it worked and then
                    found the step still unticked with no explanation.

                    So the badge only ever appears when the step genuinely
                    passes `assessSteps`. Anything less says nothing here and
                    lists what is missing in the footer instead. */}
                {status.done ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-ontrack-soft)] px-2.5 py-1 text-[12.5px] font-medium text-[var(--color-ontrack)]">
                    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3 w-3">
                      <path
                        d="M3.5 8.5 L6.5 11.5 L12.5 5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Complete
                  </span>
                ) : null}
              </div>
              <p className="m-0 max-w-[54ch] text-[15.5px] leading-relaxed text-[var(--color-ink-2)]">
                {STEP_BLURBS[step]}
              </p>
            </header>

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
          <div className="flex flex-col gap-8">
            {/* Offered above the form, never instead of it. Until rates exist
                the form is the only route forward, so hiding it behind "we are
                reading your files" would block a studio on us for a week. */}
            <ArchivePanel
              archive={await archiveView()}
              minForRates={MIN_QUOTATIONS_FOR_RATES}
              enabled={quotationUploadEnabled()}
            />
            <RateCardForm values={await rateCardValues()} />
          </div>
        ) : null}

        {step === 'review' ? (
          <ReviewPanel
            alreadySubmitted={studio.submittedForReview}
            /* Review itself is excluded: it is the step being stood on, and
               it passes precisely when the other four do, so including it
               would be a row that only ever restates its own siblings. */
            sections={steps
              .filter((s) => s.step !== 'review')
              .map((s) => ({
                step: s.step,
                label: STEP_LABELS[s.step],
                done: s.done,
                missing: s.missing,
              }))}
          />
        ) : null}

            <StepFooter status={status} previous={previous} next={next} />
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
/**
 * What the studio has sent us, shaped for the panel.
 *
 * Only the fields the studio may see. Deliberately NOT the storage paths —
 * they identify objects in a private bucket holding every studio's
 * confidential pricing, and there is no reason for one to reach a browser.
 */
async function archiveView(): Promise<ArchiveView | null> {
  const archive = await myArchive();
  if (!archive) return null;

  return {
    state: archive.state,
    quotationCount: archive.quotationCount,
    fileCount: archive.fileCount,
    note: archive.note,
    files: archive.files.map((f) => ({ id: f.id, filename: f.filename, bytes: f.bytes })),
  };
}

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
