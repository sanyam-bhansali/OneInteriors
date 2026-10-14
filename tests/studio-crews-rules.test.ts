import { describe, expect, it } from 'vitest';
import { canRemoveOrder, canSwapCrew, checkStatus, nextNumber, statementWhatsApp, stripMoney, viewFor, type WorkOrderView } from '@/modules/studio-crews/rules';
import { readCrewSettings, checkCrewSettings, tradesFromForm, DEFAULTS } from '@/modules/studio-crews/settings';
import { execGate, execGateIndex, DEFAULT_EXEC_GATES } from '@/modules/studio-crews/exec-gates';
import { can, type StudioRoleName } from '@/modules/studio/roles';
import { mayOpen } from '@/modules/studio/surfaces';

const view: WorkOrderView = {
  id: 'wo1',
  number: 1,
  projectId: 'p1',
  projectName: 'Anita · Kumar Prospera, Baner, 3 BHK',
  vendorId: 'v1',
  crewName: 'Ramesh Kumar',
  crewPhone: '9823041127',
  trades: [{ key: 'carpentry', label: 'Carpentry' }],
  status: 'IN_PROGRESS',
  dueOn: '2026-11-26',
  archived: false,
  sourceKind: 'DESIGN_FINAL',
  stepIds: [],
  steps: [],
  workDoneAt: null,
  workDoneByName: null,
  createdByName: 'Meera',
  lines: [
    {
      id: 'l1',
      room: 'Master bedroom',
      product: 'Premium Shutter Wardrobe',
      code: 'MODULAR',
      widthMm: 3048,
      heightMm: 3048,
      trade: 'carpentry',
      tradeLabel: 'Carpentry',
      guessed: false,
      item: 'Modular installation',
      unit: 'SQFT',
      carpentry: 'INSTALL',
      qtyMilli: 100_000,
      measuredQtyMilli: 110_000,
      qtySource: 'SITE',
      isExtra: false,
      pending: null,
      overQuote: true,
      ratePaise: 15_000,
      rateEdited: false,
      agreedPaise: null,
      amountPaise: 1_650_000,
      quotedAmountPaise: 9_000_000,
    },
  ],
  needPrice: 0,
  needQty: 0,
  extras: 0,
  overQuoteLines: 1,
  paymentCount: 1,
  money: { billPaise: 1_650_000, asQuotedPaise: 1_500_000, extrasPaise: 0, variancePaise: 150_000, clientValuePaise: 9_000_000, paidPaise: 500_000, balancePaise: 1_150_000, advanceOutPaise: 0, settled: false },
  payments: [{ id: 'pay1', kind: 'PAYMENT', amountPaise: 500_000, mode: 'UPI', reference: 'UTR1', note: 'Running bill', paidOn: '2026-10-12', byName: 'Kavita', correctsId: null, corrected: false }],
};

/** Every number in a value, at any depth, under a money key. */
function moneyLeft(v: unknown, path = ''): string[] {
  if (v === null || typeof v !== 'object') return [];
  const out: string[] = [];
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (/paise|money|payments|rate/i.test(k) && x !== null && x !== undefined) out.push(`${path}.${k}`);
    out.push(...moneyLeft(x, `${path}.${k}`));
  }
  return out;
}

