import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

/**
 * The quotation / floor-plan review fixes of 12 Oct 2026:
 *  1. the fee a quotation keeps (an older 10% is not repriced to 7% on save);
 *  3. a photo's size cap keeps its base64 under the reader's image limit;
 *  4. a plan already being read stops the run (no fallback quotation), and
 *     the run's claim is atomic;
 *  5. no writes to a quotation a live project runs on; Read rooms on a draft;
 *  6. a kitchen false ceiling is sized from the plan;
 *  (7 is in studio-sales-revisions.test.ts; 2 removed code, checked below.)
 */

const db = vi.hoisted(() => ({
  job: null as null | { status: string; startedAt: Date },
  jobCreateFails: false,
  quote: null as null | { id: string; clientId: string | null; config: string | null; carpetSqft: number | null; status: string },
  liveProject: false,
  calls: { createQuote: 0, readPlanOnce: 0, quoteUpdate: 0 },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    studioClientFile: {
      findFirst: vi.fn(async () => ({ id: 'f1', kind: 'FLOOR_PLAN', storagePath: 'studio_s1/lead_c1/x.pdf', contentType: 'application/pdf', bytes: 1000, clientId: 'c1' })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    studioClient: {
      findFirst: vi.fn(async () => ({ id: 'c1', name: 'Asha', phone: null, email: null, society: null, config: '2 BHK', carpetSqft: null, introductionId: null, source: 'OTHER' })),
    },
    studioQuote: {
      count: vi.fn(async () => 0),
      findFirst: vi.fn(async () => db.quote),
      updateMany: vi.fn(async () => {
        db.calls.quoteUpdate += 1;
        return { count: 1 };
      }),
    },
    studioQuotePlan: { upsert: vi.fn(async () => ({})) },
    homeProject: { findFirst: vi.fn(async () => (db.liveProject ? { id: 'p1' } : null)) },
    studioPlanJob: {
      updateMany: vi.fn(async ({ where }: { where: { OR: unknown } }) => {
        void where;
        if (!db.job) return { count: 0 };
        const stale = Date.now() - db.job.startedAt.getTime() >= 3 * 60_000;
        if (db.job.status !== 'READING' || stale) {
          db.job = { status: 'READING', startedAt: new Date() };
          return { count: 1 };
        }
        return { count: 0 };
      }),
      create: vi.fn(async () => {
        if (db.job || db.jobCreateFails) {
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '6.0.0' });
        }
        db.job = { status: 'READING', startedAt: new Date() };
        return {};
      }),
      update: vi.fn(async ({ data }: { data: { status: string } }) => {
        db.job = { status: data.status, startedAt: db.job?.startedAt ?? new Date() };
        return {};
      }),
    },
  },
}));

vi.mock('@/modules/studio/lead-scope', () => ({
  myLeadScope: vi.fn(async () => ({ studioId: 's1', leads: {}, quotes: {}, seesAll: true, member: { id: 'm1', role: 'OWNER' } })),
  leadInScope: vi.fn(async () => ({ id: 'c1', assignedToId: null, name: 'Asha' })),
  mayOnLead: vi.fn(() => true),
}));
vi.mock('@/modules/studio-practice/events', () => ({ record: vi.fn(async () => undefined) }));
vi.mock('@/modules/storage/lead-files', () => ({ readLeadFile: vi.fn(async () => new Uint8Array([1, 2, 3])) }));
vi.mock('@/modules/floorplan/read', () => ({ canReadPlans: () => true }));
const plan = vi.hoisted(() => ({ result: { ok: false, reason: 'busy' } as unknown }));
vi.mock('@/modules/floorplan/plan-reads', () => ({
  readPlanOnce: vi.fn(async () => {
    db.calls.readPlanOnce += 1;
    return plan.result;
  }),
}));
vi.mock('@/modules/studio-quote/quotes', () => ({
  createQuote: vi.fn(async () => {
    db.calls.createQuote += 1;
    return { ok: true, id: 'q-new' };
  }),
  applyConfiguration: vi.fn(async () => ({ ok: true, added: 0, notes: [] })),
}));

import { keptFeeBps, FEE_BPS } from '@/modules/studio-quote/pricing';
import {
  base64Length,
  checkPlanFile,
  PHOTO_MAX_BYTES,
  PLAN_FILE_LIMITS,
  planReadMessage,
  READER_IMAGE_MAX_ENCODED,
  READER_REQUEST_MAX,
} from '@/modules/floorplan/plan-cache';
import { QUOTE_WRITE_ERRORS, quoteWriteRefusal, readRoomsRefusal } from '@/modules/studio-quote/write-rules';
import { namedRoomOf, planQuotation, type CatalogueProduct } from '@/modules/studio-quote/configure';
import { areaSqft } from '@/modules/floorplan/sizing';
import { buildFromPlan, readRoomsForQuote } from '@/modules/studio-quote/from-plan';
import type { PlanRoomSize } from '@/modules/brief/types';
import { readFileSync } from 'node:fs';

