/**
 * "Suggest with Claude" on the ops photo-tagging page: which room a studio
 * photo shows, which of our styles, and which of our materials are visible.
 *
 * AI proposes, a person checks — the same rule as the floor-plan and
 * inspiration readers. Only names from our own lists can come back; anything
 * else is dropped, because a material the feed doesn't know would mean
 * nothing to a customer. Pure and tested; the call is `suggest-read.ts`.
 */

import { STYLE_TAGS, type StyleTag } from '@/modules/brief/types';
import { STYLE_DEFINITIONS } from '@/modules/inspiration/reading';
import { MATERIAL_TAGS, type MaterialTag } from './tags';

export const PHOTO_ROOMS = ['LIVING', 'DINING', 'KITCHEN', 'MASTER_BEDROOM', 'BEDROOM', 'KIDS', 'POOJA', 'FOYER', 'BATH', 'OTHER'] as const;
export type PhotoRoom = (typeof PHOTO_ROOMS)[number];

export interface PhotoSuggestion {
  room: PhotoRoom | null;
  styles: StyleTag[];
  materials: MaterialTag[];
  /** Claude thinks this is a 3D render, not a photograph. */
  looksRendered: boolean;
}

export const SUGGEST_PROMPT = [
  'This is a photo a Pune interior studio says is from a finished home. Tag it for a homeowner-facing feed.',
  `room: one of ${PHOTO_ROOMS.join(', ')}.`,
  'styles: one to three, strongest first, ONLY from this list:',
  ...STYLE_TAGS.map((t) => `- ${t}: ${STYLE_DEFINITIONS[t]}`),
  `materials: those clearly visible, ONLY from this list: ${MATERIAL_TAGS.join(', ')}.`,
  'looksRendered: true if this looks like a 3D render rather than a photograph.',
  'Reply with JSON only: {"room": "...", "styles": ["..."], "materials": ["..."], "looksRendered": false}',
].join('\n');

export function readSuggestion(text: string): PhotoSuggestion | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
  const room = (PHOTO_ROOMS as readonly string[]).includes(String(raw.room)) ? (raw.room as PhotoRoom) : null;
  const styles = Array.isArray(raw.styles)
    ? [...new Set(raw.styles.filter((s): s is StyleTag => (STYLE_TAGS as readonly string[]).includes(String(s))))].slice(0, 3)
    : [];
  const materials = Array.isArray(raw.materials)
    ? [...new Set(raw.materials.filter((m): m is MaterialTag => (MATERIAL_TAGS as readonly string[]).includes(String(m))))]
    : [];
  return { room, styles, materials, looksRendered: raw.looksRendered === true };
}