describe('the PM sees quantities only', () => {
  it('stripMoney takes out every rate, amount, client value, total and payment', () => {
    const pm = stripMoney(view);
    expect(moneyLeft(pm)).toEqual([]);
    expect(pm.lines[0]).toMatchObject({ qtyMilli: 100_000, measuredQtyMilli: 110_000, overQuote: true, item: 'Modular installation' });
  });
  it('viewFor strips for a member without workorder.money, keeps it for one with', () => {
    expect(viewFor(view, false).money).toBeNull();
    expect(viewFor(view, true)).toBe(view);
  });
  it('the roles: PM builds on their projects but never sees or moves money; accounts pays; supervisor reads', () => {
    const m = (role: StudioRoleName) => ({ role, status: 'ACTIVE' as const });
    expect(can(m('PM'), 'workorder.build', { assigned: true })).toBe(true);
    expect(can(m('PM'), 'workorder.build', { assigned: false })).toBe(false);
    expect(can(m('PM'), 'workorder.money', { assigned: true })).toBe(false);
    expect(can(m('PM'), 'crew.pay', { assigned: true })).toBe(false);
    expect(can(m('PM'), 'crew.edit')).toBe(false);
    expect(can(m('ACCOUNTS'), 'crew.pay')).toBe(true);
    expect(can(m('ACCOUNTS'), 'workorder.build', { assigned: true })).toBe(false);
    expect(can(m('ACCOUNTS'), 'vendor.rates')).toBe(false);
    expect(can(m('SUPERVISOR'), 'workorder.read', { assigned: true })).toBe(true);
    expect(can(m('SUPERVISOR'), 'workorder.money', { assigned: true })).toBe(false);
    for (const a of ['crew.list', 'crew.edit', 'workorder.read', 'workorder.build', 'workorder.money', 'crew.pay'] as const) expect(can(m('SALES'), a, { assigned: true })).toBe(false);
    // Lifecycle (owner, 13 Oct 2026): a designer sees the crews' money on the projects they design, read only.
    for (const a of ['workorder.read', 'workorder.money'] as const) {
      expect(can(m('DESIGNER'), a, { assigned: true }), a).toBe(true);
      expect(can(m('DESIGNER'), a, { assigned: false }), a).toBe(false);
    }
    for (const a of ['crew.list', 'crew.edit', 'workorder.build', 'crew.pay'] as const) expect(can(m('DESIGNER'), a, { assigned: true }), a).toBe(false);
    // Owner and accounts keep the money studio-wide; the PM still never has it.
    expect(can(m('OWNER'), 'workorder.money')).toBe(true);
    expect(can(m('ACCOUNTS'), 'workorder.money')).toBe(true);
  });
  it('screens: accounts opens the crews but not the owner’s labour page; the PM opens neither', () => {
    const m = (role: StudioRoleName) => ({ role, status: 'ACTIVE' as const });
    expect(mayOpen(m('ACCOUNTS'), '/studio/vendors/price')).toBe(true);
    expect(mayOpen(m('ACCOUNTS'), '/studio/vendors/labour')).toBe(false);
    expect(mayOpen(m('PM'), '/studio/vendors/pay')).toBe(false);
    expect(mayOpen(m('OWNER'), '/studio/vendors/labour')).toBe(true);
    expect(mayOpen(m('OWNER'), '/studio/settings/trades')).toBe(true);
    expect(mayOpen(m('PM'), '/studio/settings/trades')).toBe(false);
  });
});

describe('statuses', () => {
  const pm = { build: true, money: false };
  const acc = { build: false, money: true };
  it('the PM moves the work: issue, start, work done, reopen', () => {
    expect(checkStatus('DRAFT', 'ISSUED', pm, null).ok).toBe(true);
    expect(checkStatus('ISSUED', 'IN_PROGRESS', pm, null).ok).toBe(true);
    expect(checkStatus('IN_PROGRESS', 'WORK_DONE', pm, null).ok).toBe(true);
    expect(checkStatus('WORK_DONE', 'IN_PROGRESS', pm, null).ok).toBe(true);
    expect(checkStatus('DRAFT', 'WORK_DONE', pm, null).ok).toBe(false);
  });
  it('accounts cannot move the work, and the PM cannot settle', () => {
    expect(checkStatus('ISSUED', 'IN_PROGRESS', acc, null).ok).toBe(false);
    expect(checkStatus('WORK_DONE', 'SETTLED', pm, { settled: true }).ok).toBe(false);
  });
  it('settled only with no balance; reopened as work done', () => {
    expect(checkStatus('WORK_DONE', 'SETTLED', acc, { settled: false }).ok).toBe(false);
    expect(checkStatus('WORK_DONE', 'SETTLED', acc, { settled: true }).ok).toBe(true);
    expect(checkStatus('SETTLED', 'WORK_DONE', acc, null).ok).toBe(true);
    expect(checkStatus('SETTLED', 'IN_PROGRESS', acc, null).ok).toBe(false);
  });
});

describe('once anything is paid', () => {
  it('the crew cannot be swapped, and the work order cannot be removed (archive instead)', () => {
    expect(canSwapCrew(1, false).ok).toBe(false);
    expect(canSwapCrew(0, true).ok).toBe(false);
    expect(canSwapCrew(0, false).ok).toBe(true);
    expect(canRemoveOrder(1).ok).toBe(false);
    expect(canRemoveOrder(0).ok).toBe(true);
  });
  it('numbers run on per project', () => {
    expect(nextNumber([])).toBe(1);
    expect(nextNumber([1, 3, 2])).toBe(4);
  });
});

