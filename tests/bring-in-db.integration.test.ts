import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * "Add an existing project" against the LOCAL throwaway test database only
 * (PGlite on 127.0.0.1:54329; docs/studio-os/BRING-IN-PROJECTS.md). Skipped
 * in the normal suite. Run on its own, never beside another DB script:
 *
 *   BRING_IN_TEST_DB=1 DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:54329/postgres?sslmode=disable&connection_limit=1&pgbouncer=true' \
 *     npx vitest run tests/bring-in-db.integration.test.ts
 *
 * Signs in as the seeded Hauspire owner (+919900000001, studio st-akara, Max)
 * by mocking the session, brings in one project through "build in our
 * builder" and one through the import, served by a tiny local stub that
 * answers like PostgREST with FAKE rows, and checks what was written.
 */

const RUN = process.env.BRING_IN_TEST_DB === '1';
const URL_OK = (process.env.DATABASE_URL ?? '').includes('127.0.0.1:54329');
if (RUN && !URL_OK) throw new Error('Test database only: DATABASE_URL must point at 127.0.0.1:54329.');

const who = vi.hoisted(() => ({ member: null as null | Record<string, unknown>, acting: null as null | { id: string; name: string } }));
vi.mock('@/modules/studio/access', async (orig) => ({ ...(await orig<object>()), currentMember: async () => who.member }));
vi.mock('@/modules/studio/lead-scope', async (orig) => ({ ...(await orig<object>()), actingMember: async () => who.acting }));

const STUDIO = 'st-akara';
const SLUG = 'hauspire-luxury-design-studio';
const rnd = () => `98${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;

// FAKE source rows, shaped like the Hauspire quotation app's `quotes` table.
const SRC_ID = `fa4e0000-0000-4000-8000-${String(Date.now()).slice(-12)}`;
const DESIGN_ID = `fa4e0001-0000-4000-8000-${String(Date.now()).slice(-12)}`;
const QNO = `T${String(Date.now()).slice(-5)}`;
const fakeLines = [
  { room: 'Kitchen', product: 'Base Cabinet', wc: 'MO-01', details: 'Test details', width: 2400, height: 600, rate: 1500, amount: 23250 },
  { room: 'Master Bedroom', product: 'Wardrobe (test)', wc: 'MO-01', details: '', width: 1800, height: 2100, rate: 1400, amount: 56950 },
  { room: 'Other Services', product: 'Painting (test)', wc: 'NM-01', details: '', sqft: 900, rate: 26.5, amount: 23850 },
];
const salesRow = { id: SRC_ID, quote_no: QNO, stage: 'sales', client_name: 'Test Import Client', location: 'Testnagar', bhk: '2 BHK', created_at: '2026-08-01T05:00:00Z', settings: { modularPct: 0.15, onSpot: 2000, onSpotLabel: 'On-spot discount', feeOn: true, gstOn: true, quoteDate: '2026-07-30' }, lines: fakeLines, tpv: 0 };
salesRow.tpv = 104050 + Math.round(104050 * 0.07) - Math.round(80200 * 0.15) - 2000;
const designRow = { ...salesRow, id: DESIGN_ID, stage: 'design', created_at: '2026-08-20T05:00:00Z', lines: [...fakeLines, { room: 'Living', product: 'TV Unit (test)', wc: 'MO-01', details: '', rft: 8, rate: 1200, amount: 9600 }] };

let server: Server;
let seen: string[] = [];

beforeAll(async () => {
  if (!RUN) return;
  server = createServer((req, res) => {
    seen.push(req.url ?? '');
    if (req.headers.apikey !== 'fake-read-key') {
      res.writeHead(401).end('[]');
      return;
    }
    const u = new URL(req.url ?? '/', 'http://x');
    const rows = u.searchParams.get('id') ? [salesRow] : u.searchParams.get('quote_no') ? [designRow, salesRow] : [salesRow, designRow];
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(rows));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  vi.stubEnv('HAUSPIRE_QUOTES_SUPABASE_URL', `http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  vi.stubEnv('HAUSPIRE_QUOTES_SUPABASE_KEY', 'fake-read-key');
  vi.stubEnv('HAUSPIRE_QUOTES_STUDIO_SLUG', SLUG);
});
afterAll(async () => {
  if (server) await new Promise((r) => server.close(r));
  vi.unstubAllEnvs();
});

