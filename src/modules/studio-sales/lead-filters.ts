/**
 * The leads list's filters, as one shape (leads at scale, 12 Oct 2026; the
 * AxLeads look, same day). Pure, no `server-only`: the filter panel
 * (browser), the list and board reads, the KPI cards, the dashboard, the
 * bulk actions and saved views all speak it. Tested in
 * tests/studio-leads-scale.test.ts, studio-leads-axleads.test.ts and
 * studio-leads-look.test.ts.
 *
 * ## One definition per number
 *
 * Every KPI card and dashboard number is `count(where(F))`, and clicking it
 * shows the list with the same `F`: both come from `leadWhere` (lead-where.ts,
 * server only — the Prisma `where` builders live there so this file carries no
 * Prisma into the browser bundle). The
 * card rules are AxLeads' (lib/leads/list.ts `rules`), restated for our
 * tables: a scheduled call is `nextActionOn`, a task is `StudioTask`.
 *
 * ## The scope is not a filter
 *
 * `scopedLeadWhere` (lead-where.ts) ANDs the person's scope (roles.ts: a salesperson's own
 * leads, or the pool to claim from) around whatever the URL asked for. A URL
 * asking for somebody else's leads cannot widen what they see.
 */

import { parseRange, rangeLabel, rangeToString, type RangeToken } from './ist-range';
import { LOST_LABELS, QUIET_AFTER_DAYS, SOURCE_LABELS, type ClientSourceName, type LostReasonName } from '@/modules/studio-practice/vocabulary';

/**
 * When the follow-up falls. `overdue` / `today` / `week` are AxLeads' Due
 * filter (Overdue, Due today, Due this week); the rest are the dashboard's.
 */
export type DueFilter = 'overdue' | 'today' | 'week' | 'missed' | 'due' | 'upcoming' | 'none';
export type KindFilter = 'open' | 'won' | 'lost' | 'closed';
export type SortKey = 'newest' | 'oldest' | 'lastactive' | 'followup' | 'contacted' | 'name';
/** The KPI cards that filter (AxLeads), and the Today button. */
export type KpiFilter = 'today' | 'pending' | 'callbacks' | 'tasks' | 'needs';

export const DUE_LABELS: Record<DueFilter, string> = {
  overdue: 'Overdue',
  today: 'Due today',
  week: 'Due this week',
  missed: 'Missed follow-up',
  due: 'Due today or missed',
  upcoming: 'Follow-up later',
  none: 'No follow-up date',
};

/** The Due choices the filter panel offers, in AxLeads' order. */
export const PANEL_DUE: readonly DueFilter[] = ['overdue', 'today', 'week'];

export const KIND_LABELS: Record<KindFilter, string> = {
  open: 'Open',
  won: 'Won',
  lost: 'Lost',
  closed: 'Finished or lost',
};

export const KPI_LABELS: Record<KpiFilter, string> = {
  today: 'Today',
  pending: 'Pending',
  callbacks: 'Callbacks',
  tasks: 'Tasks',
  needs: 'Needs action',
};

export const SORT_LABELS: Record<SortKey, string> = {
  newest: 'Most recent',
  oldest: 'Oldest first',
  lastactive: 'Last active',
  followup: 'Next call',
  contacted: 'Longest since a call',
  name: 'Name',
};

/** The sort menu (AxLeads): Most recent, Oldest first, Last active, Next call. */
export const SORT_MENU: readonly SortKey[] = ['newest', 'oldest', 'lastactive', 'followup'];

export interface LeadFilters {
  /** Name, society or phone (3+ digits). */
  q?: string;
  /** Any of: one of ours (`INSTAGRAM`) or one of the studio's own names (`own:<id>`). */
  source?: string[];
  /** Any of these columns. */
  stage?: string[];
  kind?: KindFilter;
  /** `pool` nobody · `anyone` somebody · `me` · a member id. */
  owner?: string;
  /**
   * Which pool (sales roles and teams, owner 22 Oct 2026): `studio` for the
   * studio pool, or a head's member id for their team pool. Unassigned leads
   * only; always inside the person's own pool fence.
   */
  poolTeam?: string;
  /** Any of these follow-up buckets (open leads with a follow-up). */
  due?: DueFilter[];
  /** Never spoken to (open leads). */
  never?: boolean;
  /** Spoken to before, nothing for QUIET_AFTER_DAYS (open leads). */
  quiet?: boolean;
  lost?: LostReasonName;
  added?: RangeToken;
  contacted?: RangeToken;
  meeting?: RangeToken;
  /** A quotation revision sent in this range. */
  quoted?: RangeToken;
  /** A sales final marked in this range. */
  final?: RangeToken;
  /** Booked in this range (`any`: booked at all). */
  booked?: RangeToken;
  /**
   * Cold 7d+ / needs attention (AxLeads `stale`): open, not snoozed into the
   * future, and nothing at all has happened to it for QUIET_AFTER_DAYS —
   * not created, not contacted, no timeline line.
   */
  stale?: boolean;
  /** The studio's own fields: key → any of these values (`NOT_SET` for empty). */
  custom?: Record<string, string[]>;
  /** Carrying any of these tags. */
  tags?: string[];
  /** A KPI card (or the Today button) switched on. */
  kpi?: KpiFilter;
}

