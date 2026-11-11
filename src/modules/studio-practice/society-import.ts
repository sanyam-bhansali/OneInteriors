/**
 * Importing a society sheet (owner, 11 Nov 2026; Max plan). Pure
 * (CONTRIBUTING §9.5): the browser reads the file (.xlsx or .csv) into rows,
 * the person matches the columns, and `planSocietyImport` turns that into the
 * societies, wings and owners it will write. tests/society-import.test.ts.
 *
 * A Hauspire sheet is usually one society's flat owners: wing, flat number,
 * owner name, phone, sometimes the possession month. A sheet without a
 * society column is for the one society typed on the import screen.
 */

import { normalisePhone, tidyName } from './csv';
import { parsePossession, societyKey } from './society-rules';

export type SocietyColumn = 'society' | 'wing' | 'flat' | 'name' | 'phone' | 'possession' | 'locality' | 'skip';

export const SOCIETY_COLUMN_LABELS: Record<SocietyColumn, string> = {
  society: 'Society',
  wing: 'Wing / tower',
  flat: 'Flat number',
  name: 'Owner name',
  phone: 'Phone',
  possession: 'Possession month',
  locality: 'Locality',
  skip: 'Leave out',
};

/**
 * The sheet format the import screen shows and offers as a template
 * (owner, 11 Nov 2026). Only Owner name or Phone is needed on a row; the
 * rest fill in the society. Headers in this exact wording are matched
 * without any choosing.
 */
export const SOCIETY_TEMPLATE: readonly { header: string; column: SocietyColumn; need: string; example: [string, string] }[] = [
  { header: 'Owner name', column: 'name', need: 'Name or phone on every row', example: ['Rahul Deshpande', 'Priya Shah'] },
  { header: 'Phone', column: 'phone', need: 'Name or phone on every row', example: ['9822055310', '9876543210'] },
  { header: 'Society', column: 'society', need: 'Yes, or typed once on the import screen', example: ['Skyline Heights', 'Skyline Heights'] },
  { header: 'Wing', column: 'wing', need: 'Optional', example: ['A', 'B'] },
  { header: 'Flat number', column: 'flat', need: 'Optional', example: ['1203', '704'] },
  { header: 'Possession month', column: 'possession', need: 'Optional', example: ['Mar 2027', '2027-09'] },
  { header: 'Locality', column: 'locality', need: 'Optional', example: ['Ravet', 'Ravet'] },
];

/** The template as CSV text: the headers and two example rows. */
export function societyTemplateCsv(): string {
  const q = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = [SOCIETY_TEMPLATE.map((c) => c.header), SOCIETY_TEMPLATE.map((c) => c.example[0]), SOCIETY_TEMPLATE.map((c) => c.example[1])];
  return rows.map((r) => r.map(q).join(',')).join('\r\n') + '\r\n';
}

const GUESS: [SocietyColumn, RegExp][] = [
  ['phone', /phone|mobile|contact|cell|whats/i],
  ['possession', /possession|handover|poss\b|ready/i],
  ['wing', /wing|tower|building|bldg|block/i],
  ['flat', /flat|unit|apartment|apt|door|^no\.?$/i],
  ['society', /society|project|complex|site/i],
  ['locality', /locality|area|location|address/i],
  ['name', /name|owner|customer|client|buyer|member/i],
];

/** A first guess at each column from its header. Each kind is used once. */
export function guessSocietyColumns(headers: readonly string[]): SocietyColumn[] {
  const used = new Set<SocietyColumn>();
  return headers.map((h) => {
    const hit = GUESS.find(([k, re]) => !used.has(k) && re.test(h.trim()));
    if (!hit) return 'skip';
    used.add(hit[0]);
    return hit[0];
  });
}

export interface SocietyImportOwner {
  name: string;
  phone: string | null;
  flat: string | null;
  wing: string | null;
}

export interface SocietyImportGroup {
  name: string;
  key: string;
  locality: string | null;
  /** Wing name → possession month, or null when the sheet does not say. */
  wings: Map<string, Date | null>;
  owners: SocietyImportOwner[];
}

