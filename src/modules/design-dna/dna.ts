/**
 * Design DNA (owner, 4 Nov 2026): what a customer's home should feel like,
 * read from three things they did themselves.
 *
 *  1. The styles they liked and ruled out in the Home Profile.
 *  2. The mood boards they built, room by room, from the element catalogue
 *     (modules/prepare/catalogue.ts): every element carries the styles it
 *     reads as and its colours.
 *  3. Their yes / no on the AI room mock-ups, and why they said no.
 *
 * The DNA is never stored. Like the prep boards, we keep the inputs (the
 * board slugs and each verdict) and compute this from them, so the card
 * always agrees with what the customer actually did, and changing the rules
 * here re-reads every customer's DNA at once.
 *
 * Two rules from the Home Profile hold here too: a style they ruled out never
 * appears, whatever the board says; and nothing is random, so the same inputs
 * always give the same DNA (and this file can be tested).
 *
 * Pure and tested. No `server-only`: the phone app reads the same shapes.
 */

import { STYLE_LABELS, STYLE_TAGS, type BudgetTier, type StyleTag } from '@/modules/brief/types';
import { STYLE_PALETTES } from '@/modules/brief/palettes';
import { elementBySlug, isAboveBand, type Element } from '@/modules/prepare/catalogue';

export type Lightness = 'light' | 'balanced' | 'deep';
export type Density = 'calm' | 'layered';
export type Verdict = 'up' | 'down';

/** Why a mock-up was a no. One tap, never a text box. */
export const NO_REASONS = ['too_dark', 'too_light', 'too_busy', 'too_plain', 'wrong_colours', 'too_expensive'] as const;
export type NoReason = (typeof NO_REASONS)[number];

export const NO_REASON_LABELS: Record<NoReason, string> = {
  too_dark: 'Too dark',
  too_light: 'Too pale',
  too_busy: 'Too busy',
  too_plain: 'Too empty',
  wrong_colours: 'Not my colours',
  too_expensive: 'Looks too expensive',
};

export interface MockupAnswer {
  /** The style the mock-up was drawn in. */
  style: StyleTag;
  light: Lightness;
  density: Density;
  verdict: Verdict;
  reason: NoReason | null;
}

export interface DnaInput {
  likes: readonly StyleTag[];
  dislikes: readonly StyleTag[];
  tier: BudgetTier | null;
  /** Element slugs the customer placed, per room. */
  boards: readonly { room: string; items: readonly string[] }[];
  answers: readonly MockupAnswer[];
}

export interface DesignDna {
  /** Up to three styles, as whole percentages that add up to 100. */
  shares: { tag: StyleTag; label: string; pct: number }[];
  /** Five colours: wall, floor, furniture, trim, accent. */
  palette: [string, string, string, string, string];
  /** Three materials, from their own board where they built one. */
  materials: [string, string, string];
  light: Lightness;
  density: Density;
  /** Three plain words for the card, e.g. "warm, calm, light-filled". */
  moods: string[];
  /** A board that leans above the band they picked, said plainly. */
  budget: { aboveBand: number; total: number; stretching: boolean };
  /** How much this DNA rests on. Few inputs = a first guess, and the card says so. */
  evidence: { likes: number; boardItems: number; answers: number };
  confidence: 'first guess' | 'taking shape' | 'strong';
}

const LIKE_POINTS = [3, 2.4, 1.8];

