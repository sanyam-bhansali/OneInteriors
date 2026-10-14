import { beforeEach, describe, expect, it, vi } from 'vitest';
import { changesFromRows, checkNewDecision, legacyOptionsJson, pickAllowed, pickChanges, priceChange } from '@/modules/project/decision-rules';
import { customerChoices, customerPayments, customerLedger } from '@/modules/portal/money-locker-view';
import { CUSTOMER_PROJECT_SELECT } from '@/modules/portal/customer-project-view';
import { makeDb, type FakeDb } from './phase5-fake-db';

/**
 * Decisions (studio workspace Phase 5): a pick changes the quote, the final
 * payment amount and the locker's material entry with nobody retyping; the
 * studio's cost per option never reaches the customer; family vote and the
 * owner's pick decides; a late first pick is the customer's delay.
 */

const NOW = new Date('2026-10-11T08:00:00Z');

const input = (over: Record<string, unknown> = {}) => ({
  title: 'Kitchen shutter finish',
  why: 'Shutters are cut next week; a late pick moves carpentry.',
  dueOn: '2026-10-16',
  quoteLineId: 'ql-shutters',
  options: [
    { label: 'Sage matte laminate', detail: 'As quoted', delta: '0', studioCost: '0' },
    { label: 'Walnut grain', detail: 'Warm wood look', delta: '14,000', studioCost: '9,800' },
    { label: 'Plain white', detail: 'A little cheaper', delta: '-2,500', studioCost: '-1,900' },
  ],
  ...over,
});

describe('a new decision, checked', () => {
  it('reads rupees as typed, negative price changes, and the studio cost separately', () => {
    const r = checkNewDecision(input(), NOW);
    expect(r.ok).toBe(true);
    const v = r.ok ? r.value : null;
    expect(v!.options.map((o) => [o.label, o.deltaPaise, o.studioCostDeltaPaise])).toEqual([
      ['Sage matte laminate', 0, 0],
      ['Walnut grain', 14_000_00, 9_800_00],
      ['Plain white', -2_500_00, -1_900_00],
    ]);
    expect(v!.quoteLineId).toBe('ql-shutters');
  });

  it('wants two or three named options, a date not past, and the late text', () => {
    expect(checkNewDecision(input({ options: [{ label: 'Only one' }] }), NOW).ok).toBe(false);
    expect(checkNewDecision(input({ options: [{ label: 'a' }, { label: 'b' }, { label: 'c' }, { label: 'd' }] }), NOW).ok).toBe(false);
    expect(checkNewDecision(input({ dueOn: '2026-10-10' }), NOW).ok).toBe(false);
    expect(checkNewDecision(input({ why: 'soon' }), NOW).ok).toBe(false);
    expect(checkNewDecision(input({ options: [{ label: 'A', delta: 'lots' }, { label: 'B' }] }), NOW)).toEqual({ ok: false, error: 'The price change on “A” is not an amount.' });
  });

  it('writes the older options JSON without any studio cost, and never below zero', () => {
    const r = checkNewDecision(input(), NOW);
    const json = legacyOptionsJson(r.ok ? r.value.options : []);
    expect(json).toEqual([
      { name: 'Sage matte laminate', note: 'As quoted', extraPaise: 0, swatch: null },
      { name: 'Walnut grain', note: 'Warm wood look', extraPaise: 14_000_00, swatch: null },
      { name: 'Plain white', note: 'A little cheaper', extraPaise: 0, swatch: null },
    ]);
    expect(JSON.stringify(json)).not.toMatch(/studioCost|9800|980000/);
  });
});

