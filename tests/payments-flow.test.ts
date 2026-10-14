import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BACKFILL_RECORDER,
  canRecord,
  isBackfilled,
  ledger,
  mirrorPaidOn,
  parseRupees,
  type LedgerRowInput,
  type LedgerStageInput,
} from '@/modules/project/payment-ledger';
import { makeDb, type FakeDb } from './phase5-fake-db';

/**
 * Payments (studio workspace Phase 5): paid and balance are always the sums
 * of the payment rows; overpaying a stage is refused with the difference
 * said; the customer confirms or says "I didn't pay this"; rows backfilled
 * from the old paidPhases marks count as paid. Then the flow itself, against
 * an in-memory stand-in for the database (tests/phase5-fake-db.ts).
 */

const STAGES: LedgerStageInput[] = [
  { label: 'Booking', pct: 40, amountPaise: 4_00_000_00 },
  { label: 'Carpentry', pct: 40, amountPaise: 4_00_000_00 },
  { label: 'Handover', pct: 20, amountPaise: 2_00_000_00 },
];

let n = 0;
const row = (over: Partial<LedgerRowInput>): LedgerRowInput => ({
  id: `r${++n}`,
  stageIndex: 0,
  amountPaise: 1_00_000_00,
  receivedOn: '2026-10-01',
  mode: 'UPI',
  receiptDocumentId: null,
  correctsId: null,
  recordedAt: `2026-10-01T10:00:${String(n).padStart(2, '0')}.000Z`,
  customerConfirmedAt: null,
  disputedAt: null,
  backfilled: false,
  ...over,
});

const confirmed = (over: Partial<LedgerRowInput>) => row({ customerConfirmedAt: '2026-10-02T00:00:00.000Z', ...over });

describe('the ledger: paid and balance are the rows', () => {
  it('counts only confirmed (and backfilled) rows as paid; waiting money is held, not paid', () => {
    const rows = [confirmed({ amountPaise: 4_00_000_00 }), row({ stageIndex: 1, amountPaise: 1_50_000_00 }), row({ stageIndex: 1, amountPaise: 50_000_00, backfilled: true })];
    const l = ledger(STAGES, [], rows);
    expect(l.paidPaise).toBe(4_00_000_00 + 50_000_00);
    expect(l.waitingPaise).toBe(1_50_000_00);
    expect(l.balancePaise).toBe(l.totalPaise - l.paidPaise);
    expect(l.stages.map((s) => s.state)).toEqual(['paid', 'part', 'later']);
    expect(l.stages[1]).toMatchObject({ paidPaise: 50_000_00, waitingPaise: 1_50_000_00, openPaise: 2_00_000_00 });
  });

  it('always equals the sum of the counted rows, whatever the mix', () => {
    const rows: LedgerRowInput[] = [];
    for (let i = 0; i < 40; i++) {
      const kind = i % 5;
      rows.push(
        row({
          stageIndex: i % 3,
          amountPaise: 1000 + i * 137,
          customerConfirmedAt: kind === 0 || kind === 3 ? '2026-10-02T00:00:00.000Z' : null,
          disputedAt: kind === 1 ? '2026-10-02T00:00:00.000Z' : null,
          backfilled: kind === 2,
        }),
      );
    }
    const l = ledger(STAGES, [{ deltaPaise: 14_000_00, stageIndex: 2 }], rows);
    const counted = l.rows.filter((r) => r.status === 'confirmed' || r.status === 'earlier').reduce((s, r) => s + r.amountPaise, 0);
    expect(l.paidPaise).toBe(counted);
    expect(l.stages.reduce((s, x) => s + x.paidPaise, 0)).toBe(counted);
    expect(l.balancePaise).toBe(10_00_000_00 + 14_000_00 - counted);
  });

  it('puts decision changes on the final stage, and the total moves by exactly that', () => {
    const l = ledger(STAGES, [{ deltaPaise: 14_000_00, stageIndex: null }, { deltaPaise: -2_500_00, stageIndex: 2 }], []);
    expect(l.stages[2]).toMatchObject({ signedPaise: 2_00_000_00, changesPaise: 11_500_00, amountPaise: 2_11_500_00 });
    expect(l.totalPaise).toBe(10_11_500_00);
    expect(l.changesPaise).toBe(11_500_00);
  });

  it('a disputed row is neither paid nor held: the stage is owed again', () => {
    const l = ledger(STAGES, [], [row({ amountPaise: 4_00_000_00, disputedAt: '2026-10-03T00:00:00.000Z' })]);
    expect(l.paidPaise).toBe(0);
    expect(l.waitingPaise).toBe(0);
    expect(l.stages[0]).toMatchObject({ state: 'due', openPaise: 4_00_000_00 });
    expect(l.rows[0]!.status).toBe('disputed');
  });

  it('a correction replaces the row it corrects; a correction to zero is "recorded by mistake"', () => {
    const first = confirmed({ amountPaise: 4_00_000_00 });
    const fix = row({ amountPaise: 3_00_000_00, correctsId: first.id });
    let l = ledger(STAGES, [], [first, fix]);
    expect(l.rows.find((r) => r.id === first.id)!.status).toBe('replaced');
    expect(l.paidPaise).toBe(0);
    expect(l.waitingPaise).toBe(3_00_000_00);
    const undo = row({ amountPaise: 0, correctsId: fix.id });
    l = ledger(STAGES, [], [first, fix, undo]);
    expect(l.paidPaise + l.waitingPaise).toBe(0);
  });

  it('backfilled rows are known by recorder or id, count as paid and still ask the customer', () => {
    expect(isBackfilled({ id: 'hpp_abc' })).toBe(true);
    expect(isBackfilled({ id: 'x', recordedById: BACKFILL_RECORDER })).toBe(true);
    expect(isBackfilled({ id: 'x', recordedById: 'u-acc' })).toBe(false);
    const l = ledger(STAGES, [], [row({ id: 'hpp_1', amountPaise: 4_00_000_00, mode: null, backfilled: true })]);
    expect(l.rows[0]).toMatchObject({ status: 'earlier', counts: true });
    expect(l.stages[0]!.state).toBe('paid');
  });
});

