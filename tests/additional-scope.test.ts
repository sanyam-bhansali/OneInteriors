import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  checkDaysRequired,
  checkScopeImpact,
  checkScopeLines,
  extrasOpen,
  SCOPE_LINES_MAX,
  scopeImpactOf,
  scopeImpactWords,
  scopeMoveDays,
  scopeNumber,
  scopePaidDays,
  scopeTitle,
  toCustomerExtra,
} from '@/modules/project/change-order-rules';
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
    expect(toCustomerExtra(row, true, null)).toMatchObject({ daysRequired: null, dueOn: null, impact: null, inclGst: false });
  });
  it('simple scope: the impact and "including GST"; an older app is never told "Adds 0 days"', () => {
    const within = toCustomerExtra({ ...row, gstBps: 0, gstPaise: 0, daysRequired: 0, dueOn: '2026-11-13', impact: { kind: 'WITHIN_TIMELINE' }, inclGst: true }, true, null);
    expect(within).toMatchObject({ impact: { kind: 'WITHIN_TIMELINE' }, inclGst: true, daysRequired: null, dueOn: null });
    const moves = toCustomerExtra({ ...row, daysRequired: 7, dueOn: '2026-11-13', impact: { kind: 'MOVES_PROJECT', days: 7 }, inclGst: true }, true, null);
    expect(moves).toMatchObject({ impact: { kind: 'MOVES_PROJECT', days: 7 }, daysRequired: 7, dueOn: '2026-11-13' });
  });
});

/*
 * Simple additional scope (owner, 13 Nov 2026): "Just a click: write the
 * element, write the cost, write the days, send for approval." No
 * quotation, no discount, amounts include GST; the impact is one of three;
 * the whole project holds until paid, and only "moves the project" adds its
 * days.
 */

describe('simple scope lines', () => {
  it('item, details and cost; the total is the sum, in paise', () => {
    const r = checkScopeLines([
      { item: ' Loft in bedroom 2 ', details: '1200 x 600, laminate', amount: '25,000' },
      { item: 'Extra light point', details: '', amount: '1499.50' },
    ]);
    expect(r).toEqual({
      ok: true,
      lines: [
        { item: 'Loft in bedroom 2', details: '1200 x 600, laminate', amountPaise: 25_000_00 },
        { item: 'Extra light point', details: null, amountPaise: 1_499_50 },
      ],
      totalPaise: 26_499_50,
    });
  });
  it('an empty row left in the form is skipped; none at all is refused', () => {
    expect(checkScopeLines([{ item: 'Loft', amount: '100' }, { item: '', details: '', amount: '' }])).toMatchObject({ ok: true, totalPaise: 100_00 });
    expect(checkScopeLines([{ item: '', details: '', amount: '' }]).ok).toBe(false);
    expect(checkScopeLines([]).ok).toBe(false);
    expect(checkScopeLines('nope').ok).toBe(false);
  });
  it('every line needs an item and a positive cost, under ₹1 crore', () => {
    expect(checkScopeLines([{ item: '', amount: '100' }])).toEqual({ ok: false, error: 'Line 1: write the item.' });
    expect(checkScopeLines([{ item: 'Loft', amount: '' }]).ok).toBe(false);
    expect(checkScopeLines([{ item: 'Loft', amount: '0' }]).ok).toBe(false);
    expect(checkScopeLines([{ item: 'Loft', amount: '-5' }]).ok).toBe(false);
    expect(checkScopeLines([{ item: 'Loft', amount: '10000001' }]).ok).toBe(false);
  });
  it('one to ten lines', () => {
    const row = { item: 'Item', amount: '10' };
    expect(checkScopeLines(Array.from({ length: SCOPE_LINES_MAX }, () => row))).toMatchObject({ ok: true, totalPaise: 100_00 });
    expect(checkScopeLines(Array.from({ length: SCOPE_LINES_MAX + 1 }, () => row)).ok).toBe(false);
  });
});

