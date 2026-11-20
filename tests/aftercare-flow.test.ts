import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The aftercare flows against a stand-in database (store.ts): the payment
 * gate runs before anything is read, stored or held; a covered claim opens a
 * warranty snag and tells the design head; a not-covered one raises nothing;
 * a visit is held, then booked once, when paid.
 */

const db = vi.hoisted(() => ({
  project: null as Record<string, unknown> | null,
  claims: [] as Record<string, unknown>[],
  requests: [] as Record<string, unknown>[],
  takenCount: 0,
}));

const fx = vi.hoisted(() => ({
  readClaim: vi.fn(),
  storeSitePhoto: vi.fn(),
  notify: vi.fn(),
  notifyStudio: vi.fn(),
  createPaymentLink: vi.fn(),
  razorpayReady: vi.fn(() => true),
  createWarrantyClaimSnag: vi.fn(async () => 'snag_1'),
}));

vi.mock('@/lib/prisma', () => {
  const prisma = {
    homeProject: { findUnique: vi.fn(async () => db.project) },
    warrantyCoverageRule: { findMany: vi.fn(async () => []) },
    warrantyClaim: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        db.claims.push(data);
        return { id: `wc_${db.claims.length}` };
      }),
      findMany: vi.fn(async () => []),
    },
    serviceRequest: {
      count: vi.fn(async () => db.takenCount),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        db.requests.push({ id: `sr_${db.requests.length + 1}`, status: 'HELD', ...data });
        return { id: `sr_${db.requests.length}` };
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        Object.assign(db.requests.find((r) => r.id === where.id)!, data);
        return { id: where.id };
      }),
      updateMany: vi.fn(async ({ where, data }: { where: { id?: string; status?: unknown }; data: Record<string, unknown> }) => {
        if (!where.id) return { count: 0 };
        const r = db.requests.find((x) => x.id === where.id && x.status !== 'BOOKED');
        if (!r) return { count: 0 };
        Object.assign(r, data);
        return { count: 1 };
      }),
      findUnique: vi.fn(async ({ where }: { where: { payLinkId?: string; id?: string } }) => {
        const r = db.requests.find((x) => (where.id ? x.id === where.id : x.payLinkId === where.payLinkId));
        return r
          ? {
              ...r,
              slotDay: new Date(`${String(r.slotDay instanceof Date ? r.slotDay.toISOString().slice(0, 10) : '2026-11-25')}T00:00:00Z`),
              studio: { tradeName: 'Akara' },
              project: { introduction: { brief: { user: { name: 'Ankita' } } } },
            }
          : null;
      }),
      findMany: vi.fn(async () => []),
    },
    studioMember: { findMany: vi.fn(async () => [{ userId: 'u_head' }]) },
    $queryRaw: vi.fn(async () => []),
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
  };
  return { prisma };
});
vi.mock('@/modules/aftercare/reader', () => ({ READER_MODEL: 'claude-sonnet-5-5', readClaim: fx.readClaim }));
vi.mock('@/modules/storage/site-photos', () => ({ storeSitePhoto: fx.storeSitePhoto }));
vi.mock('@/modules/notify/service', () => ({ notify: fx.notify, notifyStudio: fx.notifyStudio }));
vi.mock('@/modules/aftercare/razorpay', () => ({ createPaymentLink: fx.createPaymentLink, razorpayReady: fx.razorpayReady }));
vi.mock('@/modules/project/snag-flow', () => ({ createWarrantyClaimSnag: fx.createWarrantyClaimSnag }));
vi.mock('@/modules/studio/access', () => ({ currentMember: vi.fn(async () => null), can: vi.fn(() => false) }));

const { bookServiceVisit, markServicePaid, raiseWarrantyClaim } = await import('@/modules/aftercare/store');

const payment = (id: string, stageIndex: number, rupees: number, confirmed = true) => ({
  id,
  stageIndex,
  amountPaise: BigInt(rupees * 100),
  receivedOn: new Date('2026-10-01T00:00:00Z'),
  mode: 'UPI',
  receiptDocumentId: null,
  correctsId: null,
  recordedAt: new Date(`2026-10-01T10:00:0${stageIndex}Z`),
  customerConfirmedAt: confirmed ? new Date('2026-10-02T00:00:00Z') : null,
  disputedAt: null,
  beforeJoining: false,
});

function project(over: { paidRupees?: number; phase?: string; plan?: string; owner?: string; handover?: string } = {}) {
  const paid = over.paidRupees ?? 100_000;
  return {
    id: 'hp_1',
    phase: over.phase ?? 'WARRANTY',
    warrantyEndsOn: new Date('2027-10-01T00:00:00Z'),
    handoverSignedAt: over.handover ? new Date(`${over.handover}T06:00:00Z`) : null,
    cancelledAt: null,
    paymentPhases: [
      { label: 'Booking', pct: 10, amountPaise: 10_000_00 },
      { label: 'Handover', pct: 90, amountPaise: 90_000_00 },
    ],
    payments: [payment('p1', 0, Math.min(paid, 10_000)), ...(paid > 10_000 ? [payment('p2', 1, paid - 10_000)] : [])],
    quoteChanges: [],
    family: [{ userId: 'u_family', joinedAt: new Date(), removedAt: null }],
    introduction: {
      studioId: 'st_1',
      studio: { tradeName: 'Akara', softwarePlan: over.plan ?? 'MAX', fullSoftware: false, serviceCharges: { CARPENTRY: 50000 }, serviceSlotVisits: 2 },
      brief: { userId: over.owner ?? 'u_owner', user: { name: 'Ankita', phone: '+919800000000', email: null } },
    },
  };
}

