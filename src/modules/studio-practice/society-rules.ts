/**
 * Societies (owner, 11 Nov 2026; Max plan): how a society's priority and its
 * Hot / Warm / Cold label are worked out. Pure (CONTRIBUTING §9.5);
 * tests/society-rules.test.ts pins every line below.
 *
 * Both are worked out when the list is read, never stored, so they are never
 * stale: a wing's possession date or a logged call changes them at once. A
 * person can set either by hand with a reason (the override columns on
 * `StudioSociety`); a hand-set heat lapses after 30 days.
 *
 * ## Priority from possession
 *
 * Interiors start around possession, so that is when a society's owners are
 * worth the most calls:
 *
 * - P1: from 3 months before possession to 6 months after it.
 * - P2: 3 to 9 months before.
 * - P3: further out than 9 months, more than 6 months after (most owners
 *   have furnished by then), or no possession date at all.
 *
 * Each wing gets its own priority and the society takes its best one, so one
 * early wing lifts the whole society.
 *
 * ## Hot, Warm or Cold from the calls
 *
 * Over the last 60 days, each lead the team actually got through to counts
 * once, by its latest such call: good (interested, wants a quote or a visit,
 * asked for the portfolio, comparing designers, met, visited the site), bad
 * (not interested, already done, budget too low, wrong number) or neutral
 * (everything else they said). No answer, busy, switched off and voicemail
 * are not "got through" and do not count.
 *
 * - Fewer than 5 leads reached: no label yet ("Too early").
 * - Hot: 3 or more good, or 30% or more good.
 * - Cold: more than half bad.
 * - Warm: 10% or more good.
 * - Cold otherwise.
 */

export type Priority = 'P1' | 'P2' | 'P3';
export type Heat = 'HOT' | 'WARM' | 'COLD';
export type CallClass = 'good' | 'neutral' | 'bad';

export const PRIORITY_LABEL: Record<Priority, string> = { P1: 'P1 · Top', P2: 'P2 · Medium', P3: 'P3 · Low' };
export const HEAT_LABEL: Record<Heat, string> = { HOT: 'Hot', WARM: 'Warm', COLD: 'Cold' };

/** Days the calls are read over. */
export const HEAT_WINDOW_DAYS = 60;
/** Days a hand-set heat lasts. */
export const HEAT_OVERRIDE_DAYS = 30;
/** Leads reached before a society gets a label. */
export const HEAT_MIN_REACHED = 5;

const DAY = 86_400_000;
const MONTH_DAYS = 30.44;

/** Lower-case letters and digits only: "Life Republic R-10" and "life republic r10" are one society. */
export function societyKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Months from `now` to `possessionOn`; negative once possession has passed. */
export function monthsToPossession(possessionOn: Date, now: Date): number {
  return (possessionOn.getTime() - now.getTime()) / DAY / MONTH_DAYS;
}

export function priorityForDate(possessionOn: Date | null, now: Date): Priority {
  if (!possessionOn) return 'P3';
  const m = monthsToPossession(possessionOn, now);
  if (m >= -6 && m <= 3) return 'P1';
  if (m > 3 && m <= 9) return 'P2';
  return 'P3';
}

const RANK: Record<Priority, number> = { P1: 0, P2: 1, P3: 2 };

export interface AutoPriority {
  priority: Priority;
  /** The wing date that set it, or null when no wing has a date. */
  possessionOn: Date | null;
  /** No wing has a possession date: someone should fill one in. */
  dateMissing: boolean;
}

/**
 * The society's priority from its wings: the best wing's. Ties go to the
 * wing whose possession is nearest today.
 */
export function priorityFor(wings: readonly { possessionOn: Date | null }[], now: Date): AutoPriority {
  const dated = wings.filter((w): w is { possessionOn: Date } => w.possessionOn instanceof Date);
  if (dated.length === 0) return { priority: 'P3', possessionOn: null, dateMissing: true };
  const away = (d: Date) => Math.abs(d.getTime() - now.getTime());
  let best: { p: Priority; d: Date } | null = null;
  for (const w of dated) {
    const p = priorityForDate(w.possessionOn, now);
    if (!best || RANK[p] < RANK[best.p] || (RANK[p] === RANK[best.p] && away(w.possessionOn) < away(best.d))) best = { p, d: w.possessionOn };
  }
  return { priority: best!.p, possessionOn: best!.d, dateMissing: false };
}

const GOOD_REACTIONS = new Set(['interested', 'wants_quote', 'wants_visit', 'portfolio', 'comparing']);
const BAD_REACTIONS = new Set(['already_done', 'budget_low', 'not_interested']);
const GOOD_OUTCOMES = new Set(['met', 'site_visit']);
const BAD_OUTCOMES = new Set(['not_interested', 'wrong_number']);
/** The call did not reach anybody. */
const NOT_REACHED = new Set(['no_answer', 'line_busy', 'switched_off', 'voicemail']);

/**
 * One logged call (a CONTACTED event's `meta`), as good, neutral or bad; null
 * when it reached nobody or is not a call at all.
 */
