/**
 * Decisions with options as rows (studio workspace Phase 5). Pure, and tested
 * (tests/decision-flow.test.ts); the writes are in decision-flow.ts.
 *
 * - A new decision: a title, a decide-by date, what deciding late costs
 *   ("if she decides late"), optionally the quote line it changes, and two
 *   or three options, each with a price change the customer sees (GST
 *   included, may be negative) and the studio's own cost change, which never
 *   leaves the studio.
 * - A pick turns into recorded changes on the quote: the old pick reversed
 *   (when there was one) and the new one added, so the history is kept and
 *   the total is always the sum of the rows. The difference lands on the
 *   final payment stage (payment-ledger.ts).
 * - Picking late: a first pick after the decide-by date is still taken (the
 *   studio needs the answer more than the rule), and the working days it
 *   was late are the customer's delay, moved onto the handover date with the
 *   decision named (decision-flow.ts; Phase 3's attribution reads
 *   `decisionId`). A pick already made can be changed only until the date.
 */

import { formatINR } from '@/lib/money';
import { endOfIstDay } from '@/modules/portal/decisions';
import { parseRupees } from './payment-ledger';

/* Up to six (walkthrough, 27 Oct 2026: catalogues of handles, knobs, laminates); more no longer fits a phone screen. */
export const DECISION_RULES = { minOptions: 2, maxOptions: 6, title: 120, why: 600, label: 60, detail: 160, maxDeltaPaise: 1_00_00_000_00 } as const;

export interface NewOption {
  label: string;
  detail: string | null;
  swatch: string | null;
  /** GST included; negative takes money off. */
  deltaPaise: number;
  /** Only your team. Null when not given. */
  studioCostDeltaPaise: number | null;
}

export interface NewDecision {
  title: string;
  why: string;
  /** "YYYY-MM-DD", the last day (IST). */
  dueDay: string;
  dueOn: Date;
  quoteLineId: string | null;
  options: NewOption[];
}

export interface NewDecisionInput {
  title: unknown;
  why: unknown;
  dueOn: unknown;
  quoteLineId?: unknown;
  options: unknown;
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');

/** A new decision, checked, with messages a studio person can act on. */
export function checkNewDecision(input: NewDecisionInput, now = new Date()): { ok: true; value: NewDecision } | { ok: false; error: string } {
  const title = text(input.title, DECISION_RULES.title);
  if (title.length < 3) return { ok: false, error: 'Say what needs deciding, for example “Kitchen shutter finish”.' };
  const why = text(input.why, DECISION_RULES.why);
  if (why.length < 10) return { ok: false, error: 'Say what happens if the decision comes late.' };
  if (typeof input.dueOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.dueOn)) return { ok: false, error: 'Pick the decide-by date.' };
  const dueOn = endOfIstDay(input.dueOn);
  if (Number.isNaN(dueOn.getTime())) return { ok: false, error: 'Pick the decide-by date.' };
  if (dueOn.getTime() < now.getTime()) return { ok: false, error: 'The decide-by date has already passed.' };
  const quoteLineId = typeof input.quoteLineId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(input.quoteLineId) ? input.quoteLineId : null;
  if (!Array.isArray(input.options)) return { ok: false, error: 'Give two to six options.' };
  const options: NewOption[] = [];
  for (const [i, raw] of input.options.entries()) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Record<string, unknown>;
    const label = text(o.label, DECISION_RULES.label);
    const blank = label === '' && !text(o.detail, 10) && !text(o.delta, 10);
    if (blank) continue;
    if (!label) return { ok: false, error: `Option ${i + 1} needs a name.` };
    const delta = o.delta === undefined || o.delta === null || text(o.delta, 20) === '' ? 0 : parseRupees(o.delta, { negative: true });
    if (delta === null || Math.abs(delta) > DECISION_RULES.maxDeltaPaise) return { ok: false, error: `The price change on “${label}” is not an amount.` };
    const cost = o.studioCost === undefined || o.studioCost === null || text(o.studioCost, 20) === '' ? null : parseRupees(o.studioCost, { negative: true });
    if (cost === null && text(o.studioCost, 20) !== '') return { ok: false, error: `Your cost on “${label}” is not an amount.` };
    const swatch = typeof o.swatch === 'string' && /^#[0-9a-f]{6}$/i.test(o.swatch) ? o.swatch.toLowerCase() : null;
    options.push({ label, detail: text(o.detail, DECISION_RULES.detail) || null, swatch, deltaPaise: delta, studioCostDeltaPaise: cost });
  }
  if (options.length < DECISION_RULES.minOptions) return { ok: false, error: 'Give at least two options, each with a name.' };
  if (options.length > DECISION_RULES.maxOptions) return { ok: false, error: 'Six options at most: more no longer fits on the client’s phone.' };
  const names = new Set(options.map((o) => o.label.toLowerCase()));
  if (names.size !== options.length) return { ok: false, error: 'Two options have the same name.' };
  return { ok: true, value: { title, why, dueDay: input.dueOn, dueOn, quoteLineId, options } };
}

/**
 * The older `options` JSON the app read before `choices` (kept in step until
 * every reader moves): name, note, what it adds — never below zero, the JSON
 * cannot say "takes off" — and the swatch. Never the studio's cost.
 */
