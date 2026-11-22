import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ledger, type LedgerRowInput } from '@/modules/project/payment-ledger';
import {
  CLEAR_PAYMENTS_FIRST,
  DEFAULT_COVERAGE_RULES,
  NOT_COVERED,
  bookingIsFree,
  checkRuleInput,
  checkStudioSlot,
  notCoveredReply,
  freeServiceUntil,
  SLOT_STARTS,
  checkServiceChargesInput,
  checkSlot,
  claimTitle,
  coverageRulesFrom,
  decideCoverage,
  parseReaderReply,
  paymentGate,
  readServiceCharges,
  readSlotVisits,
  readerPrompt,
  serviceSlotDays,
  serviceState,
  slotDayLabel,
  slotKey,
  warrantyOpen,
} from '@/modules/aftercare/rules';
import { linkCallbackValid, paidFromWebhook, readLinkCallback, webhookValid } from '@/modules/aftercare/razorpay-sign';

/**
 * After the handover (owner, 20 Nov 2026; docs/studio-os/AFTERCARE.md): the
 * payment gate before either option, warranty coverage decided from data,
 * and the paid service visit's slots and Razorpay signatures.
 */

const stages = [
  { label: 'Booking', pct: 10, amountPaise: 10_000_00 },
  { label: 'Handover', pct: 90, amountPaise: 90_000_00 },
];

const row = (id: string, stageIndex: number, amountPaise: number, extra: Partial<LedgerRowInput> = {}): LedgerRowInput => ({
  id,
  stageIndex,
  amountPaise,
  receivedOn: '2026-10-01',
  mode: 'UPI',
  receiptDocumentId: null,
  correctsId: null,
  recordedAt: `2026-10-01T10:00:0${id.length}Z`,
  customerConfirmedAt: '2026-10-02T10:00:00Z',
  disputedAt: null,
  backfilled: false,
  ...extra,
});

describe('payment gate', () => {
  it('clears a project paid to the rupee', () => {
    const g = paymentGate(ledger(stages, [], [row('a', 0, 10_000_00), row('bb', 1, 90_000_00)]));
    expect(g).toEqual({ cleared: true, pendingPaise: 0, message: null });
  });

  it('refuses with ₹1 pending, and says the amount', () => {
    const g = paymentGate(ledger(stages, [], [row('a', 0, 10_000_00), row('bb', 1, 90_000_00 - 100)]));
    expect(g.cleared).toBe(false);
    expect(g.pendingPaise).toBe(100);
    expect(g.message).toBe(`${CLEAR_PAYMENTS_FIRST} ₹1 is pending.`);
  });

  it('counts a decision that made the final stage dearer', () => {
    const g = paymentGate(ledger(stages, [{ deltaPaise: 5_000_00, stageIndex: null }], [row('a', 0, 10_000_00), row('bb', 1, 90_000_00)]));
    expect(g.cleared).toBe(false);
    expect(g.pendingPaise).toBe(5_000_00);
  });

  it('a payment the studio recorded counts, with no confirmation from the client (owner, 22 Nov 2026)', () => {
    const g = paymentGate(ledger(stages, [], [row('a', 0, 10_000_00), row('bb', 1, 90_000_00, { customerConfirmedAt: null })]));
    expect(g).toEqual({ cleared: true, pendingPaise: 0, message: null });
  });

  it('backfilled and before-joining rows count as paid', () => {
    const g = paymentGate(ledger(stages, [], [row('a', 0, 10_000_00, { backfilled: true, customerConfirmedAt: null }), row('bb', 1, 90_000_00, { backfilled: true, customerConfirmedAt: null })]));
    expect(g.cleared).toBe(true);
  });

  it('a disputed payment is owed again', () => {
    const g = paymentGate(ledger(stages, [], [row('a', 0, 10_000_00), row('bb', 1, 90_000_00, { disputedAt: '2026-10-03T00:00:00Z' })]));
    expect(g.pendingPaise).toBe(90_000_00);
  });

  it('no payment plan in the app is not cleared', () => {
    const g = paymentGate(null);
    expect(g.cleared).toBe(false);
    expect(g.pendingPaise).toBeNull();
    expect(g.message).toMatch(/^Please clear your payments first\./);
  });
});

