/**
 * Our mark on a studio's quotation, and what it takes to remove it.
 *
 * Pure — no database, no `server-only` — so the document, the settings screen
 * and the tests all read the same rules. CONTRIBUTING §9.5.
 *
 * ## What this is allowed to put on their document, and what it is not
 *
 * The print page carries a rule worth quoting, because this module is the
 * first thing that has ever qualified it:
 *
 *   **Nothing of ours appears on it.** Not our name, not our logo, not our
 *   words, not our terms. A quotation is a document a studio is legally
 *   answerable for, and putting our sentences on it would be committing them
 *   to promises they never read.
 *
 * That rule stands, and this does not breach it, because it draws a line the
 * original could not: there is a difference between **our terms** and **an
 * attribution**. Our terms commit the studio to something. "Prepared with One
 * Interiors" commits them to nothing — it is a software credit, the same shape
 * as the line at the bottom of a form built with Typeform.
 *
 * So the constraint is not "no mark". It is:
 *
 * 1. **Never near the parties.** It goes in the footer, below their GSTIN,
 *    never in the header where a reader is working out who is quoting them.
 * 2. **Never in the terms block**, and never a sentence that could be read as
 *    a promise by anybody.
 * 3. **Never our logo at the size of theirs.** Their name is the document's
 *    name.
 *
 * A client reading the footer must come away knowing the studio used our
 * software, and must not come away wondering whether we are a party to their
 * contract. On an Indian quotation that second reading is a real hazard: a
 * document naming two businesses near a GSTIN invites the question of who is
 * actually invoicing.
 */

export const MARK_TEXT = 'Prepared with One Interiors';

/**
 * Which subscriptions may take it off.
 *
 * Mirrors `SUBSCRIPTION_TIERS` in `studio/subscription.ts`; kept as a list
 * here rather than importing so this file stays free of anything that might
 * one day reach for a database. A tier that does not exist yet is not
 * entitled, which is the safe direction to fail.
 */
const ENTITLED_TIERS = ['PREMIUM', 'LUXURY'] as const;

export function tierMayRemoveMark(tier: string | null | undefined): boolean {
  return (ENTITLED_TIERS as readonly string[]).includes(tier ?? '');
}

/**
 * Does our mark go on this document?
 *
 * Both halves are required, and the order matters. A studio can ask for it to
 * be hidden at any time — the preference is stored whatever their tier is —
 * but the preference is only *honoured* while they are entitled. So a studio
 * who upgrades, turns it off, and later downgrades gets the mark back without
 * anybody editing their settings, and gets their choice back if they upgrade
 * again.
 *
 * Storing the wish separately from the right to it is what makes that work.
 * A single boolean would have to be rewritten on every tier change, by
 * something that remembered to.
 */
export function showsOurMark(input: {
  tier: string | null | undefined;
  hideRequested: boolean;
}): boolean {
  if (!input.hideRequested) return true;
  return !tierMayRemoveMark(input.tier);
}

/** What the settings screen says about the toggle, given where they stand. */
export function markToggleState(input: {
  tier: string | null | undefined;
  hideRequested: boolean;
}): { entitled: boolean; on: boolean; note: string } {
  const entitled = tierMayRemoveMark(input.tier);

  if (!entitled) {
    return {
      entitled: false,
      on: input.hideRequested,
      /* Says what it costs rather than hiding the control. A feature a studio
         cannot see is one they cannot decide they want. */
      note: 'Available on Premium. Your preference is kept either way, so it takes effect the day you upgrade.',
    };
  }

  return {
    entitled: true,
    on: input.hideRequested,
    note: input.hideRequested
      ? 'Your quotations go out with nothing of ours on them.'
      : 'A single line in the footer, below your GSTIN. Never in your terms.',
  };
}
