/**
 * Calling numbers (improvement 7, owner 22 Oct 2026). Pure, no
 * `server-only`: the rules for what counts as a dial, a connect, a lead
 * reached and a step moved on, and the arithmetic that turns the loader's
 * grouped rows into the "Calling" tab of lead analytics. Tested in
 * tests/studio-call-stats.test.ts. The reads are call-stats-data.ts, which
 * groups in SQL and hands this file only small, already-counted rows.
 *
 * ## Why this exists
 *
 * Hauspire's five salespeople ring down about 14,500 "New" leads through
 * Calling 1–4. AxLeads showed them a dial count and nothing else, so nobody
 * could say whether a slow week was too few dials, too few people picking
 * up, or leads going stale before anybody rang. These numbers answer those
 * three, per person, for a range of India days.
 *
 * ## The definitions (one place, so the SQL and the page cannot disagree)
 *
 * - **Dial**: a CONTACTED line whose outcome is a phone call. Met them,
 *   visited the site and messaged them are contact but not dials. A line
 *   with no outcome at all is the old "Spoke to them" button, so it is a
 *   dial and a connect. An imported AxLeads call whose outcome we could not
 *   map (outcome null) is a dial, not a connect: we know somebody rang, not
 *   that anybody answered.
 * - **Connect**: a dial where they picked up: spoke, asked us to call back,
 *   or said not interested. Wrong number is a dial and not a connect.
 * - **Connect rate**: connects ÷ dials, whole per cent; none when no dials.
 * - **Leads reached**: distinct leads with at least one connect in the range
 *   (a lead reached twice is one). "Leads dialled" is the same for dials.
 *   The studio's total is its own distinct count, not the people's sum (two
 *   people can reach the same lead).
 * - **Tries before they picked up** (median): for every lead whose FIRST
 *   connect ever falls in the range, the dials on it before that connect, by
 *   anybody. 0 means the first ring got through. Credited to whoever made
 *   the connect.
 * - **Time to first call** (median): for every lead that ARRIVED in the
 *   range (its own created time, which the AxLeads import keeps; never the
 *   day it was imported), the time from arriving to its first dial, by
 *   anybody, credited to whoever dialled. Clock time: nights and Sundays
 *   count, because a lead that comes in at 9 pm and is rung at 10 am waited
 *   13 hours whatever our calling hours say. Leads not rung yet are counted
 *   separately, never as zero.
 * - **Moved on** (stage to stage): of the leads that entered a step in the
 *   range, how many later reached any step after it, up to now. Steps are
 *   the studio's own columns in board order, lost ones aside, with the
 *   calling steps (Calling 1–4) as one step. A lead enters the arrival step
 *   by being created; it enters any other step by being moved into it from
 *   outside it. Recent ranges read lower simply because those leads have had
 *   less time; the page says so.
 *
 * Days are India days (midnight to midnight IST), whatever the server says.
 */

import { addDays, istDay } from '@/modules/project/working-days';
import { istDayEnd, istDayStart, parseRange, rangeLabel, type RangeToken } from './ist-range';

// ── What a call was ───────────────────────────────────────────────

/** Outcomes where they picked up. */
export const CONNECT_OUTCOMES: readonly string[] = ['spoke', 'busy', 'not_interested'];

/** Contact that is not a phone call: never a dial. */
export const NOT_DIAL_OUTCOMES: readonly string[] = ['met', 'site_visit', 'messaged'];

/** The outcome a line without one gets: the old "Spoke to them" button. */
export const NO_OUTCOME = 'spoke';

export type CallKind = 'connect' | 'missed' | 'not_a_dial';

/**
 * What one CONTACTED line counts as. `outcome` is as stored: a string, `null`
 * (an imported call we could not map), or `undefined` (no outcome at all,
 * read as {@link NO_OUTCOME}).
 */
export function callKind(outcome: string | null | undefined): CallKind {
  const o = outcome === undefined ? NO_OUTCOME : outcome;
  if (o !== null && CONNECT_OUTCOMES.includes(o)) return 'connect';
  if (o !== null && NOT_DIAL_OUTCOMES.includes(o)) return 'not_a_dial';
  return 'missed';
}

export const isDial = (outcome: string | null | undefined): boolean => callKind(outcome) !== 'not_a_dial';
export const isConnect = (outcome: string | null | undefined): boolean => callKind(outcome) === 'connect';

