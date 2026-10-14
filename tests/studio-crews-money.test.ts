import { describe, expect, it } from 'vitest';
import {
  canCorrect,
  canPayCrew,
  effectiveQty,
  labourSummary,
  lineAmount,
  lineAsQuoted,
  linePending,
  overQuote,
  parseQty,
  parseRupeesPaise,
  quickAmounts,
  workOrderMoney,
  type MoneyLine,
} from '@/modules/studio-crews/money';

const L = (over: Partial<MoneyLine> = {}): MoneyLine => ({
  ratePaise: 15_000,
  qtyMilli: 100_000,
  measuredQtyMilli: null,
  agreedPaise: null,
  isExtra: false,
  quotedAmountPaise: 5_000_000,
  ...over,
});

describe('a line', () => {
  it('rate × quantity, on the quoted quantity', () => {
    expect(lineAmount(L())).toBe(1_500_000);
  });
  it('measured beats quoted', () => {
    expect(effectiveQty(L({ measuredQtyMilli: 110_000 }))).toBe(110_000);
    expect(lineAmount(L({ measuredQtyMilli: 110_000 }))).toBe(1_650_000);
    expect(overQuote(L({ measuredQtyMilli: 110_000 }))).toBe(true);
    expect(overQuote(L({ measuredQtyMilli: 90_000 }))).toBe(false);
  });
  it('an agreed amount beats rate × quantity entirely', () => {
    expect(lineAmount(L({ agreedPaise: 1_200_000, measuredQtyMilli: 150_000 }))).toBe(1_200_000);
    expect(linePending(L({ ratePaise: null, qtyMilli: null, agreedPaise: 300_000 }))).toBeNull();
  });
  it('rounds once, half up, from thousandths', () => {
    expect(lineAmount(L({ ratePaise: 15_000, qtyMilli: 9_688 }))).toBe(145_320);
    expect(lineAmount(L({ ratePaise: 333, qtyMilli: 1_500 }))).toBe(500); // 499.5 → 500
  });
  it('needs a price, or a quantity; an unpriced line is ₹0 on the bill', () => {
    expect(linePending(L({ ratePaise: null }))).toBe('price');
    expect(linePending(L({ ratePaise: 0 }))).toBe('price');
    expect(linePending(L({ qtyMilli: null }))).toBe('qty');
    expect(lineAmount(L({ ratePaise: null }))).toBe(0);
  });
  it('a removed line counts for nothing', () => {
    expect(lineAmount(L({ removed: true }))).toBe(0);
    expect(linePending(L({ removed: true, ratePaise: null }))).toBeNull();
  });
  it('as quoted: the quotation’s own quantity; an extra was never quoted', () => {
    expect(lineAsQuoted(L({ measuredQtyMilli: 120_000 }))).toBe(1_500_000);
    expect(lineAsQuoted(L({ isExtra: true }))).toBe(0);
  });
});

describe('a work order’s money (never stored, always added up)', () => {
  const lines = [
    L({ measuredQtyMilli: 110_000 }), // ₹16,500 against ₹15,000 quoted
    L({ ratePaise: null, qtyMilli: null, quotedAmountPaise: 2_000_000 }), // to price
    L({ isExtra: true, ratePaise: null, qtyMilli: 1000, agreedPaise: 500_000, quotedAmountPaise: null }), // extra ₹5,000
  ];
  const m = workOrderMoney(lines, [{ amountPaise: 1_000_000 }]);
  it('bill, as quoted, extras and variance', () => {
    expect(m.billPaise).toBe(1_650_000 + 500_000);
    expect(m.asQuotedPaise).toBe(1_500_000);
    expect(m.extrasPaise).toBe(500_000);
    expect(m.variancePaise).toBe(150_000 + 500_000);
    expect(m.clientValuePaise).toBe(7_000_000);
  });
  it('paid and balance; pending lines counted', () => {
    expect(m.paidPaise).toBe(1_000_000);
    expect(m.balancePaise).toBe(1_150_000);
    expect(m.needPrice).toBe(1);
    expect(m.pendingLines).toBe(1);
    expect(m.settled).toBe(false);
  });
  it('a correction (negative row) reverses a payment', () => {
    const c = workOrderMoney([L()], [{ amountPaise: 500_000 }, { amountPaise: -500_000, kind: 'CORRECTION' }]);
    expect(c.paidPaise).toBe(0);
    expect(c.balancePaise).toBe(1_500_000);
  });
  it('settled within ₹1; an advance ahead of the bill shows as advance out', () => {
    expect(workOrderMoney([L()], [{ amountPaise: 1_499_950 }]).settled).toBe(true);
    const a = workOrderMoney([L({ ratePaise: null })], [{ amountPaise: 200_000, kind: 'ADVANCE' }]);
    expect(a.advanceOutPaise).toBe(200_000);
    expect(a.settled).toBe(false);
  });
});

