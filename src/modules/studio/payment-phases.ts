/**
 * When a studio is paid — its own schedule, printed on every quote it gets
 * through us.
 *
 * Each studio has one, and they differ in the way that matters most to a
 * customer: how much leaves their account before anything is installed. A
 * studio asking 60% at booking and one asking 10% are not the same offer at
 * the same total, and the quote is where that has to be visible.
 *
 * The schedule comes from the studio — typed on the rates step, or read from
 * their own quotations — never invented by us. Until one is filed the quote
 * says so, and says why the question is worth asking.
 *
 * Pure, so the checks are tested and the same rules run on the studio form,
 * on the reader and on the quote.
 */

export interface PaymentPhase {
  /** "Booking", "Design sign-off", "Material delivery", "Handover". */
  label: string;
  /** Whole percent of the project total. The schedule sums to exactly 100. */
  pct: number;
}

export const PHASES_MIN = 2;
export const PHASES_MAX = 8;
export const PHASE_LABEL_MAX = 60;

/** The problem with a schedule, in the studio's words — or null when it is sound. */
export function checkPhases(phases: PaymentPhase[]): string | null {
  if (phases.length < PHASES_MIN) return `At least ${PHASES_MIN} phases — booking and handover, if nothing else.`;
  if (phases.length > PHASES_MAX) return `At most ${PHASES_MAX} phases.`;
  for (const p of phases) {
    if (!p.label.trim()) return 'Every phase needs a name.';
    if (p.label.trim().length > PHASE_LABEL_MAX) return `Phase names are at most ${PHASE_LABEL_MAX} characters.`;
    if (!Number.isInteger(p.pct) || p.pct < 1 || p.pct > 100) return 'Each phase is a whole percent between 1 and 100.';
  }
  const sum = phases.reduce((a, p) => a + p.pct, 0);
  if (sum !== 100) return `The phases add up to ${sum}%, not 100%.`;
  return null;
}

/**
 * A stored schedule, or null.
 *
 * The column is JSON, so anything can be in it; a schedule that fails the
 * checks is treated as no schedule rather than printed half-right on a
 * customer's quote.
 */
export function readPhases(raw: unknown): PaymentPhase[] | null {
  if (!Array.isArray(raw)) return null;
  const phases: PaymentPhase[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null;
    const { label, pct } = item as Record<string, unknown>;
    if (typeof label !== 'string' || typeof pct !== 'number') return null;
    phases.push({ label: label.trim(), pct });
  }
  return checkPhases(phases) === null ? phases : null;
}

/**
 * "10% booking, 40% design sign-off, 40% delivery, 10% handover" → phases.
 *
 * How a studio actually writes its terms, at the foot of every quotation —
 * so it is how they can type them here, and how the archive reader hands
 * them over. Either order works ("Booking 10%" too). Returns null when any
 * part has no percentage, rather than guessing which number was meant.
 */
export function parsePhasesText(text: string): PaymentPhase[] | null {
  const parts = text
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  const phases: PaymentPhase[] = [];
  for (const part of parts) {
    const m = part.match(/(\d{1,3})\s*%/);
    if (!m) return null;
    const label = part
      .replace(m[0], ' ')
      .replace(/^\s*(on|at|of|for|-|–|:)\s+/i, '')
      .replace(/\s+(on|at|of|for)\s*$/i, '')
      .replace(/^[\s\-–:]+|[\s\-–:]+$/g, '')
      .replace(/\s+/g, ' ');
    if (!label) return null;
    phases.push({ label: label[0]!.toUpperCase() + label.slice(1), pct: Number(m[1]) });
  }
  return phases;
}

/** Back to the words a studio would write, for the form's initial value. */
export function phasesText(phases: PaymentPhase[] | null): string {
  return (phases ?? []).map((p) => `${p.pct}% ${p.label}`).join(', ');
}

export interface PhaseAmount extends PaymentPhase {
  amountPaise: number;
}

/**
 * Each phase in rupees, on this quote's total.
 *
 * Rounded to the rupee, with the last phase taking the remainder so the
 * phases always add up to the total printed above them — a schedule whose
 * sum is ₹2 off the total is the kind of thing a customer notices.
 */
export function phaseAmounts(phases: PaymentPhase[], totalPaise: number): PhaseAmount[] {
  let given = 0;
  return phases.map((p, i) => {
    const amountPaise =
      i === phases.length - 1
        ? totalPaise - given
        : Math.round((totalPaise * p.pct) / 100 / 100) * 100;
    given += amountPaise;
    return { ...p, amountPaise };
  });
}

/**
 * The share asked for up front — the first phase.
 *
 * Above this much at booking, the quote says so plainly. Thirty percent is
 * the common ceiling in the owner's archive of Pune quotations; a studio can
 * ask for more, and the customer should know that it is more.
 */
export const HIGH_ADVANCE_PCT = 30;

export function advanceIsHigh(phases: PaymentPhase[]): boolean {
  return (phases[0]?.pct ?? 0) > HIGH_ADVANCE_PCT;
}