describe('overpayment is refused with the difference said', () => {
  const l = ledger(STAGES, [], [confirmed({ amountPaise: 3_00_000_00 }), row({ stageIndex: 1, amountPaise: 4_00_000_00 })]);

  it('allows up to what is open on the stage', () => {
    expect(canRecord(l, 0, 1_00_000_00)).toEqual({ ok: true });
    expect(canRecord(l, 0, 50_000_00)).toEqual({ ok: true });
  });

  it('refuses more, saying by how much and what is open', () => {
    const r = canRecord(l, 0, 1_25_000_00);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toBe('That is ₹25,000 more than the ₹1,00,000 still due on Booking. Record the extra against the next stage.');
  });

  it('refuses a stage already recorded in full, naming the money waiting for the customer', () => {
    const r = canRecord(l, 1, 1_000_00);
    expect(!r.ok && r.error).toMatch(/already recorded in full; ₹4,00,000 is waiting for the customer to confirm/);
  });

  it('refuses nothing, and a stage that is not there', () => {
    expect(canRecord(l, 0, 0).ok).toBe(false);
    expect(canRecord(l, 9, 100).ok).toBe(false);
  });
});

describe('the old paidPhases marks follow the rows', () => {
  it('sets paidOn when a stage is covered and clears it when it no longer is, keeping due dates and reminders', () => {
    const covered = ledger(STAGES, [], [row({ amountPaise: 4_00_000_00, receivedOn: '2026-10-05' })]);
    const marks = mirrorPaidOn([{ index: 0, dueOn: '2026-10-04', remindedAt: '2026-10-02T04:00:00Z' }, { index: 2, dueOn: '2026-12-01' }], covered);
    expect(marks).toEqual([
      { index: 0, dueOn: '2026-10-04', remindedAt: '2026-10-02T04:00:00Z', paidOn: '2026-10-05' },
      { index: 2, dueOn: '2026-12-01', paidOn: null },
    ]);
    const disputed = ledger(STAGES, [], [row({ amountPaise: 4_00_000_00, disputedAt: '2026-10-06T00:00:00Z' })]);
    expect(mirrorPaidOn(marks, disputed)[0]).toMatchObject({ index: 0, dueOn: '2026-10-04', paidOn: null });
  });
});

describe('rupees as typed', () => {
  it('reads Indian grouping, a ₹ sign, paise; refuses junk; negative only when asked', () => {
    expect(parseRupees('7,36,000')).toBe(7_36_000_00);
    expect(parseRupees('₹ 12,500.50')).toBe(12_500_50);
    expect(parseRupees('abc')).toBeNull();
    expect(parseRupees('-2,500')).toBeNull();
    expect(parseRupees('-2,500', { negative: true })).toBe(-2_500_00);
  });
});

// ── The flow, end to end against the stand-in ──────────────────