// ── The range ─────────────────────────────────────────────────────

export type CallRangePreset = 'today' | '7d' | '30d';
export const CALL_RANGE_PRESETS: readonly CallRangePreset[] = ['today', '7d', '30d'];
export const CALL_RANGE_LABELS: Record<CallRangePreset, string> = { today: 'Today', '7d': '7 days', '30d': '30 days' };
export const CALL_RANGE_DEFAULT: CallRangePreset = '7d';
/** A custom range longer than this is cut to its last this-many days. */
export const MAX_RANGE_DAYS = 366;

export interface CallRange {
  token: CallRangePreset | { from: string; to: string };
  /** "Today", "Last 7 days", "1 Oct – 12 Oct". */
  label: string;
  /** First and last India day, inclusive. */
  fromDay: string;
  toDay: string;
  /** IST midnight of the first day, and the last millisecond of the last. */
  from: Date;
  to: Date;
  /** Every India day in the range, oldest first (the bars). */
  days: string[];
}

/**
 * The range a URL asked for: `today`, `7d`, `30d`, or `2026-10-01..2026-10-12`
 * (or two separate `from` / `to` days from the custom form). Anything else
 * is the last 7 days. A custom range ending after today ends today; one
 * longer than {@link MAX_RANGE_DAYS} keeps its last days.
 */
export function callRange(raw: { range?: unknown; from?: unknown; to?: unknown }, now: Date): CallRange {
  const today = istDay(now);
  let token: RangeToken | null = null;
  if (typeof raw.from === 'string' && raw.from && typeof raw.to === 'string' && raw.to) token = parseRange(`${raw.from}..${raw.to}`);
  else if (typeof raw.from === 'string' && raw.from) token = parseRange(raw.from);
  if (!token) token = parseRange(raw.range);
  if (typeof token === 'string' && !(CALL_RANGE_PRESETS as readonly string[]).includes(token)) token = null;
  return rangeFor(token === null ? CALL_RANGE_DEFAULT : (token as CallRange['token']), today);
}

function rangeFor(asked: CallRange['token'], today: string): CallRange {
  let token = asked;

  let fromDay: string;
  let toDay: string;
  if (typeof token === 'string') {
    toDay = today;
    fromDay = token === 'today' ? today : addDays(today, token === '7d' ? -6 : -29);
  } else {
    toDay = token.to > today ? today : token.to;
    fromDay = token.from > toDay ? toDay : token.from;
    if (dayCount(fromDay, toDay) > MAX_RANGE_DAYS) fromDay = addDays(toDay, -(MAX_RANGE_DAYS - 1));
    token = { from: fromDay, to: toDay };
  }
  const days: string[] = [];
  for (let d = fromDay; d <= toDay; d = addDays(d, 1)) days.push(d);
  const label = typeof token === 'string' ? (token === 'today' ? 'Today' : token === '7d' ? 'Last 7 days' : 'Last 30 days') : rangeLabel(token);
  return { token, label, fromDay, toDay, from: istDayStart(fromDay), to: istDayEnd(toDay), days };
}

function dayCount(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

/** The range as URL params (for links that keep it). */
export function callRangeQuery(r: CallRange): string {
  return typeof r.token === 'string' ? `range=${r.token}` : `from=${r.token.from}&to=${r.token.to}`;
}

// ── Small arithmetic ──────────────────────────────────────────────

/** Whole per cent, or null when there is nothing to divide by. */
export function pct(part: number, whole: number): number | null {
  if (!(whole > 0)) return null;
  return Math.round((part / whole) * 100);
}

/** The median of some numbers (the mean of the middle two for an even count); null for none. */
export function median(values: readonly number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 === 1 ? v[mid]! : (v[mid - 1]! + v[mid]!) / 2;
}

/** The median of a histogram: value → how many times it occurred. Same answer as `median` on the expanded list. */
export function medianOfCounts(counts: readonly { value: number; n: number }[]): number | null {
  const rows = counts.filter((c) => c.n > 0 && Number.isFinite(c.value)).sort((a, b) => a.value - b.value);
  const total = rows.reduce((s, r) => s + r.n, 0);
  if (total === 0) return null;
  const at = (k: number): number => {
    let seen = 0;
    for (const r of rows) {
      seen += r.n;
      if (k < seen) return r.value;
    }
    return rows[rows.length - 1]!.value;
  };
  return total % 2 === 1 ? at((total - 1) / 2) : (at(total / 2 - 1) + at(total / 2)) / 2;
}

/** "Under a minute", "25 min", "3 h 10 min", "2 days 4 h", "16 days". */
export function waitLabel(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return '—';
  const m = Math.max(0, Math.round(minutes));
  if (m < 1) return 'Under a minute';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7 && h % 24) return `${d} days ${h % 24} h`;
  return `${d} days`;
}

