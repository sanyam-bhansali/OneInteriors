/**
 * The money side of a signed project (trust fixes 5 and 7, v79 Project
 * screen). Pure, and tested.
 *
 * - The payment stages as signed, in rupees: what is paid, what is next and
 *   when, and what is left. The studio or ops sets each stage's due date and
 *   marks it paid; nothing here guesses a date from the tracker.
 * - "Changes so far": every decision the customer made that added to the
 *   price, totalled, so the final bill never surprises anyone.
 *
 * The customer pays the studio directly. These are records, not payments.
 */

import type { DecisionOption } from './decisions';

export interface SignedStage {
  label: string;
  pct: number | null;
  amountPaise: number;
}

/** One entry per stage index in HomeProject.paidPhases. */
export interface StageMark {
  index: number;
  /** "YYYY-MM-DD", set by the studio or ops. */
  dueOn?: string | null;
  paidOn?: string | null;
  /** When the two-days-before reminder went out, so it goes out once. */
  remindedAt?: string | null;
}

export interface PayStage extends SignedStage {
  index: number;
  dueOn: string | null;
  paidOn: string | null;
  state: 'paid' | 'next' | 'later';
}

export interface MoneyView {
  contractPaise: number;
  paidPaise: number;
  /** The first unpaid stage, if any. */
  next: PayStage | null;
  /** Unpaid, after the next stage. */
  laterPaise: number;
  stages: PayStage[];
}

const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** The stages as stored at signing; null when they cannot be read. */
export function readSignedStages(raw: unknown): SignedStage[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: SignedStage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null;
    const { label, pct, amountPaise } = item as Record<string, unknown>;
    if (typeof label !== 'string' || typeof amountPaise !== 'number' || !Number.isFinite(amountPaise)) return null;
    out.push({ label, pct: typeof pct === 'number' ? pct : null, amountPaise: Math.round(amountPaise) });
  }
  return out;
}

export function readMarks(raw: unknown): StageMark[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m): m is Record<string, unknown> => Boolean(m) && typeof m === 'object')
    .filter((m) => Number.isInteger(m.index))
    .map((m) => ({
      index: m.index as number,
      dueOn: isDay(m.dueOn) ? m.dueOn : null,
      paidOn: isDay(m.paidOn) ? m.paidOn : null,
      remindedAt: typeof m.remindedAt === 'string' ? m.remindedAt : null,
    }));
}

export function moneyView(contractPaise: number | null, stagesRaw: unknown, marksRaw: unknown): MoneyView | null {
  const signed = readSignedStages(stagesRaw);
  if (contractPaise === null || !signed) return null;
  const marks = new Map(readMarks(marksRaw).map((m) => [m.index, m]));
  let nextFound = false;
  const stages: PayStage[] = signed.map((s, index) => {
    const m = marks.get(index);
    const paid = Boolean(m?.paidOn);
    const state: PayStage['state'] = paid ? 'paid' : nextFound ? 'later' : 'next';
    if (!paid) nextFound = true;
    return { ...s, index, dueOn: m?.dueOn ?? null, paidOn: m?.paidOn ?? null, state };
  });
  const paidPaise = stages.filter((s) => s.state === 'paid').reduce((n, s) => n + s.amountPaise, 0);
  const next = stages.find((s) => s.state === 'next') ?? null;
  const laterPaise = stages.filter((s) => s.state === 'later').reduce((n, s) => n + s.amountPaise, 0);
  return { contractPaise, paidPaise, next, laterPaise, stages };
}

/** Write one stage's due date or paid date into the marks, returning the new list. */
export function setMark(marksRaw: unknown, index: number, patch: Pick<StageMark, 'dueOn' | 'paidOn'>): StageMark[] {
  const marks = readMarks(marksRaw);
  const at = marks.findIndex((m) => m.index === index);
  const before = at >= 0 ? marks[at]! : { index };
  const moved = patch.dueOn !== undefined && patch.dueOn !== before.dueOn;
  const merged: StageMark = { ...before, ...patch, ...(moved ? { remindedAt: null } : {}) };
  if (at >= 0) marks[at] = merged;
  else marks.push(merged);
  return marks.sort((a, b) => a.index - b.index);
}

const DAY = 86_400_000;

/** Due within two days, not paid, not yet reminded. */
export function paymentNeedsReminder(mark: StageMark, now = new Date()): boolean {
  if (!mark.dueOn || mark.paidOn || mark.remindedAt) return false;
  const due = Date.parse(`${mark.dueOn}T12:00:00Z`);
  return due >= now.getTime() - DAY && due - now.getTime() <= 2 * DAY + DAY / 2;
}

// ── Changes so far ─────────────────────────────────────────────

export interface ChangeItem {
  decisionId: string;
  title: string;
  option: string;
  extraPaise: number;
  chosenAt: string | null;
}

export interface ChangesView {
  totalPaise: number;
  items: ChangeItem[];
}

/** Every chosen option, in the order chosen; the total counts only what adds to the price. */
export function changesSoFar(
  decisions: { id: string; title: string; options: DecisionOption[]; chosenIndex: number | null; chosenAt: string | null }[],
): ChangesView {
  const items = decisions
    .filter((d) => d.chosenIndex !== null && d.options[d.chosenIndex])
    .map((d) => {
      const o = d.options[d.chosenIndex as number]!;
      return { decisionId: d.id, title: d.title, option: o.name, extraPaise: Math.max(0, o.extraPaise), chosenAt: d.chosenAt };
    })
    .sort((a, b) => (a.chosenAt ?? '').localeCompare(b.chosenAt ?? ''));
  return { totalPaise: items.reduce((n, i) => n + i.extraPaise, 0), items };
}
