import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { calendarKpis, chatKpis, designKpis, documentKpis, moneyKpis, projectKpis, quoteKpis, vendorKpis } from '@/modules/studio/app-kpis';
import { byDesigner, designerChoices, NO_DESIGNER, pickDesigner } from '@/modules/studio/designer-filter';

/** The KPI row at the top of every app, and projects by designer (owner, 1 Nov 2026). */

const card = (o: Partial<{ lateDays: number; blocker: { side: 'client' | 'studio' } | null; snags: unknown[] }> = {}) => ({ lateDays: 0, blocker: null, snags: [], ...o });
const row = (o: Partial<{ lateDays: number; customerLateDays: number; waiting: { overdue: boolean }[]; nextPayment: { amountPaise: number; toRecord: boolean } | null }> = {}) => ({
  lateDays: 0,
  customerLateDays: 0,
  waiting: [],
  nextPayment: null,
  ...o,
});
const val = (k: { label: string; value: number | string }[], label: string) => k.find((x) => x.label === label)?.value;

describe('Projects', () => {
  const board = { design: [card({ lateDays: 2 }), card()], execution: [card()], snags: [card({ snags: [1, 2] })], closures: [1] };
  const rows = [
    row({ lateDays: 3, customerLateDays: 3 }),
    row({ lateDays: 2, customerLateDays: 0, waiting: [{ overdue: true }] }),
    row({ nextPayment: { amountPaise: 2_500_000, toRecord: true } }),
    row({ nextPayment: { amountPaise: 900_000, toRecord: false } }),
  ];

  it('counts each phase, what is late and on whom, what waits on clients, what is due', () => {
    const k = projectKpis({ board, rows, money: true, tab: 'design' });
    expect(k.map((x) => x.label)).toEqual(['In design', 'In execution', 'Snags', 'Running late', 'Waiting on clients', 'Payments due']);
    expect(k[0]).toMatchObject({ value: 2, note: '1 running late', href: '/studio/projects?tab=design', active: true });
    expect(k[1]!.note).toBe('1 closure to do');
    expect(k[2]!.note).toBe('2 open snags');
    expect(k[3]).toMatchObject({ value: 2, note: '1 on us', tone: 'bad' });
    expect(k[4]).toMatchObject({ value: 1, note: '1 decision past the date' });
    expect(k[5]).toMatchObject({ value: '₹25,000', note: 'on 1 project' });
  });

  it('counts payments instead of rupees for whoever sees no money', () => {
    expect(val(projectKpis({ board: null, rows, money: false }), 'Payments due')).toBe(1);
    expect(projectKpis({ board: null, rows, money: false }).map((x) => x.label)).toEqual(['Running late', 'Waiting on clients', 'Payments due']);
  });

  it('the Design tab: in design, late, on clients, on us, designers', () => {
    const k = designKpis({ board: { design: [card({ lateDays: 1, blocker: { side: 'client' } }), card({ blocker: { side: 'studio' } })], closures: [] }, designers: [{ projects: [] }], unassigned: 1 });
    expect(k.map((x) => [x.label, x.value])).toEqual([
      ['In design', 2],
      ['Running late', 1],
      ['Waiting on clients', 1],
      ['On us', 1],
      ['Designers', 1],
    ]);
    expect(k[4]!.note).toBe('1 project with no designer');
  });
});