// ── Per lead (the reference the SQL mirrors) ──────────────────────

export interface CallLine {
  /** Who rang (a member id), or null for somebody no longer on the team / an import. */
  memberId: string | null;
  outcome: string | null | undefined;
  at: Date;
}

/**
 * One lead's first connect and the dials before it, from its calls in any
 * order. Null when it was never reached. Ties on the same instant keep the
 * order given (the loader breaks them by id).
 */
export function firstConnect(calls: readonly CallLine[]): { memberId: string | null; at: Date; triesBefore: number } | null {
  const sorted = calls.map((c, i) => ({ c, i })).sort((a, b) => a.c.at.getTime() - b.c.at.getTime() || a.i - b.i);
  let tries = 0;
  for (const { c } of sorted) {
    const kind = callKind(c.outcome);
    if (kind === 'connect') return { memberId: c.memberId, at: c.at, triesBefore: tries };
    if (kind === 'missed') tries += 1;
  }
  return null;
}

/** Minutes from a lead arriving to its first dial (never negative), and who dialled; null when nobody has rung. */
export function firstDial(arrivedAt: Date, calls: readonly CallLine[]): { memberId: string | null; minutes: number } | null {
  const first = calls.filter((c) => isDial(c.outcome)).sort((a, b) => a.at.getTime() - b.at.getTime())[0];
  if (!first) return null;
  return { memberId: first.memberId, minutes: Math.max(0, (first.at.getTime() - arrivedAt.getTime()) / 60_000) };
}

// ── The steps (stage-to-stage) ────────────────────────────────────

export interface StepStage {
  id: string;
  name: string;
  kind: 'OPEN' | 'WON' | 'DONE' | 'LOST' | string;
  sortOrder: number;
  isIntake?: boolean;
  isCallStep?: boolean;
}

export interface StepGroup {
  /** Position in the funnel, from 0. */
  rank: number;
  /** "New", "Calling 1 – Calling 4", "Effective Lead". */
  label: string;
  stageIds: string[];
  /** Any column in it is won or finished. */
  won: boolean;
}

export interface StepPlan {
  groups: StepGroup[];
  /** Where a new lead lands: the intake column's step, else the first. */
  arrivalRank: number;
  /** The first won or finished step; null when the studio has none. */
  wonRank: number | null;
  /** Column id → rank, for the SQL (lost columns are in no step). */
  rankOf: Record<string, number>;
}

/**
 * The funnel's steps, derived from the studio's columns: board order, lost
 * columns out, consecutive calling steps merged into one step. Every other
 * column is its own step, so a studio that adds "Site visit done" gets a
 * step for it without anybody changing this file.
 */
export function stepPlan(stages: readonly StepStage[]): StepPlan {
  const open = [...stages].filter((s) => s.kind !== 'LOST').sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  const groups: StepGroup[] = [];
  let calling: StepStage[] = [];
  const flush = () => {
    if (calling.length === 0) return;
    const first = calling[0]!;
    const last = calling[calling.length - 1]!;
    groups.push({
      rank: groups.length,
      label: calling.length === 1 ? first.name : `${first.name} – ${last.name}`,
      stageIds: calling.map((s) => s.id),
      won: calling.some((s) => s.kind === 'WON' || s.kind === 'DONE'),
    });
    calling = [];
  };
  for (const s of open) {
    if (s.isCallStep) {
      calling.push(s);
      continue;
    }
    flush();
    groups.push({ rank: groups.length, label: s.name, stageIds: [s.id], won: s.kind === 'WON' || s.kind === 'DONE' });
  }
  flush();
  /* The funnel ends at the first won column (owner, 22 Oct 2026). Open
     columns after it are parking, not progress — Hauspire's Future
     Requirement sits after Converted — so a lead moved there has not
     "moved on", and they get no step. */
  const firstWon = groups.findIndex((g) => g.won);
  if (firstWon >= 0) groups.splice(firstWon + 1);
  const rankOf: Record<string, number> = {};
  for (const g of groups) for (const id of g.stageIds) rankOf[id] = g.rank;
  const intake = open.find((s) => s.isIntake);
  const arrivalRank = intake ? (rankOf[intake.id] ?? 0) : 0;
  const won = groups.find((g) => g.won);
  return { groups, arrivalRank, wonRank: won ? won.rank : null, rankOf };
}

