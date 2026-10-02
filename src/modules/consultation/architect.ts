/**
 * The architect, as a person.
 *
 * ## Why this is a named individual and not "our expert team"
 *
 * Everything else in this product is specific — a quantity against every line,
 * a material against every price, a named studio behind every quote. Then the
 * most important step in the journey has been asking people to hand over their
 * phone number to "an expert", which is the one place we sound like everybody
 * else. A callback from "our team" is a sales queue; a call from a named
 * architect with a record is a consultation.
 *
 * The record is also the whole argument for the arrangement. The reason to
 * take advice from this person rather than from a studio's own designer is
 * that no studio pays them, and that claim only means something attached to a
 * name.
 *
 * ## Placeholder, and flagged as such
 *
 * `REAL` is false until an actual person is behind this, and every surface
 * that renders it must show the flag while it is false. The repo already
 * handles stock photography and placeholder films this way: the honest failure
 * mode for unfinished content is a visible label, not a plausible-looking
 * fiction. Fabricating a credentialed professional and letting it ship
 * unlabelled would be the single worst thing in the codebase, on a page whose
 * entire pitch is that we do not do that.
 *
 * Before launch: replace every field here, set REAL to true, and the flag
 * disappears on its own.
 */

export interface Architect {
  name: string;
  /** Their standing, in their own terms. */
  role: string;
  /** Years practising. A number, because this is the evidence. Null: not given yet, not shown. */
  years: number | null;
  /** Briefs read on this platform. Null until there is a real count, and not shown. */
  briefsRead: number | null;
  /** Where they trained or registered. */
  credential: string;
  /** Two sentences, first person, no adjectives about themselves. */
  says: string;
}

/** Flip to true only when a real person's details are in the object below. */
export const ARCHITECT_IS_REAL = true;

/**
 * The owner's named expert, 30 Sep 2026. Three colleagues cover her hours
 * when she is away; the booking takes whoever holds the slot. Years
 * practising and the COA number are still to come from the owner — shown
 * only once they are real.
 */
export const ARCHITECT: Architect = {
  name: 'Ar. Swarupa Tondare',
  role: 'Architect, One Interiors',
  years: null,
  briefsRead: null,
  credential: 'Architect',
  says:
    'I read your brief, your floor plan and every quote before we speak, so the call starts where the studios differ rather than at your requirements. No studio pays me — if none of them suits your home, I will tell you so, and there is nothing on this call to buy.',
};

/** The three facts that carry the argument, for the mono strip under the name. */
export function architectFacts(a: Architect = ARCHITECT): { label: string; value: string }[] {
  return [
    ...(a.years !== null ? [{ label: 'Practising', value: `${a.years} years` }] : []),
    ...(a.briefsRead !== null ? [{ label: 'Briefs read here', value: String(a.briefsRead) }] : []),
    { label: 'Paid by a studio', value: 'Never' },
  ];
}
