/**
 * "A room you love" — which of our twelve styles a photo shows.
 *
 * The customer uploads a picture (Pinterest, a friend's flat, a magazine),
 * Claude names up to three of OUR styles in it with a plain reason, and the
 * customer chooses whether to add them to what they like. AI proposes, the
 * customer confirms — nothing is added on its own, the same rule as the
 * floor-plan reader. Only the twelve names the matcher knows can come back;
 * anything else is dropped, because a style the matcher does not know would
 * match nobody.
 *
 * Pure, and tested. The call is `read.ts`.
 */

import { STYLE_LABELS, STYLE_TAGS, type StyleTag } from '@/modules/brief/types';
import { extractJson } from '@/modules/floorplan/reading';

/** The definitions studios tag with (docs/STUDIO-PROFILE-REQUIREMENTS.md), so both sides use one vocabulary. */
const DEFINITIONS: Record<StyleTag, string> = {
  'contemporary-minimal': 'clean lines, flat surfaces, a neutral palette, almost no ornament',
  'warm-modern': 'modern forms softened with wood, warm neutrals and layered light',
  'indian-contemporary': 'modern layouts with Indian materials — cane, brass, jaali, handloom, stone',
  scandinavian: 'light woods, whites and greys, functional, cosy textiles',
  industrial: 'exposed materials — metal, concrete, brick — in darker tones',
  'mid-century': 'walnut, tapered legs, retro shapes and bold accents',
  'classical-ornate': 'mouldings, carving, rich fabrics and symmetry',
  'art-deco': 'geometry, brass and gold, velvet, jewel tones',
  'rustic-earthy': 'raw wood, terracotta, stone and handmade texture',
  'luxe-glam': 'high gloss, marble, metallics, statement lighting',
  japandi: 'low, calm and natural — Japanese restraint with Scandinavian warmth',
  'coastal-light': 'whites and blues, airy rooms, natural fibres',
};

export const INSPIRATION_PROMPT = [
  'This is a photo of a room a homeowner in Pune likes. Say which interior styles it shows, choosing ONLY from this list:',
  ...STYLE_TAGS.map((t) => `- ${t}: ${DEFINITIONS[t]}`),
  '',
  'Pick one to three, strongest first. For each, one short reason that points at something visible in the photo (a material, a colour, a shape). If the photo is not of an interior, return an empty list.',
  'Reply with JSON only: {"styles": [{"style": "<one of the ids above>", "why": "<under 90 characters>"}]}',
].join('\n');

export interface StylePick {
  style: StyleTag;
  label: string;
  why: string;
}

export type InspirationResult = { ok: true; picks: StylePick[] } | { ok: false; reason: 'not-interior' | 'unreadable' };

/** The model's reply, kept to our vocabulary, three at most, no repeats. */
export function readInspiration(text: string): InspirationResult {
  const json = extractJson(text);
  if (!json) return { ok: false, reason: 'unreadable' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
  const list = (parsed as { styles?: unknown })?.styles;
  if (!Array.isArray(list)) return { ok: false, reason: 'unreadable' };
  const picks: StylePick[] = [];
  for (const item of list) {
    const style = (item as { style?: unknown })?.style;
    const why = (item as { why?: unknown })?.why;
    if (typeof style !== 'string' || !(STYLE_TAGS as readonly string[]).includes(style)) continue;
    if (picks.some((p) => p.style === style)) continue;
    picks.push({
      style: style as StyleTag,
      label: STYLE_LABELS[style as StyleTag],
      why: typeof why === 'string' ? why.replace(/\s+/g, ' ').trim().slice(0, 120) : '',
    });
    if (picks.length === 3) break;
  }
  return picks.length > 0 ? { ok: true, picks } : { ok: false, reason: 'not-interior' };
}