beforeEach(() => {
  db.job = null;
  db.jobCreateFails = false;
  db.quote = null;
  db.liveProject = false;
  db.calls = { createQuote: 0, readPlanOnce: 0, quoteUpdate: 0 };
  plan.result = { ok: false, reason: 'busy' };
});

describe('1. the fee a quotation keeps', () => {
  it('keeps an older quotation’s own fee while the box stays on', () => {
    expect(keptFeeBps(1000, true)).toBe(1000);
    expect(keptFeeBps(700, true)).toBe(700);
  });
  it('sets 7% only when a fee is turned on from off, and nothing when off', () => {
    expect(keptFeeBps(0, true)).toBe(FEE_BPS);
    expect(keptFeeBps(1000, false)).toBe(0);
  });
});

describe('2. no uncapped plan read', () => {
  it('nothing outside plan-reads.ts (and the customer quiz) calls the reader directly', () => {
    const leads = readFileSync('src/modules/studio-sales/leads.ts', 'utf8');
    const actions = readFileSync('src/app/studio/sales-actions.ts', 'utf8');
    expect(leads).not.toMatch(/readFloorPlan|export async function readRoomsOn/);
    expect(actions).not.toMatch(/readRoomsOn|readRoomsAction/);
  });
});

describe('3. what the reader can take', () => {
  it('keeps the largest photo’s base64 under the reader’s 5 MB image limit', () => {
    expect(base64Length(PHOTO_MAX_BYTES)).toBeLessThan(READER_IMAGE_MAX_ENCODED);
    expect(checkPlanFile('image/jpeg', PHOTO_MAX_BYTES)).toEqual({ ok: true });
  });
  it('refuses a 4 MB photo in plain words', () => {
    expect(checkPlanFile('image/jpeg', 4 * 1024 * 1024)).toEqual({ ok: false, reason: 'photo-too-large' });
    expect(planReadMessage('photo-too-large')).toMatch(/^Photo is too big — send a PDF or a smaller photo/);
  });
  it('keeps a 15 MB PDF inside the reader’s request limit', () => {
    const pdf = PLAN_FILE_LIMITS['application/pdf']!;
    expect(base64Length(pdf)).toBeLessThan(READER_REQUEST_MAX - 1024 * 1024);
    expect(checkPlanFile('application/pdf', pdf)).toEqual({ ok: true });
    expect(checkPlanFile('application/pdf', pdf + 1)).toEqual({ ok: false, reason: 'too-large' });
  });
});

describe('4. a plan already being read', () => {
  it('stops without making a quotation when the reader says busy', async () => {
    const r = await buildFromPlan('c1', { fileId: 'f1' }, 'auto');
    expect(r).toMatchObject({ ok: true, status: 'FAILED', quoteId: null, message: planReadMessage('busy') });
    expect(planReadMessage('busy')).toMatch(/already being read — try again in a minute/);
    expect(db.calls.createQuote).toBe(0);
    expect(db.job?.status).toBe('FAILED');
  });

  it('a second press while a run is going is told so, and reads nothing', async () => {
    db.job = { status: 'READING', startedAt: new Date() };
    const r = await buildFromPlan('c1', { fileId: 'f1' }, 'manual');
    expect(r).toMatchObject({ ok: true, status: 'READING', quoteId: null });
    expect(db.calls.readPlanOnce).toBe(0);
    expect(db.calls.createQuote).toBe(0);
  });

  it('two first presses at once: the one whose create collides waits', async () => {
    db.jobCreateFails = true;
    const r = await buildFromPlan('c1', { fileId: 'f1' }, 'manual');
    expect(r).toMatchObject({ ok: true, status: 'READING' });
    expect(db.calls.readPlanOnce).toBe(0);
  });

  it('a dead run is taken over, and a read plan still builds', async () => {
    db.job = { status: 'READING', startedAt: new Date(Date.now() - 4 * 60_000) };
    plan.result = { ok: true, cached: true, reading: { bedrooms: 2, bathrooms: 2, rooms: [], hasStudy: false, carpetAreaSqft: null, carpetAreaSource: null, kitchenRunMm: null, confidence: 'high', needsConfirming: [] } };
    const r = await buildFromPlan('c1', { fileId: 'f1' }, 'manual');
    expect(r).toMatchObject({ ok: true, status: 'BUILT', quoteId: 'q-new' });
    expect(db.calls.createQuote).toBe(1);
  });
});