describe('warranty coverage, as data', () => {
  const rules = coverageRulesFrom([]);

  it('falls back to the default list, generally only modular covered', () => {
    expect(rules.map((r) => r.key)).toEqual(DEFAULT_COVERAGE_RULES.map((r) => r.key));
    expect(rules.filter((r) => r.covered).every((r) => r.key.startsWith('MODULAR_'))).toBe(true);
    expect(rules.find((r) => r.key === 'PAINTING')!.covered).toBe(false);
    expect(rules.find((r) => r.key === 'ELECTRICAL')!.covered).toBe(false);
  });

  it('every not-covered area sends the client to a service category', () => {
    for (const r of rules.filter((x) => !x.covered)) expect(r.serviceCategory).not.toBeNull();
  });

  it('uses table rows when there are any, sorted, inactive ones left out', () => {
    const own = coverageRulesFrom([
      { key: 'B', label: 'Bee', examples: 'b', covered: false, serviceCategory: 'PAINTING', sortOrder: 2 },
      { key: 'A', label: 'Ay', examples: 'a', covered: true, serviceCategory: null, sortOrder: 1 },
      { key: 'C', label: 'Cee', examples: 'c', covered: true, serviceCategory: 'NOPE', sortOrder: 0, active: false },
    ]);
    expect(own.map((r) => r.key)).toEqual(['A', 'B']);
  });

  it('a changed row changes the answer, with no code change', () => {
    const painted = coverageRulesFrom(DEFAULT_COVERAGE_RULES.map((r) => (r.key === 'PAINTING' ? { ...r, covered: true } : r)));
    expect(decideCoverage(painted, 'PAINTING', { ok: false, why: 'not-configured' })!.covered).toBe(true);
  });

  it('the photo reader wins over the client pick: a paint crack filed as modular is not covered', () => {
    const d = decideCoverage(rules, 'MODULAR_CORE', { ok: true, key: 'PAINTING', summary: 'Crack in bedroom wall paint', reason: 'hairline crack in paint' })!;
    expect(d).toMatchObject({ covered: false, by: 'reader' });
    expect(d.rule.serviceCategory).toBe('PAINTING');
  });

  it('a light not working is not covered', () => {
    expect(decideCoverage(rules, 'MODULAR_CORE', { ok: true, key: 'ELECTRICAL', summary: 'LED profile off', reason: '' })!.covered).toBe(false);
  });

  it('a covered modular fault is covered', () => {
    expect(decideCoverage(rules, 'MODULAR_CORE', { ok: true, key: 'MODULAR_CORE', summary: 'Wardrobe panel delaminating', reason: '' })).toMatchObject({ covered: true, by: 'reader' });
  });

  it('with no reader answer, the client pick decides; an unknown pick decides nothing', () => {
    expect(decideCoverage(rules, 'MODULAR_CORE', { ok: false, why: 'reader-failed' })).toMatchObject({ covered: true, by: 'client' });
    expect(decideCoverage(rules, 'NOT_A_RULE', { ok: false, why: 'reader-failed' })).toBeNull();
  });

  it('the auto reply is the owner’s words', () => {
    expect(NOT_COVERED).toBe('This is not covered under your warranty. Please raise a service request.');
  });

  it('claims only during the warranty', () => {
    expect(warrantyOpen('WARRANTY').ok).toBe(true);
    expect(warrantyOpen('CLOSED')).toMatchObject({ ok: false, error: expect.stringMatching(/ended/) });
    expect(warrantyOpen('SNAGS')).toMatchObject({ ok: false, error: expect.stringMatching(/Snags/) });
  });

  it('the migration seeds exactly the default list', () => {
    const sql = readFileSync(join(__dirname, '..', 'prisma', 'migrations', '20261120120000_aftercare', 'migration.sql'), 'utf8');
    for (const r of DEFAULT_COVERAGE_RULES) {
      const line = sql.split('\n').find((l) => l.includes(`'wcr_default_${r.key.toLowerCase()}'`));
      expect(line, r.key).toBeDefined();
      expect(line).toContain(`'${r.label.replace(/'/g, "''")}'`);
      expect(line).toContain(`'${r.examples.replace(/'/g, "''")}'`);
      expect(line).toContain(`, ${r.covered}, `);
      expect(line).toContain(r.serviceCategory ? `'${r.serviceCategory}', ${r.sortOrder},` : `NULL, ${r.sortOrder},`);
      expect(line).toContain(r.clientNote ? `, '${r.clientNote.replace(/'/g, "''")}', true,` : ', NULL, true,');
    }
    expect(sql.match(/'wcr_default_/g)!.length).toBe(DEFAULT_COVERAGE_RULES.length);
  });
});

describe('the photo reader’s words', () => {
  const rules = coverageRulesFrom([]);

  it('the prompt lists every area as data', () => {
    const p = readerPrompt(rules, 'kitchen drawer will not close', 'MODULAR_HARDWARE');
    for (const r of rules) expect(p).toContain(`${r.key}: ${r.label}`);
    expect(p).toContain('The client picked: MODULAR_HARDWARE');
  });

  it('reads the JSON reply, even with words around it', () => {
    expect(parseReaderReply('Looking at it:\n{"area":"modular_hardware","summary":"Drawer channel stuck","reason":"channel bent"}', rules)).toEqual({
      ok: true,
      key: 'MODULAR_HARDWARE',
      summary: 'Drawer channel stuck',
      reason: 'channel bent',
    });
  });

  it('an unknown area or broken JSON is no answer', () => {
    expect(parseReaderReply('{"area":"ROOF"}', rules)).toEqual({ ok: false, why: 'unknown-area' });
    expect(parseReaderReply('no idea', rules)).toEqual({ ok: false, why: 'unreadable' });
    expect(parseReaderReply('{"area": }', rules)).toEqual({ ok: false, why: 'unreadable' });
  });

  it('titles the snag from the summary, else the client’s words', () => {
    expect(claimTitle({ ok: true, key: 'X', summary: 'Hinge broken', reason: '' }, 'the hinge on the wardrobe')).toBe('Hinge broken');
    expect(claimTitle({ ok: false, why: 'reader-failed' }, 'the hinge on the wardrobe')).toBe('the hinge on the wardrobe');
  });
});

describe('service visits', () => {
  it('reads charges, dropping anything malformed', () => {
    expect(readServiceCharges({ CARPENTRY: 50000, PAINTING: -1, ELECTRICAL: 1.5, ROOF: 100, WALLPAPER: '300' })).toEqual({ CARPENTRY: 50000 });
    expect(readServiceCharges(null)).toEqual({});
  });

  it('the owner types rupees; blank means not offered', () => {
    expect(checkServiceChargesInput({ CARPENTRY: '500', PAINTING: '₹1,200', ELECTRICAL: '', WALLPAPER: '0' })).toEqual({ ok: true, value: { CARPENTRY: 50000, PAINTING: 120000 } });
    expect(checkServiceChargesInput({ CARPENTRY: '5.5' }).ok).toBe(false);
    expect(checkServiceChargesInput({ CARPENTRY: '200000' }).ok).toBe(false);
  });

  it('visits per slot default to 2', () => {
    expect(readSlotVisits(undefined)).toBe(2);
    expect(readSlotVisits(0)).toBe(2);
    expect(readSlotVisits(3)).toBe(3);
  });

  it('the first bookable day is today + 5, every day of the week, four 2-hour slots', () => {
    const days = serviceSlotDays('2026-11-20', 2, new Map());
    expect(days[0]!.date).toBe('2026-11-25');
    expect(days).toHaveLength(7);
    expect(days.map((d) => d.date)).toContain('2026-11-29'); // a Sunday
    expect(days[0]!.slots.map((s) => s.start)).toEqual([...SLOT_STARTS]);
    expect(days[0]!.slots[0]!.label).toBe('10 am – 12 pm');
    expect(days[0]!.label).toBe('Wed 25 Nov');
  });

  it('a taken slot shows what is left', () => {
    const days = serviceSlotDays('2026-11-20', 2, new Map([[slotKey('2026-11-25', '12:00'), 2], [slotKey('2026-11-25', '14:00'), 1]]));
    expect(days[0]!.slots.map((s) => s.left)).toEqual([2, 0, 1, 2]);
  });

  it('refuses a slot before today + 5 or past the days shown', () => {
    expect(checkSlot('2026-11-24', '10:00', '2026-11-20')).toEqual({ ok: false, error: `The earliest visit is ${slotDayLabel('2026-11-25')}. Pick that day or later.` });
    expect(checkSlot('2026-11-25', '10:00', '2026-11-20')).toEqual({ ok: true, day: '2026-11-25', start: '10:00' });
    expect(checkSlot('2026-12-02', '10:00', '2026-11-20').ok).toBe(false);
    expect(checkSlot('2026-11-25', '09:00', '2026-11-20').ok).toBe(false);
  });

  it('an unpaid hold expires on its own; paid is booked', () => {
    const now = new Date('2026-11-20T10:00:00Z');
    expect(serviceState('HELD', new Date('2026-11-20T10:10:00Z'), now)).toBe('held');
    expect(serviceState('HELD', new Date('2026-11-20T09:59:00Z'), now)).toBe('expired');
    expect(serviceState('BOOKED', new Date('2026-11-20T09:00:00Z'), now)).toBe('booked');
  });
});

describe('the free month after the handover', () => {
  it('runs 30 days from the handover (agreement clause 5.1)', () => {
    expect(freeServiceUntil('2026-11-20')).toBe('2026-12-20');
    expect(freeServiceUntil('2026-01-31')).toBe('2026-03-02');
    expect(freeServiceUntil('2026-12-15')).toBe('2027-01-14');
    expect(freeServiceUntil(null)).toBeNull();
  });

  it('goes by the day the client books, not the visit day', () => {
    expect(bookingIsFree('2026-12-20', '2026-12-20')).toBe(true);
    expect(bookingIsFree('2026-12-21', '2026-12-20')).toBe(false);
    expect(bookingIsFree('2026-12-01', null)).toBe(false);
    // One free visit: once used, the next is charged.
    expect(bookingIsFree('2026-12-01', '2026-12-20', true)).toBe(false);
  });
});

describe('Hauspire agreement, clause 5', () => {
  const rules = coverageRulesFrom([]);
  const rule = (k: string) => rules.find((r) => r.key === k)!;

  it('covers manufacturing defects in modular woodwork only', () => {
    expect(rules.filter((r) => r.covered).map((r) => r.key)).toEqual(['MODULAR_CORE', 'MODULAR_FINISH']);
  });

  it('hardware is the manufacturer’s warranty, and says so', () => {
    expect(rule('MODULAR_HARDWARE').covered).toBe(false);
    expect(notCoveredReply(rule('MODULAR_HARDWARE'))).toBe(`${NOT_COVERED} Hinges, channels and other hardware carry their manufacturer's warranty; your studio helps you claim it on the visit.`);
  });

  it('excludes small adjustments, water, damp and pests, wear and misuse', () => {
    for (const k of ['MINOR_ADJUSTMENT', 'MOISTURE_PESTS', 'DAMAGE_FROM_USE']) expect(rule(k).covered).toBe(false);
  });

  it('a rule with no line of its own gets the owner’s sentence alone', () => {
    expect(notCoveredReply(rule('PAINTING'))).toBe(NOT_COVERED);
  });
});

describe('ops’ rule editor', () => {
  const ok = { key: 'mirror chips', label: 'Mirror edges', examples: 'chipped mirror edge, flaking silver', covered: 'false', serviceCategory: 'CARPENTRY', sortOrder: '155', clientNote: '' };

  it('reads a rule as typed', () => {
    expect(checkRuleInput(ok)).toEqual({
      ok: true,
      value: { key: 'MIRROR_CHIPS', label: 'Mirror edges', examples: 'chipped mirror edge, flaking silver', covered: false, serviceCategory: 'CARPENTRY', sortOrder: 155, clientNote: null, active: true },
    });
  });

  it('a covered rule sends nowhere and carries no extra line', () => {
    expect(checkRuleInput({ ...ok, covered: true, clientNote: 'x' })).toMatchObject({ ok: true, value: { covered: true, serviceCategory: null, clientNote: null } });
  });

  it('refuses a bad key, no examples, or not covered with nowhere to go', () => {
    expect(checkRuleInput({ ...ok, key: '9x' }).ok).toBe(false);
    expect(checkRuleInput({ ...ok, examples: 'x' }).ok).toBe(false);
    expect(checkRuleInput({ ...ok, serviceCategory: '' }).ok).toBe(false);
    expect(checkRuleInput({ ...ok, serviceCategory: 'ROOF' }).ok).toBe(false);
    expect(checkRuleInput({ ...ok, sortOrder: '-1' }).ok).toBe(false);
  });
});

describe('the studio moves a visit', () => {
  it('to any slot from tomorrow, up to 60 days', () => {
    expect(checkStudioSlot('2026-11-21', '16:00', '2026-11-20')).toEqual({ ok: true, day: '2026-11-21', start: '16:00' });
    expect(checkStudioSlot('2026-11-20', '16:00', '2026-11-20').ok).toBe(false);
    expect(checkStudioSlot('2027-01-20', '16:00', '2026-11-20').ok).toBe(false);
    expect(checkStudioSlot('2026-11-21', '18:00', '2026-11-20').ok).toBe(false);
  });

  it('a done visit reads as done', () => {
    expect(serviceState('DONE', new Date(0), new Date())).toBe('done');
  });
});

describe('Razorpay signatures', () => {
  const secret = 'test_secret';

  it('accepts the redirect only with the right signature', () => {
    const sig = createHmac('sha256', secret).update('plink_1|sr_1|paid|pay_1').digest('hex');
    const q = new URLSearchParams({
      razorpay_payment_id: 'pay_1',
      razorpay_payment_link_id: 'plink_1',
      razorpay_payment_link_reference_id: 'sr_1',
      razorpay_payment_link_status: 'paid',
      razorpay_signature: sig,
    });
    const cb = readLinkCallback(q)!;
    expect(linkCallbackValid(cb, secret)).toBe(true);
    expect(linkCallbackValid({ ...cb, status: 'paid ' }, secret)).toBe(false);
    expect(linkCallbackValid({ ...cb, paymentId: 'pay_2' }, secret)).toBe(false);
    expect(linkCallbackValid(cb, '')).toBe(false);
    expect(readLinkCallback(new URLSearchParams({ razorpay_payment_id: 'x' }))).toBeNull();
  });

  it('accepts the webhook only with the right signature, and reads payment_link.paid', () => {
    const body = JSON.stringify({ event: 'payment_link.paid', payload: { payment_link: { entity: { id: 'plink_1' } }, payment: { entity: { id: 'pay_1', amount: 50000 } } } });
    const sig = createHmac('sha256', 'wh').update(body).digest('hex');
    expect(webhookValid(body, sig, 'wh')).toBe(true);
    expect(webhookValid(`${body} `, sig, 'wh')).toBe(false);
    expect(webhookValid(body, null, 'wh')).toBe(false);
    expect(paidFromWebhook(JSON.parse(body))).toEqual({ linkId: 'plink_1', paymentId: 'pay_1', amountPaise: 50000 });
    expect(paidFromWebhook({ event: 'payment.failed' })).toBeNull();
  });
});
