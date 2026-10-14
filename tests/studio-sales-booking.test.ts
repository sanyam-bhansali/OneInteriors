import { describe, expect, it } from 'vitest';
import {
  BOOKING_ERRORS,
  bookedSummary,
  bookingRefusal,
  checkBookingInput,
  daysSinceBooking,
  refundCheck,
  type BookingFacts,
} from '@/modules/studio-sales/booking-rules';

/**
 * Studio OS Phase 1: recording the booking advance and refunding it
 * (docs/studio-os/PHASE-1-SALES.md §5).
 */

const NOW = new Date('2026-10-12T06:30:00Z'); // 12:00 IST, 12 Oct

describe('the booking form', () => {
  it('takes rupees as typed, the day, the mode and an optional reference', () => {
    expect(checkBookingInput({ amount: '25,000', receivedOn: '2026-10-12', mode: 'UPI', reference: '  UTR 1234 ' }, NOW)).toEqual({
      ok: true,
      value: { amountPaise: 2_500_000, receivedOn: '2026-10-12', mode: 'UPI', reference: 'UTR 1234' },
    });
  });

  it('refuses no amount, a future day, an unknown mode', () => {
    expect(checkBookingInput({ amount: '', receivedOn: '2026-10-12', mode: 'UPI' }, NOW).ok).toBe(false);
    expect(checkBookingInput({ amount: '25000', receivedOn: '2026-10-13', mode: 'UPI' }, NOW)).toMatchObject({ ok: false, error: expect.stringMatching(/future/) });
    expect(checkBookingInput({ amount: '25000', receivedOn: '2026-10-12', mode: 'PAYTM' }, NOW)).toMatchObject({ ok: false, error: expect.stringMatching(/how it was paid/) });
  });
});

describe('when a booking can be recorded', () => {
  const ok: BookingFacts = {
    hasSalesFinal: true,
    alreadyBooked: false,
    changedSinceFinal: false,
    fromOneInteriors: false,
    leadDeleted: false,
    bookingStagePaise: 2_500_000,
    amountPaise: 2_500_000,
  };

  it('records against a sales final', () => {
    expect(bookingRefusal(ok)).toBeNull();
    expect(bookingRefusal({ ...ok, amountPaise: 1_000_000 })).toBeNull();
  });

  it('needs a sales final, and only once', () => {
    expect(bookingRefusal({ ...ok, hasSalesFinal: false })).toBe(BOOKING_ERRORS.noFinal);
    expect(bookingRefusal({ ...ok, alreadyBooked: true })).toBe(BOOKING_ERRORS.booked);
  });

  it('refuses when the quotation changed after the sales final (easy, not automatic)', () => {
    expect(bookingRefusal({ ...ok, changedSinceFinal: true })).toBe(BOOKING_ERRORS.changed);
  });

  it('leaves One Interiors clients to sign in their app, and a binned lead alone', () => {
    expect(bookingRefusal({ ...ok, fromOneInteriors: true })).toBe(BOOKING_ERRORS.oneInteriors);
    expect(bookingRefusal({ ...ok, leadDeleted: true })).toBe(BOOKING_ERRORS.deleted);
  });

  it('refuses more than the booking stage, saying how much that is', () => {
    expect(bookingRefusal({ ...ok, amountPaise: 3_000_000 })).toMatch(/₹25,000/);
  });

  it('writes a plain timeline line', () => {
    expect(bookedSummary(2_500_000, 'UPI', '2026-004', 'R3')).toMatch(/^Booked: ₹25,000 received by UPI on R3 of quotation 2026-004\./);
  });
});

describe('refunding', () => {
  const bookedAt = new Date('2026-10-10T05:00:00Z'); // 10 Oct IST
  const base = { bookedAt, refundDays: 3, cancelled: false, lateConfirmed: false };

  it('counts India days since the booking', () => {
    expect(daysSinceBooking(bookedAt, NOW)).toBe(2);
    expect(daysSinceBooking(new Date('2026-10-11T19:00:00Z'), NOW)).toBe(0); // 00:30 IST on the 12th
  });

  it('inside the window: accounts, owner or PM', () => {
    for (const role of ['ACCOUNTS', 'OWNER', 'PM'] as const) expect(refundCheck({ ...base, role }, NOW)).toEqual({ ok: true, late: false });
    expect(refundCheck({ ...base, role: 'OWNER' }, new Date('2026-10-13T12:00:00Z'))).toEqual({ ok: true, late: false });
  });

  it('a salesperson or a supervisor never', () => {
    expect(refundCheck({ ...base, role: 'SALES' }, NOW).ok).toBe(false);
    expect(refundCheck({ ...base, role: 'SUPERVISOR' }, NOW).ok).toBe(false);
  });

  it('after the window: the owner, once told it is late; nobody else', () => {
    const later = new Date('2026-10-20T06:00:00Z');
    expect(refundCheck({ ...base, role: 'ACCOUNTS' }, later)).toMatchObject({ ok: false, error: expect.stringMatching(/Only the studio owner/) });
    expect(refundCheck({ ...base, role: 'OWNER' }, later)).toMatchObject({ ok: false, askLate: true, error: expect.stringMatching(/10 days old/) });
    expect(refundCheck({ ...base, role: 'OWNER', lateConfirmed: true }, later)).toEqual({ ok: true, late: true });
  });

  it('never twice', () => {
    expect(refundCheck({ ...base, role: 'OWNER', cancelled: true }, NOW)).toMatchObject({ ok: false, error: expect.stringMatching(/already refunded/) });
  });
});
