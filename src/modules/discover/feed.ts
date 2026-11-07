/**
 * Discover: what to show next, and what the saves say.
 *
 * ## Learning from saves, not labels
 *
 * People are poor at naming their style and even designers disagree on the
 * labels (research doc, 7 Nov 2026), so we never ask. Each save adds weight to
 * the pin's styles, each skip takes a little away, and the next batch leans
 * toward what they keep. One slot in five is a surprise from a style they have
 * seen least, so the feed never closes in on a first guess.
 *
 * Nothing here is random: the same saves always give the same feed and the
 * same style, which keeps a reload calm and makes this file testable. Order
 * among equals comes from a hash of the pin id, so it looks shuffled without
 * being so.
 *
 * Pure and tested.
 */

import { STYLE_LABELS, STYLE_TAGS, type StyleTag } from '@/modules/brief/types';
import { tierForPerSqft, type Tier } from '@/modules/quotation/tiers';
import type { DiscoverRoom, Pin } from './pins';

/** Saves before we show the style. */
export const REVEAL_AT = 20;
/** The fewest saves a style can rest on when the feed has run out first. */
export const REVEAL_MIN = 6;
/** One pin in this many is a surprise. */
const SURPRISE_EVERY = 5;

export interface FeedState {
  saved: readonly string[];
  skipped: readonly string[];
}

/** Stable 0..1 from a string (FNV-1a). */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/** How much each style is liked so far: 1 to start, up with saves, down with skips. */
export function styleWeights(pins: readonly Pin[], state: FeedState): Map<StyleTag, number> {
  const byId = new Map(pins.map((p) => [p.id, p]));
  const w = new Map<StyleTag, number>(STYLE_TAGS.map((t) => [t, 1]));
  for (const id of state.saved) {
    byId.get(id)?.styles.forEach((t, i) => w.set(t, (w.get(t) ?? 1) + (i === 0 ? 2 : 1)));
  }
  for (const id of state.skipped) {
    const first = byId.get(id)?.styles[0];
    if (first) w.set(first, Math.max(0.1, (w.get(first) ?? 1) - 0.7));
  }
  return w;
}

function pinScore(pin: Pin, w: Map<StyleTag, number>): number {
  const [first, ...rest] = pin.styles;
  const others = rest.length ? rest.reduce((s, t) => s + (w.get(t) ?? 1), 0) / rest.length : 0;
  // A real Pune room beats an example of the same style.
  return (w.get(first!) ?? 1) + 0.5 * others + (pin.kind === 'built' ? 0.4 : 0) + 0.3 * hash01(pin.id);
}

/**
 * The next `count` pins nobody has seen yet, best first, with a surprise every
 * fifth slot and never three of one style in a row.
 */
export function nextPins(
  pins: readonly Pin[],
  state: FeedState,
  seen: ReadonlySet<string>,
  count: number,
  room: DiscoverRoom | null = null,
): Pin[] {
  const w = styleWeights(pins, state);
  const pool = pins.filter((p) => !seen.has(p.id) && (room === null || p.room === room));
  const ranked = [...pool].sort((a, b) => pinScore(b, w) - pinScore(a, w) || a.id.localeCompare(b.id));

  // How often each style has been shown, for picking surprises.
  const shown = new Map<StyleTag, number>();
  const byId = new Map(pins.map((p) => [p.id, p]));
  for (const id of seen) {
    const t = byId.get(id)?.styles[0];
    if (t) shown.set(t, (shown.get(t) ?? 0) + 1);
  }

  const out: Pin[] = [];
  const taken = new Set<string>();
  while (out.length < count && taken.size < ranked.length) {
    const slot = seen.size + out.length + 1;
    let pick: Pin | undefined;
    if (slot % SURPRISE_EVERY === 0) {
      // The least-shown style still in the pool, its best pin.
      pick = [...ranked]
        .filter((p) => !taken.has(p.id))
        .sort(
          (a, b) =>
            (shown.get(a.styles[0]!) ?? 0) - (shown.get(b.styles[0]!) ?? 0) || pinScore(b, w) - pinScore(a, w),
        )[0];
    } else {
      const lastTwo = out.slice(-2).map((p) => p.styles[0]);
      const streak = lastTwo.length === 2 && lastTwo[0] === lastTwo[1] ? lastTwo[0] : null;
      pick = ranked.find((p) => !taken.has(p.id) && p.styles[0] !== streak) ?? ranked.find((p) => !taken.has(p.id));
    }
    if (!pick) break;
    taken.add(pick.id);
    out.push(pick);
    const t = pick.styles[0]!;
    shown.set(t, (shown.get(t) ?? 0) + 1);
  }
  return out;
}