export interface SocietyImportPlan {
  societies: SocietyImportGroup[];
  /** Rows with neither a usable phone nor a name. */
  skipped: number;
  /** Rows whose society could not be told (no column, no default). */
  noSociety: number;
  /** The same phone twice in the sheet: kept once. */
  repeats: number;
  /** Possession cells that were not a month. */
  badDates: number;
}

const cell = (row: readonly string[], i: number) => (i >= 0 ? String(row[i] ?? '').trim() : '');

/** "b", "B wing", "Wing B", "Tower-3" → "B", "B", "B", "Tower 3". */
export function tidyWing(raw: string): string {
  const s = raw.trim().replace(/\s+/g, ' ').replace(/[-_]+/g, ' ');
  if (!s) return '';
  const m = s.match(/^(?:wing\s+)?([a-z0-9]{1,3})(?:\s+wing)?$/i);
  if (m) return m[1].toUpperCase();
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase()).slice(0, 40);
}

export function planSocietyImport(
  rows: readonly (readonly string[])[],
  columns: readonly SocietyColumn[],
  defaults: { society?: string; locality?: string; possession?: Date | null } = {},
): SocietyImportPlan {
  const at = (k: SocietyColumn) => columns.indexOf(k);
  const iSociety = at('society');
  const iWing = at('wing');
  const iFlat = at('flat');
  const iName = at('name');
  const iPhone = at('phone');
  const iPos = at('possession');
  const iLoc = at('locality');
  const groups = new Map<string, SocietyImportGroup>();
  const seenPhones = new Set<string>();
  let skipped = 0;
  let noSociety = 0;
  let repeats = 0;
  let badDates = 0;

  for (const row of rows) {
    if (row.every((c) => !String(c ?? '').trim())) continue;
    const societyName = (cell(row, iSociety) || defaults.society || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    const key = societyKey(societyName);
    if (!key) {
      noSociety++;
      continue;
    }
    const phone = normalisePhone(cell(row, iPhone));
    const name = tidyName(cell(row, iName)).slice(0, 120);
    const flat = cell(row, iFlat).slice(0, 20) || null;
    const wing = tidyWing(cell(row, iWing)) || null;
    const posRaw = cell(row, iPos);
    const possession = posRaw ? parsePossession(posRaw) : (defaults.possession ?? null);
    if (posRaw && !possession) badDates++;

    let g = groups.get(key);
    if (!g) {
      g = { name: societyName, key, locality: (cell(row, iLoc) || defaults.locality || '').slice(0, 80) || null, wings: new Map(), owners: [] };
      groups.set(key, g);
    }
    const w = wing ?? 'Main';
    if (!g.wings.has(w) || (possession && !g.wings.get(w))) g.wings.set(w, possession);

    if (!phone && !name) {
      skipped++;
      continue;
    }
    if (phone) {
      if (seenPhones.has(phone)) {
        repeats++;
        continue;
      }
      seenPhones.add(phone);
    }
    g.owners.push({ name: name || (flat ? `Owner, flat ${flat}` : 'Flat owner'), phone, flat, wing: w });
  }
  return { societies: [...groups.values()], skipped, noSociety, repeats, badDates };
}

/** The plan as plain JSON for the server action (Maps and Dates do not cross). */
export interface SocietyImportPayload {
  sheet: string;
  /** Who owns the new societies. */
  ownerId: string | null;
  /** Who gets the new leads now; null = nobody yet (give them out on the society page). */
  leadsTo?: string | null;
  societies: {
    name: string;
    locality: string | null;
    wings: { name: string; possession: string | null }[];
    owners: SocietyImportOwner[];
  }[];
}

export function toPayload(plan: SocietyImportPlan, sheet: string, ownerId: string | null, leadsTo: string | null = ownerId): SocietyImportPayload {
  return {
    sheet: sheet.slice(0, 120),
    ownerId,
    leadsTo,
    societies: plan.societies.map((g) => ({
      name: g.name,
      locality: g.locality,
      wings: [...g.wings].map(([name, d]) => ({ name, possession: d ? d.toISOString().slice(0, 10) : null })),
      owners: g.owners,
    })),
  };
}
