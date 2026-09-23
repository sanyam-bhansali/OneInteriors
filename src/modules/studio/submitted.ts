/**
 * Has this studio handed their side back to us?
 *
 * Pure — no `server-only`, no Prisma — so the layout, the ops queue, the
 * repository and the onboarding service all read the JSON the same way.
 * CONTRIBUTING §9.5.
 *
 * ## Why one function for something this small
 *
 * `Studio.onboardingSteps` is a Json column holding exactly two keys, and it
 * was being re-cast inline in four separate files:
 *
 *     (row.onboardingSteps as { submittedForReview?: boolean } | null)
 *
 * Four casts of an untyped column is four places that believe a shape nothing
 * enforces. They agree today. They would stop agreeing the first time the
 * column gained a third key and one of the four was updated — and the
 * disagreement would show up as a studio whose navigation says they have
 * submitted while the ops queue says they have not.
 *
 * A cast is not a check. This is the check.
 */

export interface OnboardingSubmission {
  submittedForReview: boolean;
  /** ISO date, when we have one. Older rows carry only the boolean. */
  submittedAt: string | null;
}

/**
 * Read the column defensively.
 *
 * It is Json, which means its contents are whatever was true on the day they
 * were written — including, for the oldest rows, nothing at all. Anything
 * unreadable is treated as "not submitted", which is the safe direction: a
 * studio wrongly shown as still in setup can press the button again, while
 * one wrongly shown as submitted waits for a review nobody is doing.
 */
export function submissionOf(value: unknown): OnboardingSubmission {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { submittedForReview: false, submittedAt: null };
  }

  const row = value as Record<string, unknown>;

  return {
    submittedForReview: row.submittedForReview === true,
    submittedAt: typeof row.submittedAt === 'string' ? row.submittedAt : null,
  };
}

/** The question four files were asking with a cast. */
export function hasSubmittedForReview(value: unknown): boolean {
  return submissionOf(value).submittedForReview;
}