describe('the statement on WhatsApp', () => {
  it('opens the studio’s own WhatsApp to the crew’s number with the message', () => {
    expect(statementWhatsApp('98230 41127', 'Hi')).toBe('https://wa.me/919823041127?text=Hi');
    expect(statementWhatsApp(null, 'a b')).toBe('https://wa.me/?text=a%20b');
  });
});

describe('crew settings', () => {
  it('a missing or broken value reads as Hauspire’s defaults, field by field', () => {
    expect(readCrewSettings(null)).toEqual(DEFAULTS);
    const s = readCrewSettings({ trades: 'x', dueDays: 30, labourTargetPct: 500, routes: [{ match: 'keyword', text: 'jali', trade: 'fabrication' }, { text: 'x', trade: 'nope' }] });
    expect(s.trades.map((t) => t.key)).toContain('carpentry');
    expect(s.dueDays).toBe(30);
    expect(s.labourTargetPct).toBe(25);
    expect(s.routes).toEqual([{ match: 'keyword', text: 'jali', trade: 'fabrication' }]);
    expect(s.installRatePaise).toBe(15_000);
    expect(s.advanceLimitPaise).toBe(2_500_000);
  });
  it('a renamed trade keeps its key; a new one gets one', () => {
    const t = tradesFromForm([{ key: 'painting', label: 'Paint & polish', active: true }, { label: 'Tiles', active: true }], DEFAULTS.trades);
    expect(t).toEqual([
      { key: 'painting', label: 'Paint & polish', active: true },
      { key: 'tiles', label: 'Tiles', active: true },
    ]);
  });
  it('a trade in use cannot be removed', () => {
    const s = { ...DEFAULTS, trades: DEFAULTS.trades.filter((t) => t.key !== 'glass') };
    expect(checkCrewSettings(s, ['glass'])).toMatch(/Switch it off/);
    expect(checkCrewSettings(DEFAULTS, ['glass'])).toBeNull();
  });
});

describe('execution payment locks for the client', () => {
  const payments = [{ label: 'Booking advance' }, { label: 'Design advance' }, { label: 'Design closure' }, { label: 'Material procurement' }, { label: 'Material dispatch' }, { label: 'Project handover' }];
  it('Hauspire’s defaults: procurement opens "Material at site", dispatch opens "Shutters delivered"', () => {
    expect(execGateIndex({ label: 'Material at site: moulding, safety-door jali, ply', gatePayment: null }, DEFAULT_EXEC_GATES, payments)).toBe(3);
    expect(execGateIndex({ label: 'Shutters delivered', gatePayment: null }, DEFAULT_EXEC_GATES, payments)).toBe(4);
    expect(execGateIndex({ label: 'POP framing', gatePayment: null }, DEFAULT_EXEC_GATES, payments)).toBeNull();
  });
  it('a step’s own gate wins; no matching payment stage means no lock', () => {
    expect(execGateIndex({ label: 'Shutters delivered', gatePayment: 1 }, DEFAULT_EXEC_GATES, payments)).toBe(1);
    expect(execGateIndex({ label: 'Shutters delivered', gatePayment: null }, DEFAULT_EXEC_GATES, [{ label: 'Advance' }])).toBeNull();
  });
  it('locked until the payment is recorded (paid, or waiting for the client’s yes)', () => {
    const step = { label: 'Shutters delivered', gatePayment: null };
    const st = (state: 'paid' | 'waiting' | 'due' | 'later') => payments.map((p, index) => ({ index, label: p.label, state: index === 4 ? state : ('paid' as const) }));
    expect(execGate(step, DEFAULT_EXEC_GATES, payments, st('due'))).toEqual({ open: false, payment: 'Material dispatch' });
    expect(execGate(step, DEFAULT_EXEC_GATES, payments, st('waiting'))).toEqual({ open: true });
    expect(execGate(step, DEFAULT_EXEC_GATES, payments, st('paid'))).toEqual({ open: true });
    expect(execGate(step, DEFAULT_EXEC_GATES, payments, null)).toEqual({ open: true });
  });
});
