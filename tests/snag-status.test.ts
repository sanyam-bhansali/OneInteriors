import { describe, expect, it } from 'vitest';
import {
  allowedNext,
  canWrite,
  eventsOrLegacy,
  finalPaymentGate,
  hasOpenSnags,
  legacySnagEvents,
  legacySnagStatus,
  openSnagCount,
  orderSnagEvents,
  SNAG_AUTO_CLOSE_DAYS,
  SNAG_EVENT_KINDS,
  snagStatus,
  writtenState,
  type SnagEventKind,
  type SnagEventLike,
  type SnagState,
} from '@/modules/project/snag-status';

/** Snag status from its events (modules/project/snag-status.ts). Pure. */

const T0 = new Date('2026-10-01T05:00:00Z');
const at = (days: number, ms = 0) => new Date(T0.getTime() + days * 86_400_000 + ms);
const ev = (kind: SnagEventKind, day: number, extra: Partial<SnagEventLike> = {}): SnagEventLike => ({ kind, at: at(day), ...extra });

const RAISED = ev('RAISED', 0, { photoPaths: ['before.jpg'] });
const ACCEPTED = ev('ACCEPTED', 1, { fixBy: at(4), assigneeId: 'm-sup' });
const FIXED = ev('FIXED', 3, { photoPaths: ['after.jpg'], customerText: 'Filler strip fitted.' });

