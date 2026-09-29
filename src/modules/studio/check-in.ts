/**
 * The customer's check-in after a first meeting with a studio (plan §10).
 *
 * Two questions — did the studio match what we told you, and how was the
 * communication — asked once, after the meeting has happened. They are the
 * first signal in the product that comes from a customer who has met the
 * studio rather than from the studio itself, and with three or more they
 * become the studio's communication rating, which matching reads (§5.5).
 *
 * Pure, and tested.
 */

export const MATCHED = ['YES', 'PARTLY', 'NO'] as const;
export type Matched = (typeof MATCHED)[number];

export const MATCHED_LABELS: Record<Matched, string> = {
  YES: 'Yes, as described',
  PARTLY: 'Partly',
  NO: 'Not really',
};

/** Fewer than this and one customer's mood would be the studio's rating. */
export const MIN_CHECK_INS_FOR_RATING = 3;

export const NOTE_MAX = 600;

export interface CheckInInput {
  matched: string;
  communication: number;
  note: string;
}

export function checkCheckIn(input: CheckInInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!(MATCHED as readonly string[]).includes(input.matched)) errors.matched = 'Pick one.';
  if (!Number.isInteger(input.communication) || input.communication < 1 || input.communication > 5) {
    errors.communication = 'From 1 to 5.';
  }
  if (input.note.length > NOTE_MAX) errors.note = `At most ${NOTE_MAX} characters.`;
  return errors;
}

/** The studio's communication rating from its check-ins, or null until there are enough. */
export function communicationRating(scores: number[]): number | null {
  if (scores.length < MIN_CHECK_INS_FOR_RATING) return null;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
}

interface AppointmentLike {
  kind: string;
  status: string;
  startsAt: Date;
}

/**
 * Is a check-in due? After the first meeting has happened — its time has
 * passed and it was not cancelled or missed — and only once.
 */
export function checkInDue(appointments: AppointmentLike[], hasCheckIn: boolean, now: Date): boolean {
  if (hasCheckIn) return false;
  return appointments.some(
    (a) =>
      a.kind === 'FIRST_MEETING' &&
      (a.status === 'COMPLETED' || a.status === 'CONFIRMED') &&
      a.startsAt.getTime() < now.getTime(),
  );
}
