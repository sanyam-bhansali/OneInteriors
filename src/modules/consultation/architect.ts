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
  /** Years practising. A number, because this is the evidence. */
  years: number;
  /** Briefs read on this platform. Matches the figure used on the landing page. */
  briefsRead: number;
  /** Where they trained or registered. */
  credential: string;
  /** Two sentences, first person, no adjectives about themselves. */
  says: string;
}

/** Flip to true only when a real person's details are in the object below. */
export const ARCHITECT_IS_REAL = false;

export const ARCHITECT: Architect = {
  name: 'Ira Deshmukh',
  role: 'Principal architect, One Interiors',
  years: 12,
  briefsRead: 68,
  credential: 'B.Arch, COA registered',
  says:
    'I read the brief, the floor plan and every quote before I ring, so the call starts at the disagreements rather than at your requirements. If none of the studios suits the flat, I will tell you that — no studio pays me, and there is nothing on this call to buy.',
};

/** The three facts that carry the argument, for the mono strip under the name. */
export function architectFacts(a: Architect = ARCHITECT): { label: string; value: string }[] {
  return [
    { label: 'Practising', value: `${a.years} years` },
    { label: 'Briefs read here', value: String(a.briefsRead) },
    { label: 'Paid by a studio', value: 'Never' },
  ];
}
