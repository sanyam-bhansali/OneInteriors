import { describe, it, expect } from 'vitest';
import {
  workOrderMoney,
  canPay,
  byVendor,
  stageSplit,
  ledgerLineAmount,
  type LedgerLine,
} from '@/modules/studio-practice/ledger';
import { rupeesToPaise } from '@/lib/money';

const R = rupeesToPaise;

function line(rupees: number, qty = 1): LedgerLine {
  return { unit: 'UNIT', ratePaise: R(rupees), qtyMilli: qty * 1000 };
}

describe('ledgerLineAmount', () => {
  it('prices a measured quantity', () => {
    expect(ledgerLineAmount({ unit: 'SQFT', ratePaise: R(150), qtyMilli: 120_500 })).toBe(R(18_075));
  });

  it('lets an agreed figure override the rate', () => {
    expect(
      ledgerLineAmount({ unit: 'SQFT', ratePaise: R(150), qtyMilli: 120_500, amountPaise: R(18_000) }),
    ).toBe(R(18_000));
  });

  it('is zero for an unmeasured line', () => {
    expect(ledgerLineAmount({ unit: 'SQFT', ratePaise: R(150) })).toBe(0);
  });
});

describe('workOrderMoney', () => {
  it('computes bill, paid and balance', () => {
    const money = workOrderMoney([line(40_000), line(15_000)], [{ amountPaise: R(20_000) }]);
    expect(money.billPaise).toBe(R(55_000));
    expect(money.paidPaise).toBe(R(20_000));
    expect(money.balancePaise).toBe(R(35_000));
    expect(money.settled).toBe(false);
  });

  it('settles when the balance reaches zero', () => {
    const money = workOrderMoney([line(10_000)], [{ amountPaise: R(10_000) }]);
    expect(money.balancePaise).toBe(0);
    expect(money.settled).toBe(true);
    expect(money.overpaidPaise).toBe(0);
  });

  it('reports an overpayment rather than hiding it', () => {
    // Clamping the balance at zero would conceal a double payment, which is
    // exactly the mistake this table exists to make visible.
    const money = workOrderMoney([line(10_000)], [{ amountPaise: R(10_000) }, { amountPaise: R(2_500) }]);
    expect(money.balancePaise).toBe(R(-2_500));
    expect(money.overpaidPaise).toBe(R(2_500));
    expect(money.settled).toBe(true);
  });

  it('treats an empty order as settled and owing nothing', () => {
    const money = workOrderMoney([], []);
    expect(money.billPaise).toBe(0);
    expect(money.balancePaise).toBe(0);
    expect(money.settled).toBe(true);
  });
});

describe('canPay', () => {
  const money = workOrderMoney([line(50_000)], [{ amountPaise: R(20_000) }]);

  it('accepts a payment within the balance', () => {
    expect(canPay(money, R(30_000))).toEqual({ ok: true });
    expect(canPay(money, R(1))).toEqual({ ok: true });
  });

  it('refuses more than is outstanding, and says by how much', () => {
    const result = canPay(money, R(30_001));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('₹30,000');
  });

  it('refuses zero and negative', () => {
    expect(canPay(money, 0).ok).toBe(false);
    expect(canPay(money, R(-500)).ok).toBe(false);
  });

  it('refuses a payment against an order with no work on it', () => {
    expect(canPay(workOrderMoney([], []), R(1_000))).toEqual({
      ok: false,
      error: 'Add what the work is before paying for it.',
    });
  });

  it('refuses anything once settled', () => {
    const settled = workOrderMoney([line(10_000)], [{ amountPaise: R(10_000) }]);
    const result = canPay(settled, R(100));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('This work order is already settled.');
  });

  it('formats large outstanding figures in lakh', () => {
    const big = workOrderMoney([line(400_000)], []);
    const result = canPay(big, R(500_000));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('₹4L');
  });
});

describe('byVendor', () => {
  const orders = [
    {
      vendorId: 'v1', vendorName: 'Ramesh Carpentry', trade: 'Carpentry',
      lines: [line(80_000)], payments: [{ amountPaise: R(30_000) }],
    },
    {
      vendorId: 'v1', vendorName: 'Ramesh Carpentry', trade: 'Carpentry',
      lines: [line(20_000)], payments: [],
    },
    {
      vendorId: 'v2', vendorName: 'Sai Painting', trade: 'Painting',
      lines: [line(15_000)], payments: [{ amountPaise: R(15_000) }],
    },
  ];

  it('rolls several orders up per vendor', () => {
    const [first] = byVendor(orders);
    expect(first!.vendorId).toBe('v1');
    expect(first!.billPaise).toBe(R(100_000));
    expect(first!.paidPaise).toBe(R(30_000));
    expect(first!.balancePaise).toBe(R(70_000));
    expect(first!.openOrders).toBe(2);
  });

  it('sorts by what is owed, because that is the decision being made', () => {
    const rows = byVendor(orders);
    expect(rows.map((r) => r.vendorId)).toEqual(['v1', 'v2']);
    expect(rows[1]!.balancePaise).toBe(0);
    expect(rows[1]!.openOrders).toBe(0);
  });
});

describe('stageSplit', () => {
  it('splits so the parts sum to the whole, exactly', () => {
    // 100000/3 does not divide. The remainder lands on the last part rather
    // than vanishing — three thirds that do not add up to the order is the
    // argument nobody wants to have on site.
    const parts = stageSplit(R(1_000), 3);
    expect(parts).toHaveLength(3);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(R(1_000));
    expect(parts.every((p) => Number.isInteger(p))).toBe(true);
  });

  it('handles a single stage and a zero order', () => {
    expect(stageSplit(R(500), 1)).toEqual([R(500)]);
    expect(stageSplit(0, 3)).toEqual([0, 0, 0]);
    expect(stageSplit(R(500), 0)).toEqual([]);
  });
});
