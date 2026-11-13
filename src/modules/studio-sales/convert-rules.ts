/**
 * Marking a lead Converted (owner, 13 Nov 2026): the rules, pure and tested
 * (tests/studio-convert.test.ts). The server half is `convert.ts`.
 *
 * A lead goes into a won column ("Converted") only through Convert: the
 * salesperson picks the lead's sales-final quotation and writes the handover
 * to design, and the project is created there and then. The ₹25,000 booking
 * advance is recorded later by accounts, as the project's first payment.
 * The design head then assigns a designer.
 *
 * So a plain move (drag, the stage picker, the call sheet, a bulk move) into
 * a won column is refused, unless the lead is already converted or already
 * sits in a won column (moving between won columns, or leads that arrived
 * converted from AxLeads).
 */

export const HANDOVER_MIN = 200;
export const HANDOVER_MAX = 3000;

export const CONVERT_FIRST =
  'To mark this lead Converted, use Convert: pick its sales-final quotation and write the handover to design. That also starts the project.';

export const BULK_CONVERT =
  'Leads are converted one at a time: open each lead and press Convert to pick its sales-final quotation and write the handover to design.';

export type StageKind = 'OPEN' | 'WON' | 'DONE' | 'LOST';

/** Why a plain move into this column is refused, or null when it may go. */
export function wonMoveRefusal(m: { toKind: StageKind | null; fromKind: StageKind | null; converted: boolean }): string | null {
  if (m.toKind !== 'WON') return null;
  if (m.converted || m.fromKind === 'WON') return null;
  return CONVERT_FIRST;
}

/** The handover to design: trimmed, at least `HANDOVER_MIN` characters, at most `HANDOVER_MAX`. */
export function checkHandover(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const text = typeof raw === 'string' ? raw.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim() : '';
  if (text.length < HANDOVER_MIN) {
    return {
      ok: false,
      error: `Write the handover to design in detail: at least ${HANDOVER_MIN} characters (${text.length} so far). Rooms, style and colours, must-haves, budget comfort, possession and timeline, the family, anything promised.`,
    };
  }
  if (text.length > HANDOVER_MAX) return { ok: false, error: `Keep the handover under ${HANDOVER_MAX} characters.` };
  return { ok: true, value: text };
}
