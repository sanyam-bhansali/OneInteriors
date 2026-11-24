import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * The Free plan's limits (owner, 24 Nov 2026; studio/plan-usage.ts) against a
 * LOCAL throwaway test database only (PGlite). Skipped in the normal suite.
 * Needs the migrations applied and `prisma/seed.ts` run (the st-akara
 * studio). Run on its own:
 *
 *   PLAN_LIMITS_TEST_DB=1 DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:54371/postgres?sslmode=disable&connection_limit=1&pgbouncer=true' \
 *     npx vitest run tests/plan-limits-db.integration.test.ts
 *
 * Real Postgres for what the pure tests cannot prove: which leads count as
 * open, the print month and the set-once print mark, the storage sum, and
 * that the old Pro Solo (SOLO) and Pro are never limited. Every row it made
 * is deleted and the studio's plan put back at the end.
 */

const RUN = process.env.PLAN_LIMITS_TEST_DB === '1';
const URL_OK = /127\.0\.0\.1:543\d\d/.test(process.env.DATABASE_URL ?? '');
if (RUN && !URL_OK) throw new Error('Test database only: DATABASE_URL must point at a local 127.0.0.1:543xx PGlite.');

const STUDIO = 'st-akara';
const TAG = `pl${Date.now().toString(36)}`;
let planBefore: string | null = null;
let openStage = '';
let wonStage = '';

async function db() {
  return (await import('@/lib/prisma')).prisma;
}
async function setPlan(plan: 'FREE' | 'PRO' | 'MAX' | 'SOLO') {
  await (await db()).studio.update({ where: { id: STUDIO }, data: { softwarePlan: plan, fullSoftware: plan === 'MAX' } });
}
async function leads(n: number, stageId: string, extra: Record<string, unknown> = {}) {
  await (await db()).studioClient.createMany({ data: Array.from({ length: n }, (_, i) => ({ studioId: STUDIO, stageId, name: `${TAG} lead ${i}`, ...extra })) });
}
async function quote(i: number, firstPrintedAt: Date | null = null) {
  return (await db()).studioQuote.create({
    data: { studioId: STUDIO, number: `${TAG}-${i}`, clientName: `${TAG} client`, feeBps: 0, discountBps: 0, bookingAdvancePaise: 0n, firstPrintedAt },
    select: { id: true },
  });
}

beforeAll(async () => {
  if (!RUN) return;
  const prisma = await db();
  const s = await prisma.studio.findUniqueOrThrow({ where: { id: STUDIO }, select: { softwarePlan: true } });
  planBefore = s.softwarePlan;
  /* Start clean of anything an earlier run left. */
  await prisma.studioClient.deleteMany({ where: { studioId: STUDIO } });
  await prisma.studioQuote.deleteMany({ where: { studioId: STUDIO } });
  openStage = (await prisma.studioStage.create({ data: { studioId: STUDIO, name: `${TAG} New`, sortOrder: 900, kind: 'OPEN' }, select: { id: true } })).id;
  wonStage = (await prisma.studioStage.create({ data: { studioId: STUDIO, name: `${TAG} Won`, sortOrder: 901, kind: 'WON' }, select: { id: true } })).id;
});

afterAll(async () => {
  if (!RUN) return;
  const prisma = await db();
  await prisma.studioClientFile.deleteMany({ where: { studioId: STUDIO, name: { startsWith: TAG } } });
  await prisma.studioClient.deleteMany({ where: { studioId: STUDIO, name: { startsWith: TAG } } });
  await prisma.studioQuote.deleteMany({ where: { studioId: STUDIO, number: { startsWith: TAG } } });
  await prisma.studioStage.deleteMany({ where: { id: { in: [openStage, wonStage] } } });
  if (planBefore) await setPlan(planBefore as 'PRO');
});

