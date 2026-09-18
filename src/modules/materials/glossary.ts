/**
 * What the customer is actually buying — as cards, not as prose.
 *
 * ## Why this module exists
 *
 * The comparison screen tells the reader to look at the materials before the
 * totals. That instruction is worthless to almost everybody who receives it,
 * because "18mm BWP carcass · laminate shutter · soft-close hinges" is a
 * sentence in a language they do not speak.
 *
 * ## Why it is shaped like this and not like paragraphs
 *
 * The first version of this file answered that with three paragraphs per term,
 * which solved the comprehension problem by creating a worse one. Somebody
 * buying their first home is excited, slightly nervous, and on a phone. They
 * are not revising. Handing them an essay at the moment they are enjoying
 * themselves is its own kind of failure — they stop reading, and a glossary
 * nobody reads teaches nothing at all.
 *
 * So every entry is built as **a card you can take in at a glance**:
 *
 * - `tagline` — what it is, in about seven words.
 * - `good` / `bad` — the two sides, five words a side. This is the whole
 *   lesson. "Survives standing water" against "Survives steam only" does more
 *   than the paragraph it replaced.
 * - `money` — one mono figure. What the downgrade saves, or what it costs.
 * - `art` — the key into the drawings. A cross-section with a water line at
 *   the bottom teaches BWP faster than any sentence can.
 *
 * `detail` still holds the full explanation, because somebody who wants it
 * deserves it — but it sits behind a disclosure nobody has to open, and
 * nothing in the product renders it by default.
 *
 * The test suite enforces the lengths. Prose creeping back into the card
 * fields is the exact regression this shape exists to prevent.
 *
 * ## Accuracy
 *
 * These are ordinary trade facts, not marketing. The IS numbers, the hinge
 * cycle ratings and the board grades are checkable. The rupee figures are
 * order-of-magnitude for a Pune 2 BHK and are always hedged.
 *
 * ## Why no `server-only`
 *
 * Per CONTRIBUTING §9.5 — pure data and pure functions, imported by client
 * components and by tests.
 */

/** Where a term is worth arguing about, in the customer's own rooms. */
export type Room = 'kitchen' | 'wardrobe' | 'bathroom' | 'living' | 'everywhere';

export interface Material {
  /** Stable key. Used by the quiz, the drawings and stored answers. */
  id: string;
  /** How it is written on screen. */
  name: string;
  /**
   * Every way this appears in a spec string. `findTerms` sorts by length, so
   * the order here does not matter. Matching is case-insensitive, word-bounded.
   */
  aliases: string[];
  /** What it is. About seven words. Tested for length. */
  tagline: string;
  /** The better side of the comparison. Five words. */
  good: string;
  /** The worse side. Five words. This pair IS the lesson. */
  bad: string;
  /** One mono figure — what the downgrade moves. Always hedged. */
  money: string;
  /** What the money line means: a saving, or what it costs you. */
  moneyIs: 'saves' | 'costs';
  /** Which drawing to show. See MaterialArt. */
  art: string;
  /** Where it changes the outcome. */
  rooms: Room[];
  /** The standard, where one exists and is worth citing. */
  standard: string | null;
  /**
   * The full explanation, for somebody who opens it. Never rendered by
   * default, and never the first thing anybody sees.
   */
  detail: string;
}