describe('what simple scope does to the timeline', () => {
  const today = '2026-11-13';
  it('moves the project by 1 to 365 days', () => {
    expect(checkScopeImpact({ impact: 'MOVES_PROJECT', days: '7' }, today)).toEqual({ ok: true, impact: { kind: 'MOVES_PROJECT', days: 7 } });
    expect(checkScopeImpact({ impact: 'MOVES_PROJECT', days: '0' }, today).ok).toBe(false);
    expect(checkScopeImpact({ impact: 'MOVES_PROJECT', days: '' }, today).ok).toBe(false);
    expect(checkScopeImpact({ impact: 'MOVES_PROJECT', days: '366' }, today).ok).toBe(false);
  });
  it('within the timeline: no days, no date', () => {
    expect(checkScopeImpact({ impact: 'WITHIN_TIMELINE', days: '9', date: '2026-12-01' }, today)).toEqual({ ok: true, impact: { kind: 'WITHIN_TIMELINE' } });
  });
  it('this item only: a real date, today or later, within two years', () => {
    expect(checkScopeImpact({ impact: 'ITEM_ONLY', date: '2026-12-05' }, today)).toEqual({ ok: true, impact: { kind: 'ITEM_ONLY', on: '2026-12-05' } });
    expect(checkScopeImpact({ impact: 'ITEM_ONLY', date: today }, today).ok).toBe(true);
    expect(checkScopeImpact({ impact: 'ITEM_ONLY', date: '2026-11-12' }, today).ok).toBe(false);
    expect(checkScopeImpact({ impact: 'ITEM_ONLY', date: '2026-02-30' }, today).ok).toBe(false);
    expect(checkScopeImpact({ impact: 'ITEM_ONLY', date: '' }, today).ok).toBe(false);
    expect(checkScopeImpact({ impact: 'ITEM_ONLY', date: '2029-01-01' }, today).ok).toBe(false);
  });
  it('one of the three must be picked', () => {
    expect(checkScopeImpact({ impact: '' }, today).ok).toBe(false);
    expect(checkScopeImpact({ impact: 'SOMETHING' }, today).ok).toBe(false);
  });
});

describe('the impact as read back and told to the client', () => {
  it('stored kinds read back; the 12 Nov builder scope reads as moving the project by its days; extra work has none', () => {
    expect(scopeImpactOf({ scopeImpact: 'MOVES_PROJECT', daysRequired: 7, itemDueOn: null, builderScope: false })).toEqual({ kind: 'MOVES_PROJECT', days: 7 });
    expect(scopeImpactOf({ scopeImpact: 'WITHIN_TIMELINE', daysRequired: 0, itemDueOn: null, builderScope: false })).toEqual({ kind: 'WITHIN_TIMELINE' });
    expect(scopeImpactOf({ scopeImpact: 'ITEM_ONLY', daysRequired: 0, itemDueOn: '2026-12-05', builderScope: false })).toEqual({ kind: 'ITEM_ONLY', on: '2026-12-05' });
    expect(scopeImpactOf({ scopeImpact: null, daysRequired: 4, itemDueOn: null, builderScope: true })).toEqual({ kind: 'MOVES_PROJECT', days: 4 });
    expect(scopeImpactOf({ scopeImpact: null, daysRequired: null, itemDueOn: null, builderScope: false })).toBeNull();
  });
  it('plain words, never a reason', () => {
    expect(scopeImpactWords({ kind: 'MOVES_PROJECT', days: 7 })).toBe('Your handover moves by 7 days');
    expect(scopeImpactWords({ kind: 'MOVES_PROJECT', days: 1 })).toBe('Your handover moves by 1 day');
    expect(scopeImpactWords({ kind: 'WITHIN_TIMELINE' })).toBe('No change to your handover');
    expect(scopeImpactWords({ kind: 'ITEM_ONLY', on: '2026-12-05' })).toBe('This item comes by 5 Dec');
  });
  it('the title counts the scopes on the project', () => {
    expect(scopeTitle(0)).toBe('Additional scope 1');
    expect(scopeTitle(2)).toBe('Additional scope 3');
  });
});

describe('paid: the hold ends; only "moves the project" adds its days', () => {
  it('every kind moves by the days on hold, as any hold does', () => {
    expect(scopeMoveDays(3, { kind: 'MOVES_PROJECT', days: 7 })).toBe(10);
    expect(scopeMoveDays(3, { kind: 'WITHIN_TIMELINE' })).toBe(3);
    expect(scopeMoveDays(3, { kind: 'ITEM_ONLY', on: '2026-12-05' })).toBe(3);
    expect(scopeMoveDays(0, { kind: 'WITHIN_TIMELINE' })).toBe(0);
  });
});

describe('the client apps say it in all three languages', () => {
  const keys = ['life.scope.moves', 'life.scope.moves.one', 'life.scope.within', 'life.scope.item', 'life.scope.pay', 'life.scope.inclGst'];
  it('web and phone carry the same words', () => {
    const web = readFileSync(join(__dirname, '../src/modules/app/lifecycle-words.ts'), 'utf8');
    const phone = readFileSync(join(__dirname, '../mobile/src/lib/strings/lifecycle.ts'), 'utf8');
    for (const k of keys) {
      const line = (src: string) => src.split(/\r?\n/).find((l) => l.includes(`'${k}':`));
      expect(line(web), k).toBeTruthy();
      expect(line(phone), k).toBe(line(web));
    }
  });
});
