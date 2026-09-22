/**
 * Where a studio stands with us, and what the software does about it.
 *
 * Pure — no database, no `server-only` — so the nav, the dashboard gate, the
 * banner and the tests all read the same rules. CONTRIBUTING §9.5.
 *
 * ## The change this encodes
 *
 * The software used to open on approval. A studio finished five steps, sent
 * the application, and got a holding screen that said the rest opens "the day
 * you go live" — which is a week of nothing, at exactly the moment they are
 * most interested and most likely to try a competitor's trial instead.
 *
 * It also had the incentive backwards. The CRM is the thing that makes them
 * want to stay; withholding it until we have finished our paperwork means the
 * week they spend waiting is a week they spend somewhere else.
 *
 * So the practice software opens the moment they submit. What stays shut is
 * only what turns on being *verified*: appearing on the roster, being matched,
 * receiving briefs. Those are claims about a studio we have checked, and
 * nothing a studio does to their own screen can produce one.
 *
 * ## Three standings, and the middle one is the new one
 *
 * - `SETTING_UP` — still filling the five steps. Onboarding, nothing else.
 * - `WITH_US` — submitted, not yet approved. **The CRM is open.** Clients,
 *   quotations, their own catalogue: everything they would use to run their
 *   practice, none of which depends on our opinion of them.
 * - `LISTED` — approved and on the roster. Briefs arrive.
 */

export const STANDINGS = ['SETTING_UP', 'WITH_US', 'LISTED'] as const;
export type Standing = (typeof STANDINGS)[number];

export interface StandingInput {
  /** `Studio.status` — ACTIVE means ops has approved and listed them. */
  status: string;
  /** Have they handed their side back to us? */
  submittedForReview: boolean;
}

export function standingOf({ status, submittedForReview }: StandingInput): Standing {
  if (status === 'ACTIVE') return 'LISTED';
  /**
   * SUSPENDED and REMOVED deliberately fall through to SETTING_UP rather than
   * getting a standing of their own.
   *
   * A suspended studio is under investigation and a removed one is off the
   * roster; neither should be quietly handed a working CRM by a function
   * whose job is describing onboarding. If those states need their own
   * treatment they should get it explicitly, from something that knows what a
   * suspension is — not by default from here.
   */
  if (status !== 'ONBOARDING') return 'SETTING_UP';
  return submittedForReview ? 'WITH_US' : 'SETTING_UP';
}

/** Can they use the practice software — clients, quotations, their catalogue? */
export function crmIsOpen(input: StandingInput): boolean {
  const standing = standingOf(input);
  return standing === 'WITH_US' || standing === 'LISTED';
}

/**
 * Can customers reach them?
 *
 * Only when listed, and this is the line the whole arrangement rests on. A
 * studio using the CRM while we verify them is a studio running their own
 * practice on our software. A studio receiving briefs before we have called
 * their clients is us vouching for somebody we have not checked.
 */
export function receivesBriefs(input: StandingInput): boolean {
  return standingOf(input) === 'LISTED';
}

export const STANDING_COPY: Record<
  Standing,
  { label: string; detail: string }
> = {
  SETTING_UP: {
    label: 'Setting up',
    detail: 'Finish the five steps and send them to us.',
  },
  WITH_US: {
    label: 'With us for review',
    detail:
      'Your side is done. Use the software as much as you like meanwhile — your clients and your quotations are yours whatever we decide.',
  },
  LISTED: {
    label: 'On the roster',
    detail: 'Customers can find you, and briefs come through.',
  },
};
