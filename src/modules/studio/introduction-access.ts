/**
 * May this studio see who the customer is?
 *
 * ## Why this is one function in one file
 *
 * "We do not sell or pass on your contact details, and no studio receives them
 * until you tell an expert which introduction you want" is on the landing page,
 * and "there is no contact-this-studio button anywhere on this site" is the
 * sentence the whole product is arranged around.
 *
 * Until the `Introduction` table existed, that promise was a convention: the
 * studio surface simply had no page that could have leaked a phone number, so
 * nothing enforced it. The calendar changes that. It is the first studio-facing
 * screen where showing the wrong thing would be invisible to everyone except
 * the customer — no error, no exception, just a name appearing somewhere it
 * should not.
 *
 * So the decision lives here, alone, with no database access and no React, and
 * every surface calls it rather than re-deriving it from three nullable
 * columns. One thing to test, one thing to review, one thing to get wrong.
 *
 * Pure and tested. No `server-only` — see CONTRIBUTING §9.5.
 */

/** The three columns that decide this. Deliberately the whole input. */
export interface IntroductionAccess {
  /** When the studio became allowed to see name and phone. Null = not yet. */
  contactReleasedAt: Date | null;
  /** The customer changed their mind. Access ends, permanently. */
  withdrawnAt: Date | null;
}

export type ContactState =
  /** Introduced, released, still standing. Name and phone may be shown. */
  | { visible: true }
  /**
   * Introduced, but the expert has not released contact yet — usually because
   * the customer has not confirmed they are happy to be called.
   */
  | { visible: false; reason: 'not_released'; message: string }
  /** Withdrawn. This is not a temporary state and the copy must not imply it is. */
  | { visible: false; reason: 'withdrawn'; message: string };

/**
 * The single decision.
 *
 * Withdrawal is checked FIRST and independently of release. A withdrawn
 * introduction that was previously released must come back false — reading the
 * two fields in the other order, or with an `||`, would leave a customer who
 * asked to be removed still visible to the studio they asked to be removed
 * from. That is the precise bug this function exists to make impossible.
 */
export function canSeeContact(introduction: IntroductionAccess): boolean {
  if (introduction.withdrawnAt) return false;
  return introduction.contactReleasedAt !== null;
}

/**
 * The same decision, with the sentence to show when the answer is no.
 *
 * A blank where a phone number should be invites a support message. Saying why,
 * in the studio's own terms, does not.
 */
export function contactState(introduction: IntroductionAccess): ContactState {
  if (introduction.withdrawnAt) {
    return {
      visible: false,
      reason: 'withdrawn',
      message:
        'This customer asked us to withdraw the introduction. Their details are no longer available and this is not a temporary hold — if you were mid-conversation, speak to us rather than to them.',
    };
  }

  if (introduction.contactReleasedAt === null) {
    return {
      visible: false,
      reason: 'not_released',
      message:
        'Introduced, but we have not released contact details yet — usually because the customer has not confirmed a time. We will call you the moment they do.',
    };
  }

  return { visible: true };
}

/**
 * Strip a customer's identity from a record a studio is about to be shown.
 *
 * The defensive half of the same rule. `canSeeContact` decides; this makes the
 * decision hard to ignore, because a caller that forgets to branch gets nulls
 * rather than a name. Use it at the boundary where data leaves a server module,
 * not in a component — by the time a value reaches JSX it has usually been
 * spread through three objects and the guarantee is gone.
 */
export function redactContact<T extends { name: string | null; phone: string | null; email: string | null }>(
  record: T,
  introduction: IntroductionAccess,
): T {
  if (canSeeContact(introduction)) return record;
  return { ...record, name: null, phone: null, email: null };
}
