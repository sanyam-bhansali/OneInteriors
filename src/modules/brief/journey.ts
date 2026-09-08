/**
 * The five named steps of the customer journey.
 *
 * Naming the steps does real work: it turns "fill in a form and wait" into a
 * process a person can hold in their head, and it gives them the vocabulary to
 * describe what they are doing to a spouse who was not on the call. It is also
 * how MagicInteriors made an ordinary quote form memorable.
 *
 * The `One` prefix is a placeholder until the brand name is settled — it is
 * defined once, here, so renaming the company is a one-line change rather than
 * a search across the site.
 */

const PREFIX = 'One';

export interface JourneyStep {
  /** The product name. Shown as a label, not a heading. */
  name: string;
  /** What actually happens, in the customer's words. */
  title: string;
  body: string;
  /** How long it takes them. Honest, including the waiting. */
  duration: string;
}

export const JOURNEY: JourneyStep[] = [
  {
    name: `${PREFIX}Brief`,
    title: 'Nine questions about your home',
    body: 'Your flat, your budget, the styles you like — and the ones you cannot live with. Upload a floor plan if you have one; it makes everything after this sharper. Nothing is shared with anyone yet.',
    duration: 'Three minutes',
  },
  {
    name: `${PREFIX}Tier`,
    title: 'Choose what you are actually buying',
    body: 'Essential, Premium or Luxury — set by materials and finish, not by status. We show you what each band costs for a home your size before you spend any more time.',
    duration: 'One minute',
  },
  {
    name: `${PREFIX}Match`,
    title: 'Studios that fit, ranked by fit',
    body: 'From the verified roster, ordered by how well they match your brief and nothing else. We show you why each one appeared, and where the score is a guess rather than a measurement.',
    duration: 'Instant',
  },
  {
    name: `${PREFIX}Quote`,
    title: 'A real number, from their real rates',
    body: 'Each studio prices your home from their own rate card. Every quote shows what we assumed and how wide the range is — because nobody has seen your flat yet.',
    duration: 'Instant',
  },
  {
    name: `${PREFIX}Compare`,
    title: 'Side by side, line by line',
    body: 'The same categories across every quote, so you can see that one studio is dearer on the kitchen and cheaper on the ceiling. With a written summary of what the differences actually mean.',
    duration: 'As long as you like',
  },
  {
    name: `${PREFIX}Expert`,
    title: 'Talk it through with us',
    body: 'Pick the studios you want to discuss. Our expert reads everything beforehand, gets on a call, and helps you choose — then sets up the meeting or site visit with that studio directly.',
    duration: 'A 30-minute call',
  },
];

/** Just the names, for the compact strip in the header area. */
export const JOURNEY_NAMES = JOURNEY.map((s) => s.name);