describe('what a pick writes to the quote', () => {
  const base = { decisionId: 'd1', title: 'Shutter finish', quoteLineId: 'ql1', finalStageIndex: 2, at: NOW };
  const walnut = { id: 'o2', label: 'Walnut', deltaPaise: 14_000_00 };
  const white = { id: 'o3', label: 'White', deltaPaise: -2_500_00 };

  it('a first pick is one change on the final stage', () => {
    expect(pickChanges({ ...base, previous: null, next: walnut })).toEqual([
      { decisionId: 'd1', optionId: 'o2', quoteLineId: 'ql1', label: 'Shutter finish: Walnut', deltaPaise: 14_000_00, stageIndex: 2, at: NOW },
    ]);
  });

  it('a re-pick reverses the old one (kept in the record) and adds the new; the sum is the new price', () => {
    const rows = pickChanges({ ...base, previous: walnut, next: white });
    expect(rows.map((r) => [r.label, r.deltaPaise])).toEqual([
      ['Shutter finish: Walnut, changed', -14_000_00],
      ['Shutter finish: White', -2_500_00],
    ]);
    expect(rows[1]!.at.getTime()).toBeGreaterThan(rows[0]!.at.getTime());
    const all = [...pickChanges({ ...base, previous: null, next: walnut }), ...rows];
    expect(all.reduce((s, r) => s + r.deltaPaise, 0)).toBe(-2_500_00);
    expect(changesFromRows(all.map((r, i) => ({ id: `q${i}`, decisionId: 'd1', label: r.label, deltaPaise: r.deltaPaise, at: r.at, decisionTitle: 'Shutter finish', optionLabel: null })))).toEqual({
      totalPaise: -2_500_00,
      items: [{ decisionId: 'd1', title: 'Shutter finish', option: 'White', extraPaise: -2_500_00, chosenAt: rows[1]!.at.toISOString() }],
    });
  });

  it('re-picking the same option writes nothing', () => {
    expect(pickChanges({ ...base, previous: walnut, next: walnut })).toEqual([]);
  });

  it('a first pick after the date is taken and marked late; a made pick is fixed after the date', () => {
    const due = new Date('2026-10-09T18:29:59Z');
    expect(pickAllowed({ dueOn: due, pickedOptionId: null }, NOW)).toEqual({ ok: true, late: true });
    expect(pickAllowed({ dueOn: due, pickedOptionId: 'o1' }, NOW).ok).toBe(false);
    expect(pickAllowed({ dueOn: new Date('2026-10-20T00:00:00Z'), pickedOptionId: 'o1' }, NOW)).toEqual({ ok: true, late: false });
  });

  it('says price changes the Indian way', () => {
    expect([priceChange(14_000_00), priceChange(-2_500_00), priceChange(0)]).toEqual(['+₹14,000', '−₹2,500', 'As quoted']);
  });
});