/** "Not set": a custom field with nothing in it. */
export const NOT_SET = '__none';

const KINDS: readonly KindFilter[] = ['open', 'won', 'lost', 'closed'];
const DUES = Object.keys(DUE_LABELS) as DueFilter[];
const KPIS = Object.keys(KPI_LABELS) as KpiFilter[];
export const SORTS: readonly SortKey[] = ['newest', 'oldest', 'lastactive', 'followup', 'contacted', 'name'];
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const FIELD_KEY = /^[a-z0-9_]{1,40}$/;
const RANGE_KEYS = ['added', 'contacted', 'meeting', 'quoted', 'final', 'booked'] as const;
type RangeKey = (typeof RANGE_KEYS)[number];

export const RANGE_FILTER_LABELS: Record<RangeKey, string> = {
  added: 'Added',
  contacted: 'Contacted',
  meeting: 'Meeting',
  quoted: 'Quotation sent',
  final: 'Sales final',
  booked: 'Booked',
};

/** URLSearchParams, or a Next `searchParams` object. */
type Params = URLSearchParams | Record<string, string | string[] | undefined>;

function all(params: Params, key: string): string[] {
  if (params instanceof URLSearchParams) return params.getAll(key);
  const v = params[key];
  return Array.isArray(v) ? v : typeof v === 'string' ? [v] : [];
}
const one = (params: Params, key: string): string | undefined => all(params, key)[0];
/** A list value: repeated params, each possibly comma-separated (ids and enums only). */
function list(params: Params, key: string): string[] {
  return [...new Set(all(params, key).flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean))];
}

const isSource = (v: string) => Object.prototype.hasOwnProperty.call(SOURCE_LABELS, v) || (v.startsWith('own:') && ID.test(v.slice(4)));

/** A tag as stored: trimmed, single spaces, at most 40 characters. */
export function cleanTag(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, 40);
}

/** The filters in a URL. Anything unknown or malformed is dropped, never guessed. */
export function parseLeadFilters(params: Params): LeadFilters {
  const f: LeadFilters = {};
  const q = one(params, 'q')?.trim();
  if (q) f.q = q.slice(0, 80);
  const source = list(params, 'source').filter(isSource).slice(0, 20);
  if (source.length) f.source = source;
  const stage = list(params, 'stage').filter((s) => ID.test(s)).slice(0, 40);
  if (stage.length) f.stage = stage;
  const kind = one(params, 'kind');
  if (kind && (KINDS as readonly string[]).includes(kind)) f.kind = kind as KindFilter;
  const owner = one(params, 'owner');
  if (owner && ID.test(owner)) f.owner = owner;
  const poolTeam = one(params, 'pool');
  if (poolTeam && ID.test(poolTeam)) f.poolTeam = poolTeam;
  const due = list(params, 'due').filter((d): d is DueFilter => (DUES as string[]).includes(d));
  if (due.length) f.due = due;
  if (one(params, 'never') === '1') f.never = true;
  if (one(params, 'quiet') === '1') f.quiet = true;
  const lost = one(params, 'lost');
  if (lost && Object.prototype.hasOwnProperty.call(LOST_LABELS, lost)) f.lost = lost as LostReasonName;
  for (const key of RANGE_KEYS) {
    const r = parseRange(one(params, key));
    if (r) f[key] = r;
  }
  if (one(params, 'stale') === '1') f.stale = true;
  const tags = [...new Set(all(params, 'tag').map(cleanTag).filter(Boolean))].slice(0, 20);
  if (tags.length) f.tags = tags;
  const kpi = one(params, 'kpi');
  if (kpi && (KPIS as string[]).includes(kpi)) f.kpi = kpi as KpiFilter;
  const custom = readCustom(params);
  if (custom) f.custom = custom;
  return f;
}

