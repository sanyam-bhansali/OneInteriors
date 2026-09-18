/**
 * One short question, asked while a quote is being built.
 *
 * ## Why a question at all
 *
 * These ten seconds are the best attention this product will ever get: the
 * customer asked for something, they want it, and there is nothing else to do
 * until it lands. A question is worth more than a fact here, because answering
 * commits you. Having guessed BWR and been told it was BWP, you own the
 * distinction — and forty seconds later a line in your own quotation reads
 * `18mm BWP carcass` and means something.
 *
 * **The quiz exists to make the document that follows it readable.** It is not
 * a game and it keeps no score, because a score would make it about the
 * customer rather than about their kitchen.
 *
 * ## Why every field here is short
 *
 * The first version of this file opened with a three-line scenario, offered
 * options a sentence long, and answered with three paragraphs. Correct, and
 * far too much to read while waiting — which turned the best moment in the
 * journey into homework. Everything is now sized for a card: the question in
 * about a dozen words, options in four or five, the answer in two lines.
 *
 * The test suite enforces the lengths. Prose creeping back is the regression
 * this shape exists to prevent.
 *
 * ## The rules the questions obey
 *
 * - **Never about taste.** There is a correct answer and it is a fact about
 *   how a material behaves.
 * - **Never a trick.** The wrong answers are things a reasonable person would
 *   actually choose — usually the right answer somewhere else in the flat.
 * - **Never at the customer's expense.** The jokes on this screen are at the
 *   industry's; so is this.
 */

import { MATERIALS, material, type Material } from './glossary';

export interface Choice {
  id: string;
  /** Four or five words. Read under mild impatience. */
  label: string;
  correct: boolean;
  /** A short, specific reply to this pick. About a dozen words. */
  ifPicked: string;
}

export interface Question {
  id: string;
  /** The glossary entry this teaches. */
  materialId: string;
  /** The question, with its situation folded in. About a dozen words. */
  ask: string;
  choices: Choice[];
  /** The real reason. Two lines at most, shown however they answered. */
  because: string;
  /** What it is worth, as one short line with a figure in it. */
  stakes: string;
}

