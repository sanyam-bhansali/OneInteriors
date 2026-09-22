/**
 * The onboarding step model — pure, so it can be tested without a database.
 *
 * The important property here is that **completion is derived from the data,
 * never stored as a flag.** A stored "step 1 complete" boolean goes stale the
 * moment someone clears a field, and then the checklist lies to the studio
 * about what we are waiting for. Deriving it means the checklist and the
 * profile cannot disagree.
 */

export const ONBOARDING_STEPS = ['profile', 'registration', 'portfolio', 'rates', 'review'] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const STEP_LABELS: Record<OnboardingStep, string> = {
  profile: 'Your studio',
  registration: 'Registration',
  portfolio: 'Your work',
  rates: 'Your rates',
  review: 'Send for review',
};

export const STEP_BLURBS: Record<OnboardingStep, string> = {
  profile: 'How you describe yourselves, where you work, and what you take on.',
  registration: 'The numbers we check against the public registries.',
  portfolio: 'Three completed projects. This is what customers actually read.',
  rates: 'What you charge. Private, and never shown to anyone but you.',
  review: 'We take it from here.',
};

/** Enough projects that a customer sees a pattern rather than one lucky job. */
export const MIN_PORTFOLIO_PROJECTS = 3;

/**
 * The shortest account of a short portfolio worth reading.
 *
 * Same threshold as the GSTIN note, and for the same reason: a sentence routes
 * a verifier somewhere, a word does not.
 */
