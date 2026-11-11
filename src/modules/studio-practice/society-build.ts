/**
 * Building a studio's societies from its leads (owner, 11 Nov 2026): every
 * society typed on 3 or more leads becomes a society, typos merged
 * (society-match.ts), owned by whoever has most of its leads, its wings from
 * the leads' wing field or the wing written in the name. Pure; the writes are
 * scripts/build-societies.ts. tests/society-build.test.ts.
 *
 * Existing societies are reused, never duplicated: a group that matches one
 * (by name, a stored spelling or a typo of either) adds its spellings to it.
 */

import { tidyWing } from './society-import';
import { clusterSocieties, matchSociety, parseSociety, type NameCount } from './society-match';

export interface BuildLead {
  id: string;
  society: string | null;
  locality: string | null;
  /** The lead's wing field, as typed. */
  wing: string | null;
  assignedToId: string | null;
}

export interface BuildExisting {
  id: string;
  name: string;
  aliases: string[];
}

export interface BuildSociety {
  /** An existing society's id, or `new:<n>`. */
  ref: string;
  name: string;
  /** The matching key of the name (society-match.ts), and the spellings that also link. */
  matchKey: string;
  aliases: string[];
  locality: string | null;
  ownerId: string | null;
  leads: number;
  spellings: NameCount[];
  wings: string[];
  existing: boolean;
}

export interface BuildPlan {
  societies: BuildSociety[];
  /** Lead id → society ref and wing name (null: no wing known). */
  links: Map<string, { ref: string; wing: string | null }>;
  /** Names that are a source, not a society ("Digital", "Refferal"). */
  notSocieties: NameCount[];
  /** Real names on fewer leads than the minimum, matching no society: left as text. */
  small: NameCount[];
}

const mode = <T>(xs: readonly T[]): T | null => {
  const n = new Map<T, number>();
  for (const x of xs) n.set(x, (n.get(x) ?? 0) + 1);
  let best: T | null = null;
  let c = 0;
  for (const [x, k] of n) if (k > c) [best, c] = [x, k];
  return best;
};

export function planSocietyBuild(leads: readonly BuildLead[], existing: readonly BuildExisting[], min = 3): BuildPlan {
  const typed = new Map<string, number>();
  for (const l of leads) {
    const t = l.society?.trim();
    if (t) typed.set(t, (typed.get(t) ?? 0) + 1);
  }
  const { clusters, notSocieties } = clusterSocieties([...typed].map(([name, n]) => ({ name, leads: n })));
  const known = existing.map((e) => ({ id: e.id, name: e.name, key: parseSociety(e.name).key, aliases: e.aliases }));

  const societies: BuildSociety[] = [];
  const small: NameCount[] = [];
  /** Typed spelling (base, as clustered) → society ref. */
  const refOfSpelling = new Map<string, string>();
  let fresh = 0;
  for (const c of clusters) {
    const hit = matchSociety(c.name, known) ?? c.spellings.map((s) => matchSociety(s.name, known)).find(Boolean) ?? null;
    if (!hit && c.leads < min) {
      small.push(...c.spellings);
      continue;
    }
    const ref = hit ? hit.id : `new:${fresh++}`;
    const prior = societies.find((s) => s.ref === ref);
    const keys = [c.key, ...c.aliases];
    if (prior) {
      prior.leads += c.leads;
      prior.spellings.push(...c.spellings);
      for (const k of keys) if (k !== prior.matchKey && !prior.aliases.includes(k)) prior.aliases.push(k);
    } else {
      const matchKey = hit ? hit.key : c.key;
      const aliases = [...new Set([...(hit?.aliases ?? []), ...keys])].filter((k) => k !== matchKey);
      societies.push({ ref, name: hit ? hit.name : c.name, matchKey, aliases, locality: null, ownerId: null, leads: c.leads, spellings: [...c.spellings], wings: [], existing: !!hit });
    }
    for (const s of c.spellings) refOfSpelling.set(s.name, ref);
  }

  const links = new Map<string, { ref: string; wing: string | null }>();
  const members = new Map<string, BuildLead[]>();
  for (const l of leads) {
    const t = l.society?.trim();
    if (!t) continue;
    const p = parseSociety(t);
    const ref = refOfSpelling.get(p.base);
    if (!ref) continue;
    const wing = tidyWing(l.wing ?? '') || p.wing || null;
    links.set(l.id, { ref, wing });
    members.set(ref, [...(members.get(ref) ?? []), l]);
  }
  for (const s of societies) {
    const ls = members.get(s.ref) ?? [];
    s.locality = mode(ls.map((l) => l.locality?.trim()).filter((x): x is string => !!x));
    const owners = ls.map((l) => l.assignedToId);
    const top = mode(owners.filter((o): o is string => !!o));
    const topN = top ? owners.filter((o) => o === top).length : 0;
    const nobody = owners.filter((o) => !o).length;
    /* Whoever has most of its leads; nobody when most of its leads are nobody's. */
    s.ownerId = top && topN >= nobody ? top : null;
    s.wings = [...new Set(ls.map((l) => links.get(l.id)!.wing).filter((w): w is string => !!w))].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  }
  return { societies: societies.sort((a, b) => b.leads - a.leads || a.name.localeCompare(b.name)), links, notSocieties, small };
}