describe('snagStatus', () => {
  it('a snag with no events reads as raised but is not writable except by RAISED', () => {
    expect(snagStatus([]).state).toBe('raised');
    expect(writtenState([])).toBeNull();
    expect(allowedNext(null)).toEqual(['RAISED']);
  });

  it('raised → accepted carries the fix-by date and the assignee', () => {
    const s = snagStatus([RAISED, ACCEPTED]);
    expect(s).toMatchObject({ state: 'accepted', open: true, fixBy: at(4), assigneeId: 'm-sup', fix: null, closedBy: null });
  });

  it('accepting again moves the date and keeps the assignee unless changed', () => {
    const s = snagStatus([RAISED, ACCEPTED, ev('ACCEPTED', 2, { fixBy: at(6), assigneeId: null })]);
    expect(s.fixBy).toEqual(at(6));
    expect(s.assigneeId).toBe('m-sup');
    expect(snagStatus([RAISED, ACCEPTED, ev('ACCEPTED', 2, { fixBy: at(6), assigneeId: 'm-2' })]).assigneeId).toBe('m-2');
  });

  it('a fix leaves the snag OPEN until the customer answers — the studio cannot close it', () => {
    const s = snagStatus([RAISED, ACCEPTED, FIXED], at(4));
    expect(s.state).toBe('fixed');
    expect(s.open).toBe(true);
    expect(s.fixedAt).toEqual(at(3));
    expect(s.fix?.customerText).toBe('Filler strip fitted.');
    expect(s.autoClosesAt).toEqual(at(3 + SNAG_AUTO_CLOSE_DAYS));
  });

  it('the customer confirming closes it', () => {
    const s = snagStatus([RAISED, ACCEPTED, FIXED, ev('CONFIRMED', 4)], at(5));
    expect(s).toMatchObject({ state: 'closed', open: false, closedBy: 'customer', closedAt: at(4), autoClosesAt: null });
    expect(s.fix?.photoPaths).toEqual(['after.jpg']);
  });

  it('not fixed reopens it, with the reason, and forgets the fix', () => {
    const s = snagStatus([RAISED, ACCEPTED, FIXED, ev('REOPENED', 4, { note: 'Still a gap on the left' })], at(5));
    expect(s).toMatchObject({ state: 'reopened', open: true, fix: null, fixedAt: null, notFixedReason: 'Still a gap on the left', reopenCount: 1 });
  });

  it('a second fix after a reopen waits for the customer again', () => {
    const second = ev('FIXED', 5, { photoPaths: ['after2.jpg'] });
    const s = snagStatus([RAISED, ACCEPTED, FIXED, ev('REOPENED', 4), second], at(6));
    expect(s.state).toBe('fixed');
    expect(s.fix).toBe(second);
    expect(s.reopenCount).toBe(1);
    expect(s.notFixedReason).toBeNull();
  });

  describe('seven-day auto-close', () => {
    it('stays fixed one millisecond before seven days', () => {
      expect(snagStatus([RAISED, FIXED], new Date(at(3 + 7).getTime() - 1)).state).toBe('fixed');
    });

    it('is closed at exactly seven days, before the cron writes anything', () => {
      const s = snagStatus([RAISED, FIXED], at(3 + 7));
      expect(s).toMatchObject({ state: 'closed', open: false, closedBy: 'auto', closedAt: at(10), autoCloseDue: true });
    });

    it('without `now`, only what was written counts', () => {
      expect(snagStatus([RAISED, FIXED]).state).toBe('fixed');
    });

    it('the written AUTO_CLOSED row closes it and is no longer due', () => {
      const s = snagStatus([RAISED, FIXED, ev('AUTO_CLOSED', 10)], at(20));
      expect(s).toMatchObject({ state: 'closed', closedBy: 'auto', autoCloseDue: false, closedAt: at(10) });
    });

    it('counts from the latest fix, not the first', () => {
      const events = [RAISED, FIXED, ev('REOPENED', 4), ev('FIXED', 8)];
      expect(snagStatus(events, at(11)).state).toBe('fixed');
      expect(snagStatus(events, at(15)).state).toBe('closed');
    });

    it('never closes a snag that was not fixed, however old', () => {
      expect(snagStatus([RAISED, ACCEPTED], at(400)).state).toBe('accepted');
      expect(snagStatus([RAISED, ev('DISPUTED', 1, { note: 'Not in scope' })], at(400)).state).toBe('disputed');
    });
  });

  it('a dispute stays open with the reason; the customer agreeing closes it', () => {
    const disputed = [RAISED, ev('DISPUTED', 1, { note: 'Hairline in the stone, as shown at selection' })];
    expect(snagStatus(disputed)).toMatchObject({ state: 'disputed', open: true, disputeReason: 'Hairline in the stone, as shown at selection' });
    expect(snagStatus([...disputed, ev('CONFIRMED', 2)])).toMatchObject({ state: 'closed', closedBy: 'customer' });
  });

  it('accepting after a dispute clears the reason', () => {
    expect(snagStatus([RAISED, ev('DISPUTED', 1, { note: 'x' }), ev('ACCEPTED', 2, { fixBy: at(5) })])).toMatchObject({ state: 'accepted', disputeReason: null });
  });

  it('skips events that do not fit the flow instead of trusting them', () => {
    // A CONFIRMED with no fix before it does not close the snag.
    expect(snagStatus([RAISED, ev('CONFIRMED', 1)]).state).toBe('raised');
    // Nothing reopens a closed snag.
    expect(snagStatus([RAISED, FIXED, ev('CONFIRMED', 4), ev('REOPENED', 5), ev('FIXED', 6)]).state).toBe('closed');
    // An unknown kind is ignored.
    expect(snagStatus([RAISED, { kind: 'BOGUS', at: at(1) }]).state).toBe('raised');
    // Events before RAISED are ignored.
    expect(snagStatus([ev('FIXED', -1), RAISED]).state).toBe('raised');
  });

  it('orders by time, then by kind on a tie', () => {
    const same = new Date('2026-10-01T00:00:00Z');
    const shuffled: SnagEventLike[] = [
      { kind: 'FIXED', at: same },
      { kind: 'ACCEPTED', at: same },
      { kind: 'RAISED', at: same },
    ];
    expect(orderSnagEvents(shuffled).map((e) => e.kind)).toEqual(['RAISED', 'ACCEPTED', 'FIXED']);
    expect(snagStatus(shuffled).state).toBe('fixed');
    expect(shuffled[0]!.kind).toBe('FIXED'); // the input is untouched
  });

  it('every state × every kind: the transition table', () => {
    const table: Record<SnagState | 'none', SnagEventKind[]> = {
      none: ['RAISED'],
      raised: ['ACCEPTED', 'DISPUTED', 'FIXED'],
      accepted: ['ACCEPTED', 'DISPUTED', 'FIXED'],
      disputed: ['ACCEPTED', 'FIXED', 'CONFIRMED'],
      fixed: ['CONFIRMED', 'REOPENED', 'AUTO_CLOSED'],
      reopened: ['ACCEPTED', 'DISPUTED', 'FIXED'],
      closed: [],
    };
    for (const [state, kinds] of Object.entries(table)) {
      const allowed = allowedNext(state === 'none' ? null : (state as SnagState));
      for (const k of SNAG_EVENT_KINDS) expect(allowed.includes(k), `${state} → ${k}`).toBe(kinds.includes(k));
    }
  });
});

