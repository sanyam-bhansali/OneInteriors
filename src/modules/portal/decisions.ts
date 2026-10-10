/**
 * Decisions with a deadline (docs/CUSTOMER-PLATFORM-PLAN.md, step 1): a
 * choice the studio needs from the customer by a date — a shutter finish, a
 * tile — with what each option adds to the quote.
 *
 * Pure, and tested. The store (project-store.ts) validates with these on the
 * way in and reads options back through `parseOptions`, never trusting the
 * stored JSON's shape.
 */

export interface DecisionOption {
  name: string;
  note: string;
  /** What this option adds to the quote, in paise. 0 means it is in the quote already. */
  extraPaise: number;
  /** A colour for the swatch, "#rrggbb", when the option is a finish. */
  swatch: string | null;
}

export const DECISION_LIMITS = { options: 6, title: 120, why: 600, name: 60, note: 120, maxExtraPaise: 1_00_00_000_00 } as const;

/** Days before the due date that the reminder goes out. */
export const REMIND_DAYS = 2;

const DAY = 86_400_000;
const IST_MS = 330 * 60_000;

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');

/** The options as stored or sent, cleaned; null when there are not at least two usable ones. */
export function parseOptions(raw: unknown): DecisionOption[] | null {
  if (!Array.isArray(raw)) return null;
  const out: DecisionOption[] = [];
  for (const item of raw.slice(0, DECISION_LIMITS.options)) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const name = text(o.name, DECISION_LIMITS.name);
    if (!name) continue;
    const extra = typeof o.extraPaise === 'number' && Number.isFinite(o.extraPaise) ? Math.round(o.extraPaise) : 0;
    const swatch = typeof o.swatch === 'string' && /^#[0-9a-f]{6}$/i.test(o.swatch) ? o.swatch.toLowerCase() : null;
    out.push({
      name,
      note: text(o.note, DECISION_LIMITS.note),
      extraPaise: Math.min(Math.max(extra, 0), DECISION_LIMITS.maxExtraPaise),
      swatch,
    });
  }
  return out.length >= 2 ? out : null;
}

export interface DecisionInput {
  title: unknown;
  why: unknown;
  /** "YYYY-MM-DD", the last day the choice can be made (IST). */
  dueOn: unknown;
  options: unknown;
}

export type DecisionCheck =
  | { ok: true; value: { title: string; why: string; dueOn: Date; options: DecisionOption[] } }
  | { ok: false; error: string };

/** A new decision, checked: a title, why it matters, a date not in the past, and two or more options. */
export function checkDecision(input: DecisionInput, now = new Date()): DecisionCheck {
  const title = text(input.title, DECISION_LIMITS.title);
  if (title.length < 3) return { ok: false, error: 'Say what needs deciding.' };
  const why = text(input.why, DECISION_LIMITS.why);
  if (why.length < 10) return { ok: false, error: 'Say what happens if it waits.' };
  if (typeof input.dueOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.dueOn)) return { ok: false, error: 'A due date, please.' };
  const dueOn = endOfIstDay(input.dueOn);
  if (Number.isNaN(dueOn.getTime())) return { ok: false, error: 'A due date, please.' };
  if (dueOn.getTime() < now.getTime()) return { ok: false, error: 'The due date has already passed.' };
  const options = parseOptions(input.options);
  if (!options) return { ok: false, error: 'Give at least two options, each with a name.' };
  return { ok: true, value: { title, why, dueOn, options } };
}

/** 23:59:59 IST on the given date, as an instant: the choice can be made all that day. */
export function endOfIstDay(date: string): Date {
  return new Date(Date.parse(`${date}T23:59:59Z`) - IST_MS);
}

export type DecisionState = 'open' | 'due-soon' | 'overdue' | 'chosen';

/** Whole IST days from today to the due date; 0 on the day itself, negative once past. */
export function daysLeft(dueOn: Date, now = new Date()): number {
  const day = (d: Date) => Math.floor((d.getTime() + IST_MS) / DAY);
  return day(dueOn) - day(now);
}

export function decisionState(d: { dueOn: Date; chosenIndex: number | null }, now = new Date()): DecisionState {
  if (d.chosenIndex !== null) return 'chosen';
  if (d.dueOn.getTime() < now.getTime()) return 'overdue';
  return daysLeft(d.dueOn, now) <= REMIND_DAYS ? 'due-soon' : 'open';
}

/** Whether the "2 days left" reminder should go out now: still open, due soon, not reminded yet. */
export function needsReminder(d: { dueOn: Date; chosenIndex: number | null; remindedAt: Date | null }, now = new Date()): boolean {
  return d.remindedAt === null && decisionState(d, now) === 'due-soon';
}

/** A choice is valid while the decision is open and the index names an option. A made choice can be changed until the due date. */
export function canChoose(d: { dueOn: Date }, options: DecisionOption[], index: unknown, now = new Date()): boolean {
  return (
    typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < options.length && d.dueOn.getTime() >= now.getTime()
  );
}