describe('the studio cost never reaches the customer', () => {
  it('the options the customer gets carry no studio cost, by key or value', () => {
    const out = customerChoices(
      [
        { id: 'o1', label: 'Walnut', detail: null, photoPath: 'site-photos/SECRET.jpg', swatch: null, deltaPaise: BigInt(14_000_00), studioCostDeltaPaise: BigInt(9_800_77) } as never,
      ],
      ['https://signed/o1'],
    );
    expect(out).toEqual([{ id: 'o1', label: 'Walnut', detail: null, photo: 'https://signed/o1', swatch: null, deltaPaise: 14_000_00 }]);
    expect(JSON.stringify(out)).not.toMatch(/980077|studioCost|SECRET/);
  });

  it('the projection never selects it', () => {
    const select = CUSTOMER_PROJECT_SELECT.decisions.select.choices.select as Record<string, unknown>;
    expect(select.studioCostDeltaPaise).toBeUndefined();
    expect(Object.keys(select).sort()).toEqual(['deltaPaise', 'detail', 'id', 'label', 'photoPath', 'sortOrder', 'swatch']);
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
const sent = vi.hoisted(() => ({ customer: [] as unknown[], studio: [] as unknown[] }));
vi.mock('@/modules/notify/service', () => ({
  notify: vi.fn(async (_u: string, e: unknown) => void sent.customer.push(e)),
  notifyStudio: vi.fn(async (_s: string, e: unknown) => void sent.studio.push(e)),
  notifyOps: vi.fn(async () => undefined),
}));
vi.mock('@/modules/storage/project-docs', () => ({ signedDocUrls: vi.fn(async (k: string[]) => k.map(() => '')), storeProjectDoc: vi.fn(async () => ({ ok: true, path: 'doc.pdf' })) }));
vi.mock('@/modules/storage/site-photos', () => ({
  signedSitePhotoUrls: vi.fn(async (p: string[]) => p.map((x) => `https://signed/${x}`)),
  storeSitePhoto: vi.fn(async () => ({ ok: true, path: 'project_p1/option.jpg' })),
}));

import { castVote, createDecision, expireDecisions, pickOption, studioDecisions } from '@/modules/project/decision-flow';
import { ledgerOf } from '@/modules/project/payments-flow';

let db: FakeDb;
const as = (id: string, role = 'STUDIO') => {
  current.user = { id, role };
};
const money = () => ledgerOf({ ...db.s.project, payments: db.s.payments, quoteChanges: db.s.quoteChanges } as never)!;

beforeEach(() => {
  vi.stubEnv('DATABASE_URL', 'postgres://test');
  vi.stubEnv('SAMPLE_DATA_ONLY', '');
  db = makeDb();
  current.db = db;
  sent.customer.length = sent.studio.length = 0;
});

async function newDecision(): Promise<{ id: string; options: string[] }> {
  as('u-pm');
  const photo = new File(['jpg'], 'walnut.jpg', { type: 'image/jpeg' });
  const r = await createDecision('p1', input(), [null, photo, null], NOW);
  if (!r.ok) throw new Error(r.error);
  return { id: r.id!, options: db.s.options.map((o) => o.id as string) };
}

describe('the pick, end to end', () => {
  it('a PM asks: rows for the options (with studio cost), the older JSON without it, the customer told', async () => {
    const d = await newDecision();
    expect(db.s.options.map((o) => [o.label, o.deltaPaise, o.studioCostDeltaPaise, o.photoPath])).toEqual([
      ['Sage matte laminate', BigInt(0), BigInt(0), null],
      ['Walnut grain', BigInt(14_000_00), BigInt(9_800_00), 'project_p1/option.jpg'],
      ['Plain white', BigInt(-2_500_00), BigInt(-1_900_00), null],
    ]);
    expect(JSON.stringify(db.s.decisions[0]!.options)).not.toContain('980000');
    expect(db.s.events.map((e) => e.type)).toEqual(['decision.posted']);
    expect(sent.customer).toEqual([{ kind: 'decision-posted', decisionId: d.id, title: 'Kitchen shutter finish', dueLabel: 'Fri 16 Oct' }]);
  });

  it('the customer picks: the quote, the final payment and the locker change, nobody retyping', async () => {
    const d = await newDecision();
    const before = money();
    expect(before.stages[2]!.amountPaise).toBe(2_00_000_00);
    as('u-cust', 'CUSTOMER');
    expect(await pickOption('u-cust', d.id, { optionId: d.options[1] }, NOW)).toMatchObject({ ok: true, id: d.id });

    // The quote: one recorded change, on the final stage.
    expect(db.s.quoteChanges).toMatchObject([{ decisionId: d.id, optionId: d.options[1], quoteLineId: 'ql-shutters', label: 'Kitchen shutter finish: Walnut grain', stageIndex: 2 }]);
    expect(db.s.quoteChanges[0]!.deltaPaise).toBe(BigInt(14_000_00));
    // The final payment.
    const after = money();
    expect(after.stages[2]!.amountPaise).toBe(2_14_000_00);
    expect(after.totalPaise).toBe(10_14_000_00);
    expect(after.stages[0]!.amountPaise).toBe(before.stages[0]!.amountPaise);
    // The locker: the material entry for that quote line, and the outcome filed.
    expect(db.s.materials.find((m) => m.quoteLineId === 'ql-shutters')!.spec).toBe('Walnut grain (Warm wood look)');
    expect(db.s.materials.find((m) => m.quoteLineId === 'ql-hinges')!.spec).toBe('Soft-close');
    expect(db.s.documents).toMatchObject([{ storageKey: `decision:${d.id}`, title: 'Your choice: Kitchen shutter finish, Walnut grain (+₹14,000)', version: 1 }]);
    // The decision row, both ways, and the events.
    expect(db.s.decisions[0]).toMatchObject({ pickedOptionId: d.options[1], chosenIndex: 1, chosenById: 'u-cust' });
    expect(db.s.events.map((e) => e.type)).toEqual(['decision.posted', 'quote.changed', 'document.filed', 'decision.picked']);
    // The studio is told.
    expect(sent.studio).toEqual([{ kind: 'decision-made', decisionId: d.id, title: 'Kitchen shutter finish', choice: 'Walnut grain', extraPaise: 14_000_00 }]);
    // On time: no date moved.
    expect(db.s.dateChanges).toEqual([]);
  });

  it('a re-pick before the date keeps the old line and reverses it; the payment follows; the outcome is a new version', async () => {
    const d = await newDecision();
    await pickOption('u-cust', d.id, { optionId: d.options[1] }, NOW);
    expect(await pickOption('u-cust', d.id, { optionId: d.options[2] }, NOW)).toMatchObject({ ok: true });
    expect(db.s.quoteChanges.map((q) => [q.label, q.deltaPaise])).toEqual([
      ['Kitchen shutter finish: Walnut grain', BigInt(14_000_00)],
      ['Kitchen shutter finish: Walnut grain, changed', BigInt(-14_000_00)],
      ['Kitchen shutter finish: Plain white', BigInt(-2_500_00)],
    ]);
    expect(money().stages[2]!.amountPaise).toBe(1_97_500_00);
    expect(db.s.materials[0]!.spec).toBe('Plain white (A little cheaper)');
    expect(db.s.documents.map((x) => [x.version, x.supersedesId])).toEqual([
      [1, null],
      [2, db.s.documents[0]!.id],
    ]);
  });

  it('only the owner of the brief picks; an old app picks by index', async () => {
    const d = await newDecision();
    expect(await pickOption('u-fam', d.id, { optionId: d.options[1] }, NOW)).toEqual({ ok: false, error: 'That decision is not on your project.' });
    expect(await pickOption('u-cust', d.id, { index: 7 }, NOW)).toEqual({ ok: false, error: 'Pick one of the options.' });
    expect(await pickOption('u-cust', d.id, { index: 0 }, NOW)).toMatchObject({ ok: true });
    expect(db.s.decisions[0]!.pickedOptionId).toBe(d.options[0]);
  });

  it('family vote by option; the owner’s pick decides; no votes once decided', async () => {
    const d = await newDecision();
    expect(await castVote('u-fam', d.id, { optionId: d.options[2] }, 'cheaper is fine', NOW)).toMatchObject({ ok: true });
    expect(await castVote('u-fam', d.id, { optionId: d.options[1] }, null, NOW)).toMatchObject({ ok: true });
    expect(db.s.votes).toEqual([expect.objectContaining({ userId: 'u-fam', optionId: d.options[1], optionIndex: 1, note: null })]);
    expect(await castVote('u-stranger', d.id, { optionId: d.options[1] }, null, NOW)).toEqual({ ok: false, error: 'Only family on this project can vote.' });
    await pickOption('u-cust', d.id, { optionId: d.options[0] }, NOW);
    expect(db.s.decisions[0]!.pickedOptionId).toBe(d.options[0]);
    expect(await castVote('u-fam', d.id, { optionId: d.options[2] }, null, NOW)).toEqual({ ok: false, error: 'This one has been decided.' });
    as('u-owner');
    const view = await studioDecisions('p1', NOW);
    expect(view!.decisions[0]!.options.map((o) => o.votes)).toEqual([0, 1, 0]);
  });

  it('a first pick after the date moves the plan by the working days late, as the customer’s delay', async () => {
    const d = await newDecision();
    // Picked on Wed 21 Oct, decide-by was Fri 16 Oct: Sat 17, Mon 19, Tue 20, Wed 21 = 4 working days (Mon–Sat).
    const late = new Date('2026-10-21T06:00:00Z');
    const r = await pickOption('u-cust', d.id, { optionId: d.options[1] }, late);
    expect(r).toMatchObject({ ok: true, message: 'Picked 4 working days after the date, so the plan moves by that much.' });
    // The stage holding the shutters (carpentry) and the handover after it, both named on the decision.
    expect(db.s.dateChanges.map((c) => [c.stageId, c.field, c.reason, c.decisionId])).toEqual([
      ['st-carp', 'PLANNED_END', 'CUSTOMER_CHANGE', d.id],
      ['st-hand', 'PLANNED_START', 'CUSTOMER_CHANGE', d.id],
      ['st-hand', 'HANDOVER', 'CUSTOMER_CHANGE', d.id],
    ]);
    expect(db.s.events.some((e) => e.type === 'date.moved' && e.payload.customer === true)).toBe(true);
    // Fixed once past the date.
    expect(await pickOption('u-cust', d.id, { optionId: d.options[0] }, late)).toMatchObject({ ok: false });
  });

  it('a decision left past its date is expired once, and the studio told', async () => {
    const d = await newDecision();
    db.s.decisions[0]!.dueOn = new Date('2026-10-09T18:29:59Z');
    expect(await expireDecisions(NOW)).toBe(1);
    expect(await expireDecisions(NOW)).toBe(0);
    expect(sent.studio).toEqual([{ kind: 'decision-expired', decisionId: d.id, title: 'Kitchen shutter finish', projectId: 'p1' }]);
  });

  it('the studio sees its cost per option only with decision.create; the customer projection never', async () => {
    await newDecision();
    as('u-owner');
    expect((await studioDecisions('p1', NOW))!.decisions[0]!.options[1]!.studioCostDeltaPaise).toBe(9_800_00);
    as('u-sup');
    expect((await studioDecisions('p1', NOW))!.decisions[0]!.options.every((o) => o.studioCostDeltaPaise === null)).toBe(true);
    const choices = customerChoices(db.s.options as never);
    expect(JSON.stringify(choices)).not.toMatch(/980000|190000|studioCost/);
  });
});

describe('the customer sees the money the pick moved', () => {
  it('the payments block shows the final stage with the change on it', () => {
    const l = customerLedger({
      paymentPhases: [
        { label: 'Booking', pct: 50, amountPaise: 5_00_000_00 },
        { label: 'Handover', pct: 50, amountPaise: 5_00_000_00 },
      ],
      payments: [],
      quoteChanges: [{ id: 'q1', label: 'Shutter: Walnut', deltaPaise: BigInt(14_000_00), stageIndex: 1 }],
    });
    const p = customerPayments(l, [], true, new Set());
    expect(p!.stages[1]).toMatchObject({ amountPaise: 5_14_000_00, changesPaise: 14_000_00 });
    expect(p!.totalPaise).toBe(10_14_000_00);
  });
});
