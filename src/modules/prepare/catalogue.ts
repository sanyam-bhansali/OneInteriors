/**
 * The element catalogue — what a customer can put on their own board.
 *
 * ## Why a catalogue instead of an import
 *
 * The obvious version of this feature is "connect your Pinterest". We are not
 * doing that, and the reason is the same reason we are not building a 3D
 * planner: a board assembled from the open internet is a board of things you
 * cannot have. Pinterest cannot tell you what a board costs, and nobody's board
 * is filtered to their budget — so importing one imports the disappointment
 * rather than the taste.
 *
 * A curated library inverts that. Every element here carries a BAND, so the
 * customer composes freely and the composition is still honest: they are
 * choosing from things that exist at their price, in their city, and a board
 * that drifts above their band says so out loud instead of waiting for a
 * designer to break the news in month two.
 *
 * That is the one thing Pinterest structurally cannot do, and it is the whole
 * argument for building this ourselves.
 *
 * ## What a band means, precisely
 *
 * It is the budget tier at which this element is a NORMAL choice, not the
 * cheapest place it has ever appeared. `ESSENTIAL` means it fits a
 * budget-conscious Pune fit-out without special pleading; `LUXURY` means most
 * projects that use it are at the top band. An element above the customer's own
 * band is never hidden — hiding it would be a lie of omission, and people
 * notice when a catalogue seems thin. It is shown, and marked.
 *
 * ## What this is NOT
 *
 * Not a product catalogue, not a price list, and not a promise that any studio
 * stocks any of it. There are no SKUs, no brands and no rates here on purpose.
 * A studio quotes from its own rate card; this is vocabulary, so that a
 * customer and a designer can discover in ten minutes that they mean different
 * things by "warm".
 *
 * Pure and tested. No `server-only` — see CONTRIBUTING §9.5.
 */

import type { BudgetTier, StyleTag } from '@/modules/brief/types';

export const ELEMENT_CATEGORIES = [
  'surfaces',
  'joinery',
  'furniture',
  'lighting',
  'textiles',
  'walls',
] as const;

