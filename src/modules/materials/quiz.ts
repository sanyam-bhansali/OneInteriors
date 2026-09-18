/**
 * One question, asked while a quote is being built.
 *
 * ## Why a question and not a fact
 *
 * The ten seconds a quote takes are the best attention this product will ever
 * get: the customer asked for something, they want it, and they cannot do
 * anything else until it arrives. Filling that with a rotating fact is
 * wallpaper — read, forgotten before the quote lands.
 *
 * A question is different, because answering commits you. Having guessed BWR
 * and been told it was BWP, you now own the distinction, and forty seconds
 * later a line in your quotation says `18mm BWP carcass` and it means
 * something. That is the whole design: the quiz exists to make the document
 * that follows it readable.
 *
 * ## The rules the questions obey
 *
 * - **Never about taste.** No "which finish is nicer". There is a correct
 *   answer and it is a fact about how a material behaves.
 * - **Never a trick.** The wrong answers are the things a reasonable person
 *   would actually choose, not nonsense.
 * - **Getting it wrong has to be interesting.** Every question's explanation
 *   is worth reading even if you got it right, and the wrong option always has
 *   a real argument for it — often it is the right answer somewhere else in
 *   the flat.
 * - **Never about the customer's budget or taste.** The jokes on this screen
 *   are at the industry's expense; so is this.
 *
 * ## One per quote, and never the same one twice
 *
 * `pickQuestion` takes the ids already seen. Somebody pricing four studios
 * gets four different questions, which is the difference between a feature and
 * an irritation.
 */

import { MATERIALS, material, type Material } from './glossary';

export interface Choice {
  id: string;
  /** What the option says. Short — this is read under mild impatience. */
  label: string;
  correct: boolean;
  /**
   * Why this one is wrong, and where it would have been right. Shown only for
   * the option the customer actually picked, so a wrong answer gets a specific
   * reply rather than a generic one.
   */
  ifPicked: string;
}

export interface Question {
  id: string;
  /** The glossary entry this teaches. The answer panel links onward to it. */
  materialId: string;
  /** The situation. Concrete, in their flat, never abstract. */
  scenario: string;
  /** The question itself. */
  ask: string;
  choices: Choice[];
  /** The real reason, shown however they answered. */
  because: string;
  /** What the cheaper choice costs, in money. Drawn from the glossary. */
  stakes: string;
}

