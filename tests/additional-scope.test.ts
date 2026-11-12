import { describe, expect, it } from 'vitest';
import { checkDaysRequired, extrasOpen, scopeNumber, scopePaidDays, toCustomerExtra } from '@/modules/project/change-order-rules';
import { can } from '@/modules/studio/roles';
import { checkHoldAsk, holdEndShift } from '@/modules/studio-hold/rules';

/*
 * Additional scope (owner, 12 Nov 2026): a new quotation after the design
 * final, approved by the client with the days it needs, paid at once; the
 * project holds from the approval until it is paid. And the design head
 * records payments.
 */

describe('the design head records payments', () => {
  const base = { status: 'ACTIVE' as const, fullSoftware: true };
  it('the design head may record a payment on any project; a designer may not', () => {
    expect(can({ ...base, role: 'DESIGNER', designHead: true }, 'payment.record')).toBe(true);
    expect(can({ ...base, role: 'DESIGNER', designHead: true }, 'payment.record', { assigned: false })).toBe(true);
    expect(can({ ...base, role: 'DESIGNER' }, 'payment.record', { assigned: true })).toBe(false);
  });
});

describe('when additional scope opens', () => {
  it('in design once the design final is made; not before; never after closing out', () => {
    expect(extrasOpen('DESIGN', false, true)).toEqual({ ok: true });
    expect(extrasOpen('DESIGN', false, false).ok).toBe(false);
    expect(extrasOpen('EXECUTION', false, true)).toEqual({ ok: true });
    expect(extrasOpen('EXECUTION', true, true).ok).toBe(false);
  });
});

describe('the quotation number', () => {
  it("is the design final's number with -A1, -A2…", () => {
    expect(scopeNumber('OI-104', [])).toBe('OI-104-A1');
    expect(scopeNumber('OI-104', ['OI-104-A1', 'OI-104-A2'])).toBe('OI-104-A3');
    expect(scopeNumber('OI-104-A1', ['OI-104-A1'])).toBe('OI-104-A2');
  });
});

describe('days required', () => {
  it('a whole number of days, 0 to a year', () => {
    expect(checkDaysRequired('7')).toEqual({ ok: true, days: 7 });
    expect(checkDaysRequired(0)).toEqual({ ok: true, days: 0 });
    expect(checkDaysRequired('').ok).toBe(false);
    expect(checkDaysRequired('2.5').ok).toBe(false);
    expect(checkDaysRequired('-1').ok).toBe(false);
    expect(checkDaysRequired('400').ok).toBe(false);
  });

  it('paid: the plan moves by the days on hold plus the days the work needs', () => {
    expect(scopePaidDays(4, 7)).toBe(11);
    expect(scopePaidDays(0, 7)).toBe(7);
    expect(scopePaidDays(3, null)).toBe(3);
  });

  it('the move: the stage under way and handover later by those days', () => {
    const stages = [
      { id: 'des', kind: 'DESIGN' as const, name: 'Design', plannedStart: '2026-10-01', plannedEnd: '2026-11-30', actualEnd: null },
      { id: 'han', kind: 'HANDOVER' as const, name: 'Handover', plannedStart: '2027-02-20', plannedEnd: '2027-02-28', actualEnd: null },
    ];
    const s = holdEndShift(stages, [{ id: 'x', stageId: 'des', plannedOn: '2026-11-20', done: false }], scopePaidDays(4, 7));
    expect(s.steps).toEqual([{ id: 'x', from: '2026-11-20', to: '2026-12-01' }]);
    expect(s.plan!.rows.find((r) => r.field === 'HANDOVER')).toMatchObject({ from: '2027-02-28', to: '2027-03-11' });
  });
});

describe('the hold', () => {
  it('nobody asks for the additional-scope hold by hand: it comes with the approval', () => {
    expect(checkHoldAsk({ reason: 'ADDITIONAL_SCOPE', note: '' }, []).ok).toBe(false);
  });
});

describe('what the client sees', () => {
  const row = {
    id: 'c1',
    number: 2,
    title: 'Additional scope OI-104-A1',
    reason: null,
    status: 'SENT_TO_CLIENT' as const,
    workPaise: 100_000,
    discountPaise: 0,
    gstBps: 1800,
    gstPaise: 18_000,
    totalPaise: 118_000,
    sentAt: '2026-11-12',
    decidedAt: null,
    declineReason: null,
    lines: [],
    payments: [],
  };
  it('the days it adds and the day its payment is due', () => {
    expect(toCustomerExtra({ ...row, daysRequired: 7, dueOn: '2026-11-12' }, true, null)).toMatchObject({ daysRequired: 7, dueOn: '2026-11-12', canAnswer: true });
  });
  it('ordinary extra work has neither', () => {
    expect(toCustomerExtra(row, true, null)).toMatchObject({ daysRequired: null, dueOn: null });
  });
});