export function classifyCall(meta: unknown): CallClass | null {
  if (!meta || typeof meta !== 'object') return null;
  const m = meta as { outcome?: unknown; reactions?: unknown };
  const outcome = typeof m.outcome === 'string' ? m.outcome : null;
  if (!outcome || NOT_REACHED.has(outcome)) return null;
  const reactions = Array.isArray(m.reactions) ? m.reactions.filter((r): r is string => typeof r === 'string') : [];
  if (BAD_OUTCOMES.has(outcome)) return 'bad';
  if (GOOD_OUTCOMES.has(outcome) || reactions.some((r) => GOOD_REACTIONS.has(r))) return 'good';
  if (reactions.some((r) => BAD_REACTIONS.has(r))) return 'bad';
  return 'neutral';
}

export interface CallFact {
  clientId: string;
  at: Date;
  meta: unknown;
}

export interface AutoHeat {
  /** Null = too early to say. */
  heat: Heat | null;
  reached: number;
  good: number;
  bad: number;
}

/** The society's label from its leads' calls over the last 60 days. */
export function heatFor(calls: readonly CallFact[], now: Date): AutoHeat {
  const since = now.getTime() - HEAT_WINDOW_DAYS * DAY;
  const latest = new Map<string, { at: number; c: CallClass }>();
  for (const call of calls) {
    const at = call.at.getTime();
    if (at < since || at > now.getTime()) continue;
    const c = classifyCall(call.meta);
    if (!c) continue;
    const seen = latest.get(call.clientId);
    if (!seen || at > seen.at) latest.set(call.clientId, { at, c });
  }
  let good = 0;
  let bad = 0;
  for (const { c } of latest.values()) {
    if (c === 'good') good++;
    if (c === 'bad') bad++;
  }
  const reached = latest.size;
  if (reached < HEAT_MIN_REACHED) return { heat: null, reached, good, bad };
  let heat: Heat;
  if (good >= 3 || good / reached >= 0.3) heat = 'HOT';
  else if (bad / reached > 0.5) heat = 'COLD';
  else if (good / reached >= 0.1) heat = 'WARM';
  else heat = 'COLD';
  return { heat, reached, good, bad };
}

/** A hand-set heat wins for 30 days from when it was set. */
export function effectiveHeat(auto: Heat | null, override: Heat | null, overrideAt: Date | null, now: Date): { heat: Heat | null; byHand: boolean } {
  if (override && overrideAt && now.getTime() - overrideAt.getTime() < HEAT_OVERRIDE_DAYS * DAY) return { heat: override, byHand: true };
  return { heat: auto, byHand: false };
}

export function effectivePriority(auto: Priority, override: Priority | null): { priority: Priority; byHand: boolean } {
  return override ? { priority: override, byHand: true } : { priority: auto, byHand: false };
}

const HEAT_RANK = (h: Heat | null): number => (h === 'HOT' ? 0 : h === 'WARM' ? 1 : h === 'COLD' ? 2 : 3);

/**
 * The list's order: P1 first; within a priority the nearest possession first
 * (no date last); then Hot, Warm, Cold, too early; then by name.
 */
export function compareSocieties(
  a: { priority: Priority; possessionOn: Date | null; heat: Heat | null; name: string },
  b: { priority: Priority; possessionOn: Date | null; heat: Heat | null; name: string },
  now: Date,
): number {
  if (RANK[a.priority] !== RANK[b.priority]) return RANK[a.priority] - RANK[b.priority];
  const dist = (d: Date | null) => (d ? Math.abs(d.getTime() - now.getTime()) : Number.POSITIVE_INFINITY);
  const da = dist(a.possessionOn);
  const db = dist(b.possessionOn);
  if (da !== db) return da < db ? -1 : 1;
  if (HEAT_RANK(a.heat) !== HEAT_RANK(b.heat)) return HEAT_RANK(a.heat) - HEAT_RANK(b.heat);
  return a.name.localeCompare(b.name);
}

/** "Mar 2027", for a possession month. */
export function monthLabel(d: Date): string {
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/**
 * A possession month typed in a sheet or a form: "2027-03", "03/2027",
 * "Mar 2027", "March-27", or an Excel serial day number. The first of the
 * month, or null when it cannot be read.
 */
export function parsePossession(raw: unknown): Date | null {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return new Date(Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), 1));
  if (typeof raw === 'number' && raw > 20000 && raw < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + raw * DAY);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  }
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return null;
  if (/^\d{5}$/.test(s)) return parsePossession(Number(s));
  let m = s.match(/^(\d{4})[-/.](\d{1,2})(?:[-/.]\d{1,2})?$/);
  if (m) return utcMonth(Number(m[1]), Number(m[2]));
  m = s.match(/^(?:\d{1,2}[-/.])?(\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (m) return utcMonth(year(m[2]), Number(m[1]));
  m = s.match(/^([a-z]{3,9})[\s,'’\-/.]*(\d{2}|\d{4})$/);
  if (m) {
    const word = m[1];
    const mon = MONTHS.findIndex((x) => word.startsWith(x));
    if (mon >= 0) return utcMonth(year(m[2]), mon + 1);
  }
  return null;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const year = (y: string) => (y.length === 2 ? 2000 + Number(y) : Number(y));
function utcMonth(y: number, mo: number): Date | null {
  if (!(y >= 2000 && y <= 2100 && mo >= 1 && mo <= 12)) return null;
  return new Date(Date.UTC(y, mo - 1, 1));
}
