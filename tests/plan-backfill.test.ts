import { describe, expect, it } from 'vitest';
import { backfillPlans, type BackfillDb } from '@/modules/portal/plan-backfill';
import { SIGNED_QUOTE_PREFIX } from '@/modules/portal/documents';

/**
 * The backfill (scripts/studio/build-plans.ts) against an in-memory fake
 * database: it builds each old project's plan once — from the signed quote
 * when there is one, from the old tracker when not — carries ticked stages
 * across, files the signed documents once, writes nothing on a dry run, and
 * writes nothing the second time.
 */

type Stage = { projectId: string; kind: string; actualEnd: Date | null; items: { create: { label: string; doneAt: Date | null }[] } };

function fakeDb() {
  const stages: Stage[] = [];
  const materials: { projectId: string; item: string }[] = [];
  const documents: { projectId: string; kind: string; storageKey: string; sharedAt: Date }[] = [];
  const projects = [
    {
      id: 'signed',
      startOn: new Date('2026-09-01T00:00:00Z'),
      totalDays: 100,
      doneStages: ['DESIGN'],
      signedAt: new Date('2026-09-01T10:00:00Z'),
      signedQuoteId: 'q1',
      contractPaise: BigInt(10_00_000_00),
      paymentPhases: [{ label: 'Booking', pct: 100, amountPaise: 10_00_000_00 }],
      introduction: { brief: { userId: 'u1' } },
    },
    {
      id: 'by-ops',
      startOn: new Date('2026-08-01T00:00:00Z'),
      totalDays: 60,
      doneStages: ['DESIGN', 'SITE'],
      signedAt: null,
      signedQuoteId: null,
      contractPaise: null,
      paymentPhases: null,
      introduction: { brief: { userId: 'u2' } },
    },
  ];
  const quotes: Record<string, unknown> = {
    q1: {
      id: 'q1',
      number: 'Q-1',
      lines: [
        { id: 'l1', room: 'Kitchen', product: 'Base cabinets', details: null, code: 'MODULAR' },
        { id: 'l2', room: 'Living', product: 'Painting — two coats', details: null, code: 'ONSITE' },
      ],
    },
  };
  const tx = {
    homeProjectStage: {
      count: async ({ where }: { where: { projectId: string } }) => stages.filter((s) => s.projectId === where.projectId).length,
      create: async ({ data }: { data: Stage }) => {
        stages.push(data);
        return { id: `st${stages.length}` };
      },
    },
    homeMaterial: {
      createMany: async ({ data }: { data: { projectId: string; item: string }[] }) => {
        materials.push(...data);
        return { count: data.length };
      },
    },
    homeDocument: {
      createMany: async ({ data }: { data: { projectId: string; kind: string; storageKey: string; sharedAt: Date }[] }) => {
        documents.push(...data);
        return { count: data.length };
      },
    },
  };
  const db = {
    homeProject: {
      findMany: async () =>
        projects
          .filter((p) => !stages.some((s) => s.projectId === p.id))
          .map((p) => ({ ...p, documents: documents.filter((d) => d.projectId === p.id && d.storageKey.startsWith(SIGNED_QUOTE_PREFIX)).map(() => ({ id: 'd' })) })),
    },
    studioQuote: { findUnique: async ({ where }: { where: { id: string } }) => quotes[where.id] ?? null },
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  };
  return { db: db as unknown as BackfillDb, stages, materials, documents };
}

const NOW = new Date('2026-10-11T06:00:00Z');

describe('the plan backfill', () => {
  it('writes nothing on a dry run, but says what it would', async () => {
    const f = fakeDb();
    const lines = await backfillPlans(f.db, { apply: false, now: NOW });
    expect(lines.map((l) => [l.projectId, l.source, l.written])).toEqual([
      ['signed', 'quote', false],
      ['by-ops', 'tracker', false],
    ]);
    expect(f.stages).toEqual([]);
    expect(f.materials).toEqual([]);
    expect(f.documents).toEqual([]);
  });

  it('builds each plan from the right source, carrying the ticked stages across', async () => {
    const f = fakeDb();
    const lines = await backfillPlans(f.db, { apply: true, now: NOW });
    expect(lines.every((l) => l.written)).toBe(true);

    const signed = f.stages.filter((s) => s.projectId === 'signed');
    expect(signed.map((s) => s.kind)).toEqual(['DESIGN', 'CIVIL', 'CARPENTRY', 'FINISH', 'HANDOVER']);
    expect(signed.find((s) => s.kind === 'CARPENTRY')!.items.create).toHaveLength(22); // Hauspire's steps, not the quote's lines
    expect(signed.map((s) => s.actualEnd !== null)).toEqual([true, false, false, false, false]);
    expect(f.materials.map((m) => [m.projectId, m.item])).toEqual([
      ['signed', 'Base cabinets'],
      ['signed', 'Painting — two coats'],
    ]);

    const byOps = f.stages.filter((s) => s.projectId === 'by-ops');
    expect(byOps.map((s) => s.actualEnd !== null)).toEqual([true, true, false, false, false]);
    expect(byOps.map((s) => s.items.create.length)).toEqual([1, 8, 22, 6, 7]);
    expect(byOps[1]!.items.create.every((i) => i.doneAt?.getTime() === byOps[1]!.actualEnd!.getTime())).toBe(true);
    expect(byOps[2]!.items.create.every((i) => !i.doneAt)).toBe(true);
  });

  it('files the agreement and quotation only for a project signed in the app, dated at signing', async () => {
    const f = fakeDb();
    await backfillPlans(f.db, { apply: true, now: NOW });
    expect(f.documents.map((d) => [d.projectId, d.kind])).toEqual([
      ['signed', 'AGREEMENT'],
      ['signed', 'QUOTATION'],
    ]);
    expect(f.documents[0]!.sharedAt).toEqual(new Date('2026-09-01T10:00:00Z'));
  });

  it('is idempotent: a second run finds nothing and writes nothing', async () => {
    const f = fakeDb();
    await backfillPlans(f.db, { apply: true, now: NOW });
    const counts = [f.stages.length, f.materials.length, f.documents.length];
    expect(await backfillPlans(f.db, { apply: true, now: NOW })).toEqual([]);
    expect([f.stages.length, f.materials.length, f.documents.length]).toEqual(counts);
  });

  it('skips a project another run planned in the meantime', async () => {
    const f = fakeDb();
    // A plan lands between this run's read and its write.
    const tx = { count: 0 };
    const original = f.db.$transaction.bind(f.db);
    (f.db as unknown as { $transaction: unknown }).$transaction = async (fn: never) => {
      if (tx.count++ === 0) f.stages.push({ projectId: 'signed', kind: 'DESIGN', actualEnd: null, items: { create: [] } });
      return (original as (fn: never) => Promise<unknown>)(fn);
    };
    const lines = await backfillPlans(f.db, { apply: true, now: NOW });
    expect(lines.find((l) => l.projectId === 'signed')!.written).toBe(false);
    expect(f.stages.filter((s) => s.projectId === 'signed')).toHaveLength(1);
    expect(f.documents).toEqual([]);
  });
});