/** Grouped by the SQL: per step, leads that entered it in the range, and how many later moved on / reached won. */
export interface StepCount {
  rank: number;
  entered: number;
  movedOn: number;
  reachedWon: number;
}

export interface StepRow {
  from: string;
  to: string;
  entered: number;
  movedOn: number;
  /** Whole per cent, or null when none entered. */
  rate: number | null;
}

export interface Steps {
  rows: StepRow[];
  /** Of the leads that arrived in the range, how many reached the first won step (null: no won step). */
  allTheWay: { arrived: number; won: number; rate: number | null; wonLabel: string } | null;
}

/** The funnel's rows: one per adjacent pair of steps, in order, with zeroes where nothing entered. */
export function stepRows(plan: StepPlan, counts: readonly StepCount[]): Steps {
  const byRank = new Map(counts.map((c) => [c.rank, c]));
  const rows: StepRow[] = [];
  for (let i = 0; i < plan.groups.length - 1; i += 1) {
    const c = byRank.get(i);
    const entered = c?.entered ?? 0;
    const movedOn = Math.min(c?.movedOn ?? 0, entered);
    rows.push({ from: plan.groups[i]!.label, to: plan.groups[i + 1]!.label, entered, movedOn, rate: pct(movedOn, entered) });
  }
  let allTheWay: Steps['allTheWay'] = null;
  if (plan.wonRank !== null && plan.wonRank > plan.arrivalRank) {
    const c = byRank.get(plan.arrivalRank);
    const arrived = c?.entered ?? 0;
    const won = Math.min(c?.reachedWon ?? 0, arrived);
    allTheWay = { arrived, won, rate: pct(won, arrived), wonLabel: plan.groups[plan.wonRank]!.label };
  }
  return { rows, allTheWay };
}

// ── Per person ────────────────────────────────────────────────────

/** Grouped by the SQL: one person's lines of one outcome on one India day. */
export interface OutcomeCount {
  memberId: string | null;
  day: string;
  /** As stored; undefined: no outcome at all. */
  outcome: string | null | undefined;
  n: number;
}

/** Grouped by the SQL: distinct leads dialled and reached, per person; `memberId: 'total'` is the studio's own distinct count. */
export interface ReachCount {
  memberId: string | null | 'total';
  dialled: number;
  reached: number;
}

/** Grouped by the SQL: first connects in the range, per person, by how many dials came before. */
export interface TriesCount {
  memberId: string | null;
  triesBefore: number;
  n: number;
}

/** Grouped by the SQL: leads that arrived in the range, per first dialler, with the median wait. `'total'` is everyone together. */
export interface FirstCallCount {
  memberId: string | null | 'total';
  /** Leads rung at least once. */
  called: number;
  /** Median minutes from arriving to the first dial, over `called`. */
  medianMinutes: number | null;
  /** Only on the total: leads that arrived and nobody has rung yet. */
  notCalled?: number;
}

export interface PersonCalls {
  /** A member id, `null` for "not on the team", or `'total'`. */
  memberId: string | null | 'total';
  name: string;
  dials: number;
  connects: number;
  connectRate: number | null;
  dialled: number;
  reached: number;
  /** First connects made, and the median dials before them. */
  firstConnects: number;
  medianTries: number | null;
  /** Arrived leads first rung by them, and the median wait. */
  firstCalls: number;
  medianMinutesToFirstCall: number | null;
}

export interface DayCalls {
  day: string;
  dials: number;
  connects: number;
}

export interface CallStats {
  range: CallRange;
  people: PersonCalls[];
  total: PersonCalls;
  daily: DayCalls[];
  /** Leads that arrived in the range and nobody has rung. */
  notCalled: number;
  steps: Steps;
}

