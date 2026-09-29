/**
 * The style DNA card (build queue item 13): their styles as shares, the
 * leading style's palette and three materials — something worth sending to
 * the person they are doing the home with. The share text carries no name
 * and no number, only the styles and a link to start their own.
 *
 * Pure, and tested.
 */

import { STYLE_LABELS, type StyleTag } from './types';
import { STYLE_PALETTES } from './palettes';
import { LIKE_WEIGHTS } from '@/modules/matching/style-affinity';

export interface StyleDna {
  shares: { tag: StyleTag; label: string; pct: number }[];
  palette: string[];
  materials: [string, string, string];
  shareText: string;
}

export function styleDna(likes: readonly StyleTag[], site = 'https://oneinteriors.in'): StyleDna | null {
  const tags = likes.slice(0, 3);
  if (tags.length === 0) return null;
  const weights = tags.map((_, i) => LIKE_WEIGHTS[i] ?? 0.7);
  const total = weights.reduce((a, b) => a + b, 0);
  const pcts = weights.map((w) => Math.round((w / total) * 100));
  pcts[0]! += 100 - pcts.reduce((a, b) => a + b, 0); // rounding lands on the leader
  const shares = tags.map((tag, i) => ({ tag, label: STYLE_LABELS[tag], pct: pcts[i]! }));
  const p = STYLE_PALETTES[tags[0]!];
  const line = shares.map((s) => `${s.pct}% ${s.label}`).join(', ');
  return {
    shares,
    palette: [p.wall, p.floor, p.furniture, p.trim, p.accent],
    materials: p.materials,
    shareText: `My home's style DNA: ${line}. Find yours in four minutes: ${site}/quiz`,
  };
}

/** A WhatsApp share link for the card — no number, so they pick the chat. */
export function whatsappShare(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