export interface Reveal {
  /** Enough saves to say something. */
  ready: boolean;
  /** Up to three styles as whole percentages adding to 100; empty with no saves. */
  shares: { tag: StyleTag; label: string; pct: number }[];
  /** The band the saved real rooms were built in, from their median cost. */
  tier: Tier | null;
  /** Studios whose rooms were saved, most saved first, at most three. Never shown. */
  studioIds: string[];
  saves: number;
}

/**
 * What the saves say. Ready at `REVEAL_AT` saves, or at `REVEAL_MIN` when the
 * feed has nothing left to show — a short feed shouldn't strand anyone.
 */
export function revealStyle(pins: readonly Pin[], saved: readonly string[], feedExhausted = false): Reveal {
  const byId = new Map(pins.map((p) => [p.id, p]));
  const kept = saved.map((id) => byId.get(id)).filter((p): p is Pin => p !== undefined);

  const w = new Map<StyleTag, number>();
  for (const p of kept) p.styles.forEach((t, i) => w.set(t, (w.get(t) ?? 0) + (i === 0 ? 1 : 0.5)));
  const top = [...w.entries()]
    .sort((a, b) => b[1] - a[1] || STYLE_TAGS.indexOf(a[0]) - STYLE_TAGS.indexOf(b[0]))
    .slice(0, 3)
    // A style with under a tenth of the weight is noise, not a taste.
    .filter(([, v], _, all) => v >= all[0]![1] * 0.1);
  const total = top.reduce((s, [, v]) => s + v, 0);
  const pcts = top.map(([, v]) => Math.round((v / total) * 100));
  if (pcts.length) pcts[0]! += 100 - pcts.reduce((s, p) => s + p, 0);
  const shares = top.map(([tag], i) => ({ tag, label: STYLE_LABELS[tag], pct: pcts[i]! }));

  const costs = kept.map((p) => p.perSqft).filter((v): v is number => v !== null).sort((a, b) => a - b);
  const median = costs.length ? costs[Math.floor((costs.length - 1) / 2)]! : null;

  const studioCount = new Map<string, number>();
  for (const p of kept) if (p.studioId) studioCount.set(p.studioId, (studioCount.get(p.studioId) ?? 0) + 1);
  const studioIds = [...studioCount.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([id]) => id);

  return {
    ready: kept.length >= REVEAL_AT || (feedExhausted && kept.length >= REVEAL_MIN),
    shares,
    tier: median === null ? null : tierForPerSqft(median),
    studioIds,
    saves: kept.length,
  };
}

/** Saves grouped into the five boards, newest first. */
export function boards(pins: readonly Pin[], saved: readonly string[]): Record<DiscoverRoom, Pin[]> {
  const byId = new Map(pins.map((p) => [p.id, p]));
  const out: Record<DiscoverRoom, Pin[]> = { living: [], kitchen: [], bedroom: [], mandir: [], other: [] };
  for (const id of [...saved].reverse()) {
    const p = byId.get(id);
    if (p) out[p.room].push(p);
  }
  return out;
}

/** The most saves we keep per Home Profile. */
export const MAX_SAVES = 80;
const PIN_ID = /^(b:[A-Za-z0-9_-]{1,64}:\d{1,3}|x:[a-z-]{1,40}:[a-z]{1,12})$/;

/** Saves from a device, made safe to store: real pin-shaped ids, no repeats, newest kept. */
export function cleanSaves(raw: unknown, max = MAX_SAVES): string[] {
  if (!Array.isArray(raw)) return [];
  const ids = raw.filter((v): v is string => typeof v === 'string' && PIN_ID.test(v));
  return [...new Set(ids)].slice(-max);
}