export const MATERIALS: Material[] = [
  {
    id: 'bwp',
    name: 'BWP ply',
    aliases: ['BWP', 'boiling water proof', 'marine ply', 'marine-ply', 'marine grade'],
    tagline: 'Marine-grade board. Does not mind water.',
    good: 'Survives standing water',
    bad: 'BWR: survives steam only',
    money: '≈ ₹9,000',
    moneyIs: 'saves',
    art: 'board-water',
    rooms: ['kitchen', 'bathroom'],
    standard: 'IS 710',
    detail:
      'Plywood bonded with phenol-formaldehyde resin, which does not let go when it is wet for a long time. A kitchen base carcass is wet along its bottom edge for years, not minutes — so BWP and BWR behave identically for about four years and then stop. It is the most commonly downgraded line in this city, and it goes quietly: you find out in year four, under the sink.',
  },
  {
    id: 'bwr',
    name: 'BWR ply',
    aliases: ['BWR', 'boiling water resistant', 'MR grade', 'MR ply'],
    tagline: 'The everyday board. Right in dry rooms.',
    good: 'Correct for every wardrobe',
    bad: 'Wrong under a sink',
    money: 'No penalty',
    moneyIs: 'costs',
    art: 'board-dry',
    rooms: ['wardrobe', 'living'],
    standard: 'IS 303',
    detail:
      'Plywood rated to survive humidity and splashing, but not prolonged soaking. Perfectly correct for wardrobes, TV units and anything in a dry room — it is only a downgrade when it turns up in a kitchen base or a bathroom. Paying for BWP in a bedroom wardrobe is money spent on a problem that room does not have.',
  },
  {
    id: 'mdf',
    name: 'MDF',
    aliases: ['MDF', 'HDF', 'MDF-MR', 'fibreboard', 'fiberboard'],
    tagline: 'No grain at all. Perfect under paint.',
    good: 'Best for lacquered shutters',
    bad: 'Screws pull out under load',
    money: 'Depends where',
    moneyIs: 'costs',
    art: 'grain',
    rooms: ['living', 'wardrobe'],
    standard: 'IS 12406',
    detail:
      'Wood fibre pressed with resin into a board with no grain — flat, dense and completely uniform. The right choice for a routed or lacquered shutter, because there is no grain to telegraph through the paint. The wrong choice for a carcass: screws pull out of it under sustained load, and once it takes on water it swells and never comes back.',
  },
  {
    id: 'particle',
    name: 'Particle board',
    aliases: ['particle board', 'particleboard', 'chipboard', 'pre-laminated board'],
    tagline: 'Chips and glue. The cheapest panel made.',
    good: 'Fine standing still',
    bad: 'Sags, and cannot be re-screwed',
    money: 'Half of ply',
    moneyIs: 'saves',
    art: 'chips',
    rooms: ['everywhere'],
    standard: 'IS 3087',
    detail:
      'Wood chips and glue — what flat-pack furniture is made of, and it behaves like flat-pack furniture: fine standing still, poor under load, finished the moment it gets wet. Shelves sag within a couple of years and there is no second life, because it cannot be re-screwed. If a quote is startlingly cheap and the board is not named, this is usually why.',
  },
  {
    id: 'mm18',
    name: '18mm carcass',
    aliases: ['18mm', '18 mm'],
    tagline: 'Board thickness. Decides whether shelves sag.',
    good: '18mm holds a long shelf',
    bad: '16mm is honestly fine',
    money: '≈ ₹15,000',
    moneyIs: 'saves',
    art: 'shelf-sag',
    rooms: ['everywhere'],
    standard: null,
    detail:
      'The thickness of the boxes themselves — sides, base and shelves. Shelf sag is a thickness problem before it is a material problem: a long 18mm shelf carrying crockery is at the edge of what it can do, and a 16mm one is past it. Honestly, though, 16mm is structurally fine for wardrobe shutters and short shelves, and anyone telling you otherwise is selling board. The one that really matters is the back panel — a 6mm back is what makes a unit rack out of square when you push on it.',
  },
  {
    id: 'laminate',
    name: 'Laminate',
    aliases: ['laminate', 'lamination', '1mm laminate', '0.8mm laminate', 'HPL'],
    tagline: 'The outer skin. 0.8mm or 1mm.',
    good: '1mm where hands land',
    bad: 'Thin wears to dark core',
    money: '≈ ₹7,000',
    moneyIs: 'saves',
    art: 'laminate-edge',
    rooms: ['kitchen', 'everywhere'],
    standard: 'IS 2046',
    detail:
      'The printed, resin-saturated sheet bonded to the outside of the board. Thickness is about abrasion, not looks — the two are identical on day one and for the first few years. 1mm belongs anywhere a hand or a pan lands; 0.8mm is entirely adequate on a vertical face nobody touches, so dropping it on wardrobe sides costs nothing. On a kitchen counter face it wears through to the dark core, and there is no repairing that.',
  },
  {
    id: 'edgeband',
    name: 'Edge banding',
    aliases: ['edge band', 'edge-band', 'edge banding', 'edgeband', 'beading'],
    tagline: 'The strip sealing every raw cut edge.',
    good: '2mm survives your thumb',
    bad: 'Thin chips at the corner',
    money: 'A few thousand',
    moneyIs: 'saves',
    art: 'edge-chip',
    rooms: ['kitchen', 'everywhere'],
    standard: null,
    detail:
      'The PVC strip that seals the raw cut edge of a board, in 0.8mm or 2mm. It is the first thing to fail on a cheap job and the first place water gets into a board, so every exposed edge in a kitchen should be 2mm. Thin banding chips at the corner where your thumb opens the shutter, and an unbanded internal edge in a kitchen is raw board sitting in steam. Small money, disproportionate consequence.',
  },
  {
    id: 'softclose',
    name: 'Soft-close hinge',
    aliases: ['soft-close', 'soft close', 'softclose', 'hinge', 'hinges'],
    tagline: 'Everyone writes it. The rating is the spec.',
    good: '80,000 cycles: outlasts the kitchen',
    bad: '25,000 cycles: seven years',
    money: '≈ ₹12,000',
    moneyIs: 'saves',
    art: 'cycles',
    rooms: ['kitchen', 'wardrobe'],
    standard: null,
    detail:
      'A hinge with a damper in it, rated by how many open-and-shut cycles it is guaranteed for — typically 25,000, 50,000 or 80,000. The words "soft-close" are on every quote in this city and mean nothing on their own. A kitchen shutter is opened around ten times a day, so 25,000 cycles is roughly seven years. When the damper goes it slams, and replacing hinges behind fitted shutters is a joiner-day, not a spare part.',
  },
  {
    id: 'tandem',
    name: 'Tandem box',
    aliases: ['tandem box', 'tandem', 'tandem box set', 'drawer box', 'undermount'],
    tagline: 'A rated metal drawer on hidden runners.',
    good: 'Opens all the way out',
    bad: 'Ply drawer stops 100mm short',
    money: '≈ ₹4,000 a drawer',
    moneyIs: 'saves',
    art: 'drawer',
    rooms: ['kitchen'],
    standard: null,
    detail:
      'A ready-made metal drawer whose runners sit underneath and pull all the way out, load-rated at 30kg or 50kg. The alternative is a plywood drawer on side-mounted telescopic channels: a third of the cost, holds less, and stops about 100mm short of fully open — which is where the heavy pan always is. Worth paying for in a kitchen, genuinely arguable in a bedroom.',
  },
  {
    id: 'hydraulic',
    name: 'Hydraulic storage',
    aliases: ['hydraulic', 'hydraulic storage', 'gas lift', 'gas-lift'],
    tagline: 'Gas struts holding the bed base up.',
    good: 'One hand opens it',
    bad: 'Unrated struts need two people',
    money: '≈ ₹5,000 a bed',
    moneyIs: 'saves',
    art: 'strut',
    rooms: ['everywhere'],
    standard: null,
    detail:
      'Gas struts that hold a bed base up while you get at the storage underneath. Rated by the strut, and the rating has to suit the mattress — struts sized for a 12kg foam mattress under a 35kg spring one will not hold it up, and it comes down on your arm. Without them you need two people, so in practice nobody opens it and the storage you paid for goes unused.',
  },
  {
    id: 'gypsum',
    name: 'False ceiling',
    aliases: ['gypsum', 'false ceiling', 'cove', 'POP'],
    tagline: 'Board on a metal grid, with a cove.',
    good: 'Close framing stays flat',
    bad: 'Wide framing cracks at joints',
    money: '≈ ₹50 a sq ft',
    moneyIs: 'saves',
    art: 'ceiling-grid',
    rooms: ['living'],
    standard: null,
    detail:
      'Gypsum board screwed to a suspended metal grid, usually with a cove around the edge for concealed light. The board is never the question — the grid is. Galvanised iron sections at the right spacing hold a flat ceiling for decades; widen the spacing to save material and it sags visibly along the joints within two or three monsoons. Ask what the framing is, not what the board is.',
  },
  {
    id: 'powdercoat',
    name: 'Powder coating',
    aliases: ['powder-coated', 'powder coated', 'MS frame', 'mild steel'],
    tagline: 'A baked skin on steel, not paint.',
    good: 'Sealed against four monsoons',
    bad: 'Enamel rusts at the welds',
    money: '≈ ₹3,000',
    moneyIs: 'saves',
    art: 'rust',
    rooms: ['everywhere'],
    standard: null,
    detail:
      'Mild steel with a dry polymer coat baked on, rather than wet paint. Pune has four months of monsoon: a powder coat is a sealed skin, while enamel on mild steel is a decorative layer over something that rusts underneath it. You get rust bleed at the welds after two monsoons, on the outside of your front door where everybody sees it.',
  },
  {
    id: 'mirror',
    name: 'Bevelled mirror',
    aliases: ['bevelled mirror', 'beveled mirror', 'bevelled', '5mm bevelled'],
    tagline: 'Ground edge on 5mm glass, not decoration.',
    good: 'Ground edge will not chip',
    bad: 'Raw edge starts a crack',
    money: '≈ ₹2,000',
    moneyIs: 'saves',
    art: 'bevel',
    rooms: ['bathroom'],
    standard: null,
    detail:
      'Mirror with the edge ground back at an angle, usually 5mm glass. The bevel is not decoration — grinding the edge is what stops it chipping, and a chipped mirror edge starts a crack. Thin 4mm mirror also shows a slight waviness in the reflection.',
  },
  {
    id: 'primer',
    name: 'Putty, primer, two coats',
    aliases: ['putty', 'primer', 'two coats', 'emulsion', 'two coats emulsion'],
    tagline: 'Four layers. One of them is invisible.',
    good: 'Primer makes emulsion stick',
    bad: 'Skipped: patchy in daylight',
    money: '≈ ₹20,000',
    moneyIs: 'saves',
    art: 'layers',
    rooms: ['everywhere'],
    standard: null,
    detail:
      'The full paint system — filler, a bonding coat, then two coats of the colour. Primer is the layer that makes the emulsion stick and stops the wall drinking it. It is also invisible once the job is done, which is precisely why it is the layer that gets skipped. You get patchy coverage that shows in raking daylight and paint that lifts with any tape stuck to the wall. It looks identical on handover day — that is the problem with it.',
  },
  {
    id: 'conduit',
    name: 'Concealed conduit',
    aliases: ['concealed conduit', 'conduit', 'modular switches', 'modular switch'],
    tagline: 'A pipe around the cable, inside the wall.',
    good: 'Cable can be replaced later',
    bad: 'Bare cable means chiselling',
    money: '≈ ₹10,000',
    moneyIs: 'saves',
    art: 'conduit',
    rooms: ['everywhere'],
    standard: 'IS 732',
    detail:
      'Wiring run inside a pipe chased into the wall, terminating in a modular switch plate. Conduit means the cable can be pulled and replaced later without breaking the wall open; cable buried directly in plaster cannot. Every future change — an extra point, a failed run, moving a switch — becomes a chiselling job across a finished wall. It is the least visible thing in the whole quote and the most expensive one to undo.',
  },
];