/** The filters as a query string (no leading `?`), in a fixed order so equal filters compare equal. */
export function leadFiltersToQuery(f: LeadFilters): string {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.source?.length) p.set('source', [...f.source].sort().join(','));
  if (f.stage?.length) p.set('stage', [...f.stage].sort().join(','));
  if (f.kind) p.set('kind', f.kind);
  if (f.owner) p.set('owner', f.owner);
  if (f.poolTeam) p.set('pool', f.poolTeam);
  if (f.due?.length) p.set('due', [...f.due].sort().join(','));
  if (f.never) p.set('never', '1');
  if (f.quiet) p.set('quiet', '1');
  if (f.lost) p.set('lost', f.lost);
  for (const key of RANGE_KEYS) {
    const r = f[key];
    if (r) p.set(key, rangeToString(r));
  }
  if (f.stale) p.set('stale', '1');
  for (const t of [...(f.tags ?? [])].sort()) p.append('tag', t);
  if (f.kpi) p.set('kpi', f.kpi);
  for (const [k, vs] of Object.entries(f.custom ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
    for (const v of [...vs].sort()) p.append(`cf.${k}`, v);
  }
  return p.toString();
}

export function hasFilters(f: LeadFilters): boolean {
  return leadFiltersToQuery(f).length > 0;
}

/** A list link for these filters. */
export function leadsHref(f: LeadFilters, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams(leadFiltersToQuery(f));
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  const s = p.toString();
  return `/studio/clients${s ? `?${s}` : ''}`;
}

/**
 * A Phase 1 salesperson's `owner`: their own leads, or (owner, 12 Oct 2026)
 * the pool to claim from. Nothing else — never a colleague's. (A sales role
 * with team reach may also pick someone in their team: lead-where.ts.)
 */
export function salesOwner(f: LeadFilters): 'me' | 'pool' {
  return f.owner === 'pool' ? 'pool' : 'me';
}

// ── Sorting and pages ─────────────────────────────────────────────

export const PAGE_SIZE = 50;

export function parseSort(raw: unknown): SortKey {
  return typeof raw === 'string' && (SORTS as readonly string[]).includes(raw) ? (raw as SortKey) : 'newest';
}

/** Where the last row of a page stood: its sort value (ISO date or name, or null) and id. */
export interface Cursor {
  v: string | null;
  id: string;
}

const FIELD: Record<SortKey, 'createdAt' | 'updatedAt' | 'nextActionOn' | 'lastContactedAt' | 'name'> = {
  newest: 'createdAt',
  oldest: 'createdAt',
  lastactive: 'updatedAt',
  followup: 'nextActionOn',
  contacted: 'lastContactedAt',
  name: 'name',
};

export function cursorOf(
  sort: SortKey,
  row: { id: string; name: string; createdAt: Date; updatedAt?: Date; nextActionOn: Date | null; lastContactedAt: Date | null },
): string {
  const raw = row[FIELD[sort]];
  const v = raw === null || raw === undefined ? null : raw instanceof Date ? raw.toISOString() : raw;
  return JSON.stringify({ v, id: row.id });
}

export function parseCursor(raw: unknown): Cursor | null {
  if (typeof raw !== 'string' || raw.length > 400) return null;
  try {
    const c = JSON.parse(raw) as unknown;
    if (!c || typeof c !== 'object') return null;
    const { v, id } = c as { v?: unknown; id?: unknown };
    if (typeof id !== 'string' || !ID.test(id)) return null;
    if (v !== null && typeof v !== 'string') return null;
    return { v: v as string | null, id };
  } catch {
    return null;
  }
}

// ── Words ─────────────────────────────────────────────────────────

/** One chip: which filter, and for a list filter which value. */
export interface FilterChip {
  key: keyof LeadFilters;
  /** A custom field's key. */
  field?: string;
  /** One value of a list filter (a stage, a source, a tag…). */
  value?: string;
  label: string;
}

/**
 * The filters as short chips: "Facebook", "Overdue", "Added: Today". Names
 * for ids come from the caller (this file is pure).
 */
