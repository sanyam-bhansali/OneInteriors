import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `readPlanOnce` against a stand-in database: the same bytes are read once,
 * a failed plan is not sent again, the daily cap holds, and without an API
 * key nothing is read or stored.
 */

type Row = { id: string; studioId: string; contentHash: string; status: string; reason: string | null; reading: unknown; attempts: number; lastAttemptAt: Date };

const db = vi.hoisted(() => {
  const rows: Row[] = [];
  const keyOf = (w: { studioId_contentHash: { studioId: string; contentHash: string } }) => w.studioId_contentHash;
  return {
    rows,
    client: {
      studioPlanReading: {
        findUnique: vi.fn(async ({ where }: { where: { studioId_contentHash: { studioId: string; contentHash: string } } }) => {
          const k = keyOf(where);
          return rows.find((r) => r.studioId === k.studioId && r.contentHash === k.contentHash) ?? null;
        }),
        count: vi.fn(async ({ where }: { where: { studioId: string; lastAttemptAt: { gte: Date } } }) =>
          rows.filter((r) => r.studioId === where.studioId && r.lastAttemptAt >= where.lastAttemptAt.gte).length,
        ),
        create: vi.fn(async ({ data }: { data: Omit<Row, 'id' | 'reason' | 'reading'> }) => {
          const row = { id: `r${rows.length + 1}`, reason: null, reading: null, ...data };
          rows.push(row);
          return row;
        }),
        updateMany: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Row> & { attempts?: { increment: number } } }) => {
          const row = rows.find((r) => r.id === where.id);
          if (!row) return { count: 0 };
          const { attempts, ...rest } = data;
          Object.assign(row, rest);
          if (attempts) row.attempts += attempts.increment;
          return { count: 1 };
        }),
        update: vi.fn(async ({ where, data }: { where: { studioId_contentHash: { studioId: string; contentHash: string } }; data: Partial<Row> }) => {
          const k = keyOf(where);
          const row = rows.find((r) => r.studioId === k.studioId && r.contentHash === k.contentHash)!;
          Object.assign(row, data);
          return row;
        }),
      },
    },
  };
});
vi.mock('@/lib/prisma', () => ({ prisma: db.client }));

const reader = vi.hoisted(() => ({
  on: true,
  result: { ok: true, reading: { bedrooms: 2, bathrooms: 2, rooms: [], hasStudy: false, carpetAreaSqft: null, carpetAreaSource: null, kitchenRunMm: null, confidence: 'high', needsConfirming: [] } } as unknown,
  calls: 0,
}));
vi.mock('@/modules/floorplan/read', () => ({
  canReadPlans: () => reader.on,
  readFloorPlan: vi.fn(async () => {
    reader.calls += 1;
    return reader.result;
  }),
}));

import { readPlanOnce, contentHash } from '@/modules/floorplan/plan-reads';
import { PLAN_READS_PER_DAY } from '@/modules/floorplan/plan-cache';

const PLAN = new Uint8Array([37, 80, 68, 70, 1, 2, 3]);

beforeEach(() => {
  db.rows.length = 0;
  reader.on = true;
  reader.calls = 0;
  reader.result = { ok: true, reading: { bedrooms: 2, bathrooms: 2, rooms: [], hasStudy: false, carpetAreaSqft: null, carpetAreaSource: null, kitchenRunMm: null, confidence: 'high', needsConfirming: [] } };
});

describe('readPlanOnce', () => {
  it('reads a file once and serves the stored reading after', async () => {
    const first = await readPlanOnce('s1', PLAN, 'application/pdf');
    expect(first).toMatchObject({ ok: true, cached: false });
    const second = await readPlanOnce('s1', PLAN, 'application/pdf');
    expect(second).toMatchObject({ ok: true, cached: true });
    expect(reader.calls).toBe(1);
    expect(db.rows[0]!.contentHash).toBe(contentHash(PLAN));
    expect(db.rows[0]!.status).toBe('READ');
  });

  it('keeps studios apart: the same bytes are read once per studio', async () => {
    await readPlanOnce('s1', PLAN, 'application/pdf');
    await readPlanOnce('s2', PLAN, 'application/pdf');
    expect(reader.calls).toBe(2);
  });

  it('does not send a plan the reader could not make out again', async () => {
    reader.result = { ok: false, reason: 'unreadable' };
    expect(await readPlanOnce('s1', PLAN, 'image/png')).toEqual({ ok: false, reason: 'unreadable' });
    expect(await readPlanOnce('s1', PLAN, 'image/png')).toEqual({ ok: false, reason: 'unreadable' });
    expect(reader.calls).toBe(1);
  });

  it('retries a timeout once, then stops', async () => {
    reader.result = { ok: false, reason: 'reader-failed' };
    await readPlanOnce('s1', PLAN, 'image/png');
    await readPlanOnce('s1', PLAN, 'image/png');
    await readPlanOnce('s1', PLAN, 'image/png');
    expect(reader.calls).toBe(2);
  });

  it('stops at the daily cap', async () => {
    const now = new Date();
    for (let i = 0; i < PLAN_READS_PER_DAY; i += 1) {
      db.rows.push({ id: `x${i}`, studioId: 's1', contentHash: `h${i}`, status: 'READ', reason: null, reading: null, attempts: 1, lastAttemptAt: now });
    }
    expect(await readPlanOnce('s1', PLAN, 'application/pdf')).toEqual({ ok: false, reason: 'daily-cap' });
    expect(reader.calls).toBe(0);
  });

  it('without an API key, reads nothing and stores nothing', async () => {
    reader.on = false;
    expect(await readPlanOnce('s1', PLAN, 'application/pdf')).toEqual({ ok: false, reason: 'not-configured' });
    expect(reader.calls).toBe(0);
    expect(db.rows).toHaveLength(0);
  });

  it('refuses a photo over 5 MB before reading', async () => {
    expect(await readPlanOnce('s1', new Uint8Array(6 * 1024 * 1024), 'image/jpeg')).toEqual({ ok: false, reason: 'photo-too-large' });
    expect(db.rows).toHaveLength(0);
  });
});