export type ElementCategory = (typeof ELEMENT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ElementCategory, string> = {
  surfaces: 'Floors & counters',
  joinery: 'Shutters & storage',
  furniture: 'Furniture',
  lighting: 'Lighting',
  textiles: 'Fabric & rugs',
  walls: 'Walls & ceiling',
};

/**
 * How a tile is drawn. Eight forms rather than forty-five bespoke drawings:
 * the catalogue is data, the drawing is a function of it, so adding an element
 * is one line here and nothing in the renderer.
 */
export type ElementForm =
  | 'surface'
  | 'shutter'
  | 'seat'
  | 'table'
  | 'light'
  | 'textile'
  | 'storage'
  | 'feature';

export interface Element {
  slug: string;
  label: string;
  category: ElementCategory;
  form: ElementForm;
  /** The band at which this is a normal choice. */
  band: BudgetTier;
  /** Styles this reads as. Empty means it is style-neutral and always offered. */
  styles: StyleTag[];
  /** Base, accent, line. Fixed hex — a teak is a teak in dark mode too. */
  colours: [string, string, string];
  /** The sentence that teaches something. Not marketing. */
  note: string;
}

/**
 * The catalogue.
 *
 * Written for Pune apartments specifically. Vitrified tile is the default floor
 * here and hardwood essentially does not happen, so the bands reflect that
 * rather than a European fit-out — a catalogue calibrated to the wrong city
 * would quietly mis-advise every customer who trusted it.
 */
export const ELEMENTS: Element[] = [
  // ── Surfaces ────────────────────────────────────────────────
  {
    slug: 'vitrified-large-format',
    label: 'Large-format vitrified tile',
    category: 'surfaces',
    form: 'surface',
    band: 'ESSENTIAL',
    styles: ['contemporary-minimal', 'warm-modern', 'scandinavian'],
    colours: ['#E4E0D8', '#CFC9BE', '#B4AFA6'],
    note: 'What most Pune flats already have. Fewer grout lines make a small room read larger.',
  },
  {
    slug: 'wood-look-tile',
    label: 'Wood-look tile',
    category: 'surfaces',
    form: 'surface',
    band: 'ESSENTIAL',
    styles: ['warm-modern', 'scandinavian', 'japandi', 'rustic-earthy'],
    colours: ['#C9A87C', '#A98455', '#8B6B44'],
    note: 'The warmth of timber with none of the monsoon problem. Honest, and very common here.',
  },
  {
    slug: 'engineered-wood-floor',
    label: 'Engineered wood floor',
    category: 'surfaces',
    form: 'surface',
    band: 'PREMIUM',
    styles: ['mid-century', 'japandi', 'warm-modern'],
    colours: ['#B98A55', '#96683C', '#6E4A28'],
    note: 'Real veneer over ply. Warmer underfoot than tile; needs care in an unairconditioned flat.',
  },
  {
    slug: 'italian-marble',
    label: 'Italian marble',
    category: 'surfaces',
    form: 'surface',
    band: 'LUXURY',
    styles: ['luxe-glam', 'classical-ornate', 'art-deco'],
    colours: ['#EDEAE4', '#D6D0C6', '#9B958A'],
    note: 'Beautiful and porous. Ask what the sealing schedule is before you commit.',
  },
  {
    slug: 'kota-stone',
    label: 'Kota stone',
    category: 'surfaces',
    form: 'surface',
    band: 'ESSENTIAL',
    styles: ['rustic-earthy', 'indian-contemporary', 'industrial'],
    colours: ['#8E9A8C', '#75816F', '#5A6455'],
    note: 'Local, cheap, cool underfoot, and back in fashion for exactly those reasons.',
  },
  {
    slug: 'granite-counter',
    label: 'Granite counter',
    category: 'surfaces',
    form: 'surface',
    band: 'ESSENTIAL',
    styles: [],
    colours: ['#3E3B38', '#2A2724', '#565250'],
    note: 'The default Indian kitchen counter, and genuinely hard to beat for durability.',
  },
  {
    slug: 'quartz-counter',
    label: 'Engineered quartz counter',
    category: 'surfaces',
    form: 'surface',
    band: 'PREMIUM',
    styles: ['contemporary-minimal', 'scandinavian', 'warm-modern'],
    colours: ['#EAE7E1', '#D3CFC7', '#A8A39A'],
    note: 'Non-porous, so no sealing. The pale ones show a cluttered counter more than granite does.',
  },
  {
    slug: 'terrazzo',
    label: 'Terrazzo',
    category: 'surfaces',
    form: 'surface',
    band: 'PREMIUM',
    styles: ['mid-century', 'indian-contemporary', 'contemporary-minimal'],
    colours: ['#E8E3D9', '#C4B9A6', '#8A8377'],
    note: 'Chips of stone in cement. Hides dust better than any plain floor you will be shown.',
  },

  // ── Joinery ─────────────────────────────────────────────────
  {
    slug: 'laminate-shutter',
    label: 'Laminate shutter',
    category: 'joinery',
    form: 'shutter',
    band: 'ESSENTIAL',
    styles: [],
    colours: ['#D8D2C6', '#B9B2A4', '#8E877A'],
    note: 'Enormous range, hard-wearing, and what most Pune kitchens actually use.',
  },
  {
    slug: 'acrylic-shutter',
    label: 'Acrylic shutter',
    category: 'joinery',
    form: 'shutter',
    band: 'PREMIUM',
    styles: ['contemporary-minimal', 'luxe-glam'],
    colours: ['#F0EEEA', '#DCD8D2', '#B0ABA3'],
    note: 'The high-gloss look. Shows every fingerprint — people love it or regret it within a month.',
  },
  {
    slug: 'matte-pu-shutter',
    label: 'Matte PU shutter',
    category: 'joinery',
    form: 'shutter',
    band: 'PREMIUM',
    styles: ['contemporary-minimal', 'japandi', 'warm-modern'],
    colours: ['#6E7A6A', '#57624F', '#3E4738'],
    note: 'Sprayed finish, any colour you like. Forgiving on fingerprints, harder to touch up.',
  },
  {
    slug: 'lacquered-glass-shutter',
    label: 'Lacquered glass shutter',
    category: 'joinery',
    form: 'shutter',
    band: 'LUXURY',
    styles: ['luxe-glam', 'art-deco', 'contemporary-minimal'],
    colours: ['#2B4A47', '#1C3330', '#C9A227'],
    note: 'The most expensive shutter in a normal kitchen. It roughly doubles that line.',
  },
  {
    slug: 'veneer-shutter',
    label: 'Veneer shutter',
    category: 'joinery',
    form: 'shutter',
    band: 'PREMIUM',
    styles: ['mid-century', 'warm-modern', 'japandi'],
    colours: ['#A87F4E', '#8A6238', '#5F4324'],
    note: 'Real wood grain. Every panel differs slightly, which is the point and also the complaint.',
  },
  {
    slug: 'floor-to-ceiling-wardrobe',
    label: 'Floor-to-ceiling wardrobe',
    category: 'joinery',
    form: 'storage',
    band: 'PREMIUM',
    styles: [],
    colours: ['#C6BEB0', '#A79E8D', '#7C7365'],
    note: 'The most storage per square foot in the flat, and the line most often cut late.',
  },
  {
    slug: 'sliding-wardrobe',
    label: 'Sliding wardrobe',
    category: 'joinery',
    form: 'storage',
    band: 'ESSENTIAL',
    styles: ['contemporary-minimal', 'warm-modern'],
    colours: ['#CFCAC0', '#AEA89C', '#827C70'],
    note: 'No door swing needed, so it suits a tight room. You lose a third of the opening.',
  },
  {
    slug: 'open-shelving',
    label: 'Open shelving',
    category: 'joinery',
    form: 'storage',
    band: 'ESSENTIAL',
    styles: ['scandinavian', 'industrial', 'japandi', 'rustic-earthy'],
    colours: ['#B99A70', '#96764D', '#6B5334'],
    note: 'Cheap, and a standing commitment to tidiness. Be honest with yourself about that.',
  },
  {
    slug: 'fluted-panel-joinery',
    label: 'Fluted panel fronts',
    category: 'joinery',
    form: 'shutter',
    band: 'LUXURY',
    styles: ['art-deco', 'luxe-glam', 'indian-contemporary'],
    colours: ['#8A6A45', '#6B4F31', '#C9A227'],
    note: 'Everywhere on Instagram right now. Ask yourself whether you will like it in 2031.',
  },

  // ── Furniture ───────────────────────────────────────────────
  {
    slug: 'fabric-sofa-low',
    label: 'Low fabric sofa',
    category: 'furniture',
    form: 'seat',
    band: 'ESSENTIAL',
    styles: ['scandinavian', 'contemporary-minimal', 'japandi', 'mid-century'],
    colours: ['#9A9488', '#7C7669', '#5C574C'],
    note: 'A lower back makes a 10-foot ceiling feel taller. Check it suits older knees first.',
  },
  {
    slug: 'sectional-sofa',
    label: 'Sectional sofa',
    category: 'furniture',
    form: 'seat',
    band: 'PREMIUM',
    styles: ['warm-modern', 'contemporary-minimal'],
    colours: ['#8C8378', '#6E665C', '#4E4841'],
    note: 'Seats the most people per rupee. Measure the lift before you fall in love with one.',
  },
  {
    slug: 'leather-sofa',
    label: 'Leather sofa',
    category: 'furniture',
    form: 'seat',
    band: 'LUXURY',
    styles: ['mid-century', 'industrial', 'classical-ornate'],
    colours: ['#7A4F33', '#5C3A24', '#3B2416'],
    note: 'Ages well, and is honest about humidity in a way fabric is not.',
  },
  {
    slug: 'cane-armchair',
    label: 'Cane armchair',
    category: 'furniture',
    form: 'seat',
    band: 'ESSENTIAL',
    styles: ['indian-contemporary', 'rustic-earthy', 'coastal-light', 'japandi'],
    colours: ['#C7A977', '#A6874F', '#7A6034'],
    note: 'Made well an hour from Pune, and it breathes in a way upholstery does not.',
  },
  {
    slug: 'solid-wood-dining',
    label: 'Solid wood dining table',
    category: 'furniture',
    form: 'table',
    band: 'PREMIUM',
    styles: ['rustic-earthy', 'mid-century', 'warm-modern', 'indian-contemporary'],
    colours: ['#A17245', '#7E552F', '#57391D'],
    note: 'Outlives the rest of the fit-out. Sheesham locally is the sensible version.',
  },
  {
    slug: 'glass-dining',
    label: 'Glass dining table',
    category: 'furniture',
    form: 'table',
    band: 'PREMIUM',
    styles: ['contemporary-minimal', 'luxe-glam', 'art-deco'],
    colours: ['#D9DEDD', '#B9C1C0', '#8C9491'],
    note: 'Visually disappears in a small room. Shows every mark in a household with children.',
  },
  {
    slug: 'marble-coffee-table',
    label: 'Marble-top coffee table',
    category: 'furniture',
    form: 'table',
    band: 'LUXURY',
    styles: ['luxe-glam', 'art-deco', 'classical-ornate'],
    colours: ['#EAE6DF', '#CBC5BA', '#9A9186'],
    note: 'Heavy, cold and beautiful. Turmeric stains it, which nobody mentions in the showroom.',
  },
  {
    slug: 'platform-bed',
    label: 'Low platform bed',
    category: 'furniture',
    form: 'seat',
    band: 'ESSENTIAL',
    styles: ['japandi', 'contemporary-minimal', 'scandinavian'],
    colours: ['#A88F6C', '#846C4D', '#5C4A32'],
    note: 'Calmer in a small bedroom. No storage underneath, which is a real trade in a 2 BHK.',
  },
  {
    slug: 'hydraulic-storage-bed',
    label: 'Hydraulic storage bed',
    category: 'furniture',
    form: 'seat',
    band: 'ESSENTIAL',
    styles: [],
    colours: ['#9B9184', '#7A7165', '#564F46'],
    note: 'The single most useful cubic foot in an Indian flat. Almost everyone ends up with one.',
  },

  // ── Lighting ────────────────────────────────────────────────
  {
    slug: 'recessed-downlights',
    label: 'Recessed downlights',
    category: 'lighting',
    form: 'light',
    band: 'ESSENTIAL',
    styles: ['contemporary-minimal', 'warm-modern'],
    colours: ['#EFEAE0', '#D6CFC2', '#9D9689'],
    note: 'Needs a false ceiling to hide in. Ask for warm white — cool white reads as an office.',
  },
  {
    slug: 'cove-lighting',
    label: 'Cove lighting',
    category: 'lighting',
    form: 'light',
    band: 'ESSENTIAL',
    styles: ['warm-modern', 'luxe-glam', 'indian-contemporary'],
    colours: ['#F2E4C8', '#DCC79C', '#A38F65'],
    note: 'The soft perimeter glow in every Indian ceiling. Cheap, and it flatters a room.',
  },
  {
    slug: 'pendant-cluster',
    label: 'Pendant cluster',
    category: 'lighting',
    form: 'light',
    band: 'PREMIUM',
    styles: ['mid-century', 'scandinavian', 'industrial'],
    colours: ['#2E2B28', '#1C1A18', '#C9A227'],
    note: 'Hung over a dining table it does more for a room than any amount of ceiling work.',
  },
  {
    slug: 'brass-wall-sconce',
    label: 'Brass wall sconce',
    category: 'lighting',
    form: 'light',
    band: 'PREMIUM',
    styles: ['art-deco', 'classical-ornate', 'luxe-glam', 'indian-contemporary'],
    colours: ['#C9A227', '#A5821B', '#6E5610'],
    note: 'Light at eye level is what makes a room feel like evening rather than a shop.',
  },
  {
    slug: 'paper-lantern',
    label: 'Paper lantern',
    category: 'lighting',
    form: 'light',
    band: 'ESSENTIAL',
    styles: ['japandi', 'scandinavian', 'coastal-light'],
    colours: ['#F4F0E6', '#E0DACC', '#B3AC9C'],
    note: 'Almost free, and it does the softest light in this list. Genuinely hard to beat.',
  },
  {
    slug: 'chandelier',
    label: 'Chandelier',
    category: 'lighting',
    form: 'light',
    band: 'LUXURY',
    styles: ['classical-ornate', 'luxe-glam', 'art-deco'],
    colours: ['#E8DFC4', '#C9A227', '#8A6F14'],
    note: 'Needs ceiling height and a cleaning plan. Both are usually discovered afterwards.',
  },

  // ── Textiles ────────────────────────────────────────────────
  {
    slug: 'cotton-dhurrie',
    label: 'Cotton dhurrie',
    category: 'textiles',
    form: 'textile',
    band: 'ESSENTIAL',
    styles: ['indian-contemporary', 'rustic-earthy', 'scandinavian', 'coastal-light'],
    colours: ['#E0D6C2', '#B9A98A', '#7E7259'],
    note: 'Washable, local, and the cheapest way to stop a tiled room echoing.',
  },
  {
    slug: 'jute-rug',
    label: 'Jute rug',
    category: 'textiles',
    form: 'textile',
    band: 'ESSENTIAL',
    styles: ['rustic-earthy', 'coastal-light', 'japandi'],
    colours: ['#C9B78E', '#A8946A', '#7A6A46'],
    note: 'Texture for very little money. Rough underfoot — not the one for a bedroom.',
  },
  {
    slug: 'wool-rug',
    label: 'Wool rug',
    category: 'textiles',
    form: 'textile',
    band: 'PREMIUM',
    styles: ['mid-century', 'warm-modern', 'classical-ornate'],
    colours: ['#B4A08A', '#8E7A64', '#5F5142'],
    note: 'Warmer and quieter than anything else here. Needs professional cleaning.',
  },
  {
    slug: 'linen-curtains',
    label: 'Linen curtains',
    category: 'textiles',
    form: 'textile',
    band: 'PREMIUM',
    styles: ['japandi', 'scandinavian', 'coastal-light', 'contemporary-minimal'],
    colours: ['#E6E0D2', '#CBC3B1', '#9A9383'],
    note: 'Filters harsh afternoon light beautifully. Creases, permanently, on purpose.',
  },
  {
    slug: 'blackout-blinds',
    label: 'Blackout blinds',
    category: 'textiles',
    form: 'textile',
    band: 'ESSENTIAL',
    styles: ['contemporary-minimal', 'industrial'],
    colours: ['#7E7A74', '#5E5B56', '#3C3936'],
    note: 'Unglamorous, and the difference between sleeping and not in a west-facing bedroom.',
  },
  {
    slug: 'silk-cushions',
    label: 'Silk cushions',
    category: 'textiles',
    form: 'textile',
    band: 'LUXURY',
    styles: ['luxe-glam', 'classical-ornate', 'indian-contemporary'],
    colours: ['#9A4F5E', '#7A3746', '#C9A227'],
    note: 'The cheapest item on this list that still reads as expensive.',
  },

  // ── Walls & ceiling ─────────────────────────────────────────
  {
    slug: 'plain-paint',
    label: 'Plain paint',
    category: 'walls',
    form: 'feature',
    band: 'ESSENTIAL',
    styles: [],
    colours: ['#EDEAE3', '#DAD5CB', '#B0AAA0'],
    note: 'Still the best value in the building. Two coats of a good emulsion beats a bad feature wall.',
  },
  {
    slug: 'lime-plaster',
    label: 'Lime plaster finish',
    category: 'walls',
    form: 'feature',
    band: 'PREMIUM',
    styles: ['rustic-earthy', 'japandi', 'coastal-light', 'indian-contemporary'],
    colours: ['#E2DACA', '#C7BCA6', '#9B9080'],
    note: 'Depth that flat paint cannot do. Patching it later is a specialist job.',
  },
  {
    slug: 'wall-panelling',
    label: 'Wall panelling',
    category: 'walls',
    form: 'feature',
    band: 'PREMIUM',
    styles: ['classical-ornate', 'warm-modern', 'art-deco'],
    colours: ['#D3CCBE', '#B2AA99', '#82796A'],
    note: 'Makes a plain builder wall look designed. It is carpentry, so it is priced like carpentry.',
  },
  {
    slug: 'exposed-brick',
    label: 'Exposed brick',
    category: 'walls',
    form: 'feature',
    band: 'ESSENTIAL',
    styles: ['industrial', 'rustic-earthy'],
    colours: ['#A0674A', '#7E4E35', '#563322'],
    note: 'One wall, never four. Sealing it is not optional in a monsoon city.',
  },
  {
    slug: 'jaali-screen',
    label: 'Jaali screen',
    category: 'walls',
    form: 'feature',
    band: 'PREMIUM',
    styles: ['indian-contemporary', 'classical-ornate', 'rustic-earthy'],
    colours: ['#C2A374', '#9C7D4E', '#6E5631'],
    note: 'Divides a room without closing it, and does something remarkable to afternoon light.',
  },
  {
    slug: 'false-ceiling-peripheral',
    label: 'Peripheral false ceiling',
    category: 'walls',
    form: 'feature',
    band: 'ESSENTIAL',
    styles: [],
    colours: ['#F0EDE7', '#DBD7CF', '#ACA79D'],
    note: 'Only around the edge, so you keep the height in the middle. Half the cost of a full one.',
  },
  {
    slug: 'textured-accent-wall',
    label: 'Textured accent wall',
    category: 'walls',
    form: 'feature',
    band: 'ESSENTIAL',
    styles: ['warm-modern', 'indian-contemporary', 'luxe-glam'],
    colours: ['#B8A68C', '#96866D', '#6B5F4B'],
    note: 'High impact for very little. Also the thing people most often tire of first.',
  },
  {
    slug: 'mirror-wall',
    label: 'Mirror panel wall',
    category: 'walls',
    form: 'feature',
    band: 'LUXURY',
    styles: ['art-deco', 'luxe-glam'],
    colours: ['#D6DBDA', '#B4BCBA', '#C9A227'],
    note: 'Doubles a small room and doubles the dusting. Antique-tinted hides marks better.',
  },
];

/** Fast lookup. Built once. */
const BY_SLUG = new Map(ELEMENTS.map((element) => [element.slug, element]));

export function elementBySlug(slug: string): Element | null {
  return BY_SLUG.get(slug) ?? null;
}

/**
 * Band ordering, so "is this above my budget?" is a comparison rather than a
 * pile of conditionals.
 */
const BAND_RANK: Record<BudgetTier, number> = { ESSENTIAL: 0, PREMIUM: 1, LUXURY: 2 };

export function bandRank(band: BudgetTier): number {
  return BAND_RANK[band];
}

/**
 * Is this element above the customer's band?
 *
 * A null tier means they have not chosen one, and in that case NOTHING is above
 * band — we do not get to mark someone's taste as extravagant before they have
 * told us what they are spending.
 */
export function isAboveBand(element: Element, tier: BudgetTier | null): boolean {
  if (tier === null) return false;
  return BAND_RANK[element.band] > BAND_RANK[tier];
}