export const QUESTIONS: Question[] = [
  {
    id: 'q-kitchen-board',
    materialId: 'bwp',
    scenario:
      'Your kitchen base units sit on a floor that gets mopped every day, and one of them is under the sink.',
    ask: 'Which board should the carcass be?',
    choices: [
      {
        id: 'mdf',
        label: 'MDF — the flattest, smoothest board',
        correct: false,
        ifPicked:
          'MDF is genuinely the best board in the flat — for a lacquered shutter, where its lack of grain is the point. In a base unit it holds screws poorly and swells permanently once water reaches it.',
      },
      {
        id: 'bwr',
        label: 'BWR — boiling water RESISTANT',
        correct: false,
        ifPicked:
          'Close, and the right answer for every wardrobe in the flat. BWR is rated for humidity and splashing. Under a sink it is sitting in water, which is a different test.',
      },
      {
        id: 'bwp',
        label: 'BWP — boiling water PROOF',
        correct: true,
        ifPicked: 'Right — and the one word between the two grades is the whole specification.',
      },
    ],
    because:
      'BWR survives steam. BWP survives standing water. A kitchen base is wet along its bottom edge for years, so the two grades behave identically for about four years and then stop.',
    stakes:
      'BWR instead of BWP saves roughly ₹8,000–10,000 across a 2 BHK kitchen. It is the most commonly downgraded line in this city.',
  },
  {
    id: 'q-softclose',
    materialId: 'softclose',
    scenario:
      'Two quotes both say “soft-close hinges” on every kitchen shutter, and one is ₹14,000 cheaper.',
    ask: 'What actually tells the two apart?',
    choices: [
      {
        id: 'cycles',
        label: 'The cycle rating — 25,000 vs 80,000',
        correct: true,
        ifPicked: 'Right. The phrase is not a specification; the number is.',
      },
      {
        id: 'feel',
        label: 'How soft the close feels on the day',
        correct: false,
        ifPicked:
          'A new 25,000-cycle hinge and a new 80,000-cycle hinge feel the same. That is exactly why the cheap one is easy to sell in a showroom.',
      },
      {
        id: 'nothing',
        label: 'Nothing — a soft-close hinge is a soft-close hinge',
        correct: false,
        ifPicked:
          'Reasonable, and wrong by a factor of three. Every hinge sold is rated for a number of open-and-shut cycles, and the range on sale in Pune runs from about 25,000 to about 80,000.',
      },
    ],
    because:
      'A kitchen shutter is opened around ten times a day. 25,000 cycles is roughly seven years; 80,000 is longer than you will keep the kitchen. When the damper fails the shutter slams, and the hinge is behind a fitted shutter.',
    stakes:
      'Unbranded hinges save roughly ₹10,000–15,000 across a 2 BHK — and it is a line almost no quotation in this market states a rating for.',
  },
  {
    id: 'q-laminate',
    materialId: 'laminate',
    scenario: 'A studio has quoted 1mm laminate throughout, and you are looking to save money.',
    ask: 'Where can you drop to 0.8mm without regretting it?',
    choices: [
      {
        id: 'wardrobe',
        label: 'Wardrobe sides and internal shelves',
        correct: true,
        ifPicked: 'Right — nothing abrades a wardrobe side. This is a real saving with no cost.',
      },
      {
        id: 'kitchen',
        label: 'Kitchen shutter faces',
        correct: false,
        ifPicked:
          'These are opened with wet hands, wiped daily, and caught by rings and pan handles. It is the one place the extra 0.2mm is doing visible work.',
      },
      {
        id: 'nowhere',
        label: 'Nowhere — always take the thicker one',
        correct: false,
        ifPicked:
          'A defensible instinct, but 1mm on the inside of a wardrobe is money buying nothing. Knowing where a downgrade is free is as useful as knowing where it is not.',
      },
    ],
    because:
      'Laminate thickness is about abrasion, not appearance — the two look identical on day one and for the first few years. It only matters where hands, pans and cleaning cloths land.',
    stakes:
      'Dropping to 0.8mm everywhere saves roughly ₹6,000–9,000 on a 2 BHK. Dropping it only where nothing touches saves most of that and costs nothing.',
  },
  {
    id: 'q-paint',
    materialId: 'primer',
    scenario:
      'Two painting quotes for the same flat are ₹22,000 apart, and both say “two coats emulsion”.',
    ask: 'What is most likely missing from the cheaper one?',
    choices: [
      {
        id: 'primer',
        label: 'The primer coat',
        correct: true,
        ifPicked:
          'Right — and it is invisible on handover day, which is precisely why it is the layer that goes.',
      },
      {
        id: 'brand',
        label: 'A cheaper brand of emulsion',
        correct: false,
        ifPicked:
          'Possible, and it would show up as a smaller gap. The brand is on the invoice; the primer is not, which makes the primer the easier thing to leave out.',
      },
      {
        id: 'labour',
        label: 'Fewer painters, so it takes longer',
        correct: false,
        ifPicked:
          'Painting is priced by area, not by day. A ₹22,000 gap on the same area is a materials gap, not a scheduling one.',
      },
    ],
    because:
      'Primer is the layer that bonds the emulsion and stops bare plaster drinking it. Without it the colour goes on looking correct and then shows patchy in raking daylight, and it lifts with any tape stuck to the wall.',
    stakes:
      'Skipping putty and primer saves roughly ₹15,000–25,000 across a 2 BHK, and the difference is not visible on the day you take handover.',
  },
  {
    id: 'q-tandem',
    materialId: 'tandem',
    scenario:
      'Your kitchen has six drawers. One quote has tandem boxes; the other has plywood drawers on telescopic channels.',
    ask: 'What do you actually lose with the cheaper drawer?',
    choices: [
      {
        id: 'extension',
        label: 'The last 100mm — it never opens fully',
        correct: true,
        ifPicked:
          'Right, and the heavy pan is always in that last 100mm. Side-mounted channels stop short; undermount runners do not.',
      },
      {
        id: 'looks',
        label: 'Nothing visible — the fronts are identical',
        correct: false,
        ifPicked:
          'The fronts are identical, which is why this substitution is so easy to make. What changes is behind the front: how far it comes out and how much it will carry.',
      },
      {
        id: 'softclose',
        label: 'The soft-close',
        correct: false,
        ifPicked:
          'Telescopic channels can be had with soft-close too. The difference is extension and load rating, not the damper.',
      },
    ],
    because:
      'A tandem box is a rated metal drawer on undermount runners — full extension, 30kg or 50kg. A ply drawer on side channels costs about a third as much, carries less, and stops short of fully open.',
    stakes:
      'Roughly ₹3,500–5,000 per drawer. Worth paying in a kitchen; genuinely arguable in a bedroom, where nobody is reaching past a stockpot.',
  },
  {
    id: 'q-ceiling',
    materialId: 'gypsum',
    scenario: 'You are comparing two false-ceiling lines for the same living room.',
    ask: 'Which question tells you which one will still be flat in five years?',
    choices: [
      {
        id: 'framing',
        label: 'What the framing is, and how far apart',
        correct: true,
        ifPicked: 'Right. The grid holds the ceiling. The board just hangs on it.',
      },
      {
        id: 'board',
        label: 'Which brand of gypsum board',
        correct: false,
        ifPicked:
          'Board brands barely differ, and the board is not what sags — the frame under it is. This is the question the industry would rather you asked.',
      },
      {
        id: 'thickness',
        label: 'How thick the board is',
        correct: false,
        ifPicked:
          'Board thickness is near enough standard. Two ceilings built from the same board can be five years apart in how they age, entirely because of the sections behind them.',
      },
    ],
    because:
      'Galvanised iron sections at the correct spacing hold a flat ceiling for decades. Widen the spacing to save material and it sags visibly along the joints — and plaster-of-Paris instead of board cannot be opened up again if something above it needs reaching.',
    stakes:
      'Wider framing saves roughly ₹40–60 per square foot of ceiling, and it is not a line any quotation in this market writes down.',
  },
  {
    id: 'q-conduit',
    materialId: 'conduit',
    scenario:
      'The electrical line on one quote says “concealed conduit”; the other just says “concealed wiring”.',
    ask: 'What is the difference worth?',
    choices: [
      {
        id: 'replaceable',
        label: 'Conduit means the cable can be pulled and replaced later',
        correct: true,
        ifPicked: 'Right — the pipe is the point, not the hiding.',
      },
      {
        id: 'safety',
        label: 'Conduit is safer in a fire',
        correct: false,
        ifPicked:
          'Not the main argument. Both are buried in masonry. The difference is what happens the day you want to change something.',
      },
      {
        id: 'same',
        label: 'They mean the same thing',
        correct: false,
        ifPicked:
          'They sound identical and are not. Cable can be concealed by chasing it straight into the plaster, with no pipe around it at all.',
      },
    ],
    because:
      'Cable inside a conduit can be drawn out and a new one drawn in. Cable buried directly in plaster cannot — every future change becomes a chiselling job across a finished wall.',
    stakes:
      'Chasing cable directly saves roughly ₹8,000–12,000 across a 2 BHK. It is the least visible thing in the whole quotation and the most expensive one to undo.',
  },
];

/**
 * Pick a question the customer has not been asked yet.
 *
 * Deterministic given `seen` and `seed`, so React re-renders do not shuffle
 * the question out from under somebody mid-read. `seed` is normally the studio
 * slug — different studio, different question, same question on a remount.
 *
 * Once every question has been seen the set starts again, which is the right
 * behaviour: somebody pricing an eighth studio has earned a repeat, and the
 * alternative is a blank space.
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

/** The glossary entry a question teaches, for the "read more" line. */
export function questionMaterial(q: Question): Material {
  const m = material(q.materialId);
  // A question naming a material that does not exist is a build-time mistake,
  // and the test suite asserts it cannot happen. This keeps the type honest.
  if (!m) throw new Error(`Question ${q.id} references unknown material ${q.materialId}`);
  return m;
}

/** Every material the quiz covers — asserted against MATERIALS in tests. */
export const QUIZ_MATERIAL_IDS = QUESTIONS.map((q) => q.materialId);

export const MATERIAL_COUNT = MATERIALS.length;
