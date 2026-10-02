/**
 * "This or that" (build queue item 12; plan §2 screen 8): four quick pairs
 * drawn from the styles they liked and the ones closest to them. Whatever
 * they choose most leads their likes — and a close neighbour that keeps
 * winning can take the weakest like's place. The style score weights the
 * order (style-affinity.ts `LIKE_WEIGHTS`), so it sharpens the match.
 *
 * Pure, and tested.
 */

import { STYLE_TAGS, type StyleTag } from './types';
import { neighbours } from '@/modules/matching/style-affinity';

export const PAIRS = 4;
const MAX_LIKES = 3;

export type Pair = [StyleTag, StyleTag];

const isStyle = (s: string): s is StyleTag => (STYLE_TAGS as readonly string[]).includes(s);

/** Like against like first, then each like against its closest neighbour. */
export function pairsFor(likes: readonly StyleTag[], dislikes: readonly StyleTag[] = []): Pair[] {
  const out: Pair[] = [];
  for (let i = 0; i < likes.length; i++) {
    for (let j = i + 1; j < likes.length; j++) out.push([likes[i]!, likes[j]!]);
  }
  const near = neighbours(likes, dislikes).filter(isStyle);
  let n = 0;
  for (let i = 0; out.length < PAIRS && n < near.length; i = (i + 1) % Math.max(1, likes.length)) {
    const like = likes[i];
    if (!like) break;
    out.push([like, near[n]!]);
    n += 1;
  }
  return out.slice(0, PAIRS);
}

/** Their likes after the pairs: most wins first; a neighbour that won enough replaces the weakest. */
export function applyChoices(likes: readonly StyleTag[], winners: readonly StyleTag[]): StyleTag[] {
  const wins = new Map<StyleTag, number>();
  for (const w of winners) wins.set(w, (wins.get(w) ?? 0) + 1);
  const pool = [...new Set<StyleTag>([...likes, ...winners])];
  const order = (s: StyleTag) => (likes.includes(s) ? likes.indexOf(s) : likes.length);
  // A neighbour that won at least once can take the weakest like's place.
  pool.sort((a, b) => (wins.get(b) ?? 0) - (wins.get(a) ?? 0) || order(a) - order(b));
  const kept = pool.filter((s) => likes.includes(s) || (wins.get(s) ?? 0) >= 1).slice(0, MAX_LIKES);
  return kept.length >= 2 ? kept : [...likes];
}
