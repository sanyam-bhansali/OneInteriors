/**
 * What the customer is actually buying.
 *
 * ## Why this module exists
 *
 * The comparison screen tells the reader to look at the materials before the
 * totals. That instruction is worthless to almost everybody who receives it,
 * because "18mm BWP carcass · laminate shutter · soft-close hinges" is a
 * sentence in a language they do not speak. Telling somebody to read the
 * evidence and then handing them evidence they cannot read is the same failure
 * as not showing it at all, dressed up as transparency.
 *
 * So: one body of real, checkable material knowledge, written once and used
 * everywhere a spec string appears — tapped in the comparison table, asked as
 * a question during the ten seconds a quote is being built, and quoted back to
 * the architect before the call.
 *
 * ## The rule every entry obeys
 *
 * Each term says what it is, **where it actually matters**, and — this is the
 * load-bearing field — what the cheaper alternative saves and what it costs
 * you. A glossary that only defines terms teaches vocabulary. A glossary that
 * says "BWR instead of BWP saves about ₹9,000 across a 2 BHK and fails under
 * the sink" teaches somebody to read a quotation, which is the entire point.
 *
 * `cheaperCosts` is therefore not optional. If a downgrade has no real
 * consequence, the honest thing is to say so in that field — see `mm18`, where
 * the answer is that 16mm is fine and the industry pretends otherwise.
 *
 * ## Accuracy
 *
 * These are ordinary trade facts, not marketing. The IS numbers, the hinge
 * cycle ratings and the board grades are checkable, and they are written here
 * so that a studio reading this page cannot say we misdescribed their work.
 * The rupee figures are order-of-magnitude for a Pune 2 BHK and are labelled
 * as such in `cheaperSaves` rather than presented as quotations.
 *
 * ## Why no `server-only`
 *
 * Per CONTRIBUTING §9.5 — this is pure data and pure functions, imported by
 * client components and by tests. Nothing here touches a request.
 */

/** Where a term is worth arguing about, in the customer's own rooms. */
export type Room = 'kitchen' | 'wardrobe' | 'bathroom' | 'living' | 'everywhere';

export interface Material {
  /** Stable key. Used by the quiz and by stored answers. */
  id: string;
  /** How it is written on screen when there is room. */
  name: string;
  /**
   * Every way this appears in a spec string, longest first is NOT required —
   * `findTerms` sorts. Matching is case-insensitive and word-bounded.
   */
  aliases: string[];
  /** One sentence. What the thing is. */
  what: string;
  /** Where it changes the outcome. Not everywhere — that would be useless. */
  matters: string;
  rooms: Room[];
  /** The standard, where one exists and is worth citing. */
  standard: string | null;
  /** What gets substituted when a quote is being sharpened. */
  cheaperAlt: string | null;
  /** Order of magnitude on a Pune 2 BHK. Always hedged, never a quotation. */
  cheaperSaves: string | null;
  /**
   * What the substitution actually costs you — or, honestly, that it costs
   * you nothing. Never left vague to make the expensive option look better.
   */
  cheaperCosts: string;
}

