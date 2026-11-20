import { afterAll, describe, expect, it, vi } from 'vitest';

/**
 * Warranty claims and service visits against a LOCAL throwaway test database
 * only (PGlite; docs/studio-os/AFTERCARE.md). Skipped in the normal suite.
 * Needs the migrations applied (20261120120000_aftercare seeds the coverage
 * rules) and `prisma/seed.ts` run (the st-akara studio). Run on its own:
 *
 *   AFTERCARE_TEST_DB=1 DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:54367/postgres?sslmode=disable&connection_limit=1&pgbouncer=true' \
 *     npx vitest run tests/aftercare-db.integration.test.ts
 *
 * Real Postgres for the parts the stand-in cannot prove: the seeded coverage
 * rules are read, the slot lock and the date filters work, a covered claim
 * writes a warranty snag and its RAISED event, a paid link books once.
 * The photo reader, storage and Razorpay are stubbed (no network). Every row
 * it made is deleted at the end.
 */

const RUN = process.env.AFTERCARE_TEST_DB === '1';
const URL_OK = /127\.0\.0\.1:543\d\d/.test(process.env.DATABASE_URL ?? '');
if (RUN && !URL_OK) throw new Error('Test database only: DATABASE_URL must point at a local 127.0.0.1:543xx PGlite.');

const fx = vi.hoisted(() => ({ reader: { ok: true, key: 'MODULAR_CORE', summary: 'Wardrobe panel delaminating', reason: 'layers separating' } as Record<string, unknown> }));
vi.mock('@/modules/aftercare/reader', () => ({ READER_MODEL: 'claude-sonnet-5-5', readClaim: vi.fn(async () => fx.reader) }));
vi.mock('@/modules/storage/site-photos', () => ({ storeSitePhoto: vi.fn(async () => ({ ok: true, path: `project_x/${Math.random().toString(36).slice(2)}.jpg` })) }));
vi.mock('@/modules/aftercare/razorpay', () => ({
  razorpayReady: () => true,
  createPaymentLink: vi.fn(async (i: { referenceId: string }) => ({ ok: true, id: `plink_${i.referenceId}`, url: 'https://rzp.io/i/test' })),
  refundPayment: vi.fn(async () => ({ ok: true, id: 'rfnd_test' })),
}));
/* The studio's side acts as st-akara's owner (the member is read in the test's own setup). */
const staff = vi.hoisted(() => ({ member: null as Record<string, unknown> | null }));
vi.mock('@/modules/studio/access', () => ({ currentMember: vi.fn(async () => staff.member), can: vi.fn(() => true) }));

const STUDIO = 'st-akara';
const TAG = `act${Date.now().toString(36)}`;
const made = { users: [] as string[], members: [] as string[], briefs: [] as string[], intros: [] as string[], projects: [] as string[] };
let projectId = '';
let userId = '';
let studioBefore: { softwarePlan: string; serviceCharges: unknown; serviceSlotVisits: number } | null = null;

afterAll(async () => {
  if (!RUN) return;
  const { prisma } = await import('@/lib/prisma');
  await prisma.homeProject.deleteMany({ where: { id: { in: made.projects } } });
  await prisma.introduction.deleteMany({ where: { id: { in: made.intros } } });
  await prisma.brief.deleteMany({ where: { id: { in: made.briefs } } });
  await prisma.studioMember.deleteMany({ where: { id: { in: made.members } } });
  await prisma.notification.deleteMany({ where: { userId: { in: made.users } } });
  await prisma.user.deleteMany({ where: { id: { in: made.users } } });
  if (studioBefore) {
    await prisma.studio.update({
      where: { id: STUDIO },
      data: { softwarePlan: studioBefore.softwarePlan as 'PRO', serviceCharges: (studioBefore.serviceCharges ?? undefined) as never, serviceSlotVisits: studioBefore.serviceSlotVisits },
    });
  }
});

const photo = () => new File([new Uint8Array([255, 216, 255])], 'p.jpg', { type: 'image/jpeg' });