const current = vi.hoisted(() => ({ db: null as unknown as { client: Record<string, unknown> }, user: null as null | { id: string; role: string } }));
vi.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get: (_t, k) => current.db.client[k as string] }) }));
vi.mock('@/modules/auth/session', () => {
  const RANK = { CUSTOMER: 0, STUDIO: 1, OPS: 2, ADMIN: 3 } as const;
  return {
    getCurrentUser: vi.fn(async () => current.user),
    hasRole: (u: { role: keyof typeof RANK } | null, role: keyof typeof RANK) => !!u && RANK[u.role] >= RANK[role],
  };
});
const sent = vi.hoisted(() => ({ customer: [] as unknown[], ops: [] as unknown[], studio: [] as unknown[] }));
vi.mock('@/modules/notify/service', () => ({
  notify: vi.fn(async (_u: string, e: unknown) => void sent.customer.push(e)),
  notifyStudio: vi.fn(async (_s: string, e: unknown) => void sent.studio.push(e)),
  notifyOps: vi.fn(async (e: unknown) => void sent.ops.push(e)),
}));
vi.mock('@/modules/storage/project-docs', () => ({
  signedDocUrls: vi.fn(async (keys: string[]) => keys.map((k) => `https://signed/${k}`)),
  storeProjectDoc: vi.fn(async () => ({ ok: true, path: 'project_p1/receipt.pdf' })),
}));
vi.mock('@/modules/storage/site-photos', () => ({ signedSitePhotoUrls: vi.fn(async () => []), storeSitePhoto: vi.fn(async () => ({ ok: true, path: 'photo.jpg' })) }));

import { confirmPayment, correctPayment, disputePayment, ledgerOf, recordPayment, studioPayments } from '@/modules/project/payments-flow';

let db: FakeDb;
const as = (id: string, role = 'STUDIO') => {
  current.user = { id, role };
};
const NOW = new Date('2026-10-11T08:00:00Z');
/** The ledger as the server computes it, from the rows the stand-in holds now. */
const money = () => ledgerOf({ ...db.s.project, payments: db.s.payments, quoteChanges: db.s.quoteChanges } as never)!;

beforeEach(() => {
  vi.stubEnv('DATABASE_URL', 'postgres://test');
  vi.stubEnv('SAMPLE_DATA_ONLY', '');
  db = makeDb();
  current.db = db;
  sent.customer.length = sent.ops.length = sent.studio.length = 0;
});