export const MATERIALS: Material[] = [
  {
    id: 'bwp',
    name: 'BWP ply',
    aliases: ['BWP', 'boiling water proof', 'marine ply', 'marine-ply', 'marine grade'],
    what: 'Plywood bonded with phenol-formaldehyde resin, which does not let go when it is wet for a long time.',
    matters:
      'Anything standing on a floor that gets mopped, or under a sink. A kitchen base carcass is wet at the bottom edge for years, not minutes.',
    rooms: ['kitchen', 'bathroom'],
    standard: 'IS 710',
    cheaperAlt: 'BWR ply',
    cheaperSaves: 'roughly ₹8,000–10,000 across a 2 BHK kitchen',
    cheaperCosts:
      'BWR handles steam and splashes. It does not handle standing water. Under the sink and along the bottom rail is exactly where it goes, and it goes quietly — you find out in year four.',
  },
  {
    id: 'bwr',
    name: 'BWR ply',
    aliases: ['BWR', 'boiling water resistant', 'MR grade', 'MR ply'],
    what: 'Plywood rated to survive humidity and splashing, but not prolonged soaking.',
    matters:
      'Perfectly correct for wardrobes, TV units and anything in a dry room. It is only a downgrade when it turns up in a kitchen base or a bathroom.',
    rooms: ['wardrobe', 'living'],
    standard: 'IS 303',
    cheaperAlt: null,
    cheaperSaves: null,
    cheaperCosts:
      'Nothing, in a dry room. Paying for BWP in a bedroom wardrobe is money spent on a problem that room does not have.',
  },
  {
    id: 'mdf',
    name: 'MDF',
    aliases: ['MDF', 'HDF', 'MDF-MR', 'fibreboard', 'fiberboard'],
    what: 'Wood fibre pressed with resin into a board with no grain — flat, dense and completely uniform.',
    matters:
      'The right choice for a routed or lacquered shutter, because it has no grain to telegraph through paint. The wrong choice for a carcass that carries weight on screws.',
    rooms: ['living', 'wardrobe'],
    standard: 'IS 12406',
    cheaperAlt: null,
    cheaperSaves: null,
    cheaperCosts:
      'Screws pull out of MDF under sustained load, and once it takes on water it swells and never comes back. In a shutter, fine. In a base unit, not.',
  },
  {
    id: 'particle',
    name: 'Particle board',
    aliases: ['particle board', 'particleboard', 'chipboard', 'pre-laminated board'],
    what: 'Wood chips and glue. The cheapest panel in the trade.',
    matters:
      'It is what flat-pack furniture is made of, and it behaves like flat-pack furniture: fine standing still, poor under load, finished the moment it gets wet.',
    rooms: ['everywhere'],
    standard: 'IS 3087',
    // This entry is written from the other end: particle board IS the
    // substitution, so there is nothing cheaper to name. The figure belongs in
    // what it costs you, not in a saving.
    cheaperAlt: null,
    cheaperSaves: null,
    cheaperCosts:
      'It comes in at roughly half the cost of BWR ply, and it buys you sagging shelves within a couple of years and no second life — it cannot be re-screwed. If a quote is startlingly cheap and the board is not named, this is usually why.',
  },
  {
    id: 'mm18',
    name: '18mm carcass',
    aliases: ['18mm', '18 mm'],
    what: 'The thickness of the boxes themselves — the sides, the base and the shelves.',
    matters:
      'Shelf sag is a thickness problem before it is a material problem. A long 18mm shelf carrying crockery is at the edge of what it can do; a 16mm one is past it.',
    rooms: ['everywhere'],
    standard: null,
    cheaperAlt: '16mm carcass, or a 6mm back panel instead of 12mm',
    cheaperSaves: 'roughly ₹12,000–18,000 across a 2 BHK',
    cheaperCosts:
      'Honestly: 16mm is structurally fine for wardrobe shutters and short shelves, and anyone telling you otherwise is selling board. The one that matters is the back panel — a 6mm back is what makes a unit rack out of square when you push on it.',
  },
  {
    id: 'laminate',
    name: 'Laminate',
    aliases: ['laminate', 'lamination', '1mm laminate', '0.8mm laminate', 'HPL'],
    what: 'The printed, resin-saturated sheet bonded to the outside of the board. Usually 0.8mm or 1mm.',
    matters:
      'Thickness is about abrasion, not looks — the two are identical on day one. 1mm belongs anywhere a hand or a pan lands; 0.8mm is entirely adequate on a vertical face nobody touches.',
    rooms: ['kitchen', 'everywhere'],
    standard: 'IS 2046',
    cheaperAlt: '0.8mm throughout',
    cheaperSaves: 'roughly ₹6,000–9,000 across a 2 BHK',
    cheaperCosts:
      'On wardrobe sides and shutter faces, nothing at all. On a kitchen counter face or a frequently opened shutter edge, it wears through to the dark core and there is no repairing that.',
  },
  {
    id: 'edgeband',
    name: 'Edge banding',
    aliases: ['edge band', 'edge-band', 'edge banding', 'edgeband', 'beading'],
    what: 'The PVC strip that seals the raw cut edge of a board, in 0.8mm or 2mm.',
    matters:
      'It is the first thing to fail on a cheap job and the first place water gets into a board. Every exposed edge in a kitchen should be 2mm.',
    rooms: ['kitchen', 'everywhere'],
    standard: null,
    cheaperAlt: '0.8mm banding, or banding only on visible edges',
    cheaperSaves: 'a few thousand rupees — it is a small line',
    cheaperCosts:
      'Thin banding chips at the corner where your thumb opens the shutter, and an unbanded internal edge in a kitchen is a raw board edge sitting in steam. Small money, disproportionate consequence.',
  },
  {
    id: 'softclose',
    name: 'Soft-close hinge',
    aliases: ['soft-close', 'soft close', 'softclose', 'hinge', 'hinges'],
    what: 'A hinge with a damper in it, rated by how many open-and-shut cycles it is guaranteed for — typically 25,000, 50,000 or 80,000.',
    matters:
      'The words "soft-close" are on every quote in this city and mean nothing on their own. The rating and the brand are the specification; the phrase is not.',
    rooms: ['kitchen', 'wardrobe'],
    standard: null,
    cheaperAlt: 'unbranded soft-close at 25,000 cycles',
    cheaperSaves: 'roughly ₹10,000–15,000 across a 2 BHK',
    cheaperCosts:
      'A kitchen shutter is opened perhaps ten times a day. 25,000 cycles is about seven years; 80,000 is longer than you will keep the kitchen. When the damper goes it slams, and replacing hinges behind fitted shutters is a joiner-day, not a spare part.',
  },
  {
    id: 'tandem',
    name: 'Tandem box',
    aliases: ['tandem box', 'tandem', 'tandem box set', 'drawer box', 'undermount'],
    what: 'A ready-made metal drawer whose runners sit underneath and pull all the way out, load-rated at 30kg or 50kg.',
    matters:
      'The alternative is a plywood drawer on a side-mounted telescopic channel. It costs a third as much, holds less, and stops about 100mm short of fully open — which is where the heavy pan always is.',
    rooms: ['kitchen'],
    standard: null,
    cheaperAlt: 'ply drawer on telescopic channels',
    cheaperSaves: 'roughly ₹3,500–5,000 per drawer',
    cheaperCosts:
      'You reach into the back of the drawer for the rest of your life. Worth paying for in a kitchen, genuinely arguable in a bedroom.',
  },
  {
    id: 'hydraulic',
    name: 'Hydraulic storage',
    aliases: ['hydraulic', 'hydraulic storage', 'gas lift', 'gas-lift'],
    what: 'Gas struts that hold a bed base up while you get at the storage underneath.',
    matters:
      'Rated by the strut, and the rating has to suit the mattress. Struts sized for a 12kg foam mattress under a 35kg spring one will not hold it up, and it comes down on your arm.',
    rooms: ['everywhere'],
    standard: null,
    cheaperAlt: 'a lift-up base with no struts',
    cheaperSaves: 'roughly ₹4,000–6,000 per bed',
    cheaperCosts:
      'You need two people to open it, so in practice nobody opens it and the storage you paid for goes unused.',
  },
  {
    id: 'gypsum',
    name: 'Gypsum false ceiling',
    aliases: ['gypsum', 'false ceiling', 'cove', 'POP'],
    what: 'Gypsum board screwed to a suspended metal grid, usually with a cove around the edge for concealed light.',
    matters:
      'The board is never the question — the grid is. Galvanised iron sections at the right spacing hold a flat ceiling for decades; the cheap version sags visibly along the joints.',
    rooms: ['living'],
    standard: null,
    cheaperAlt: 'wider frame spacing, or plaster-of-Paris instead of board',
    cheaperSaves: 'roughly ₹40–60 per square foot of ceiling',
    cheaperCosts:
      'Cracks at the joints within two or three monsoons, and POP cannot be opened up again if something above it needs reaching. Ask what the framing is, not what the board is.',
  },
  {
    id: 'powdercoat',
    name: 'Powder-coated MS',
    aliases: ['powder-coated', 'powder coated', 'MS frame', 'mild steel'],
    what: 'Mild steel with a dry polymer coat baked on, rather than wet paint.',
    matters:
      'Pune has four months of monsoon. A powder coat is a sealed skin; enamel paint on mild steel is a decorative layer over something that rusts underneath it.',
    rooms: ['everywhere'],
    standard: null,
    cheaperAlt: 'enamel paint over primer',
    cheaperSaves: 'roughly ₹2,000–4,000 on a safety door or mesh shutter',
    cheaperCosts:
      'Rust bleed at the welds after two monsoons, and it is on the outside of your front door where everybody sees it.',
  },
  {
    id: 'mirror',
    name: 'Bevelled mirror',
    aliases: ['bevelled mirror', 'beveled mirror', 'bevelled', '5mm bevelled'],
    what: 'Mirror with the edge ground back at an angle, usually 5mm glass.',
    matters:
      'The bevel is not decoration — grinding the edge is what stops it chipping, and a chipped mirror edge starts a crack.',
    rooms: ['bathroom'],
    standard: null,
    cheaperAlt: '4mm mirror with a plain cut edge',
    cheaperSaves: 'roughly ₹1,500–3,000',
    cheaperCosts:
      'Thin mirror shows a slight waviness in the reflection, and an unground edge in a bathroom will chip the first time something knocks it.',
  },
  {
    id: 'primer',
    name: 'Putty, primer, two coats',
    aliases: ['putty', 'primer', 'two coats', 'emulsion', 'two coats emulsion'],
    what: 'The full paint system — filler, a bonding coat, then two coats of the colour.',
    matters:
      'The primer is the layer that makes the emulsion stick and stops the wall drinking it. It is also invisible once the job is done, which is precisely why it is the layer that gets skipped.',
    rooms: ['everywhere'],
    standard: null,
    cheaperAlt: 'skip the primer, or one coat instead of two',
    cheaperSaves: 'roughly ₹15,000–25,000 across a 2 BHK',
    cheaperCosts:
      'Patchy coverage that shows in daylight from certain angles, and paint that comes away with the tape the next time anything is stuck to the wall. It looks identical on handover day. That is the problem with it.',
  },
  {
    id: 'conduit',
    name: 'Concealed conduit',
    aliases: ['concealed conduit', 'conduit', 'modular switches', 'modular switch'],
    what: 'Wiring run inside a pipe chased into the wall, terminating in a modular switch plate.',
    matters:
      'Conduit means the cable can be pulled and replaced later without breaking the wall open. Cable buried directly in plaster cannot.',
    rooms: ['everywhere'],
    standard: 'IS 732',
    cheaperAlt: 'cable chased directly into the plaster',
    cheaperSaves: 'roughly ₹8,000–12,000 across a 2 BHK',
    cheaperCosts:
      'Any future change — an extra point, a failed run, moving a switch — becomes a chiselling job across a finished wall. It is the least visible thing in the whole quote and the most expensive one to undo.',
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