const BY_ID = new Map(MATERIALS.map((m) => [m.id, m]));

export function material(id: string): Material | undefined {
  return BY_ID.get(id);
}

// ── Finding terms inside a spec string ──────────────────────────

export interface FoundTerm {
  /** Index into the source string. */
  start: number;
  /** Exclusive. */
  end: number;
  /** The text exactly as it appeared, so we render the source and not the alias. */
  text: string;
  material: Material;
}

/**
 * Every alias, longest first.
 *
 * Order is the whole trick. "marine ply" must be tried before "ply" would be,
 * and "boiling water proof" before "boiling water resistant" could partially
 * match it. Sorting by length descending and then refusing overlaps gives
 * longest-match-wins without a parser.
 */
const ALIASES: { alias: string; lower: string; material: Material }[] = MATERIALS.flatMap((m) =>
  m.aliases.map((alias) => ({ alias, lower: alias.toLowerCase(), material: m })),
).sort((a, b) => b.lower.length - a.lower.length);

/** Letters and digits are word characters here; `-` and `.` are not, so
 *  "18mm" matches inside "18mm BWP" and "MR" does not match inside "MRP". */
function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && /[A-Za-z0-9]/.test(ch);
}

/**
 * Locate every known material term in a spec string.
 *
 * Returns non-overlapping matches in source order. A term that sits inside a
 * longer term already matched is dropped rather than nested, because the
 * renderer wraps each match in a button and nested buttons are invalid HTML
 * and unreachable by keyboard.
 *
 * Matching is case-insensitive and bounded on both sides by a non-word
 * character, so "ply" does not light up inside "supply" and "MR" does not
 * light up inside "MRP".
 */
