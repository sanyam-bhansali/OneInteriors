/**
 * The onboarding step model — pure, so it can be tested without a database.
 *
 * The important property here is that **completion is derived from the data,
 * never stored as a flag.** A stored "step 1 complete" boolean goes stale the
 * moment someone clears a field, and then the checklist lies to the studio
 * about what we are waiting for. Deriving it means the checklist and the
 * profile cannot disagree.
 */

export const ONBOARDING_STEPS = ['profile', 'registration', 'portfolio', 'review'] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const STEP_LABELS: Record<OnboardingStep, string> = {
  profile: 'Your studio',
  registration: 'Registration',
  portfolio: 'Your work',
  review: 'Send for review',
};

export const STEP_BLURBS: Record<OnboardingStep, string> = {
  profile: 'How you describe yourselves, where you work, and what you take on.',
  registration: 'The numbers we check against the public registries.',
  portfolio: 'Three completed projects. This is what customers actually read.',
  review: 'We take it from here.',
};

/** Enough projects that a customer sees a pattern rather than one lucky job. */
export const MIN_PORTFOLIO_PROJECTS = 3;

/** The minimum description length worth publishing. */
export const MIN_ABOUT_LENGTH = 80;
export const MAX_ABOUT_LENGTH = 1200;

/** Everything `assessSteps` needs. Deliberately not the Prisma row. */
export interface OnboardingSnapshot {
  about: string | null;
  localities: string[];
  minProjectPaise: bigint | number | null;
  maxProjectPaise: bigint | number | null;
  yearsActive: number | null;
  teamSize: number | null;
  gstin: string | null;
  portfolioCount: number;
  submittedForReview: boolean;
}

export interface StepStatus {
  step: OnboardingStep;
  done: boolean;
  /** What is still missing, in the studio's language rather than ours. */
  missing: string[];
}

export function assessSteps(studio: OnboardingSnapshot): StepStatus[] {
  const profileMissing: string[] = [];
  if (!studio.about || studio.about.trim().length < MIN_ABOUT_LENGTH) {
    profileMissing.push(`a description of at least ${MIN_ABOUT_LENGTH} characters`);
  }
  if (studio.localities.length === 0) profileMissing.push('the areas you work in');
  if (studio.minProjectPaise === null || studio.maxProjectPaise === null) {
    profileMissing.push('your project size range');
  }
  if (!studio.yearsActive) profileMissing.push('years active');
  if (!studio.teamSize) profileMissing.push('team size');

  // A GSTIN is not universal — a proprietorship may genuinely not have one — so
  // this step completes on a decision rather than on a value. What we will not
  // accept is silence, because a blank field is indistinguishable from an
  // unfinished form to whoever picks up the file.
  const registrationMissing: string[] = [];
  if (!studio.gstin) registrationMissing.push('a GSTIN, or a note that you do not have one');

  const portfolioMissing: string[] = [];
  if (studio.portfolioCount < MIN_PORTFOLIO_PROJECTS) {
    const short = MIN_PORTFOLIO_PROJECTS - studio.portfolioCount;
    portfolioMissing.push(`${short} more completed project${short === 1 ? '' : 's'}`);
  }

  const profile: StepStatus = {
    step: 'profile',
    done: profileMissing.length === 0,
    missing: profileMissing,
  };
  const registration: StepStatus = {
    step: 'registration',
    done: registrationMissing.length === 0,
    missing: registrationMissing,
  };
  const portfolio: StepStatus = {
    step: 'portfolio',
    done: portfolioMissing.length === 0,
    missing: portfolioMissing,
  };

  const earlierDone = profile.done && registration.done && portfolio.done;
  const review: StepStatus = {
    step: 'review',
    done: studio.submittedForReview,
    missing: earlierDone ? [] : ['the steps above'],
  };

  return [profile, registration, portfolio, review];
}

export function onboardingProgress(studio: OnboardingSnapshot) {
  const steps = assessSteps(studio);
  const done = steps.filter((s) => s.done).length;
  return { steps, done, total: steps.length, complete: done === steps.length };
}

/** Can the studio hand this back to us yet? Review itself is excluded. */
export function readyForReview(studio: OnboardingSnapshot): boolean {
  return assessSteps(studio)
    .filter((s) => s.step !== 'review')
    .every((s) => s.done);
}