export interface CallStatsInput {
  range: CallRange;
  /** The people to name, and to show with zeroes (the studio's salespeople). */
  members: { id: string; name: string; showAlways?: boolean }[];
  outcomes: readonly OutcomeCount[];
  reach: readonly ReachCount[];
  tries: readonly TriesCount[];
  firstCalls: readonly FirstCallCount[];
  plan: StepPlan;
  steps: readonly StepCount[];
}

/** The name for a row with no member: somebody who has left, or a line brought over from AxLeads. */
export const NOT_ON_TEAM = 'Not on the team now';

/**
 * Everything the Calling tab draws, from the loader's grouped rows. People
 * are listed busiest first (most dials, then name); a salesperson with no
 * dials is still listed so a quiet day shows as a zero, not as a gap.
 */
export function buildCallStats(input: CallStatsInput): CallStats {
  const key = (id: string | null) => id ?? '__none';
  const nameOf = new Map(input.members.map((m) => [m.id, m.name]));
  const rows = new Map<string, PersonCalls>();
  const blank = (memberId: string | null | 'total', name: string): PersonCalls => ({
    memberId,
    name,
    dials: 0,
    connects: 0,
    connectRate: null,
    dialled: 0,
    reached: 0,
    firstConnects: 0,
    medianTries: null,
    firstCalls: 0,
    medianMinutesToFirstCall: null,
  });
  const row = (id: string | null): PersonCalls => {
    const k = key(id);
    let r = rows.get(k);
    if (!r) {
      r = blank(id, id === null ? NOT_ON_TEAM : (nameOf.get(id) ?? NOT_ON_TEAM));
      rows.set(k, r);
    }
    return r;
  };
  for (const m of input.members) if (m.showAlways) row(m.id);

  const total = blank('total', 'Everyone');
  const inRange = new Set(input.range.days);
  const daily = new Map(input.range.days.map((d) => [d, { day: d, dials: 0, connects: 0 }]));

  for (const o of input.outcomes) {
    if (!(o.n > 0) || !inRange.has(o.day)) continue;
    const kind = callKind(o.outcome);
    if (kind === 'not_a_dial') continue;
    const r = row(o.memberId);
    const d = daily.get(o.day)!;
    r.dials += o.n;
    total.dials += o.n;
    d.dials += o.n;
    if (kind === 'connect') {
      r.connects += o.n;
      total.connects += o.n;
      d.connects += o.n;
    }
  }

  for (const c of input.reach) {
    if (c.memberId === 'total') {
      total.dialled = c.dialled;
      total.reached = c.reached;
    } else if (c.dialled > 0 || c.reached > 0) {
      const r = row(c.memberId);
      r.dialled = c.dialled;
      r.reached = c.reached;
    }
  }

  const triesBy = new Map<string, { value: number; n: number }[]>();
  for (const t of input.tries) {
    if (!(t.n > 0)) continue;
    const k = key(t.memberId);
    row(t.memberId).firstConnects += t.n;
    total.firstConnects += t.n;
    (triesBy.get(k) ?? triesBy.set(k, []).get(k)!).push({ value: t.triesBefore, n: t.n });
  }
  for (const [k, counts] of triesBy) rows.get(k)!.medianTries = medianOfCounts(counts);
  total.medianTries = medianOfCounts(input.tries.map((t) => ({ value: t.triesBefore, n: t.n })));

  let notCalled = 0;
  for (const f of input.firstCalls) {
    if (f.memberId === 'total') {
      total.firstCalls = f.called;
      total.medianMinutesToFirstCall = f.called > 0 ? f.medianMinutes : null;
      notCalled = f.notCalled ?? 0;
    } else if (f.called > 0) {
      const r = row(f.memberId);
      r.firstCalls = f.called;
      r.medianMinutesToFirstCall = f.medianMinutes;
    }
  }

  const people = [...rows.values()].map((r) => ({ ...r, connectRate: pct(r.connects, r.dials) }));
  people.sort((a, b) => b.dials - a.dials || (a.memberId === null ? 1 : 0) - (b.memberId === null ? 1 : 0) || a.name.localeCompare(b.name));
  total.connectRate = pct(total.connects, total.dials);

  return {
    range: input.range,
    people,
    total,
    daily: input.range.days.map((d) => daily.get(d)!),
    notCalled,
    steps: stepRows(input.plan, input.steps),
  };
}