describe.skipIf(!RUN)('bring in a running project (test database)', () => {
  it('signs in as the owner', async () => {
    const { prisma } = await import('@/lib/prisma');
    const owner = await prisma.studioMember.findFirst({ where: { studioId: STUDIO, role: 'OWNER', status: 'ACTIVE', user: { phone: '+919900000001' } }, select: { id: true, userId: true, studio: { select: { softwarePlan: true } } } });
    expect(owner?.studio.softwarePlan).toBe('MAX');
    who.member = { id: owner!.id, studioId: STUDIO, userId: owner!.userId, role: 'OWNER', status: 'ACTIVE', fullSoftware: true };
    who.acting = { id: owner!.id, name: 'Hauspire Owner' };
  });

  it('builder path: execution, steps done before joining, earlier payments, team', async () => {
    const { prisma } = await import('@/lib/prisma');
    const bi = await import('@/modules/studio-bring-in/bring-in');
    const designer = await prisma.studioMember.findFirst({ where: { studioId: STUDIO, role: 'DESIGNER', user: { phone: '+919900000005' } }, select: { id: true } });
    const stage = await prisma.studioStage.findFirst({ where: { studioId: STUDIO }, orderBy: { sortOrder: 'asc' }, select: { id: true } });
    const phone = rnd();
    const lead = await prisma.studioClient.create({ data: { studioId: STUDIO, stageId: stage!.id, name: 'Test Builder Client', phone, config: '3 BHK', source: 'OTHER' }, select: { id: true } });
    const quote = await prisma.studioQuote.create({
      data: {
        studioId: STUDIO,
        number: `TB-${phone.slice(-6)}`,
        clientName: 'Test Builder Client',
        clientId: lead.id,
        status: 'DRAFT',
        feeBps: 700,
        discountBps: 1500,
        bookingAdvancePaise: BigInt(0),
        lines: { create: [{ room: 'Kitchen', product: 'Base Cabinet', code: 'MODULAR', unit: 'UNIT', qtyMilli: 1000, ratePaise: BigInt(50_000_00), amountPaise: BigInt(50_000_00), sortOrder: 0 }, { room: 'Whole home', product: 'Painting', code: 'ONSITE', unit: 'UNIT', qtyMilli: 1000, ratePaise: BigInt(20_000_00), amountPaise: BigInt(20_000_00), sortOrder: 1 }] },
      },
      select: { id: true },
    });
    const ours = await bi.ourQuotesFor(lead.id);
    expect(ours.map((q) => q.id)).toContain(quote.id);
    const pv = await bi.planPreview({ quote: { kind: 'ours', quoteId: quote.id } });
    if (!pv.ok) throw new Error(pv.error);
    const pick = pv.preview.choices.EXECUTION.find((c) => c.stageKind === 'CARPENTRY')!;
    const r = await bi.bringIn({
      lead: { id: lead.id },
      quote: { kind: 'ours', quoteId: quote.id },
      confirmedTotalPaise: pv.preview.totalPaise,
      phase: 'EXECUTION',
      lastStep: pick.key,
      payments: [
        { stageIndex: 0, amountPaise: pv.preview.stages[0]!.amountPaise, receivedOn: '2026-08-01', mode: 'UPI' },
        { stageIndex: 1, amountPaise: 100_000, receivedOn: '2026-09-01', mode: 'BANK' },
      ],
      team: { designerId: designer!.id },
      inviteNow: false,
    });
    if (!r.ok) throw new Error(r.error);
    const p = await prisma.homeProject.findUnique({
      where: { id: r.projectId },
      select: {
        phase: true,
        designClosedAt: true,
        designerId: true,
        broughtInAt: true,
        signedQuoteId: true,
        team: { select: { memberId: true } },
        payments: { select: { beforeJoining: true, amountPaise: true } },
        stages: { orderBy: { sortOrder: 'asc' }, select: { kind: true, actualEnd: true, items: { select: { doneSource: true, donePhotoId: true, plannedOn: true, doneAt: true } } } },
        events: { select: { type: true } },
      },
    });
    expect(p?.phase).toBe('EXECUTION');
    expect(p?.designClosedAt).not.toBeNull();
    expect(p?.signedQuoteId).toBe(quote.id);
    expect(p?.designerId).toBe(designer!.id);
    expect(p?.team.map((t) => t.memberId)).toContain(designer!.id);
    expect(p?.broughtInAt).not.toBeNull();
    expect(p?.payments.every((x) => x.beforeJoining)).toBe(true);
    expect(p?.payments).toHaveLength(2);
    const [design, civil, carpentry, finish] = p!.stages;
    expect(design!.actualEnd).not.toBeNull();
    expect(civil!.actualEnd).not.toBeNull();
    expect(carpentry!.actualEnd).toBeNull();
    expect(carpentry!.items.filter((i) => i.doneSource === 'BEFORE_JOINING')).toHaveLength(1);
    expect(finish!.items.every((i) => i.doneAt === null)).toBe(true);
    expect(p!.stages.flatMap((s) => s.items).every((i) => i.donePhotoId === null)).toBe(true);
    // The first open step is planned for today.
    const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
    const open = p!.stages.flatMap((s) => s.items).filter((i) => !i.doneAt && i.plannedOn).map((i) => i.plannedOn!.toISOString().slice(0, 10)).sort();
    expect(open[0]).toBe(today);
    expect(p!.events.map((e) => e.type)).toEqual(expect.arrayContaining(['plan.created', 'project.brought_in', 'phase.changed', 'payment.recorded', 'designer.assigned']));
    // 'earlier': counted as paid without the client's confirmation.
    const { ledgerOf } = await import('@/modules/project/payments-flow');
    const money = await prisma.homeProject.findUnique({ where: { id: r.projectId }, select: { paymentPhases: true, paidPhases: true, payments: { select: { id: true, stageIndex: true, amountPaise: true, receivedOn: true, mode: true, receiptDocumentId: true, correctsId: true, recordedById: true, beforeJoining: true, recordedAt: true, customerConfirmedAt: true, disputedAt: true } }, quoteChanges: { select: { deltaPaise: true, stageIndex: true } } } });
    const l = ledgerOf(money!)!;
    expect(l.rows.every((x) => x.status === 'earlier')).toBe(true);
    expect(l.paidPaise).toBe(pv.preview.stages[0]!.amountPaise + 100_000);
    const booked = await prisma.studioClient.findUnique({ where: { id: lead.id }, select: { bookedIntroductionId: true, events: { where: { kind: 'BOOKED' }, select: { summary: true } } } });
    expect(booked?.bookedIntroductionId).not.toBeNull();
    expect(booked?.events[0]?.summary).toMatch(/Brought in as a running project/);
    // Twice is refused.
    const again = await bi.bringIn({ lead: { id: lead.id }, quote: { kind: 'ours', quoteId: quote.id }, confirmedTotalPaise: pv.preview.totalPaise, phase: 'DESIGN', lastStep: null, payments: [], team: {}, inviteNow: false });
    expect(again.ok).toBe(false);
  });

  it('import path: search, preview, a new lead, warranty, the design final', async () => {
    const { prisma } = await import('@/lib/prisma');
    const bi = await import('@/modules/studio-bring-in/bring-in');
    const found = await bi.searchSource(QNO);
    if (!found.ok) throw new Error(found.error);
    expect(found.matches.map((m) => m.number)).toContain(QNO);
    const pre = await bi.previewSource(SRC_ID);
    if (!pre.ok) throw new Error(pre.error);
    expect(pre.preview.quote.lines).toHaveLength(3);
    expect(pre.preview.design?.lines).toBe(4);
    expect(pre.preview.quote.differencePaise).toBe(0);
    const pv = await bi.planPreview({ quote: { kind: 'import', sourceId: SRC_ID }, config: '2 BHK' });
    if (!pv.ok) throw new Error(pv.error);
    const phone = rnd();
    const dup = await bi.leadOnMobile(phone);
    expect(dup.ok && dup.match).toBeNull();
    const r = await bi.bringIn({
      lead: { name: 'Test Import Client', phone, society: 'Test Society A-101', locality: 'Testnagar', config: '2 BHK' },
      quote: { kind: 'import', sourceId: SRC_ID },
      confirmedTotalPaise: pv.preview.totalPaise,
      phase: 'WARRANTY',
      lastStep: null,
      handoverOn: '2026-09-15',
      payments: pv.preview.stages.map((s, i) => ({ stageIndex: i, amountPaise: s.amountPaise, receivedOn: '2026-09-10', mode: 'BANK' })),
      team: {},
      inviteNow: false,
    });
    if (!r.ok) throw new Error(r.error);
    const p = await prisma.homeProject.findUnique({
      where: { id: r.projectId },
      select: { phase: true, warrantyEndsOn: true, handoverSignedAt: true, closedOutAt: true, broughtInFrom: true, designFinalQuoteId: true, signedQuoteId: true, stages: { select: { actualEnd: true, items: { select: { doneSource: true } } } } },
    });
    expect(p?.phase).toBe('WARRANTY');
    expect(p?.warrantyEndsOn?.toISOString().slice(0, 10)).toBe('2027-09-14');
    expect(p?.closedOutAt).not.toBeNull();
    expect(p?.broughtInFrom).toBe(QNO);
    expect(p!.stages.every((s) => s.actualEnd !== null)).toBe(true);
    expect(p!.stages.flatMap((s) => s.items).every((i) => i.doneSource === 'BEFORE_JOINING')).toBe(true);
    const q = await prisma.studioQuote.findUnique({ where: { id: p!.signedQuoteId! }, select: { number: true, importedFrom: true, feeBps: true, discountBps: true, gstBps: true, onSpotPaise: true, quoteDate: true, salesFinalRevisionId: true, lines: { orderBy: { sortOrder: 'asc' }, select: { product: true, unit: true, widthMm: true, amountPaise: true, code: true } } } });
    expect(q).toMatchObject({ number: QNO, importedFrom: `hauspire:${SRC_ID}`, feeBps: 700, discountBps: 1500, gstBps: 1800, onSpotPaise: BigInt(200_000) });
    expect(q?.quoteDate?.toISOString().slice(0, 10)).toBe('2026-07-30');
    expect(q?.salesFinalRevisionId).not.toBeNull();
    expect(q?.lines.map((l) => [l.product, l.unit, Number(l.amountPaise)])).toEqual([
      ['Base Cabinet', 'AREA', 2_325_000],
      ['Wardrobe (test)', 'AREA', 5_695_000],
      ['Painting (test)', 'SQFT', 2_385_000],
    ]);
    const df = await prisma.studioQuote.findUnique({ where: { id: p!.designFinalQuoteId! }, select: { stage: true, basedOnId: true, _count: { select: { lines: true } } } });
    expect(df).toMatchObject({ stage: 'DESIGN', basedOnId: p!.signedQuoteId, _count: { lines: 4 } });
    // The stub saw only reads with the key, never a write.
    expect(seen.every((u) => u.startsWith('/rest/v1/quotes?select='))).toBe(true);
    seen = [];
  });

  it('a designer may bring in; sales and supervisors may not', async () => {
    const bi = await import('@/modules/studio-bring-in/bring-in');
    const saved = who.member;
    who.member = { ...saved, role: 'SALES' };
    expect(await bi.bringInContext()).toBeNull();
    who.member = { ...saved, role: 'DESIGNER' };
    const ctx = await bi.bringInContext();
    expect(ctx?.canImport).toBe(true);
    expect(ctx?.canBuild).toBe(false);
    who.member = saved;
  });
});