describe('5. a quotation a project runs on, and Read rooms', () => {
  it('refuses lines, terms and the build once a live project runs on it', () => {
    expect(quoteWriteRefusal({ liveProject: true })).toBe(QUOTE_WRITE_ERRORS.booked);
    expect(quoteWriteRefusal({ liveProject: false })).toBeNull();
  });
  it('Read rooms is for a draft with no project', () => {
    expect(readRoomsRefusal({ liveProject: false, status: 'DRAFT' })).toBeNull();
    expect(readRoomsRefusal({ liveProject: false, status: 'ISSUED' })).toBe(QUOTE_WRITE_ERRORS.notDraft);
    expect(readRoomsRefusal({ liveProject: true, status: 'DRAFT' })).toBe(QUOTE_WRITE_ERRORS.booked);
  });
  it('readRoomsForQuote changes nothing on a sent quotation', async () => {
    db.quote = { id: 'q1', clientId: 'c1', config: '2 BHK', carpetSqft: null, status: 'ISSUED' };
    expect(await readRoomsForQuote('q1')).toEqual({ ok: false, error: QUOTE_WRITE_ERRORS.notDraft });
    expect(db.calls.readPlanOnce).toBe(0);
    expect(db.calls.quoteUpdate).toBe(0);
  });
  it('readRoomsForQuote changes nothing on a booked quotation', async () => {
    db.quote = { id: 'q1', clientId: 'c1', config: '2 BHK', carpetSqft: null, status: 'DRAFT' };
    db.liveProject = true;
    expect(await readRoomsForQuote('q1')).toEqual({ ok: false, error: QUOTE_WRITE_ERRORS.booked });
    expect(db.calls.quoteUpdate).toBe(0);
  });
});

describe('6. the kitchen false ceiling from the plan', () => {
  const ROOMS: PlanRoomSize[] = [
    { name: 'Master Bedroom', code: 'BEDROOM', widthMm: 3658, depthMm: 4267 },
    { name: 'Bedroom', code: 'BEDROOM', widthMm: 3048, depthMm: 3353 },
    { name: 'Living', code: 'LIVING', widthMm: 3962, depthMm: 5486 },
    { name: 'Kitchen', code: 'KITCHEN', widthMm: 2438, depthMm: 3048 },
  ];
  let n = 0;
  const p = (over: Partial<CatalogueProduct> & Pick<CatalogueProduct, 'name' | 'unit' | 'rooms'>): CatalogueProduct => ({
    id: `p${++n}`,
    code: 'ONSITE',
    details: null,
    ratePaise: 100_00,
    defaultWidthMm: null,
    defaultHeightMm: null,
    defaultQty: null,
    inStandardBuild: true,
    isActive: true,
    sortOrder: n,
    rules: { sqft: 60 },
    ...over,
  });

  it('knows a kitchen-named product', () => {
    expect(namedRoomOf('False Ceiling (Kitchen)')?.test('Kitchen')).toBe(true);
  });

  it('sizes a standard "False Ceiling (Kitchen)" to the kitchen’s floor area', () => {
    const { lines } = planQuotation(
      { config: '2 BHK', kitchenRunMm: 3000, bathrooms: 1, study: false, planRooms: ROOMS },
      [p({ name: 'False Ceiling (Kitchen)', unit: 'SQFT', rooms: ['Kitchen'] })],
    );
    const kitchen = lines.filter((l) => l.room === 'Kitchen');
    expect(kitchen).toHaveLength(1);
    expect(kitchen[0]!.qtyMilli).toBe(areaSqft(ROOMS[3]!) * 1000);
  });

  it('sizes it through the room-wise toggle too, and leaves a kitchen wall product alone', () => {
    const { lines } = planQuotation(
      { config: '2 BHK', kitchenRunMm: 3000, bathrooms: 1, study: false, planRooms: ROOMS, falseCeiling: true },
      [
        p({ name: 'False Ceiling (Kitchen)', unit: 'SQFT', rooms: ['Kitchen'], inStandardBuild: false }),
        p({ name: 'Backsplash (Kitchen)', unit: 'SQFT', rooms: ['Kitchen'] }),
      ],
    );
    expect(lines.find((l) => l.product === 'False Ceiling (Kitchen)')!.qtyMilli).toBe(areaSqft(ROOMS[3]!) * 1000);
    expect(lines.find((l) => l.product === 'Backsplash (Kitchen)')!.qtyMilli).toBe(60_000);
  });
});