export function describeFilters(
  f: LeadFilters,
  names: { member?: (id: string) => string | null; stage?: (id: string) => string | null; source?: (id: string) => string | null; field?: (key: string) => string | null } = {},
): FilterChip[] {
  const out: FilterChip[] = [];
  if (f.q) out.push({ key: 'q', label: `"${f.q}"` });
  for (const s of f.source ?? []) {
    out.push({ key: 'source', value: s, label: s.startsWith('own:') ? (names.source?.(s.slice(4)) ?? 'A source of yours') : (SOURCE_LABELS[s as ClientSourceName] ?? s) });
  }
  for (const s of f.stage ?? []) out.push({ key: 'stage', value: s, label: names.stage?.(s) ?? 'A column' });
  if (f.kind) out.push({ key: 'kind', label: KIND_LABELS[f.kind] });
  if (f.owner) {
    out.push({
      key: 'owner',
      label:
        f.owner === 'pool' ? 'Nobody has it (pool)' : f.owner === 'anyone' ? 'Somebody has it' : f.owner === 'me' ? 'Mine' : names.member?.(f.owner) ? `${names.member(f.owner)}'s` : 'Somebody who has left',
    });
  }
  if (f.poolTeam) {
    out.push({ key: 'poolTeam', label: f.poolTeam === 'studio' ? 'Studio pool' : names.member?.(f.poolTeam) ? `${names.member(f.poolTeam)}’s team pool` : 'A team pool' });
  }
  for (const d of f.due ?? []) out.push({ key: 'due', value: d, label: DUE_LABELS[d] });
  if (f.never) out.push({ key: 'never', label: 'Not contacted yet' });
  if (f.quiet) out.push({ key: 'quiet', label: `Gone quiet (${QUIET_AFTER_DAYS}+ days)` });
  if (f.stale) out.push({ key: 'stale', label: `Cold ${QUIET_AFTER_DAYS}d+` });
  if (f.lost) out.push({ key: 'lost', label: `Lost: ${LOST_LABELS[f.lost]}` });
  for (const key of RANGE_KEYS) {
    const r = f[key];
    if (r) out.push({ key, label: `${RANGE_FILTER_LABELS[key]}: ${rangeLabel(r)}` });
  }
  for (const t of f.tags ?? []) out.push({ key: 'tags', value: t, label: `#${t}` });
  for (const [k, vs] of Object.entries(f.custom ?? {})) {
    for (const v of vs) out.push({ key: 'custom', field: k, value: v, label: `${names.field?.(k) ?? k}: ${v === NOT_SET ? 'Not set' : v}` });
  }
  if (f.kpi) out.push({ key: 'kpi', label: KPI_LABELS[f.kpi] });
  return out;
}

/** The filters without one key (a chip's ×). */
export function without(f: LeadFilters, key: keyof LeadFilters): LeadFilters {
  const next = { ...f };
  delete next[key];
  return next;
}

/** The filters without one chip: a list filter loses only that value. */
export function withoutChip(f: LeadFilters, chip: Pick<FilterChip, 'key' | 'field' | 'value'>): LeadFilters {
  if (chip.key === 'custom' && chip.field) {
    const rest = (f.custom?.[chip.field] ?? []).filter((v) => chip.value !== undefined && v !== chip.value);
    return withCustom(f, chip.field, rest);
  }
  if ((chip.key === 'source' || chip.key === 'stage' || chip.key === 'due' || chip.key === 'tags') && chip.value !== undefined) {
    const rest = ((f[chip.key] as string[] | undefined) ?? []).filter((v) => v !== chip.value);
    return rest.length ? { ...f, [chip.key]: rest } : without(f, chip.key);
  }
  return without(f, chip.key);
}

/** The filters with one custom field set to these values (none clears it). */
export function withCustom(f: LeadFilters, key: string, values: string | string[]): LeadFilters {
  const list = (Array.isArray(values) ? values : values ? [values] : []).filter(Boolean);
  const custom = { ...(f.custom ?? {}) };
  if (list.length) custom[key] = list;
  else delete custom[key];
  const next = without(f, 'custom');
  return Object.keys(custom).length > 0 ? { ...next, custom } : next;
}

/** `cf.<key>=<value>` pairs from the URL (repeatable); at most 10 fields, each bounded. */
function readCustom(params: Params): Record<string, string[]> | null {
  const entries: [string, string][] =
    params instanceof URLSearchParams
      ? [...params.entries()]
      : Object.entries(params).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v] as [string, string]] : Array.isArray(v) ? v.map((x) => [k, x] as [string, string]) : []));
  const out: Record<string, string[]> = {};
  for (const [k, v] of entries) {
    if (!k.startsWith('cf.')) continue;
    const key = k.slice(3);
    const value = v.trim();
    if (!FIELD_KEY.test(key) || value.length === 0 || value.length > 80) continue;
    if (!out[key] && Object.keys(out).length >= 10) continue;
    const vs = (out[key] ??= []);
    if (!vs.includes(value) && vs.length < 20) vs.push(value);
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * The stale-lead review's query: the page's filters (owner, source, tags…)
 * without a KPI card, plus Cold 7d+, longest-silent first. The banner counts
 * `kpis.stale` over exactly these filters, so the review, its "select all"
 * and its batches work on the same leads the banner promised.
 */
export function staleReviewQuery(pageQuery: string): string {
  const f = parseLeadFilters(new URLSearchParams(pageQuery));
  return `${leadFiltersToQuery({ ...without(f, 'kpi'), stale: true })}&sort=contacted`;
}