const photo = () => new File([new Uint8Array([1, 2, 3])], 'p.jpg', { type: 'image/jpeg' });

beforeEach(() => {
  db.claims = [];
  db.requests = [];
  db.takenCount = 0;
  for (const f of Object.values(fx)) f.mockClear();
  fx.storeSitePhoto.mockResolvedValue({ ok: true, path: 'project_hp_1/x.jpg' });
  fx.createPaymentLink.mockResolvedValue({ ok: true, id: 'plink_1', url: 'https://rzp.io/i/x' });
});

describe('warranty claim', () => {
  it('₹1 pending: "Please clear your payments first", and nothing is read, stored or raised', async () => {
    db.project = project({ paidRupees: 99_999 });
    const r = await raiseWarrantyClaim('u_owner', 'hp_1', { description: 'Drawer channel stuck', area: 'MODULAR_HARDWARE' }, [photo()]);
    expect(r).toMatchObject({ ok: false, pendingPaise: 100, error: 'Please clear your payments first. ₹1 is pending.' });
    expect(fx.readClaim).not.toHaveBeenCalled();
    expect(fx.storeSitePhoto).not.toHaveBeenCalled();
    expect(db.claims).toHaveLength(0);
  });

  it('the gate comes before anything else, even a missing photo', async () => {
    db.project = project({ paidRupees: 50_000 });
    const r = await raiseWarrantyClaim('u_owner', 'hp_1', { description: '', area: '' }, []);
    expect(r).toMatchObject({ ok: false, pendingPaise: 50_000_00 });
  });

  it('covered: a warranty snag is raised and the design head is told', async () => {
    db.project = project();
    fx.readClaim.mockResolvedValue({ ok: true, key: 'MODULAR_HARDWARE', summary: 'Kitchen drawer channel stuck', reason: 'channel bent' });
    const r = await raiseWarrantyClaim('u_owner', 'hp_1', { description: 'the kitchen drawer will not close', area: 'MODULAR_HARDWARE' }, [photo()]);
    expect(r).toMatchObject({ ok: true, covered: true, snagId: 'snag_1' });
    expect(fx.createWarrantyClaimSnag).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ title: 'Kitchen drawer channel stuck', projectId: 'hp_1', userId: 'u_owner' }));
    expect(db.claims[0]).toMatchObject({ covered: true, ruleKey: 'MODULAR_HARDWARE', decidedBy: 'reader', snagId: 'snag_1' });
    await vi.waitFor(() => expect(fx.notify).toHaveBeenCalledWith('u_head', expect.objectContaining({ kind: 'warranty-claim', projectId: 'hp_1' })));
  });

  it('not covered (a paint crack): the automatic reply, no snag, nobody told', async () => {
    db.project = project();
    fx.readClaim.mockResolvedValue({ ok: true, key: 'PAINTING', summary: 'Crack in wall paint', reason: 'hairline crack' });
    const r = await raiseWarrantyClaim('u_owner', 'hp_1', { description: 'crack near the wardrobe', area: 'MODULAR_STRUCTURE' }, [photo()]);
    expect(r).toEqual({ ok: true, covered: false, claimId: 'wc_1', message: 'This is not covered under your warranty. Please raise a service request.', serviceCategory: 'PAINTING' });
    expect(fx.createWarrantyClaimSnag).not.toHaveBeenCalled();
    expect(fx.notify).not.toHaveBeenCalled();
    expect(fx.notifyStudio).not.toHaveBeenCalled();
  });

  it('needs a photo, the owner, the warranty, and a Max studio', async () => {
    db.project = project();
    expect(await raiseWarrantyClaim('u_owner', 'hp_1', { description: 'hinge broken', area: 'MODULAR_HARDWARE' }, [])).toMatchObject({ ok: false, error: 'Add at least one photo of the problem.' });
    expect(await raiseWarrantyClaim('u_family', 'hp_1', { description: 'hinge broken', area: 'MODULAR_HARDWARE' }, [photo()])).toMatchObject({ ok: false, error: 'Only the person whose home it is can raise this.' });
    expect(await raiseWarrantyClaim('u_stranger', 'hp_1', { description: 'hinge broken', area: 'MODULAR_HARDWARE' }, [photo()])).toMatchObject({ ok: false, error: 'That project is not yours.' });
    db.project = project({ phase: 'SNAGS' });
    expect(await raiseWarrantyClaim('u_owner', 'hp_1', { description: 'hinge broken', area: 'MODULAR_HARDWARE' }, [photo()])).toMatchObject({ ok: false, error: expect.stringMatching(/sign off the handover/) });
    db.project = project({ plan: 'PRO' });
    expect(await raiseWarrantyClaim('u_owner', 'hp_1', { description: 'hinge broken', area: 'MODULAR_HARDWARE' }, [photo()])).toMatchObject({ ok: false, error: 'This is not open for your project yet.' });
    expect(fx.readClaim).not.toHaveBeenCalled();
  });
});