describe('paying', () => {
  const money = { billPaise: 1_500_000, balancePaise: 1_000_000 };
  it('any amount up to the balance', () => {
    expect(canPayCrew(money, 1_000_000, 'PAYMENT', 2_500_000)).toEqual({ ok: true });
    expect(canPayCrew(money, 250_000, 'PAYMENT', 0)).toEqual({ ok: true });
  });
  it('₹1 of rounding is allowed, a rupee more is refused', () => {
    expect(canPayCrew(money, 1_000_100, 'PAYMENT', 0).ok).toBe(true);
    const r = canPayCrew(money, 1_000_101, 'PAYMENT', 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/more than the ₹10,000 outstanding/);
  });
  it('nothing, or a fraction of a paisa, is not a payment', () => {
    expect(canPayCrew(money, 0, 'PAYMENT', 0).ok).toBe(false);
    expect(canPayCrew(money, 10.5, 'PAYMENT', 0).ok).toBe(false);
  });
  it('an unpriced work order takes an advance, not a payment', () => {
    expect(canPayCrew({ billPaise: 0, balancePaise: 0 }, 100_000, 'PAYMENT', 2_500_000).ok).toBe(false);
    expect(canPayCrew({ billPaise: 0, balancePaise: 0 }, 2_500_000, 'ADVANCE', 2_500_000).ok).toBe(true);
    expect(canPayCrew({ billPaise: 0, balancePaise: 0 }, 2_500_200, 'ADVANCE', 2_500_000).ok).toBe(false);
  });
  it('an advance runs ahead of the bill by the limit, no further', () => {
    expect(canPayCrew(money, 3_500_000, 'ADVANCE', 2_500_000).ok).toBe(true);
    expect(canPayCrew(money, 3_500_101, 'ADVANCE', 2_500_000).ok).toBe(false);
    expect(canPayCrew({ billPaise: 1_000_000, balancePaise: -2_500_000 }, 100_000, 'ADVANCE', 2_500_000).ok).toBe(false);
  });
  it('quick amounts: full, half to the rupee, ₹25,000 never above the balance', () => {
    expect(quickAmounts(1_000_000)).toEqual([
      { label: 'Full balance', amountPaise: 1_000_000 },
      { label: 'Half', amountPaise: 500_000 },
    ]); // ₹25,000 capped at this balance is the full balance again: shown once
    expect(quickAmounts(10_000_000).map((q) => q.amountPaise)).toEqual([10_000_000, 5_000_000, 2_500_000]);
    expect(quickAmounts(333_333).find((q) => q.label === 'Half')!.amountPaise).toBe(166_700);
    expect(quickAmounts(50)).toEqual([]);
  });
  it('a payment is corrected once, and a correction never', () => {
    expect(canCorrect({ kind: 'PAYMENT', amountPaise: 100 }, false).ok).toBe(true);
    expect(canCorrect({ kind: 'PAYMENT', amountPaise: 100 }, true).ok).toBe(false);
    expect(canCorrect({ kind: 'CORRECTION', amountPaise: -100 }, false).ok).toBe(false);
  });
});

describe('labour against the contract', () => {
  const orders = [workOrderMoney([L({ measuredQtyMilli: 110_000 })], [{ amountPaise: 500_000 }])];
  it('expected, committed, paid and the margin', () => {
    const s = labourSummary(2_000_000, orders, 25);
    expect(s).toMatchObject({ expectedPaise: 1_500_000, committedPaise: 1_650_000, paidPaise: 500_000, marginPaise: 350_000, marginBp: 1750, warn: true });
  });
  it('no warning at or above the target; none without a contract', () => {
    expect(labourSummary(10_000_000, orders, 25).warn).toBe(false);
    expect(labourSummary(null, orders, 25)).toMatchObject({ marginPaise: null, warn: false });
  });
});

describe('typed figures', () => {
  it('quantities to thousandths', () => {
    expect(parseQty('34.5')).toBe(34_500);
    expect(parseQty('1,200')).toBe(1_200_000);
    expect(parseQty('0')).toBeNull();
    expect(parseQty('abc')).toBeNull();
  });
  it('rupees to paise, exactly', () => {
    expect(parseRupeesPaise('₹25,000')).toBe(2_500_000);
    expect(parseRupeesPaise('150.5')).toBe(15_050);
    expect(parseRupeesPaise('-5')).toBeNull();
    expect(parseRupeesPaise('')).toBeNull();
  });
});