describe.skipIf(!RUN)('aftercare (test database)', () => {
  it('sets up a handed-over, fully paid project on a Max studio', async () => {
    const { prisma } = await import('@/lib/prisma');
    const s = await prisma.studio.findUnique({ where: { id: STUDIO }, select: { softwarePlan: true, serviceCharges: true, serviceSlotVisits: true } });
    expect(s).not.toBeNull();
    studioBefore = s;
    await prisma.studio.update({ where: { id: STUDIO }, data: { softwarePlan: 'MAX', serviceCharges: { CARPENTRY: 50000, ELECTRICAL: 30000 }, serviceSlotVisits: 1 } });
    const user = await prisma.user.create({ data: { phone: `+9198${String(Date.now()).slice(-8)}`, name: `${TAG} Ankita` }, select: { id: true } });
    made.users.push(user.id);
    userId = user.id;
    const brief = await prisma.brief.create({ data: { userId: user.id }, select: { id: true } });
    made.briefs.push(brief.id);
    const intro = await prisma.introduction.create({ data: { briefId: brief.id, studioId: STUDIO, introducedById: user.id }, select: { id: true } });
    made.intros.push(intro.id);
    const p = await prisma.homeProject.create({
      data: {
        introductionId: intro.id,
        startOn: new Date('2026-01-05T00:00:00Z'),
        totalDays: 90,
        phase: 'WARRANTY',
        warrantyEndsOn: new Date('2027-10-01T00:00:00Z'),
        paymentPhases: [
          { label: 'Booking', pct: 10, amountPaise: 10_000_00 },
          { label: 'Handover', pct: 90, amountPaise: 90_000_00 },
        ],
      },
      select: { id: true },
    });
    made.projects.push(p.id);
    projectId = p.id;
    for (const [i, amount] of [10_000_00, 90_000_00].entries()) {
      await prisma.homeProjectPayment.create({
        data: { projectId: p.id, stageIndex: i, amountPaise: BigInt(amount), receivedOn: new Date('2026-03-01T00:00:00Z'), recordedById: user.id, customerConfirmedAt: new Date() },
      });
    }
  });

  it('reads the seeded coverage rules and seven days of slots', async () => {
    const { aftercareView } = await import('@/modules/aftercare/store');
    const r = await aftercareView(userId, projectId, new Date('2026-11-20T06:00:00Z'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.view.payments.cleared).toBe(true);
    expect(r.view.warranty.open).toBe(true);
    expect(r.view.warranty.areas.map((a) => a.key)).toContain('MODULAR_CORE');
    expect(r.view.warranty.areas).toHaveLength(14);
    expect(r.view.service.categories.map((c) => c.key)).toEqual(['CARPENTRY', 'ELECTRICAL']);
    expect(r.view.service.days[0]!.date).toBe('2026-11-25');
  });

  it('a covered claim writes a warranty snag with its RAISED event', async () => {
    const { prisma } = await import('@/lib/prisma');
    const { raiseWarrantyClaim } = await import('@/modules/aftercare/store');
    const r = await raiseWarrantyClaim(userId, projectId, { description: 'wardrobe side panel is splitting', area: 'MODULAR_CORE' }, [photo()]);
    expect(r).toMatchObject({ ok: true, covered: true });
    if (!r.ok || !r.covered) return;
    const snag = await prisma.homeSnag.findUnique({ where: { id: r.snagId }, select: { warranty: true, title: true, events: { select: { kind: true } } } });
    expect(snag).toMatchObject({ warranty: true, title: 'Wardrobe panel delaminating', events: [{ kind: 'RAISED' }] });
  });

  it('a paint crack raises nothing', async () => {
    const { prisma } = await import('@/lib/prisma');
    const { raiseWarrantyClaim } = await import('@/modules/aftercare/store');
    fx.reader = { ok: true, key: 'PAINTING', summary: 'Wall paint crack', reason: '' };
    const before = await prisma.homeSnag.count({ where: { projectId } });
    const r = await raiseWarrantyClaim(userId, projectId, { description: 'crack in the wall paint', area: 'MODULAR_CORE' }, [photo()]);
    expect(r).toMatchObject({ ok: true, covered: false, serviceCategory: 'PAINTING' });
    expect(await prisma.homeSnag.count({ where: { projectId } })).toBe(before);
    expect(await prisma.warrantyClaim.count({ where: { projectId } })).toBe(2);
  });

  it('holds a slot, lets go of the last hold, refuses a full slot, books once when paid', async () => {
    const { prisma } = await import('@/lib/prisma');
    const { bookServiceVisit, markServicePaid } = await import('@/modules/aftercare/store');
    const now = new Date();
    const { istDay, addDays } = await import('@/modules/project/working-days');
    const day = addDays(istDay(now), 6);
    const ask = { category: 'ELECTRICAL', description: 'LED strip not working', day, start: '12:00' };
    const a = await bookServiceVisit(userId, projectId, ask, [], now);
    expect(a.ok).toBe(true);
    const b = await bookServiceVisit(userId, projectId, ask, [], now);
    expect(b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect((await prisma.serviceRequest.findUnique({ where: { id: a.id }, select: { status: true } }))!.status).toBe('CANCELLED');
    const paid = await markServicePaid(`plink_${b.id}`, `pay_${TAG}`);
    expect(paid).toEqual({ ok: true, id: b.id, fresh: true });
    expect(await markServicePaid(`plink_${b.id}`, `pay_${TAG}`)).toEqual({ ok: true, id: b.id, fresh: false });
    // One visit per slot at this studio: the booked one fills it.
    expect(await bookServiceVisit(userId, projectId, ask, [], now)).toMatchObject({ ok: false, error: 'That slot was just taken. Pick another one.' });
  });

  it('the studio moves, finishes and cancels a paid visit (refunded)', async () => {
    const { prisma } = await import('@/lib/prisma');
    const { bookServiceVisit, cancelServiceVisit, finishServiceVisit, markServicePaid, moveServiceVisit, studioServiceVisits } = await import('@/modules/aftercare/store');
    const { addDays, istDay } = await import('@/modules/project/working-days');
    const ownerUser = await prisma.user.create({ data: { phone: `+9197${String(Date.now()).slice(-8)}`, name: `${TAG} Owner`, role: 'STUDIO' }, select: { id: true } });
    made.users.push(ownerUser.id);
    const owner = await prisma.studioMember.create({ data: { studioId: STUDIO, userId: ownerUser.id, role: 'OWNER', status: 'ACTIVE' }, select: { id: true, userId: true, role: true, status: true, studioId: true } });
    made.members.push(owner.id);
    staff.member = { ...owner };
    const day = addDays(istDay(new Date()), 7);
    const a = await bookServiceVisit(userId, projectId, { category: 'CARPENTRY', description: 'shutter needs adjusting', day, start: '10:00' }, []);
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    await markServicePaid(`plink_${a.id}`, `pay2_${TAG}`);
    const list = await studioServiceVisits();
    expect(list!.canAct).toBe(true);
    expect(list!.visits.find((v) => v.id === a.id)).toMatchObject({ paid: true, state: 'booked' });
    const moved = await moveServiceVisit(a.id, { day: addDays(istDay(new Date()), 9), start: '14:00', note: 'Carpenter free that day' });
    expect(moved.ok).toBe(true);
    expect(await prisma.serviceRequest.findUnique({ where: { id: a.id }, select: { slotStart: true, studioNote: true } })).toEqual({ slotStart: '14:00', studioNote: 'Carpenter free that day' });
    expect(await cancelServiceVisit(a.id, 'no')).toMatchObject({ ok: false });
    const c = await cancelServiceVisit(a.id, 'Fixed it on the phone, no visit needed');
    expect(c).toMatchObject({ ok: true, message: expect.stringMatching(/refunded/) });
    expect(await prisma.serviceRequest.findUnique({ where: { id: a.id }, select: { status: true, refundId: true } })).toEqual({ status: 'CANCELLED', refundId: 'rfnd_test' });
    expect(await finishServiceVisit(a.id, '')).toMatchObject({ ok: false, error: 'Only a booked visit can be changed.' });
    const b = await bookServiceVisit(userId, projectId, { category: 'CARPENTRY', description: 'handle loose', day, start: '16:00' }, []);
    if (!b.ok) throw new Error(b.error);
    await markServicePaid(`plink_${b.id}`, `pay3_${TAG}`);
    expect(await finishServiceVisit(b.id, 'Handle tightened')).toMatchObject({ ok: true });
    expect((await prisma.serviceRequest.findUnique({ where: { id: b.id }, select: { status: true } }))!.status).toBe('DONE');
  });

  it('one free visit within 30 days of the handover, then the charge again', async () => {
    const { prisma } = await import('@/lib/prisma');
    const { aftercareView, bookServiceVisit } = await import('@/modules/aftercare/store');
    const { addDays, istDay } = await import('@/modules/project/working-days');
    await prisma.homeProject.update({ where: { id: projectId }, data: { handoverSignedAt: new Date(Date.now() - 10 * 86_400_000) } });
    const v = await aftercareView(userId, projectId);
    expect(v.ok && v.view.service.free).toBe(true);
    if (v.ok) expect(v.view.service.categories.find((c) => c.key === 'CARPENTRY')).toEqual({ key: 'CARPENTRY', label: 'Carpentry', chargePaise: 0, listPaise: 50000 });
    const day = addDays(istDay(new Date()), 8);
    const free = await bookServiceVisit(userId, projectId, { category: 'PAINTING', description: 'touch up a wall', day, start: '10:00' }, []);
    expect(free).toMatchObject({ ok: true, payUrl: null, booked: true, chargePaise: 0 });
    const next = await bookServiceVisit(userId, projectId, { category: 'CARPENTRY', description: 'another small fix', day, start: '12:00' }, []);
    expect(next).toMatchObject({ ok: true, booked: false, chargePaise: 50000 });
  });

  it('₹1 owed refuses both, before anything is written', async () => {
    const { prisma } = await import('@/lib/prisma');
    const { bookServiceVisit, raiseWarrantyClaim } = await import('@/modules/aftercare/store');
    const pay = await prisma.homeProjectPayment.findFirst({ where: { projectId, stageIndex: 1 }, select: { id: true } });
    await prisma.homeProjectPayment.update({ where: { id: pay!.id }, data: { amountPaise: BigInt(90_000_00 - 100) } });
    const claims = await prisma.warrantyClaim.count({ where: { projectId } });
    const c = await raiseWarrantyClaim(userId, projectId, { description: 'panel splitting', area: 'MODULAR_CORE' }, [photo()]);
    expect(c).toMatchObject({ ok: false, pendingPaise: 100, error: 'Please clear your payments first. ₹1 is pending.' });
    const s = await bookServiceVisit(userId, projectId, { category: 'CARPENTRY', description: 'shutter loose', day: '2026-12-30', start: '10:00' }, []);
    expect(s).toMatchObject({ ok: false, pendingPaise: 100 });
    expect(await prisma.warrantyClaim.count({ where: { projectId } })).toBe(claims);
  });
});
