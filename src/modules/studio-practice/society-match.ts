/**
 * Telling society names apart (owner, 11 Nov 2026): one society typed many
 * ways ("Godrej Medow" / "Godrej Meadows", "MY HOME" / "My Home Society",
 * "Eastern River Residency Wing D") is one society; two phases or towers
 * ("Phase I" / "Phase II", "Tower 1" / "Tower 2") never are. Pure;
 * tests/society-match.test.ts pins it against Hauspire's real names.
 *
 * The rules, in order:
 * 1. "A / B" (two leads merged on AxLeads) reads as A. Brackets and
 *    anything after a comma go ("4th Axis (Punawale)", "VTP Cygnus, Kharadi").
 * 2. A wing written into the name comes out as the wing: "Wing D",
 *    "B Wing", "J Building", "A And B Building".
 * 3. Words that never tell societies apart go: society, soc, chs, the,
 *    apartments, "new data".
 * 4. Roman numerals become digits, so "Phase II" and "Phase 2" agree and
 *    "Phase I" and "Phase II" differ.
 * 5. Two names are the same society when their letters-and-digits keys are
 *    equal, or when their digits are identical and the keys are a typo
 *    apart: 1 letter for keys up to 8 long, 2 up to 15, 3 beyond
 *    (Damerau–Levenshtein, so a swapped pair counts once).
 * 6. Some values are where the lead came from, not where they live
 *    ("Digital", "Direct Visit", "Refferal", "Instagram lead"): never a society.
 */

const NOT_SOCIETY = /\b(digital|direct|ref+er+al|referal|instagram|facebook|google|website|walk ?in|lead|leads|livs?pace|livespace|square ?yards?|commercial|brochure|office)\b/i;

const FILLER = new Set(['society', 'soc', 'chs', 'the', 'apartment', 'apartments', 'apts', 'apt']);

const ROMAN: Record<string, string> = { i: '1', ii: '2', iii: '3', iv: '4', v: '5', vi: '6', vii: '7', viii: '8', ix: '9', x: '10' };

export interface ParsedSociety {
  /** What a person would call it, wing and noise taken out. */
  base: string;
  /** The comparison key: letters and digits, fillers out, roman numerals as digits. */
  key: string;
  /** The digits in the name, in order: two names whose digits differ are never one society. */
  digits: string;
  /** A wing written into the name, if any ("D", "A & B"). */
  wing: string | null;
  /** A source or a place, not a society. */
  notSociety: boolean;
}

const WING_CODE = '[a-z]\\d?';
const WING_LIST = `${WING_CODE}(?:\\s*(?:,|and|&)\\s*${WING_CODE})*`;
const WING_AFTER = new RegExp(`\\s+(?:wing|building|bldg)\\s+(${WING_LIST})\\s*$`, 'i');
const WING_BEFORE = new RegExp(`\\s+(${WING_LIST})\\s+(?:wing|building|bldg)\\s*$`, 'i');

function wingName(codes: string): string {
  return codes
    .split(/\s*(?:,|and|&)\s*/i)
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean)
    .join(' & ');
}

export function parseSociety(raw: string): ParsedSociety {
  /* "A / B": two leads merged on AxLeads. A, unless A is a source ("Refferal / VTP SEIRRA"). */
  const parts = String(raw ?? '').split(' / ');
  const read = parts.map(parseOne);
  return read.find((p) => !p.notSociety) ?? read[0]!;
}

function parseOne(raw: string): ParsedSociety {
  let s = raw;
  s = s.replace(/\([^)]*\)/g, ' ').split(',')[0]!.replace(/\s+/g, ' ').trim();
  let wing: string | null = null;
  const after = s.match(WING_AFTER);
  const before = after ? null : s.match(WING_BEFORE);
  const hit = after ?? before;
  if (hit && hit.index! > 0) {
    wing = wingName(hit[1]!);
    s = s.slice(0, hit.index).trim();
  }
  s = s.replace(/\bnew data\b/gi, ' ').replace(/\s+/g, ' ').trim();
  const words = s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter((w) => !FILLER.has(w))
    .map((w) => ROMAN[w] ?? w);
  const key = words.join('');
  return {
    base: s,
    key,
    digits: (key.match(/\d+/g) ?? []).join('-'),
    wing,
    notSociety: !key || NOT_SOCIETY.test(s),
  };
}

/** Damerau–Levenshtein (optimal string alignment): a swapped pair is one edit. */
export function typoDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2]![j - 2]! + 1);
      d[i]![j] = v;
    }
  }
  return d[a.length]![b.length]!;
}

/** How many letters a key of this length may be off and still be the same name. */
export function typoAllowance(len: number): number {
  return len <= 4 ? 0 : len <= 8 ? 1 : len <= 15 ? 2 : 3;
}

