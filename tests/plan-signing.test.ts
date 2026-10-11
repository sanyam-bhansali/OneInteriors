import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Signing builds the plan (studio workspace Phase 1): in the same
 * transaction that creates the customer's project, `signFinalQuote` writes
 * the five stages with their steps, the materials, and files the
 * agreement and the signed quotation in the Locker, shared. Everything it
 * did before — accepting the quote, the payment plan, the win, the audit
 * line, telling the studio — still happens. Prisma is mocked.
 */

type Call = { op: string; args: unknown };

const db = vi.hoisted(() => {
  const calls: Call[] = [];
  const rec = (op: string, ret: (args: never) => unknown = () => ({})) =>
    vi.fn(async (args: never) => {
      calls.push({ op, args });
      return ret(args);
    });
  const tx = {
    studioQuote: { update: rec('tx.studioQuote.update') },
    homeProject: { create: rec('tx.homeProject.create', () => ({ id: 'hp1' })) },
    homeProjectStage: { create: rec('tx.homeProjectStage.create', () => ({ id: 'st' })) },
    homeMaterial: { createMany: rec('tx.homeMaterial.createMany', () => ({ count: 0 })) },
    homeDocument: { createMany: rec('tx.homeDocument.createMany', () => ({ count: 2 })) },
    quoteDecision: { upsert: rec('tx.quoteDecision.upsert') },
    auditLog: { create: rec('tx.auditLog.create') },
  };
  const client = {
    brief: { findUnique: rec('brief.findUnique', () => ({ id: 'b1' })) },
    introduction: {
      findMany: rec('introduction.findMany', () => [{ id: 'i1' }]),
      findFirst: rec('introduction.findFirst', () => ({ id: 'i1', briefId: 'b1', homeProject: null })),
    },
    studioQuote: {
      findFirst: rec('studioQuote.findFirst', () => ({
        id: 'q1',
        introductionId: 'i1',
        studioId: 's1',
        number: 'AKA-2026-014',
        clientName: 'Priya',
        lines: [
          { id: 'l1', room: 'Kitchen', product: 'Base cabinets', details: 'Carcass and shutters', code: 'MODULAR' },
          { id: 'l2', room: 'Kitchen', product: 'Dado and backsplash tiling', details: null, code: 'ONSITE' },
          { id: 'l3', room: 'Bedroom 1', product: 'Wardrobe', details: null, code: 'MODULAR' },
          { id: 'l4', room: 'Whole home', product: 'Painting — putty, primer and two coats', details: null, code: 'ONSITE' },
          { id: 'l5', room: 'Whole home', product: 'Site supervision and project management', details: null, code: 'ONSITE' },
        ],
      })),
    },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  return { client, calls, tx };
});
vi.mock('@/lib/prisma', () => ({ prisma: db.client }));
vi.mock('@/modules/auth/session', () => ({ getCurrentUser: vi.fn(async () => ({ id: 'u-customer', role: 'CUSTOMER', phone: '+919800000000', name: 'Priya Rao' })) }));
const notifyStudio = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('@/modules/notify/service', () => ({ notify: vi.fn(async () => undefined), notifyStudio }));
vi.mock('@/modules/portal/plan-store', () => ({ tellOpsAssured: vi.fn(async () => undefined) }));

import { signFinalQuote, type FinalQuoteView } from '@/modules/portal/choose';
import { PLAN_KINDS } from '@/modules/portal/tracker';
import { templateFor } from '@/modules/project/step-template';

import { FILED_CONTENT_TYPE, generatedDocLink } from '@/modules/portal/documents';

const TOTAL = 18_40_000_01;

const view: FinalQuoteView = {
  id: 'q1',
  studioName: 'Teakline Studio',
  studioSlug: 'teakline',
  number: 'AKA-2026-014',
  issuedOn: null,
  accepted: false,
  rooms: [],
  lineCount: 5,
  workPaise: 0,
  feePaise: 0,
  discountPaise: 0,
  onSpotPaise: 0,
  onSpotLabel: null,
  beforeTaxPaise: 0,
  gstPaise: 0,
  totalPaise: TOTAL,
  terms: 'Fifty percent on signing.',
  handoverDays: 90,
  stages: [
    { label: 'At signing', pct: 40, amountPaise: 7_36_000_00 },
    { label: 'When finishing starts', pct: 40, amountPaise: 7_36_000_00 },
    { label: 'At handover', pct: 20, amountPaise: 3_68_000_01 },
  ],
  firstBeforeGstPaise: null,
};

const ops = (op: string) => db.calls.filter((c) => c.op === op);

beforeEach(() => {
  db.calls.length = 0;
  notifyStudio.mockClear();
});

describe('signing builds the plan', () => {
  it('signs, and writes everything inside the one transaction', async () => {
    const r = await signFinalQuote(view, 'basic');
    expect(r).toEqual({ ok: true, projectId: 'hp1' });
    expect(db.client.$transaction).toHaveBeenCalledTimes(1);
    // Nothing of the plan is written outside the transaction.
    expect(db.calls.filter((c) => !c.op.startsWith('tx.') && /create|update|upsert/.test(c.op))).toEqual([]);
  });

  it('keeps what signing always did', async () => {
    await signFinalQuote(view, 'assured');
    expect(ops('tx.studioQuote.update')[0]!.args).toMatchObject({ where: { id: 'q1' }, data: { status: 'ACCEPTED' } });
    const created = ops('tx.homeProject.create')[0]!.args as { data: Record<string, unknown> };
    expect(created.data).toMatchObject({ introductionId: 'i1', totalDays: 90, signedQuoteId: 'q1', contractPaise: BigInt(TOTAL) });
    expect(created.data.assuredRequestedAt).toBeInstanceOf(Date);
    expect(ops('tx.quoteDecision.upsert')).toHaveLength(1);
    expect(ops('tx.auditLog.create')[0]!.args).toMatchObject({ data: { action: 'quote.signed', entityId: 'q1' } });
    expect(notifyStudio).toHaveBeenCalledWith('s1', expect.objectContaining({ kind: 'quote-signed', quoteId: 'q1' }));
  });

  it('locks a payment plan that sums exactly to the contract, as the quote showed it', async () => {
    await signFinalQuote(view);
    const data = (ops('tx.homeProject.create')[0]!.args as { data: { paymentPhases: { label: string; pct: number | null; amountPaise: number }[] } }).data;
    expect(data.paymentPhases.reduce((a, s) => a + s.amountPaise, 0)).toBe(TOTAL);
    expect(data.paymentPhases.map((s) => s.label)).toEqual(['At signing', 'When finishing starts', 'At handover']);
  });

  it('writes the five stages, each with Hauspire’s steps, against the new project', async () => {
    await signFinalQuote(view);
    type Step = { room: string; label: string; quoteLineId: string | null; weightBp: number; inScope: boolean; plannedOn: Date | null };
    const stages = ops('tx.homeProjectStage.create').map((c) => (c.args as { data: { projectId: string; kind: string; items: { create: Step[] } } }).data);
    expect(stages.map((s) => s.kind)).toEqual([...PLAN_KINDS]);
    expect(stages.every((s) => s.projectId === 'hp1')).toBe(true);
    const steps = (k: string) => stages.find((s) => s.kind === k)!.items.create;
    expect(steps('DESIGN').map((i) => `${i.room}: ${i.label}`)).toEqual(['Design: Final design and drawings signed off']);
    expect(steps('CIVIL').map((i) => i.label)).toEqual(templateFor('CIVIL').map((t) => t.label));
    const all = stages.flatMap((s) => s.items.create);
    expect(all.reduce((a, i) => a + i.weightBp, 0)).toBe(10_000);
    expect(all.every((i) => i.inScope && i.quoteLineId === null && i.plannedOn instanceof Date)).toBe(true);
    // The handover stage ends on the planned handover, 90 days from today.
    const last = ops('tx.homeProjectStage.create').at(-1)!.args as { data: { plannedStart: Date; plannedEnd: Date } };
    const first = ops('tx.homeProjectStage.create')[0]!.args as { data: { plannedStart: Date } };
    expect(last.data.plannedEnd.getTime() - first.data.plannedStart.getTime()).toBe(90 * 86_400_000);
  });

  it('copies the materials, leaving out the service line', async () => {
    await signFinalQuote(view);
    const m = (ops('tx.homeMaterial.createMany')[0]!.args as { data: { projectId: string; item: string; spec: string | null }[] }).data;
    expect(m.map((x) => x.item)).toEqual(['Base cabinets', 'Dado and backsplash tiling', 'Wardrobe', 'Painting — putty, primer and two coats']);
    expect(m[0]).toMatchObject({ projectId: 'hp1', spec: 'Carcass and shutters' });
  });

  it('files the agreement and the signed quotation, shared with the customer, opening the signed quote', async () => {
    await signFinalQuote(view);
    const docs = (ops('tx.homeDocument.createMany')[0]!.args as { data: { projectId: string; kind: string; title: string; storageKey: string; contentType: string; sharedAt: Date | null; byStudio: boolean; uploadedById: string }[] }).data;
    expect(docs.map((d) => d.kind)).toEqual(['AGREEMENT', 'QUOTATION']);
    expect(docs.every((d) => d.projectId === 'hp1' && d.sharedAt instanceof Date && !d.byStudio && d.uploadedById === 'u-customer')).toBe(true);
    expect(docs.every((d) => d.contentType === FILED_CONTENT_TYPE)).toBe(true);
    expect(docs[1]!.title).toBe('Signed quotation AKA-2026-014');
    expect(generatedDocLink(docs[0]!.storageKey, 'https://oneinteriors.in')).toBe('https://oneinteriors.in/app/choose/quote/q1#agreed');
    expect(generatedDocLink(docs[1]!.storageKey, 'https://oneinteriors.in')).toBe('https://oneinteriors.in/app/choose/quote/q1');
  });

  it('signs nothing when writing the plan fails', async () => {
    db.tx.homeProjectStage.create.mockRejectedValueOnce(new Error('boom'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const r = await signFinalQuote(view);
    expect(r.ok).toBe(false);
    expect(notifyStudio).not.toHaveBeenCalled();
  });
});

describe('a filed document’s link', () => {
  it('is a stored file’s signed link otherwise', () => {
    expect(generatedDocLink('project_p1/abc.pdf', 'https://x.in')).toBeNull();
    expect(generatedDocLink('signed-quote:../../etc#agreement', 'https://x.in')).toBeNull();
  });
});