describe.skipIf(!RUN)('Free limits on a real database', () => {
  it('open leads: only open, live, real leads count; the 200th fits and the 201st does not', async () => {
    const { leadRoom, openLeadCount } = await import('@/modules/studio/plan-usage');
    await setPlan('FREE');
    await leads(199, openStage);
    await leads(5, wonStage);
    await leads(5, openStage, { deletedAt: new Date() });
    await leads(1, openStage, { isDemo: true });
    expect(await openLeadCount(STUDIO)).toBe(199);
    expect(await leadRoom(STUDIO)).toEqual({ ok: true });
    const two = await leadRoom(STUDIO, 2);
    expect(two.ok).toBe(false);
    expect('error' in two ? two.error : '').toMatch(/200 open leads/);
    await leads(1, openStage);
    expect((await leadRoom(STUDIO)).ok).toBe(false);
  });

  it('open leads: Pro, Max and the old Pro Solo are never limited', async () => {
    const { leadRoom } = await import('@/modules/studio/plan-usage');
    for (const p of ['PRO', 'MAX', 'SOLO'] as const) {
      await setPlan(p);
      expect(await leadRoom(STUDIO, 1000), p).toEqual({ ok: true });
    }
  });

  it('prints: 20 new quotations a month on Free; the 21st is refused; a reprint and last month never count', async () => {
    const { claimPrint } = await import('@/modules/studio/plan-usage');
    const prisma = await db();
    await setPlan('FREE');
    const now = new Date('2026-11-24T10:00:00Z');
    await quote(100, new Date('2026-10-20T10:00:00Z')); /* last month: does not count */
    const printed: string[] = [];
    for (let i = 0; i < 19; i++) printed.push((await quote(i, new Date('2026-11-05T10:00:00Z'))).id);
    const twentieth = await quote(19);
    expect(await claimPrint(twentieth.id, STUDIO, now)).toEqual({ ok: true });
    const mark = (await prisma.studioQuote.findUniqueOrThrow({ where: { id: twentieth.id }, select: { firstPrintedAt: true } })).firstPrintedAt;
    expect(mark?.toISOString()).toBe(now.toISOString());

    const twentyFirst = await quote(20);
    const refused = await claimPrint(twentyFirst.id, STUDIO, now);
    expect(refused.ok).toBe(false);
    expect((await prisma.studioQuote.findUniqueOrThrow({ where: { id: twentyFirst.id }, select: { firstPrintedAt: true } })).firstPrintedAt).toBeNull();

    /* A quotation printed before prints again, and its mark never moves. */
    expect(await claimPrint(twentieth.id, STUDIO, new Date('2026-11-25T10:00:00Z'))).toEqual({ ok: true });
    expect((await prisma.studioQuote.findUniqueOrThrow({ where: { id: twentieth.id }, select: { firstPrintedAt: true } })).firstPrintedAt?.toISOString()).toBe(now.toISOString());

    /* The 1st of next month, India time, starts a fresh count. */
    expect(await claimPrint(twentyFirst.id, STUDIO, new Date('2026-11-30T18:31:00Z'))).toEqual({ ok: true });

    /* On Pro the 21st prints at once. */
    const another = await quote(21);
    await setPlan('PRO');
    expect(await claimPrint(another.id, STUDIO, now)).toEqual({ ok: true });
  });

  it('storage: the files on leads are summed; a file that fills it fits, one byte more does not', async () => {
    const { storageRoom } = await import('@/modules/studio/plan-usage');
    const prisma = await db();
    await setPlan('FREE');
    const lead = await prisma.studioClient.create({ data: { studioId: STUDIO, stageId: wonStage, name: `${TAG} files` }, select: { id: true } });
    const gb = 1024 ** 3;
    const half = gb / 2;
    await prisma.studioClientFile.createMany({
      data: [0, 1].map((i) => ({ studioId: STUDIO, clientId: lead.id, storagePath: `${TAG}/${i}`, name: `${TAG} plan ${i}.pdf`, contentType: 'application/pdf', bytes: half - 50 })),
    });
    expect(await storageRoom(STUDIO, 100)).toEqual({ ok: true });
    const over = await storageRoom(STUDIO, 101);
    expect(over.ok).toBe(false);
    expect('error' in over ? over.error : '').toMatch(/1 GB/);
    await setPlan('PRO');
    expect(await storageRoom(STUDIO, gb)).toEqual({ ok: true });
  });
});