describe('canWrite', () => {
  it('lets the customer answer a fix within seven days, and not after', () => {
    const events = [RAISED, FIXED];
    expect(canWrite(events, 'CONFIRMED', at(9))).toBe(true);
    expect(canWrite(events, 'REOPENED', at(9))).toBe(true);
    expect(canWrite(events, 'CONFIRMED', at(10))).toBe(false);
    expect(canWrite(events, 'REOPENED', at(10))).toBe(false);
  });

  it('lets the cron auto-close only when due, and only once', () => {
    expect(canWrite([RAISED, FIXED], 'AUTO_CLOSED', at(9))).toBe(false);
    expect(canWrite([RAISED, FIXED], 'AUTO_CLOSED', at(10))).toBe(true);
    expect(canWrite([RAISED, FIXED, ev('AUTO_CLOSED', 10)], 'AUTO_CLOSED', at(11))).toBe(false);
  });

  it('refuses a customer confirm before any fix, and a studio fix on a closed snag', () => {
    expect(canWrite([RAISED, ACCEPTED], 'CONFIRMED', at(2))).toBe(false);
    expect(canWrite([RAISED, FIXED, ev('CONFIRMED', 4)], 'FIXED', at(5))).toBe(false);
    expect(canWrite([], 'RAISED', at(0))).toBe(true);
    expect(canWrite([RAISED], 'RAISED', at(0))).toBe(false);
  });
});

describe('legacy column and legacy rows', () => {
  it('writes FIXED for fixed and closed, OPEN for everything else', () => {
    const want: Record<SnagState, 'OPEN' | 'FIXED'> = {
      raised: 'OPEN',
      accepted: 'OPEN',
      disputed: 'OPEN',
      reopened: 'OPEN',
      fixed: 'FIXED',
      closed: 'FIXED',
    };
    for (const [s, v] of Object.entries(want)) expect(legacySnagStatus(s as SnagState)).toBe(v);
  });

  it('reconstructs a pre-events snag like the migration did', () => {
    const legacy = { createdAt: at(0), status: 'FIXED', fixBy: at(4), fixedAt: at(3), fixedNote: 'Done', fixedPhotoPaths: ['a.jpg'], photoPaths: ['b.jpg'] };
    const events = legacySnagEvents(legacy);
    expect(events.map((e) => e.kind)).toEqual(['RAISED', 'ACCEPTED', 'FIXED']);
    expect(snagStatus(events, at(5)).state).toBe('fixed');
    expect(snagStatus(events, at(11)).state).toBe('closed');
    expect(snagStatus(legacySnagEvents({ ...legacy, status: 'OPEN', fixBy: null })).state).toBe('raised');
    expect(eventsOrLegacy([], legacy)).toHaveLength(3);
    expect(eventsOrLegacy([RAISED], legacy)).toEqual([RAISED]);
  });
});

describe('the final-payment gate', () => {
  const closed = [RAISED, FIXED, ev('CONFIRMED', 4)];
  const waiting = [RAISED, FIXED];
  const open = [RAISED, ACCEPTED];

  it('counts every snag that is not closed, fixes waiting for the customer included', () => {
    expect(openSnagCount([closed, waiting, open], at(5))).toBe(2);
    expect(hasOpenSnags([closed], at(5))).toBe(false);
    expect(hasOpenSnags([], at(5))).toBe(false);
    // Seven days after the fix, the waiting one has closed by itself.
    expect(openSnagCount([closed, waiting, open], at(10))).toBe(1);
  });

  it('holds only the last stage, while any snag is open', () => {
    const now = at(5);
    expect(finalPaymentGate({ stageIndex: 2, stageCount: 3, eventsBySnag: [open], now })).toEqual({
      ok: false,
      open: 1,
      error: 'The last payment can be due only once every snag is closed. 1 snag is still open.',
    });
    expect(finalPaymentGate({ stageIndex: 2, stageCount: 3, eventsBySnag: [open, waiting], now })).toMatchObject({ ok: false, open: 2 });
    expect(finalPaymentGate({ stageIndex: 1, stageCount: 3, eventsBySnag: [open], now })).toEqual({ ok: true });
    expect(finalPaymentGate({ stageIndex: 2, stageCount: 3, eventsBySnag: [closed], now })).toEqual({ ok: true });
    expect(finalPaymentGate({ stageIndex: 0, stageCount: 0, eventsBySnag: [open], now })).toEqual({ ok: true });
  });
});
