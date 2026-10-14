/**
 * Lead tags — the rules (the AxLeads look, 12 Oct 2026; AxLeads
 * lib/leads/tags.ts). Pure, tested in tests/studio-leads-look.test.ts.
 *
 * A tag is a short label a person puts on a lead ("hot", "Baner", "NRI").
 * Studio-wide vocabulary, at most 20 per lead, compared without case: adding
 * "Hot" to a lead tagged "hot" changes nothing, and the first spelling stays.
 */

import { cleanTag } from './lead-filters';

export const MAX_TAGS = 20;
export const MAX_TAG_LENGTH = 40;

export { cleanTag };

/** The lead's tags with these added: cleaned, no duplicates (any case), at most 20. */
export function addTags(current: readonly string[], add: readonly string[]): { tags: string[]; refused: string | null } {
  const out = [...current];
  const seen = new Set(out.map((t) => t.toLowerCase()));
  for (const raw of add) {
    const t = cleanTag(raw);
    if (!t) continue;
    if (seen.has(t.toLowerCase())) continue;
    if (out.length >= MAX_TAGS) return { tags: out, refused: `A lead can carry at most ${MAX_TAGS} tags. Remove one first.` };
    out.push(t);
    seen.add(t.toLowerCase());
  }
  return { tags: out, refused: null };
}

/** The lead's tags without this one (any case). */
export function removeTag(current: readonly string[], tag: string): string[] {
  const t = cleanTag(tag).toLowerCase();
  return current.filter((x) => x.toLowerCase() !== t);
}

/** Tag suggestions as the person types: the studio's tags starting with (then containing) the text. */
export function suggestTags(vocab: readonly string[], typed: string, have: readonly string[], limit = 8): string[] {
  const q = cleanTag(typed).toLowerCase();
  const held = new Set(have.map((t) => t.toLowerCase()));
  const pool = vocab.filter((t) => !held.has(t.toLowerCase()));
  if (!q) return pool.slice(0, limit);
  const starts = pool.filter((t) => t.toLowerCase().startsWith(q));
  const contains = pool.filter((t) => !t.toLowerCase().startsWith(q) && t.toLowerCase().includes(q));
  return [...starts, ...contains].slice(0, limit);
}
