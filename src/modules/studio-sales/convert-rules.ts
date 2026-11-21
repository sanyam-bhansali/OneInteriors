/**
 * Marking a lead Converted (owner, 13 Nov 2026): the rules, pure and tested
 * (tests/studio-convert.test.ts). The server half is `convert.ts`.
 *
 * A lead goes into a won column ("Converted") only through Convert: the
 * salesperson picks the lead's sales-final quotation and writes the handover
 * to design (required, any length), and the project is created there and then. The ₹25,000 booking
 * advance is recorded later by accounts, as the project's first payment.
 * The design head then assigns a designer.
 *
 * So a plain move (drag, the stage picker, the call sheet, a bulk move) into
 * a won column is refused, unless the lead is already converted or already
 * sits in a won column (moving between won columns, or leads that arrived
 * converted from AxLeads).
 */

/* Owner, 13 Nov 2026: no minimum length; the handover is still required (not empty). */
export const HANDOVER_MIN = 1;
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

export const BUILDING_MAX = 120;
export const ADDRESS_MIN = 10;
export const ADDRESS_MAX = 300;

const oneLine = (raw: unknown) => (typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '');

/**
 * The property, required to convert (owner, 20 Nov 2026): the building's
 * name and the address, so design and site know where the home is.
 */
export function checkProperty(building: unknown, address: unknown): { ok: true; building: string; address: string } | { ok: false; error: string } {
  const b = oneLine(building);
  const a = oneLine(address);
  if (b.length < 2) return { ok: false, error: 'Write the building’s name: the society or tower the home is in.' };
  if (b.length > BUILDING_MAX) return { ok: false, error: `Keep the building’s name under ${BUILDING_MAX} characters.` };
  if (a.length < ADDRESS_MIN) return { ok: false, error: 'Write the property’s address: flat number, wing, road and area.' };
  if (a.length > ADDRESS_MAX) return { ok: false, error: `Keep the address under ${ADDRESS_MAX} characters.` };
  return { ok: true, building: b, address: a };
}

/** The handover to design: trimmed, at least `HANDOVER_MIN` characters, at most `HANDOVER_MAX`. */
export function checkHandover(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const text = typeof raw === 'string' ? raw.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim() : '';
  if (text.length < HANDOVER_MIN) {
    return {
      ok: false,
      error: 'Write the handover to design: rooms, style and colours, must-haves, budget comfort, possession and timeline, the family, anything promised.',
    };
  }
  if (text.length > HANDOVER_MAX) return { ok: false, error: `Keep the handover under ${HANDOVER_MAX} characters.` };
  return { ok: true, value: text };
}

/**
 * What Convert writes on the lead (owner, 19 Nov 2026: "yes clear it"). The
 * follow-up call goes: the client has booked, and a leftover "call them on
 * Sunday" kept showing on Today and the calendar.
 */
export function convertedLeadData(m: { now: Date; introductionId: string; fromStageId: string; wonStageId: string | null }) {
  return {
    bookedIntroductionId: m.introductionId,
    bookedAt: m.now,
    preBookingStageId: m.fromStageId,
    nextAction: null,
    nextActionOn: null,
    ...(m.wonStageId ? { stageId: m.wonStageId, lostReason: null } : {}),
  };
}

