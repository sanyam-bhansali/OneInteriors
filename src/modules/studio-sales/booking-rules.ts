/**
 * Recording the booking advance, and refunding it (Studio OS Phase 1,
 * docs/studio-os/PHASE-1-SALES.md §5). Pure, and tested
 * (tests/studio-sales-booking.test.ts).
 *
 * ## Record booking (accounts, owner, PM)
 *
 * On the quotation's sales final: the amount (pre-filled from the first
 * payment stage), the day it arrived, how it was paid, a reference. That
 * creates the project through the existing own-client path, the payment
 * entry, the app invite and the timeline line, and moves the lead to the
 * studio's first WON column — the only move the software makes by itself.
 *
 * Refused when the quotation was changed after its sales final was marked:
 * the project is built from the quotation as it is, and the client agreed
 * to the sales final. Send it again and mark the new revision, or undo the
 * change. Easy, not automatic.
 *
 * ## Refund booking
 *
 * Within the refund days (3 by default) accounts, owner or PM may refund.
 * After that only the owner, and the screen says how late it is first. The
 * refund is a correction entry on the payment (never an edit), the project
 * is marked cancelled (never deleted), and the lead goes back to the column
 * it was in.
 */

import { isDay, istDay, daysBetween } from '@/modules/project/working-days';
import { parseRupees, isPaymentMode, type PaymentModeName } from '@/modules/project/payment-ledger';
import { formatINR } from '@/lib/money';
import type { StudioRoleName } from '@/modules/studio/roles';

export interface BookingInput {
  /** Rupees as typed: "25,000". */
  amount: unknown;
  /** "YYYY-MM-DD". */
  receivedOn: unknown;
  mode: unknown;
  /** UTR, cheque number, who paid. Optional. */
  reference?: unknown;
}

export interface CheckedBooking {
  amountPaise: number;
  receivedOn: string;
  mode: PaymentModeName;
  reference: string | null;
}

export function checkBookingInput(input: BookingInput, now = new Date()): { ok: true; value: CheckedBooking } | { ok: false; error: string } {
  const amountPaise = parseRupees(input.amount);
  if (amountPaise === null || amountPaise <= 0) return { ok: false, error: 'Enter the amount received, in rupees.' };
  if (!isDay(input.receivedOn) || input.receivedOn < '2020-01-01') return { ok: false, error: 'Pick the day the money arrived.' };
  if (input.receivedOn > istDay(now)) return { ok: false, error: 'The day the money arrived cannot be in the future.' };
  if (!isPaymentMode(input.mode)) return { ok: false, error: 'Say how it was paid: UPI, bank transfer, cash or cheque.' };
  const reference = typeof input.reference === 'string' ? input.reference.trim().replace(/\s+/g, ' ').slice(0, 120) || null : null;
  return { ok: true, value: { amountPaise, receivedOn: input.receivedOn, mode: input.mode, reference } };
}

export interface BookingFacts {
  /** A revision is marked the sales final on this quotation. */
  hasSalesFinal: boolean;
  /** A live (not cancelled) project already runs on this quotation, or the lead is booked. */
  alreadyBooked: boolean;
  /** The quotation's lines changed after the sales final was marked. */
  changedSinceFinal: boolean;
  /** The lead or quotation came from One Interiors (they sign in the app). */
  fromOneInteriors: boolean;
  /** The lead is in the bin. */
  leadDeleted: boolean;
  /** The first stage of the sales final's schedule, paise. */
  bookingStagePaise: number;
  amountPaise: number;
}

export const BOOKING_ERRORS = {
  noFinal: 'Mark a revision as the sales final first. The booking is recorded against it.',
  booked: 'This booking is already recorded.',
  changed:
    'This quotation was changed after its sales final was marked. Send it again and mark the new revision, or undo the change, then record the booking.',
  oneInteriors:
    'This client came through One Interiors and signs your final quote in their app; the project starts there. You can record the advance on the project’s payments once it does.',
  deleted: 'This lead is in the bin. Restore it first.',
} as const;

/** Why the booking cannot be recorded, or null when it can. */
export function bookingRefusal(f: BookingFacts): string | null {
  if (f.leadDeleted) return BOOKING_ERRORS.deleted;
  if (f.fromOneInteriors) return BOOKING_ERRORS.oneInteriors;
  if (f.alreadyBooked) return BOOKING_ERRORS.booked;
  if (!f.hasSalesFinal) return BOOKING_ERRORS.noFinal;
  if (f.changedSinceFinal) return BOOKING_ERRORS.changed;
  if (f.amountPaise > f.bookingStagePaise) {
    return `That is more than the booking advance on the sales final (${formatINR(f.bookingStagePaise)}). Record the rest against the next stage on the project.`;
  }
  return null;
}

export interface RefundFacts {
  role: StudioRoleName;
  /** When the booking was recorded. */
  bookedAt: Date;
  /** Days the booking advance is refundable for (the first stage's). */
  refundDays: number;
  /** Already refunded. */
  cancelled: boolean;
  /** The person pressed "refund anyway" after being told it is late. */
  lateConfirmed: boolean;
}

export type RefundCheck = { ok: true; late: boolean } | { ok: false; error: string; askLate?: boolean };

/** Whole IST days since the booking was recorded. */
export const daysSinceBooking = (bookedAt: Date, now: Date): number => daysBetween(istDay(bookedAt), istDay(now));

/**
 * May this person refund this booking now. Inside the window: accounts,
 * owner or PM. Outside it: the owner only, and only after being told it is
 * late (`askLate` asks the screen to show that and a "refund anyway").
 */
export function refundCheck(f: RefundFacts, now = new Date()): RefundCheck {
  if (f.cancelled) return { ok: false, error: 'This booking was already refunded.' };
  if (!['OWNER', 'PM', 'ACCOUNTS'].includes(f.role)) return { ok: false, error: 'Your role in the studio does not include refunds. Ask your studio owner.' };
  const days = daysSinceBooking(f.bookedAt, now);
  if (days <= f.refundDays) return { ok: true, late: false };
  if (f.role !== 'OWNER') {
    return { ok: false, error: `The ${f.refundDays}-day refund window has passed (booked ${days} days ago). Only the studio owner can refund it now.` };
  }
  if (!f.lateConfirmed) {
    return {
      ok: false,
      askLate: true,
      error: `This booking is ${days} days old and the refund window was ${f.refundDays} days. Refund it anyway?`,
    };
  }
  return { ok: true, late: true };
}

/** The timeline line for a recorded booking. */
export function bookedSummary(amountPaise: number, mode: PaymentModeName, quoteNumber: string, revision: string): string {
  const how = mode === 'BANK' ? 'bank transfer' : mode === 'UPI' ? 'UPI' : mode === 'CASH' ? 'cash' : 'cheque';
  return `Booked: ${formatINR(amountPaise)} received by ${how} on ${revision} of quotation ${quoteNumber}. The project is open and the client has been invited to the app.`;
}

export function refundedSummary(amountPaise: number, late: boolean, reason: string | null): string {
  return `Booking refunded (${formatINR(amountPaise)})${late ? ', after the refund window' : ''}. The project is cancelled and kept.${reason ? ` ${reason}` : ''}`;
}
