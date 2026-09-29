/**
 * The portfolio fields that make a project a matching signal, not a picture
 * (docs/STUDIO-PROFILE-REQUIREMENTS.md §10).
 *
 * - **Carpet area** turns "₹18.5 L" into a rate per square foot, which is
 *   how a studio's band is checked against work it has actually delivered.
 * - **Society** is what lets us say "they have done a flat in your building".
 * - **Tags** — children, elderly parents, pets, a pooja room — are the
 *   evidence behind a specialism. A specialism counts once two projects show it.
 * - **A room per photograph** lets the style picker show kitchens beside
 *   kitchens, and the match card show "their kitchen like yours".
 * - **Picker consent** is separate from client consent: a customer's portfolio
 *   being on a studio's page is not the same as it appearing, unnamed, in a
 *   stranger's style quiz.
 *
 * Pure, and tested.
 */

import { SPECIALISMS, type Specialism } from './matching-profile';

export const IMAGE_ROOMS = [
  'LIVING',
  'DINING',
  'KITCHEN',
  'MASTER_BEDROOM',
  'BEDROOM',
  'CHILDRENS_ROOM',
  'BATHROOM',
  'POOJA',
  'STUDY',
  'FOYER',
  'BALCONY',
  'OTHER',
] as const;
export type ImageRoom = (typeof IMAGE_ROOMS)[number];

export const IMAGE_ROOM_LABELS: Record<ImageRoom, string> = {
  LIVING: 'Living',
  DINING: 'Dining',
  KITCHEN: 'Kitchen',
  MASTER_BEDROOM: 'Master bedroom',
  BEDROOM: 'Bedroom',
  CHILDRENS_ROOM: "Children's room",
  BATHROOM: 'Bathroom',
  POOJA: 'Pooja',
  STUDY: 'Study',
  FOYER: 'Foyer',
  BALCONY: 'Balcony',
  OTHER: 'Other',
};

export const CARPET_AREA_RANGE = [150, 20_000] as const;
export const SOCIETY_MAX = 80;

/** Specialisms two tagged projects make real. */
export const PROJECTS_PER_SPECIALISM = 2;

/**
 * One room per photograph, in the photographs' order.
 *
 * Aligned to the images rather than stored as a map, so reordering the
 * photographs in the modal carries the rooms with them. Anything unknown —
 * or a photo with no room given — is '' ("not said"), never a guess.
 */
export function cleanImageRooms(images: string[], rooms: string[]): string[] {
  return images.map((_, i) => {
    const r = rooms[i] ?? '';
    return (IMAGE_ROOMS as readonly string[]).includes(r) ? r : '';
  });
}

export function cleanTags(raw: string[]): Specialism[] {
  return [...new Set(raw.filter((t): t is Specialism => (SPECIALISMS as readonly string[]).includes(t)))];
}

export function cleanSocietyName(raw: string): string | null {
  const s = raw.replace(/\s+/g, ' ').trim().slice(0, SOCIETY_MAX);
  return s.length >= 2 ? s : null;
}

/** A carpet area, or null for blank; `undefined` means present but out of range. */
export function carpetAreaFrom(raw: string): number | null | undefined {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isInteger(n) || n < CARPET_AREA_RANGE[0] || n > CARPET_AREA_RANGE[1]) return undefined;
  return n;
}

/** Rupees per square foot of carpet area, when both halves are known. */
export function perSqftOf(p: { valuePaise: number | null; carpetAreaSqft?: number | null }): number | null {
  if (!p.valuePaise || !p.carpetAreaSqft) return null;
  return Math.round(p.valuePaise / 100 / p.carpetAreaSqft);
}

/**
 * The specialisms a studio's portfolio actually shows — two or more tagged
 * projects each. What the studio *declares* and what this returns can
 * differ; matching trusts this.
 */
export function evidencedSpecialisms(projects: { tags?: string[] }[]): Specialism[] {
  const count = new Map<Specialism, number>();
  for (const p of projects) for (const t of cleanTags(p.tags ?? [])) count.set(t, (count.get(t) ?? 0) + 1);
  return SPECIALISMS.filter((s) => (count.get(s) ?? 0) >= PROJECTS_PER_SPECIALISM);
}

/** Societies the studio has finished homes in, from its portfolio. Case-insensitive, first spelling kept. */
export function portfolioSocieties(projects: { society?: string | null }[]): string[] {
  const out: string[] = [];
  for (const p of projects) {
    const s = p.society ? cleanSocietyName(p.society) : null;
    if (s && !out.some((o) => o.toLowerCase() === s.toLowerCase())) out.push(s);
  }
  return out;
}