export const MIN_SHORTFALL_NOTE = 40;

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
  /** Set when the studio has told us it has no GST registration. */
  gstinNotApplicable: boolean;
  /** Street address. Null on every studio that predates the field. */
  addressLine: string | null;
  pincode: string | null;
  portfolioCount: number;
  /**
   * What a studio with fewer than three completed projects has instead, in
   * their own words. Null means they have not told us.
   */
  portfolioShortfallNote: string | null;
  /// Core rate categories still without a rate. Empty = quotable.
  missingRates: string[];
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
  // `=== null`, not falsy. A studio in its first year genuinely has zero years
  // active, and a truthiness test would tell them the field was still empty
  // after they had answered it correctly.
  if (studio.yearsActive === null) profileMissing.push('years active');
  if (!studio.teamSize) profileMissing.push('team size');

  /**
   * A GSTIN is not universal — a proprietorship may genuinely not have one — so
   * this step completes on a DECISION rather than on a value. What we will not
   * accept is silence, because a blank field is indistinguishable from an
   * unfinished form to whoever picks up the file.
   *
   * That was always the stated rule, and for a long time only half of it was
   * implementable: the comment described a decision while the code tested a
   * value, and there was no field anywhere that could record "I do not have
   * one". A studio without GST registration could finish every other step and
   * then find the submit button permanently greyed out, with no escape hatch on
   * the ops side either. `gstinNotApplicable` is the other half.
   */
  const registrationMissing: string[] = [];
  if (!studio.gstin && !studio.gstinNotApplicable) {
    registrationMissing.push('a GSTIN, or a note that you do not have one');
  }

  /**
   * And where the practice actually is.
   *
   * Required because this step is verification, and verification means
   * somebody goes and stands somewhere. A GSTIN alone tells us a registration
   * exists; it does not tell us the studio does.
   *
   * The uploaded certificate is deliberately NOT required. It is the most
   * useful thing on the step and it is also the one thing a studio may not
   * have to hand on the evening they fill this in — making it compulsory
   * would stop somebody who is otherwise finished, and we can ask for it by
   * email. A document is evidence we want, not a gate.
   */
  if (!studio.addressLine?.trim()) registrationMissing.push('your studio address');
  if (!studio.pincode?.trim()) registrationMissing.push('a pincode');

  /**
   * Three completed projects, **or** one project and an account of what else
   * there is.
   *
   * This step used to accept nothing but the three, which made it the only
   * dead end left in onboarding after the GSTIN one was fixed. A young
   * practice was approved, spent half an hour on the other four steps, and
   * then sat on a permanently greyed-out submit button — having learned the
   * requirement only *after* we accepted them.
   *
   * So the bar has not moved: three finished projects is still what a listed
   * studio shows a customer. What changed is that falling short is now a
   * conversation rather than a wall, on the same principle as
   * `gstinNotApplicable` — a declared, reviewable alternative beats a blank,
   * because a blank is indistinguishable from an unfinished form to whoever
   * picks up the file.
   *
   * **At least one project is still required**, and that is not arbitrary. The
   * note describes work; the project is work we can look at. A file with
   * neither gives a verifier nothing to start from, and a profile with nothing
   * in it cannot be published under any judgement we might make.
   *
   * Note what this deliberately does *not* do: it does not mark the studio
   * verified, and it does not touch the tier. It unblocks submission, which
   * hands the decision to a person — which at ten studios is affordable and is
   * the right place for it.
   */
  const portfolioMissing: string[] = [];
  const shortfallNote = studio.portfolioShortfallNote?.trim() ?? '';
  if (studio.portfolioCount < MIN_PORTFOLIO_PROJECTS) {
    if (studio.portfolioCount === 0) {
      portfolioMissing.push('at least one project');
    } else if (shortfallNote.length < MIN_SHORTFALL_NOTE) {
      const short = MIN_PORTFOLIO_PROJECTS - studio.portfolioCount;
      portfolioMissing.push(
        `${short} more completed project${short === 1 ? '' : 's'}, or a note about what else you have`,
      );
    }
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

  // Without a complete rate card the studio produces no quote, and a studio
  // nobody can get a quote from cannot be shown to a customer — the quote is
  // the only route from a match to a conversation.
  const ratesMissing: string[] = [];
  if (studio.missingRates.length > 0) {
    const n = studio.missingRates.length;
    ratesMissing.push(`${n} rate${n === 1 ? '' : 's'} still to enter`);
  }
  const rates: StepStatus = {
    step: 'rates',
    done: ratesMissing.length === 0,
    missing: ratesMissing,
  };

  const earlierDone = profile.done && registration.done && portfolio.done && rates.done;
  const review: StepStatus = {
    step: 'review',
    done: studio.submittedForReview,
    missing: earlierDone ? [] : ['the steps above'],
  };

  return [profile, registration, portfolio, rates, review];
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

// ── The gate ───────────────────────────────────────────────────

/**
 * What a step is, from where the studio currently stands.
 *
 * - `done` — every requirement met. Always revisitable.
 * - `current` — the first step that is not done. The one to work on.
 * - `open` — not done, but everything before it is. Reachable.
 * - `locked` — something earlier is unfinished.
 */
export type StepGate = 'done' | 'current' | 'open' | 'locked';

/**
 * Why locking is DERIVED and never stored.
 *
 * The obvious build keeps a `completedSteps` array on the studio and ticks
 * entries off. It is wrong here for a reason the brief itself raises: *"if a
 * required field is removed, dependent steps get locked again."*
 *
 * A stored flag cannot do that without somebody remembering to clear it on
 * every path that can empty a field — the profile form, the rate card, a
 * project being deleted, an admin edit. Miss one and a studio walks to Review
 * with a tick against a step that is no longer true, and the submit fails
 * with no explanation.
 *
 * `assessSteps` reads the data every time, so removing a field re-locks
 * whatever depended on it with no bookkeeping at all. The cost is that
 * completion cannot be faked for a demo. That is a feature.
 */
export function gateFor(steps: StepStatus[], step: OnboardingStep): StepGate {
  const index = ONBOARDING_STEPS.indexOf(step);
  const status = steps.find((s) => s.step === step);
  if (!status) return 'locked';

  const firstOpen = steps.findIndex((s) => !s.done);

  if (status.done) return 'done';
  if (index === firstOpen) return 'current';

  /* Everything before it is finished, so it is reachable even though it is
     not the first thing to do — which happens when an earlier step was
     completed out of order. */
  const earlierAllDone = steps.slice(0, index).every((s) => s.done);
  return earlierAllDone ? 'open' : 'locked';
}

/** The step a studio should be taken to. Never `review` unless it is earned. */
export function firstIncomplete(steps: StepStatus[]): OnboardingStep {
  return steps.find((s) => !s.done)?.step ?? ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1]!;
}

/**
 * How far along, as a whole percent.
 *
 * Counted in completed STEPS, not in fields. A bar that creeps as you type is
 * guessing, and a guess that runs ahead of the work is the reason progress
 * bars are distrusted — the same argument the apply form's rail makes.
 *
 * Rounded, but never to 100 unless every step is genuinely done: four of five
 * is 80, and 99.5 rounding up to 100 beside an unfinished step is the one
 * value this must never show.
 */
export function percentComplete(steps: StepStatus[]): number {
  if (steps.length === 0) return 0;
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return 100;
  return Math.min(99, Math.round((done / steps.length) * 100));
}