export function findTerms(spec: string): FoundTerm[] {
  const found: FoundTerm[] = [];
  const taken: boolean[] = new Array(spec.length).fill(false);
  const haystack = spec.toLowerCase();

  for (const { lower, material: m } of ALIASES) {
    let from = 0;
    for (;;) {
      const at = haystack.indexOf(lower, from);
      if (at === -1) break;
      const end = at + lower.length;
      from = at + 1;

      // Word-bounded on both sides.
      if (isWordChar(spec[at - 1]) || isWordChar(spec[end])) continue;

      // Not overlapping something a longer alias already claimed.
      let clear = true;
      for (let i = at; i < end; i += 1) {
        if (taken[i]) {
          clear = false;
          break;
        }
      }
      if (!clear) continue;

      for (let i = at; i < end; i += 1) taken[i] = true;
      found.push({ start: at, end, text: spec.slice(at, end), material: m });
    }
  }

  return found.sort((a, b) => a.start - b.start);
}

/**
 * A spec string cut into pieces, ready to render.
 *
 * The renderer should not be doing index arithmetic, and two renderers doing
 * it slightly differently is how one of them ends up dropping a character.
 */
export type SpecPart =
  | { kind: 'text'; text: string }
  | { kind: 'term'; text: string; material: Material };

export function splitSpec(spec: string): SpecPart[] {
  /**
   * Only the first mention of each material is made tappable.
   *
   * "Putty · primer · two coats emulsion" matches the paint-system entry four
   * times, and four adjacent buttons all opening the same panel is not four
   * pieces of information — it is one piece of information and three
   * distractions. The later mentions render as ordinary text.
   */
  const seen = new Set<string>();
  const terms = findTerms(spec).filter((t) => {
    if (seen.has(t.material.id)) return false;
    seen.add(t.material.id);
    return true;
  });
  if (terms.length === 0) return [{ kind: 'text', text: spec }];

  const parts: SpecPart[] = [];
  let at = 0;
  for (const t of terms) {
    if (t.start > at) parts.push({ kind: 'text', text: spec.slice(at, t.start) });
    parts.push({ kind: 'term', text: t.text, material: t.material });
    at = t.end;
  }
  if (at < spec.length) parts.push({ kind: 'text', text: spec.slice(at) });
  return parts;
}