function boardElements(boards: DnaInput['boards']): Element[] {
  return boards.flatMap((b) => b.items.map((s) => elementBySlug(s)).filter((e): e is Element => e !== null));
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** 0 (black) to 1 (white), perceived. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Positive = warm (red/yellow leaning), negative = cool. */
function warmth(hex: string): number {
  const [r, , b] = hexToRgb(hex);
  return (r - b) / 255;
}

export function designDna(input: DnaInput): DesignDna {
  const banned = new Set(input.dislikes);
  const weights = new Map<StyleTag, number>();
  const add = (tag: StyleTag, w: number) => {
    if (banned.has(tag)) return;
    weights.set(tag, Math.max(0, (weights.get(tag) ?? 0) + w));
  };

  input.likes.slice(0, 3).forEach((tag, i) => add(tag, LIKE_POINTS[i] ?? 1.5));

  const elements = boardElements(input.boards);
  for (const e of elements) {
    for (const tag of e.styles) add(tag, 1 / e.styles.length);
  }

  for (const a of input.answers) {
    if (a.verdict === 'up') add(a.style, 1.5);
    else add(a.style, a.reason === 'wrong_colours' ? -1.5 : -1);
  }

  // Whole percentages for the top three, in a fixed order on ties.
  const ranked = [...weights.entries()]
    .filter(([, w]) => w > 0)
    .sort((x, y) => y[1] - x[1] || STYLE_TAGS.indexOf(x[0]) - STYLE_TAGS.indexOf(y[0]))
    .slice(0, 3);
  const fallback = STYLE_TAGS.find((t) => !banned.has(t)) ?? 'warm-modern';
  const top = ranked.length > 0 ? ranked : ([[fallback, 1]] as [StyleTag, number][]);
  const total = top.reduce((s, [, w]) => s + w, 0);
  const pcts = top.map(([, w]) => Math.round((w / total) * 100));
  pcts[0]! += 100 - pcts.reduce((s, p) => s + p, 0);
  const shares = top.map(([tag], i) => ({ tag, label: STYLE_LABELS[tag], pct: pcts[i]! }));

  // Palette: the leading style's, with floor and furniture taken from their
  // own board where they placed a surface or a piece of furniture.
  const lead = STYLE_PALETTES[shares[0]!.tag];
  const surface = elements.find((e) => e.category === 'surfaces');
  const furniture = elements.find((e) => e.category === 'furniture' || e.category === 'joinery');
  const palette: DesignDna['palette'] = [
    lead.wall,
    surface?.colours[0] ?? lead.floor,
    furniture?.colours[0] ?? lead.furniture,
    lead.trim,
    lead.accent,
  ];

  const own = elements.filter((e) => e.category === 'surfaces' || e.category === 'joinery' || e.category === 'walls').map((e) => e.label);
  const uniqueOwn = [...new Set(own)];
  const materials = [0, 1, 2].map((i) => uniqueOwn[i] ?? lead.materials[i]!) as [string, string, string];

  // Light: how pale the palette is, nudged by every "too dark" / "too pale".
  const avgLum = palette.slice(0, 4).reduce((s, c) => s + luminance(c), 0) / 4;
  const count = (r: NoReason) => input.answers.filter((a) => a.verdict === 'down' && a.reason === r).length;
  const lightScore = avgLum + 0.08 * (count('too_dark') - count('too_light'));
  const light: Lightness = lightScore >= 0.68 ? 'light' : lightScore <= 0.48 ? 'deep' : 'balanced';

  // Density: a full board or an ornate lead reads layered; "too busy" calms it.
  const perRoom = input.boards.length > 0 ? elements.length / input.boards.length : 0;
  const ornateLead = ['classical-ornate', 'art-deco', 'luxe-glam'].includes(shares[0]!.tag);
  const densityScore = (perRoom >= 6 ? 1 : 0) + (ornateLead ? 1 : 0) - count('too_busy') + count('too_plain');
  const density: Density = densityScore >= 1 ? 'layered' : 'calm';

  const warm = palette.reduce((s, c) => s + warmth(c), 0) / palette.length;
  const moods = [
    warm > 0.06 ? 'warm' : warm < -0.02 ? 'cool' : 'neutral',
    density === 'calm' ? 'calm' : 'layered',
    light === 'light' ? 'light-filled' : light === 'deep' ? 'moody' : 'balanced',
  ];

  const aboveBand = elements.filter((e) => isAboveBand(e, input.tier)).length;
  const stretching = input.tier !== null && aboveBand > 0 && aboveBand * 3 >= elements.length;

  const evidence = { likes: input.likes.length, boardItems: elements.length, answers: input.answers.length };
  const points = evidence.likes + Math.min(evidence.boardItems, 12) / 3 + evidence.answers;
  const confidence: DesignDna['confidence'] = points >= 10 ? 'strong' : points >= 5 ? 'taking shape' : 'first guess';

  return { shares, palette, materials, light, density, moods, budget: { aboveBand, total: elements.length, stretching }, evidence, confidence };
}