export function legacyOptionsJson(options: NewOption[]): { name: string; note: string; extraPaise: number; swatch: string | null }[] {
  return options.map((o) => ({ name: o.label, note: o.detail ?? '', extraPaise: Math.max(0, o.deltaPaise), swatch: o.swatch }));
}

/** "+₹14,000", "−₹2,500", or "As quoted". */
export function priceChange(deltaPaise: number): string {
  if (deltaPaise === 0) return 'As quoted';
  return `${deltaPaise > 0 ? '+' : '−'}${formatINR(Math.abs(deltaPaise))}`;
}

/** How a reversal row's label ends ("Shutter finish: Gloss, changed"). */
export const REVERSED = ', changed';

export interface PickedOption {
  id: string;
  label: string;
  deltaPaise: number;
}

export interface QuoteChangeRow {
  decisionId: string;
  optionId: string;
  quoteLineId: string | null;
  label: string;
  deltaPaise: number;
  stageIndex: number | null;
  at: Date;
}

/**
 * The quote changes a pick writes: the earlier pick reversed (a row taking
 * its price back off), then the new pick. Re-picking the same option writes
 * nothing. Times are a millisecond apart so the order survives one
 * transaction (where the database's now() is the same instant).
 */
export function pickChanges(input: {
  decisionId: string;
  title: string;
  quoteLineId: string | null;
  finalStageIndex: number | null;
  previous: PickedOption | null;
  next: PickedOption;
  at: Date;
}): QuoteChangeRow[] {
  const { previous, next } = input;
  if (previous && previous.id === next.id) return [];
  const base = { decisionId: input.decisionId, quoteLineId: input.quoteLineId, stageIndex: input.finalStageIndex };
  const rows: QuoteChangeRow[] = [];
  if (previous) {
    rows.push({ ...base, optionId: previous.id, label: `${input.title}: ${previous.label}`.slice(0, 190) + REVERSED, deltaPaise: -previous.deltaPaise, at: input.at });
  }
  rows.push({ ...base, optionId: next.id, label: `${input.title}: ${next.label}`.slice(0, 200), deltaPaise: next.deltaPaise, at: new Date(input.at.getTime() + (previous ? 1 : 0)) });
  return rows;
}

/** What the locker's material entry says once an option is picked. */
export function materialSpec(option: { label: string; detail: string | null }): string {
  return option.detail ? `${option.label} (${option.detail})` : option.label;
}

/**
 * Whether the customer may pick now. A first pick is taken even after the
 * date (and counted as their delay); a pick already made can be changed only
 * until the date.
 */
export function pickAllowed(d: { dueOn: Date; pickedOptionId: string | null }, now = new Date()): { ok: true; late: boolean } | { ok: false; error: string } {
  const past = d.dueOn.getTime() < now.getTime();
  if (!past) return { ok: true, late: false };
  if (d.pickedOptionId) return { ok: false, error: 'The decide-by date has passed, so this choice is fixed now. Ask your expert if it must change.' };
  return { ok: true, late: true };
}

// ── What the customer sees ─────────────────────────────────────

export interface CustomerChoice {
  id: string;
  label: string;
  detail: string | null;
  /** A signed link to the option's photo, or null. */
  photo: string | null;
  swatch: string | null;
  /** GST included; negative takes money off. */
  deltaPaise: number;
}

/** One option row as the customer sees it: never the studio's cost, never the storage path. */
export function customerChoice(o: { id: string; label: string; detail: string | null; swatch: string | null; deltaPaise: bigint | number }, photo: string | null): CustomerChoice {
  return { id: o.id, label: o.label, detail: o.detail ?? null, photo: photo || null, swatch: o.swatch ?? null, deltaPaise: Number(o.deltaPaise) };
}

export interface ChangeRowInput {
  id: string;
  decisionId: string | null;
  label: string;
  deltaPaise: number;
  at: Date | null;
  decisionTitle: string | null;
  optionLabel: string | null;
}

/**
 * "Changes so far", from the recorded quote changes (the one source): one
 * item per decision with its net price change and the option standing now;
 * changes not from a decision stand alone. Same shape the app already reads.
 */
export function changesFromRows(rows: ChangeRowInput[]): {
  totalPaise: number;
  items: { decisionId: string; title: string; option: string; extraPaise: number; chosenAt: string | null }[];
} {
  const sorted = [...rows].sort((a, b) => (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0));
  const groups = new Map<string, { title: string; option: string; extraPaise: number; chosenAt: string | null; decisionId: string }>();
  for (const r of sorted) {
    const key = r.decisionId ?? `change:${r.id}`;
    const [title, ...rest] = r.label.split(': ');
    const g = groups.get(key) ?? { decisionId: r.decisionId ?? '', title: r.decisionTitle ?? title ?? r.label, option: '', extraPaise: 0, chosenAt: null };
    g.extraPaise += r.deltaPaise;
    // A reversal row names the option being undone; the option standing is the last added one.
    if (!r.label.endsWith(REVERSED)) {
      g.option = r.optionLabel ?? (rest.join(': ') || r.label);
      g.chosenAt = r.at?.toISOString() ?? null;
    }
    groups.set(key, g);
  }
  const items = [...groups.values()];
  return { totalPaise: items.reduce((n, i) => n + i.extraPaise, 0), items };
}
