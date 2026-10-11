import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeDb, type FakeDb } from './phase5-fake-db';

/**
 * Phase 5 against the permission table (studio/roles.ts), checked in the
 * module layer, not the screen: accounts and the owner record payments, a
 * PM cannot (but reads them and sets due dates on their project); a
 * supervisor cannot create decisions or read the money; the customer's
 * answers are the customer's alone.
 */

const current = vi.hoisted(() => ({ db: null as unknown as { client: Record<string, unknown> }, user: null as null | { id: string; role: string } }));
vi.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get: (_t, k) => current.db.client[k as string] }) }));
vi.mock('@/modules/auth/session', () => {
  const RANK = { CUSTOMER: 0, STUDIO: 1, OPS: 2, ADMIN: 3 } as const;
  return {
    getCurrentUser: vi.fn(async () => current.user),
    hasRole: (u: { role: keyof typeof RANK } | null, role: keyof typeof RANK) => !!u && RANK[u.role] >= RANK[role],
  };
});
vi.mock('@/modules/notify/service', () => ({ notify: vi.fn(), notifyStudio: vi.fn(), notifyOps: vi.fn() }));
vi.mock('@/modules/storage/project-docs', () => ({ signedDocUrls: vi.fn(async (k: string[]) => k.map(() => '')), storeProjectDoc: vi.fn(async () => ({ ok: true, path: 'r.pdf' })) }));
vi.mock('@/modules/storage/site-photos', () => ({ signedSitePhotoUrls: vi.fn(async () => []), storeSitePhoto: vi.fn(async () => ({ ok: true, path: 'p.jpg' })) }));

import { recordPayment, studioPayments, paymentsDesk } from '@/modules/project/payments-flow';
import { createDecision, newDecisionContext, studioDecisions } from '@/modules/project/decision-flow';

let db: FakeDb;
const as = (id: string, role = 'STUDIO') => {
  current.user = { id, role };
};
const NOW = new Date('2026-10-11T08:00:00Z');
const PAY = { stageIndex: 0, amount: '1,000', receivedOn: '2026-10-10', mode: 'UPI' };
const DECISION = { title: 'Kitchen shutter finish', why: 'Shutters are cut next week.', dueOn: '2026-10-16', options: [{ label: 'Matte' }, { label: 'Gloss', delta: '5,000' }] };
const NOT_YOUR_ROLE = { ok: false, error: 'Your role in the studio does not include that. Ask your studio owner.' };

beforeEach(() => {
  vi.stubEnv('DATABASE_URL', 'postgres://test');
  vi.stubEnv('SAMPLE_DATA_ONLY', '');
  db = makeDb();
  current.db = db;
});

describe('payments', () => {
  it('accounts records a payment on any project of the studio', async () => {
    as('u-acc');
    expect((await recordPayment('p1', PAY, null, NOW)).ok).toBe(true);
    expect(db.s.payments).toHaveLength(1);
  });

  it('the owner records too; ops as well', async () => {
    as('u-owner');
    expect((await recordPayment('p1', PAY, null, NOW)).ok).toBe(true);
    as('u-ops', 'OPS');
    expect((await recordPayment('p1', PAY, null, NOW)).ok).toBe(true);
  });

  it('a PM on the project cannot record, but reads the money and may set due dates', async () => {
    as('u-pm');
    expect(await recordPayment('p1', PAY, null, NOW)).toEqual(NOT_YOUR_ROLE);
    const view = await studioPayments('p1');
    expect(view).toMatchObject({ canRecord: false, canSetDue: true });
    expect(db.s.payments).toHaveLength(0);
  });

  it('a supervisor neither records nor reads the money', async () => {
    as('u-sup');
    expect(await recordPayment('p1', PAY, null, NOW)).toEqual(NOT_YOUR_ROLE);
    expect(await studioPayments('p1')).toBeNull();
    expect(await paymentsDesk()).toEqual([]);
  });

  it('a customer cannot record a payment', async () => {
    as('u-cust', 'CUSTOMER');
    expect((await recordPayment('p1', PAY, null, NOW)).ok).toBe(false);
    expect(db.s.payments).toHaveLength(0);
  });

  it('the accounts desk lists the money with the right to record, and no way into the project', async () => {
    as('u-acc');
    const desk = await paymentsDesk();
    expect(desk).toHaveLength(1);
    expect(desk[0]).toMatchObject({ id: 'p1', canOpen: false, payments: { canRecord: true, canSetDue: true } });
  });
});

describe('decisions', () => {
  it('a supervisor cannot create a decision, or open the form', async () => {
    as('u-sup');
    expect(await createDecision('p1', DECISION, [], NOW)).toEqual(NOT_YOUR_ROLE);
    expect(await newDecisionContext('p1', NOW)).toEqual(NOT_YOUR_ROLE);
    expect(db.s.decisions).toHaveLength(0);
  });

  it('accounts cannot create one either', async () => {
    as('u-acc');
    expect(await createDecision('p1', DECISION, [], NOW)).toEqual(NOT_YOUR_ROLE);
  });

  it('the PM on the project and the owner can; the form is filled from the signed quote', async () => {
    as('u-pm');
    expect((await createDecision('p1', DECISION, [], NOW)).ok).toBe(true);
    const ctx = await newDecisionContext('p1', NOW);
    expect(ctx).toMatchObject({ ok: true, customerFirst: 'Priya', family: ['Rahul'], suggestedDue: '2026-10-18' });
    expect(ctx.ok && ctx.lines.map((l) => l.quoteLineId)).toEqual(['ql-shutters', 'ql-hinges']);
    as('u-owner');
    expect((await createDecision('p1', DECISION, [], NOW)).ok).toBe(true);
    expect(db.s.decisions).toHaveLength(2);
    expect((await studioDecisions('p1', NOW))!.canCreate).toBe(true);
  });

  it('a decision on a quote line that is not on the project is refused', async () => {
    as('u-owner');
    expect(await createDecision('p1', { ...DECISION, quoteLineId: 'ql-nope' }, [], NOW)).toEqual({ ok: false, error: 'That quote line is not on this project.' });
  });
});