describe('recording, confirming and disputing a payment', () => {
  it('accounts records money with a receipt: one row, the receipt filed in the locker, the customer asked to confirm', async () => {
    as('u-acc');
    const receipt = new File(['%PDF'], 'receipt.pdf', { type: 'application/pdf' });
    const r = await recordPayment('p1', { stageIndex: 0, amount: '4,00,000', receivedOn: '2026-10-10', mode: 'UPI', note: 'UTR 1234' }, receipt, NOW);
    expect(r.ok).toBe(true);
    expect(db.s.payments).toHaveLength(1);
    expect(db.s.payments[0]).toMatchObject({ stageIndex: 0, amountPaise: BigInt(4_00_000_00), mode: 'UPI', note: 'UTR 1234', recordedById: 'u-acc' });
    const doc = db.s.documents.find((d) => d.id === db.s.payments[0]!.receiptDocumentId)!;
    expect(doc).toMatchObject({ kind: 'RECEIPT', storageKey: 'project_p1/receipt.pdf' });
    expect(doc.sharedAt).not.toBeNull();
    expect(db.s.events.map((e) => e.type)).toEqual(['document.filed', 'payment.recorded']);
    expect(sent.customer).toEqual([{ kind: 'payment-to-confirm', stage: 'Booking', amountPaise: 4_00_000_00, studio: 'Teakline Studio' }]);
    // Not paid until the customer says so; the old marks already stop reminding.
    expect(money().paidPaise).toBe(0);
    expect(money().waitingPaise).toBe(4_00_000_00);
    expect(db.s.project.paidPhases).toEqual([{ index: 0, paidOn: '2026-10-10' }]);
  });

  it('refuses an overpayment with the difference, and writes nothing', async () => {
    as('u-acc');
    await recordPayment('p1', { stageIndex: 0, amount: '3,00,000', receivedOn: '2026-10-10', mode: 'BANK' }, null, NOW);
    const r = await recordPayment('p1', { stageIndex: 0, amount: '1,50,000', receivedOn: '2026-10-10', mode: 'BANK' }, null, NOW);
    expect(r).toEqual({ ok: false, error: 'That is ₹50,000 more than the ₹1,00,000 still due on Booking. Record the extra against the next stage.' });
    expect(db.s.payments).toHaveLength(1);
  });

  it('asks how it was paid, and refuses a day in the future', async () => {
    as('u-owner');
    expect((await recordPayment('p1', { stageIndex: 0, amount: '100', receivedOn: '2026-10-10', mode: '' }, null, NOW)).ok).toBe(false);
    expect((await recordPayment('p1', { stageIndex: 0, amount: '100', receivedOn: '2026-10-12', mode: 'CASH' }, null, NOW)).ok).toBe(false);
    expect(db.s.payments).toHaveLength(0);
  });

  it('the customer confirms with one tap, once; then it counts as paid', async () => {
    as('u-acc');
    await recordPayment('p1', { stageIndex: 0, amount: '4,00,000', receivedOn: '2026-10-10', mode: 'UPI' }, null, NOW);
    const id = db.s.payments[0]!.id as string;
    as('u-cust', 'CUSTOMER');
    expect(await confirmPayment('u-cust', id, NOW)).toEqual({ ok: true, id });
    expect(await confirmPayment('u-cust', id, NOW)).toEqual({ ok: true, id });
    expect(db.s.events.filter((e) => e.type === 'payment.confirmed')).toHaveLength(1);
    expect(money().paidPaise).toBe(4_00_000_00);
    expect(money().balancePaise).toBe(6_00_000_00);
    expect(await disputePayment('u-cust', id, 'oops', NOW)).toMatchObject({ ok: false });
  });

  it('family and strangers cannot answer for the money', async () => {
    as('u-acc');
    await recordPayment('p1', { stageIndex: 0, amount: '1,000', receivedOn: '2026-10-10', mode: 'CASH' }, null, NOW);
    const id = db.s.payments[0]!.id as string;
    expect(await confirmPayment('u-fam', id, NOW)).toEqual({ ok: false, error: 'That payment is not on your project.' });
    expect(await disputePayment('u-other', id, null, NOW)).toEqual({ ok: false, error: 'That payment is not on your project.' });
    expect(db.s.payments[0]!.customerConfirmedAt).toBeNull();
  });

  it('"I didn\'t pay this" goes to our team with the words; the stage is owed again; the words never reach the event log', async () => {
    as('u-acc');
    await recordPayment('p1', { stageIndex: 0, amount: '4,00,000', receivedOn: '2026-10-10', mode: 'CASH' }, null, NOW);
    const id = db.s.payments[0]!.id as string;
    expect(await disputePayment('u-cust', id, 'I paid only half, by cheque', NOW)).toEqual({ ok: true, id });
    expect(db.s.payments[0]).toMatchObject({ disputedById: 'u-cust', disputeNote: 'I paid only half, by cheque' });
    expect(sent.ops).toEqual([
      { kind: 'payment-disputed', customer: 'Priya Shah', studio: 'Teakline Studio', stage: 'Booking', amountPaise: 4_00_000_00, note: 'I paid only half, by cheque' },
    ]);
    expect(sent.studio).toEqual([]);
    expect(JSON.stringify(db.s.events)).not.toContain('half');
    expect(money().paidPaise + money().waitingPaise).toBe(0);
    expect(db.s.project.paidPhases).toEqual([{ index: 0, paidOn: null }]);
    expect(await confirmPayment('u-cust', id, NOW)).toMatchObject({ ok: false });
  });

  it('a correction is a new row; the original stays, marked replaced, and cannot be corrected twice', async () => {
    as('u-acc');
    await recordPayment('p1', { stageIndex: 0, amount: '4,00,000', receivedOn: '2026-10-10', mode: 'UPI' }, null, NOW);
    const first = db.s.payments[0]!.id as string;
    expect((await correctPayment(first, { amount: '3,50,000' })).ok).toBe(true);
    expect(db.s.payments).toHaveLength(2);
    expect(db.s.payments[0]!.amountPaise).toBe(BigInt(4_00_000_00));
    expect(db.s.payments[1]).toMatchObject({ correctsId: first, amountPaise: BigInt(3_50_000_00) });
    expect(money().waitingPaise).toBe(3_50_000_00);
    expect(await correctPayment(first, { amount: '1' })).toEqual({ ok: false, error: 'This entry was already corrected. Correct the newer one.' });
    expect(await confirmPayment('u-cust', first, NOW)).toMatchObject({ ok: false });
  });

  it('backfilled rows count as paid, show as recorded before confirmations started, and can still be confirmed', async () => {
    db.s.payments.push({
      id: 'hpp_abc',
      projectId: 'p1',
      stageIndex: 0,
      amountPaise: BigInt(4_00_000_00),
      receivedOn: new Date('2026-08-03T00:00:00Z'),
      mode: null,
      receiptDocumentId: null,
      correctsId: null,
      note: null,
      recordedById: BACKFILL_RECORDER,
      recordedAt: new Date('2026-10-11T00:00:00Z'),
      customerConfirmedAt: null,
      disputedAt: null,
    });
    as('u-owner');
    const view = await studioPayments('p1');
    expect(view!.rows[0]).toMatchObject({ status: 'earlier', mode: null });
    expect(view!.ledger.paidPaise).toBe(4_00_000_00);
    expect(view!.suggested).toEqual({ index: 1, openPaise: 4_00_000_00 });
    expect(await confirmPayment('u-cust', 'hpp_abc', NOW)).toEqual({ ok: true, id: 'hpp_abc' });
    expect(money().paidPaise).toBe(4_00_000_00);
  });
});