describe('service visit', () => {
  const now = new Date('2026-11-20T06:00:00Z');
  const ask = { category: 'CARPENTRY', description: 'Light switch loose', day: '2026-11-25', start: '10:00' };

  it('the payment gate refuses first, holding nothing', async () => {
    db.project = project({ paidRupees: 90_000 });
    const r = await bookServiceVisit('u_owner', 'hp_1', ask, [], now);
    expect(r).toMatchObject({ ok: false, pendingPaise: 10_000_00 });
    expect(db.requests).toHaveLength(0);
    expect(fx.createPaymentLink).not.toHaveBeenCalled();
  });

  it('holds the slot and returns the Razorpay page for the charge', async () => {
    db.project = project();
    const r = await bookServiceVisit('u_owner', 'hp_1', ask, [], now);
    expect(r).toEqual({ ok: true, id: 'sr_1', payUrl: 'https://rzp.io/i/x', booked: false, chargePaise: 50000, when: 'Wed 25 Nov, 10 am – 12 pm' });
    expect(fx.createPaymentLink).toHaveBeenCalledWith(expect.objectContaining({ amountPaise: 50000, referenceId: 'sr_1', expiresAt: new Date('2026-11-20T06:20:00Z') }));
    expect(db.requests[0]).toMatchObject({ status: 'HELD', payLinkId: 'plink_1' });
  });

  it('a category the studio has no charge for, a full slot, too early a day: refused', async () => {
    db.project = project();
    expect(await bookServiceVisit('u_owner', 'hp_1', { ...ask, category: 'PAINTING' }, [], now)).toMatchObject({ ok: false, error: expect.stringMatching(/not opened visits/) });
    expect(await bookServiceVisit('u_owner', 'hp_1', { ...ask, day: '2026-11-22' }, [], now)).toMatchObject({ ok: false, error: expect.stringMatching(/earliest visit/) });
    db.takenCount = 2;
    expect(await bookServiceVisit('u_owner', 'hp_1', ask, [], now)).toMatchObject({ ok: false, error: 'That slot was just taken. Pick another one.' });
  });

  it('the first month after the handover, fully paid: booked free at once, any kind of work, no payment page', async () => {
    db.project = project({ handover: '2026-11-01' });
    fx.razorpayReady.mockReturnValue(false);
    const r = await bookServiceVisit('u_owner', 'hp_1', { ...ask, category: 'PAINTING' }, [], now);
    fx.razorpayReady.mockReturnValue(true);
    expect(r).toEqual({ ok: true, id: 'sr_1', payUrl: null, booked: true, chargePaise: 0, when: 'Wed 25 Nov, 10 am – 12 pm' });
    expect(db.requests[0]).toMatchObject({ status: 'BOOKED', chargePaise: 0n });
    expect(fx.createPaymentLink).not.toHaveBeenCalled();
  });

  it('the free month still needs 100% paid', async () => {
    db.project = project({ handover: '2026-11-01', paidRupees: 99_999 });
    expect(await bookServiceVisit('u_owner', 'hp_1', ask, [], now)).toMatchObject({ ok: false, pendingPaise: 100 });
    expect(db.requests).toHaveLength(0);
  });

  it('after the month, the charge applies again', async () => {
    db.project = project({ handover: '2026-10-01' });
    expect(await bookServiceVisit('u_owner', 'hp_1', ask, [], now)).toMatchObject({ ok: true, booked: false, chargePaise: 50000 });
  });

  it('paid: booked once, the studio, the design head and the client told; a second notice does nothing', async () => {
    db.project = project();
    await bookServiceVisit('u_owner', 'hp_1', ask, [], now);
    const first = await markServicePaid('plink_1', 'pay_1', now);
    expect(first).toEqual({ ok: true, id: 'sr_1', fresh: true });
    expect(db.requests[0]).toMatchObject({ status: 'BOOKED', paymentId: 'pay_1' });
    expect(fx.notifyStudio).toHaveBeenCalledWith('st_1', expect.objectContaining({ kind: 'service-booked' }));
    expect(fx.notify).toHaveBeenCalledWith('u_owner', expect.objectContaining({ kind: 'service-confirmed' }));
    fx.notifyStudio.mockClear();
    expect(await markServicePaid('plink_1', 'pay_1', now)).toEqual({ ok: true, id: 'sr_1', fresh: false });
    expect(fx.notifyStudio).not.toHaveBeenCalled();
  });
});