/** The same society, by the rules above. */
export function sameSociety(a: Pick<ParsedSociety, 'key' | 'digits'>, b: Pick<ParsedSociety, 'key' | 'digits'>): boolean {
  if (!a.key || !b.key) return false;
  if (a.key === b.key) return true;
  if (a.digits !== b.digits) return false;
  const allow = typoAllowance(Math.min(a.key.length, b.key.length));
  if (Math.abs(a.key.length - b.key.length) > allow) return false;
  return typoDistance(a.key, b.key) <= allow;
}

/** "GODREJ MEADOWS" and "godrej meadows" read as "Godrej Meadows"; mixed case is left as typed. */
export function tidySocietyName(s: string): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t !== t.toUpperCase() && t !== t.toLowerCase()) return t;
  return t.toLowerCase().replace(/(^|[\s.'-])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase());
}

export interface NameCount {
  name: string;
  leads: number;
}

export interface SocietyCluster {
  /** The spelling used most, tidied. */
  name: string;
  key: string;
  digits: string;
  leads: number;
  /** Every spelling in it, most leads first. */
  spellings: NameCount[];
  /** Keys other than `key`: what leads typed that should still link here. */
  aliases: string[];
}

/**
 * Group typed names into societies: exact keys first, then each smaller
 * group joins the biggest earlier one it is a typo of. Not-a-society names
 * are left out (returned apart).
 */
export function clusterSocieties(names: readonly NameCount[]): { clusters: SocietyCluster[]; notSocieties: NameCount[] } {
  const byKey = new Map<string, { parsed: ParsedSociety; spellings: Map<string, number> }>();
  const notSocieties: NameCount[] = [];
  for (const n of names) {
    const p = parseSociety(n.name);
    if (p.notSociety) {
      notSocieties.push(n);
      continue;
    }
    const g = byKey.get(p.key) ?? { parsed: p, spellings: new Map<string, number>() };
    g.spellings.set(p.base, (g.spellings.get(p.base) ?? 0) + n.leads);
    byKey.set(p.key, g);
  }
  const groups = [...byKey.values()]
    .map((g) => ({ ...g, leads: [...g.spellings.values()].reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.leads - a.leads || a.parsed.key.localeCompare(b.parsed.key));
  const clusters: { key: string; digits: string; keys: string[]; spellings: Map<string, number>; leads: number }[] = [];
  for (const g of groups) {
    const home = clusters.find((c) => sameSociety({ key: c.key, digits: c.digits }, g.parsed));
    if (home) {
      home.keys.push(g.parsed.key);
      for (const [s, n] of g.spellings) home.spellings.set(s, (home.spellings.get(s) ?? 0) + n);
      home.leads += g.leads;
    } else {
      clusters.push({ key: g.parsed.key, digits: g.parsed.digits, keys: [g.parsed.key], spellings: new Map(g.spellings), leads: g.leads });
    }
  }
  return {
    clusters: clusters.map((c) => {
      const spellings = [...c.spellings].map(([name, leads]) => ({ name, leads })).sort((a, b) => b.leads - a.leads || a.name.localeCompare(b.name));
      return { name: tidySocietyName(spellings[0]!.name), key: c.key, digits: c.digits, leads: c.leads, spellings, aliases: c.keys.filter((k) => k !== c.key) };
    }),
    notSocieties,
  };
}

/**
 * Where each typed spelling belongs among a studio's societies (by name and
 * stored aliases), or null. One pass per distinct spelling, so a studio of
 * 26,000 leads typed 300 ways costs 300 matches.
 */
export function societyTargets(typed: readonly string[], societies: readonly { id: string; name: string; aliases: readonly string[] }[]): Map<string, string | null> {
  const list = societies.map((s) => ({ id: s.id, key: parseSociety(s.name).key, aliases: s.aliases }));
  const out = new Map<string, string | null>();
  for (const t of typed) if (!out.has(t)) out.set(t, matchSociety(t, list)?.id ?? null);
  return out;
}

/**
 * The society a typed name belongs to, among existing ones (each with its
 * key and aliases): an exact key or alias first, then a typo of one.
 */
export function matchSociety<T extends { id: string; key: string; aliases: readonly string[] }>(typed: string, societies: readonly T[]): T | null {
  const p = parseSociety(typed);
  if (p.notSociety) return null;
  const exact = societies.find((s) => s.key === p.key || s.aliases.includes(p.key));
  if (exact) return exact;
  let best: { s: T; d: number } | null = null;
  for (const s of societies) {
    for (const k of [s.key, ...s.aliases]) {
      const kd = (k.match(/\d+/g) ?? []).join('-');
      if (!sameSociety({ key: k, digits: kd }, p)) continue;
      const d = typoDistance(k, p.key);
      if (!best || d < best.d) best = { s, d };
    }
  }
  return best?.s ?? null;
}