export const QUESTIONS: Question[] = [
  {
    id: 'q-kitchen-board',
    materialId: 'bwp',
    ask: 'Your kitchen base sits under the sink. Which board?',
    choices: [
      { id: 'mdf', label: 'MDF', correct: false, ifPicked: 'Best board in the flat — for a painted shutter, not a wet base.' },
      { id: 'bwr', label: 'BWR — water resistant', correct: false, ifPicked: 'Right for every wardrobe. Under a sink it is out of its depth.' },
      { id: 'bwp', label: 'BWP — waterproof', correct: true, ifPicked: 'One word between the two grades, and it is the whole spec.' },
    ],
    because: 'BWR survives steam. BWP survives standing water. They behave identically for about four years, then stop.',
    stakes: '≈ ₹9,000 saved by downgrading — the most swapped line in Pune.',
  },
  {
    id: 'q-softclose',
    materialId: 'softclose',
    ask: 'Two quotes both say “soft-close hinges”, ₹14,000 apart. Why?',
    choices: [
      { id: 'cycles', label: 'The cycle rating', correct: true, ifPicked: 'Yes — the phrase is not a spec. The number is.' },
      { id: 'feel', label: 'How soft it feels', correct: false, ifPicked: 'They feel identical when new. That is what makes the cheap one sellable.' },
      { id: 'nothing', label: 'A hinge is a hinge', correct: false, ifPicked: 'Reasonable, and wrong by a factor of three.' },
    ],
    because: 'Every hinge is rated in open-and-shut cycles. At ten opens a day, 25,000 is seven years and 80,000 outlasts the kitchen.',
    stakes: '≈ ₹12,000 — and almost no quote in this market states the rating.',
  },
  {
    id: 'q-laminate',
    materialId: 'laminate',
    ask: 'Where can you drop from 1mm laminate to 0.8mm for free?',
    choices: [
      { id: 'wardrobe', label: 'Wardrobe sides and shelves', correct: true, ifPicked: 'Nothing abrades a wardrobe side. Real saving, no cost.' },
      { id: 'kitchen', label: 'Kitchen shutter faces', correct: false, ifPicked: 'Wet hands, pans and rings land here. The one place it works.' },
      { id: 'nowhere', label: 'Nowhere — always take thicker', correct: false, ifPicked: 'Knowing where a downgrade is free is worth as much as knowing where it is not.' },
    ],
    because: 'Thickness buys abrasion resistance, not looks. It only earns its money where hands and pans land.',
    stakes: '≈ ₹7,000 — most of it available without giving anything up.',
  },
  {
    id: 'q-paint',
    materialId: 'primer',
    ask: 'Two painting quotes, ₹22,000 apart, both “two coats”. What is missing?',
    choices: [
      { id: 'primer', label: 'The primer coat', correct: true, ifPicked: 'Invisible on handover day, which is exactly why it goes.' },
      { id: 'brand', label: 'A cheaper emulsion', correct: false, ifPicked: 'Possible, but the brand is on the invoice. The primer is not.' },
      { id: 'labour', label: 'Fewer painters', correct: false, ifPicked: 'Painting is priced by area, not by day.' },
    ],
    because: 'Primer bonds the emulsion and stops bare plaster drinking it. Without it the colour goes patchy in raking daylight and lifts with tape.',
    stakes: '≈ ₹20,000 — and it looks identical the day you take handover.',
  },
  {
    id: 'q-tandem',
    materialId: 'tandem',
    ask: 'A ply drawer costs a third as much. What do you lose?',
    choices: [
      { id: 'extension', label: 'The last 100mm of reach', correct: true, ifPicked: 'And the heavy pan lives in that last 100mm.' },
      { id: 'looks', label: 'Nothing — fronts are identical', correct: false, ifPicked: 'The fronts are identical. That is what makes the swap so easy.' },
      { id: 'softclose', label: 'The soft-close', correct: false, ifPicked: 'Side channels come with soft-close too. Extension is the difference.' },
    ],
    because: 'Undermount runners pull fully clear and carry 30–50kg. Side-mounted channels stop short and carry less.',
    stakes: '≈ ₹4,000 a drawer. Worth it in a kitchen, arguable in a bedroom.',
  },
  {
    id: 'q-ceiling',
    materialId: 'gypsum',
    ask: 'Which question tells you if a false ceiling stays flat?',
    choices: [
      { id: 'framing', label: 'What the framing is', correct: true, ifPicked: 'The grid holds the ceiling. The board just hangs on it.' },
      { id: 'board', label: 'Which brand of board', correct: false, ifPicked: 'The question the industry would rather you asked.' },
      { id: 'thickness', label: 'How thick the board is', correct: false, ifPicked: 'Near enough standard. Two ceilings off the same board age years apart.' },
    ],
    because: 'Galvanised sections at the right spacing hold flat for decades. Widen the spacing and it sags along the joints.',
    stakes: '≈ ₹50 a square foot — and no quote here writes it down.',
  },
  {
    id: 'q-conduit',
    materialId: 'conduit',
    ask: '“Concealed conduit” or “concealed wiring” — is there a difference?',
    choices: [
      { id: 'replaceable', label: 'Conduit can be re-pulled', correct: true, ifPicked: 'The pipe is the point, not the hiding.' },
      { id: 'safety', label: 'Conduit is safer in fire', correct: false, ifPicked: 'Both sit in masonry. The difference shows the day you change something.' },
      { id: 'same', label: 'They are the same', correct: false, ifPicked: 'They sound identical. Cable can be chased straight into plaster.' },
    ],
    because: 'Cable in a pipe can be drawn out and replaced. Cable buried in plaster cannot — every later change is a chiselling job.',
    stakes: '≈ ₹10,000 — the least visible line, the most expensive to undo.',
  },
];

/**
 * Pick a question the customer has not been asked yet.
 *
 * Deterministic given `seen` and `seed`, so React re-renders do not shuffle the
 * question out from under somebody mid-read. `seed` is normally the studio
 * name — different studio, different question, same question on a remount.
 *
 * Once every question has been seen the set starts again, which is right:
 * somebody pricing an eighth studio has earned a repeat, and the alternative is
 * a blank space.
 */
export function pickQuestion(seed: string, seen: readonly string[] = []): Question {
  const unseen = QUESTIONS.filter((q) => !seen.includes(q.id));
  const pool = unseen.length > 0 ? unseen : QUESTIONS;

  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return pool[Math.abs(hash) % pool.length]!;
}

/** The glossary entry a question teaches. */
export function questionMaterial(q: Question): Material {
  const m = material(q.materialId);
  // A question naming a material that does not exist is a build-time mistake,
  // and the test suite asserts it cannot happen. This keeps the type honest.
  if (!m) throw new Error(`Question ${q.id} references unknown material ${q.materialId}`);
  return m;
}

export const MATERIAL_COUNT = MATERIALS.length;
