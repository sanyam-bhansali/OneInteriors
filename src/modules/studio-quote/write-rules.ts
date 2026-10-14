/**
 * When a quotation may still be changed. Pure, and tested
 * (tests/studio-quote-write-rules.test.ts); the database checks are in
 * `quotes.ts` and `from-plan.ts`.
 *
 * - **A live project runs on it** (booked, or signed in the app): its plan and
 *   payment stages were built from these lines and terms, so the lines, the
 *   terms and the standard build are shut. The Design Final is a copy made
 *   for exactly this; a refund lets the quotation go again.
 * - **"Read rooms" on a quotation** rewrites its kitchen run, bathrooms and
 *   the plan its next rebuild is sized from, so it is for a draft only — a
 *   quotation the client has seen is changed by editing it and sending again.
 */

export const QUOTE_WRITE_ERRORS = {
  booked:
    'A project is running on this quotation, so its lines and terms can no longer be changed. Make the Design Final from it, or refund the booking first.',
  notDraft: 'Read rooms works on a draft. This quotation has been sent: edit its lines, or start a new quotation from the plan.',
} as const;

/** Why this quotation's lines, terms or build cannot be written now, or null. */
export function quoteWriteRefusal(f: { liveProject: boolean }): string | null {
  return f.liveProject ? QUOTE_WRITE_ERRORS.booked : null;
}

/** Why "Read rooms" cannot run on this quotation, or null. */
export function readRoomsRefusal(f: { liveProject: boolean; status: string }): string | null {
  return quoteWriteRefusal(f) ?? (f.status === 'DRAFT' ? null : QUOTE_WRITE_ERRORS.notDraft);
}
