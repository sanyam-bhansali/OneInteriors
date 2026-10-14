import { describe, expect, it } from 'vitest';
import { handoverPaidOn, mayRaiseSnag, readSnagWindowDays, snagWindow, windowFromLedger } from '@/modules/project/snag-window';
import { customerLifecycle, type LifecycleInput } from '@/modules/portal/lifecycle-view';
import { lifecycleLines } from '@/modules/app/lifecycle-words';

/** The snag window (owner, 15 Oct 2026): after the handover payment, the studio's days; then raising closes until the warranty. */

const stage = (index: number, openPaise: number) => ({ index, amountPaise: 100, openPaise });
const row = (stageIndex: number, receivedOn: string, status = 'confirmed') => ({ stageIndex, receivedOn, counts: status === 'confirmed' || status === 'earlier', status });

describe('the studio’s days', () => {
  it('defaults to 30 and repairs anything that is not 1 to 365 whole days', () => {
    expect(readSnagWindowDays(45)).toBe(45);
    expect(readSnagWindowDays('20')).toBe(20);
    for (const v of [0, -3, 366, 2.5, 'x', null, undefined]) expect(readSnagWindowDays(v)).toBe(30);
  });
});

describe('the handover payment', () => {
  it('is the last stage recorded in full: the latest day money arrived on it, waiting for the client’s yes included', () => {
    expect(handoverPaidOn({ stages: [stage(0, 0), stage(1, 0)], rows: [row(1, '2026-10-20'), row(1, '2026-10-22', 'waiting'), row(0, '2026-11-01')] })).toBe('2026-10-22');
  });

  it('is not recorded while anything is still open on it, or after a replaced or disputed row only', () => {
    expect(handoverPaidOn({ stages: [stage(0, 0), stage(1, 50)], rows: [row(1, '2026-10-20')] })).toBeNull();
    expect(handoverPaidOn({ stages: [stage(0, 0), stage(1, 0)], rows: [row(1, '2026-10-20', 'replaced')] })).toBeNull();
    expect(handoverPaidOn(null)).toBeNull();
  });
});

describe('the window', () => {
  it('opens on the later of the closure and the handover payment, and runs the studio’s days', () => {
    expect(snagWindow({ closedOutOn: '2026-10-15', paidOn: '2026-10-20', days: 30 })).toEqual({ opensOn: '2026-10-20', endsOn: '2026-11-18' });
    expect(snagWindow({ closedOutOn: '2026-10-15', paidOn: '2026-10-01', days: 10 })).toEqual({ opensOn: '2026-10-15', endsOn: '2026-10-24' });
  });

  it('has not opened before the closure is fixed or the payment recorded', () => {
    expect(snagWindow({ closedOutOn: null, paidOn: '2026-10-20', days: 30 })).toBeNull();
    expect(snagWindow({ closedOutOn: '2026-10-15', paidOn: null, days: 30 })).toBeNull();
  });

  it('opens on the closure day when nothing is left to pay on the last stage', () => {
    expect(windowFromLedger('2026-10-15', { stages: [stage(0, 0), { index: 1, amountPaise: 0, openPaise: 0 }], rows: [] }, 30)).toEqual({ opensOn: '2026-10-15', endsOn: '2026-11-13' });
    expect(windowFromLedger('2026-10-15', null, 30)).toBeNull();
  });
});

describe('raising a snag', () => {
  const w = { opensOn: '2026-10-20', endsOn: '2026-11-18' };
  it('is open before and inside the window', () => {
    expect(mayRaiseSnag('EXECUTION', null, '2026-10-01')).toEqual({ ok: true, warranty: false });
    expect(mayRaiseSnag('SNAGS', w, '2026-11-18')).toEqual({ ok: true, warranty: false });
  });
  it('closes after the window until the warranty, which raises warranty snags', () => {
    expect(mayRaiseSnag('SNAGS', w, '2026-11-19')).toEqual({ ok: false, reason: 'window_closed' });
    expect(mayRaiseSnag('WARRANTY', w, '2026-12-19')).toEqual({ ok: true, warranty: true });
    expect(mayRaiseSnag('CLOSED', null, '2028-01-01')).toEqual({ ok: false, reason: 'warranty_over' });
  });
});

describe('what the client sees', () => {
  const input = (over: Partial<LifecycleInput>): LifecycleInput => ({
    phase: 'SNAGS',
    role: 'owner',
    today: '2026-10-25',
    warrantyEndsOn: null,
    design: null,
    tracker: null,
    payments: null,
    snags: [],
    decisions: [],
    ...over,
  });
  const ctx = { studio: 'Hauspire', money: (p: number) => String(p), date: (d: string) => d, today: '2026-10-25' };

  it('the window’s last day while it runs, and that it closed after', () => {
    const open = customerLifecycle(input({ snagWindow: { opensOn: '2026-10-20', endsOn: '2026-11-18' } }));
    expect(open).toMatchObject({ snagWindowEndsOn: '2026-11-18', canRaiseSnag: true });
    expect(lifecycleLines(open, 'en', ctx).snagWindow).toBe('You can raise snags here until 2026-11-18.');
    const closed = customerLifecycle(input({ today: '2026-11-20', snagWindow: { opensOn: '2026-10-20', endsOn: '2026-11-18' } }));
    expect(closed).toMatchObject({ canRaiseSnag: false });
    expect(lifecycleLines(closed, 'en', { ...ctx, today: '2026-11-20' }).snagWindow).toContain('Your snag window closed on 2026-11-18');
  });

  it('nothing about a window during the warranty, or before it opens', () => {
    expect(customerLifecycle(input({ phase: 'WARRANTY', warrantyEndsOn: '2027-10-01', snagWindow: { opensOn: '2026-10-20', endsOn: '2026-11-18' } }))).toMatchObject({ snagWindowEndsOn: null, canRaiseSnag: true });
    expect(customerLifecycle(input({}))).toMatchObject({ snagWindowEndsOn: null, canRaiseSnag: true });
  });
});