describe('the other apps', () => {
  it('Quotations: by status, the money waiting and won, the win rate', () => {
    const now = new Date('2026-11-01T10:00:00Z');
    const q = (status: 'DRAFT' | 'ISSUED' | 'ACCEPTED' | 'DECLINED', totalPaise: number, daysAgo = 1) => ({ status, stage: 'SALES', totalPaise, updatedAt: new Date(now.getTime() - daysAgo * 86_400_000) });
    const k = quoteKpis([q('DRAFT', 0), q('ISSUED', 50_000_000), q('ACCEPTED', 80_000_000, 20), q('ACCEPTED', 20_000_000, 30), q('DECLINED', 10, 9)], now, 'ISSUED');
    expect(k.map((x) => [x.label, x.value])).toEqual([
      ['Quotations', 5],
      ['Drafts', 1],
      ['Sent', 1],
      ['Won', 2],
      ['Lost', 1],
      ['Win rate', '67%'],
    ]);
    expect(k[0]!.note).toBe('2 worked on this week');
    expect(k[2]).toMatchObject({ note: '₹5 L waiting', active: true, href: '/studio/quotations?status=ISSUED' });
    expect(k[3]!.note).toBe('₹10 L');
  });

  it('Documents: adds the folders up', () => {
    const f = { documents: 4, approved: 2, waiting: 1, changes: 1, finals: 2 };
    expect(documentKpis([f, { ...f, documents: 0, approved: 0, waiting: 0, changes: 0, finals: 0 }]).map((x) => x.value)).toEqual([2, 4, 1, 1, 2, 2]);
  });

  it('Money, Vendors: rupees, in lakhs once they are large', () => {
    const k = moneyKpis({ owedPaise: 250_000_000, waitingPaise: 0, disputed: 1, projects: 3, receivedThisMonthPaise: 1_000_000, bookings: 0, finals: 1 });
    expect(k[0]!.value).toMatch(/L|Cr/);
    expect(k[1]!.value).toBe('₹10,000');
    expect(k[3]).toMatchObject({ value: 1, tone: 'bad' });
    expect(vendorKpis({ crews: 2, trades: 1, kycMissing: 0, openOrders: 3, billedPaise: 0, owedPaise: 500 }).map((x) => x.label)).toEqual(['Crews', 'Open work orders', 'Billed', 'To pay', 'KYC missing']);
  });

  it('Calendar: today, the week, meetings, tasks and what is late, answers owed', () => {
    const i = (kind: string, day: string, o: { overdue?: boolean; done?: boolean } = {}) => ({ kind, day, overdue: o.overdue ?? false, done: o.done ?? false });
    const k = calendarKpis([i('meeting', '2026-11-01'), i('task', '2026-11-01', { overdue: true }), i('task', '2026-11-03'), i('followup', '2026-11-02', { done: true })], '2026-11-01', 2);
    expect(k.map((x) => [x.label, x.value])).toEqual([
      ['Today', 2],
      ['This week', 3],
      ['Meetings', 1],
      ['Tasks', 2],
      ['To answer', 2],
    ]);
    expect(k[3]!.note).toBe('1 overdue');
  });

  it('Chats: unread, waiting for a reply, active today (by the IST day)', () => {
    const k = chatKpis(
      [
        { unread: 3, last: { at: '2026-10-31T20:00:00.000Z', mine: false } },
        { unread: 0, last: { at: '2026-10-30T10:00:00.000Z', mine: true } },
        { unread: 0, last: null },
      ],
      '2026-11-01',
    );
    expect(k.map((x) => [x.label, x.value])).toEqual([
      ['Conversations', 3],
      ['Unread', 3],
      ['Waiting for a reply', 1],
      ['Active today', 1],
    ]);
  });
});

describe('projects by designer', () => {
  const cards = [
    { designerId: 'm2', designer: 'Renuka' },
    { designerId: 'm1', designer: 'Gunjan' },
    { designerId: 'm1', designer: 'Gunjan' },
    { designerId: null, designer: null },
  ];

  it('offers each designer on the board, by name, then nobody', () => {
    expect(designerChoices(cards)).toEqual([
      { id: 'm1', name: 'Gunjan', projects: 2 },
      { id: 'm2', name: 'Renuka', projects: 1 },
      { id: NO_DESIGNER, name: 'No designer yet', projects: 1 },
    ]);
  });

  it('takes only a designer it offers, and keeps their projects', () => {
    const c = designerChoices(cards);
    expect(pickDesigner('m1', c)).toBe('m1');
    expect(pickDesigner('someone-else', c)).toBeNull();
    expect(pickDesigner(undefined, c)).toBeNull();
    expect(cards.filter((x) => byDesigner(x.designerId, 'm1'))).toHaveLength(2);
    expect(cards.filter((x) => byDesigner(x.designerId, NO_DESIGNER))).toHaveLength(1);
    expect(cards.filter((x) => byDesigner(x.designerId, null))).toHaveLength(4);
  });

  it('only a board of every project offers it (owner, PM, design head)', () => {
    for (const page of ['src/app/studio/projects/page.tsx', 'src/app/studio/design/page.tsx']) expect(readFileSync(page, 'utf8')).toMatch(/scope === 'studio' \? designerChoices\(/);
  });
});

describe('every app opens on its numbers', () => {
  it.each([
    ['src/app/studio/projects/page.tsx', 'projectKpis('],
    ['src/app/studio/design/page.tsx', 'designKpis('],
    ['src/app/studio/quotations/page.tsx', 'quoteKpis('],
    ['src/app/studio/documents/page.tsx', 'documentKpis('],
    ['src/app/studio/payments/page.tsx', 'moneyKpis('],
    ['src/app/studio/vendors/page.tsx', 'vendorKpis('],
    ['src/app/studio/calendar/page.tsx', 'calendarKpis('],
    ['src/app/studio/chats/page.tsx', 'chatKpis('],
  ])('%s', (file, fn) => {
    const src = readFileSync(file, 'utf8');
    expect(src).toContain('<KpiRow');
    expect(src).toContain(fn);
  });
});
