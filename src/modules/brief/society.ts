/**
 * Society names — suggested as they type, resolved to one spelling, and the
 * area filled from the pick (build queue item 7; plan §2 screen 2).
 *
 * One spelling matters twice: "they have done a home in your society"
 * (matching/signals.ts) and the floor-plan library (floorplan/society-library.ts)
 * both compare society names, and "Gera WOJ", "gera world of joy" and
 * "Gera World of Joy" must be one building to both.
 *
 * Pure, and tested.
 */

import { PUNE_SOCIETIES, type PuneSociety } from '@/data/pune-societies';

/** Case, spaces and punctuation removed — "Sapphire-Heights" is "sapphireheights". */
export function foldSociety(name: string | null | undefined): string {
  return (name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

const BY_KEY = new Map<string, PuneSociety>();
for (const s of PUNE_SOCIETIES) {
  BY_KEY.set(foldSociety(s.name), s);
  for (const a of s.aliases ?? []) BY_KEY.set(foldSociety(a), s);
}

/** The known society a name refers to, by its name or any alias. */
export function knownSociety(name: string | null | undefined): PuneSociety | null {
  return BY_KEY.get(foldSociety(name)) ?? null;
}

/** The one spelling: the known name when it is one, otherwise what they typed, trimmed. */
export function canonicalSociety(name: string | null | undefined): string | null {
  const typed = (name ?? '').trim().replace(/\s+/g, ' ');
  if (!typed) return null;
  return knownSociety(typed)?.name ?? typed;
}

/** The comparison key: aliases resolve to their building. Null for anything too short to mean one. */
export function societyMatchKey(name: string | null | undefined): string | null {
  const known = knownSociety(name);
  const key = known ? foldSociety(known.name) : foldSociety(name);
  return key.length >= 3 ? key : null;
}

/** Are these the same building? */
export function sameSociety(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = societyMatchKey(a);
  return ka !== null && ka === societyMatchKey(b);
}

/** Suggestions as they type: names starting with it first, then containing it; aliases count. */
export function searchSocieties(query: string, limit = 6): PuneSociety[] {
  const q = foldSociety(query);
  if (q.length < 2) return [];
  const names = (s: PuneSociety) => [s.name, ...(s.aliases ?? [])].map(foldSociety);
  const starts = PUNE_SOCIETIES.filter((s) => names(s).some((n) => n.startsWith(q)));
  const contains = PUNE_SOCIETIES.filter((s) => !starts.includes(s) && names(s).some((n) => n.includes(q)));
  return [...starts, ...contains].slice(0, limit);
}
