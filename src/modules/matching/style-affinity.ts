/**
 * How close two styles are — partial credit between neighbours.
 *
 * A customer who picked Japandi is not a stranger to a studio whose work is
 * Scandinavian; the two share light wood, restraint and function. Scoring
 * that as zero overlap would rank a near-perfect studio below a mediocre
 * exact match. So neighbouring styles earn part of the credit an exact match
 * does, from this table (plan §5.2).
 *
 * Small, symmetric and versioned: a change here changes scores, so it bumps
 * `AFFINITY_VERSION` and the engine version with it.
 */

import type { StyleTag } from '@/modules/brief/types';

export const AFFINITY_VERSION = 'affinity@2';

const PAIRS: [StyleTag, StyleTag, number][] = [
  ['japandi', 'scandinavian', 0.6],
  ['japandi', 'contemporary-minimal', 0.5],
  ['japandi', 'warm-modern', 0.5],
  ['scandinavian', 'contemporary-minimal', 0.5],
  ['scandinavian', 'coastal-light', 0.6],
  ['warm-modern', 'contemporary-minimal', 0.5],
  ['warm-modern', 'indian-contemporary', 0.5],
  ['warm-modern', 'mid-century', 0.4],
  ['indian-contemporary', 'rustic-earthy', 0.4],
  ['indian-contemporary', 'classical-ornate', 0.3],
  ['art-deco', 'luxe-glam', 0.6],
  ['art-deco', 'mid-century', 0.4],
  ['classical-ornate', 'luxe-glam', 0.4],
  ['industrial', 'contemporary-minimal', 0.3],
  ['industrial', 'rustic-earthy', 0.3],
  ['coastal-light', 'rustic-earthy', 0.3],
];

const TABLE = new Map<string, number>();
for (const [a, b, w] of PAIRS) {
  TABLE.set(`${a}|${b}`, w);
  TABLE.set(`${b}|${a}`, w);
}

/** 1 for the same style, the table's value for neighbours, 0 otherwise. */
export function affinity(a: string, b: string): number {
  if (a === b) return 1;
  return TABLE.get(`${a}|${b}`) ?? 0;
}

/** The best credit a studio's style earns against any style the customer liked. */
export function bestAffinity(studioStyle: string, liked: readonly string[]): number {
  let best = 0;
  for (const l of liked) best = Math.max(best, affinity(studioStyle, l));
  return best;
}

/**
 * Likes are ordered since 30 Sep (affinity@2): the first is the one they
 * chose most in "this or that" (brief/this-or-that.ts), and it counts in full;
 * the second and third count a little less. A brief that never played keeps
 * its picking order, which is close to the same thing.
 */
export const LIKE_WEIGHTS = [1, 0.85, 0.7] as const;

/** `bestAffinity`, with each liked style weighted by its place in the order. */
export function weightedAffinity(studioStyle: string, liked: readonly string[]): number {
  let best = 0;
  liked.forEach((l, i) => {
    best = Math.max(best, affinity(studioStyle, l) * (LIKE_WEIGHTS[i] ?? LIKE_WEIGHTS[LIKE_WEIGHTS.length - 1]!));
  });
  return best;
}

/** Styles nearest to the ones they liked, best first — for "this or that". */
export function neighbours(liked: readonly string[], exclude: readonly string[] = []): string[] {
  const skip = new Set([...liked, ...exclude]);
  const scored = new Map<string, number>();
  for (const [key, w] of TABLE) {
    const [a, b] = key.split('|') as [string, string];
    if (liked.includes(a) && !skip.has(b)) scored.set(b, Math.max(scored.get(b) ?? 0, w));
  }
  return [...scored.entries()].sort((x, y) => y[1] - x[1]).map(([s]) => s);
}
