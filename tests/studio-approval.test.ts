import { describe, it, expect } from 'vitest';
import { approvalBlockers, quotationsSent } from '@/modules/studio/approval';
import { MIN_QUOTATIONS_FOR_RATES } from '@/modules/quotation/catalogue';

const READY = { quotationsRead: MIN_QUOTATIONS_FOR_RATES, liveRates: 24, productMaster: 40 };

describe('when a studio may be approved', () => {
  it(`is approvable with ${MIN_QUOTATIONS_FOR_RATES} quotations read, live rates and a product master`, () => {
    expect(approvalBlockers(READY)).toEqual([]);
  });

  it('is not approvable on fewer quotations, however good the rates look', () => {
    const b = approvalBlockers({ ...READY, quotationsRead: MIN_QUOTATIONS_FOR_RATES - 1 });
    expect(b).toHaveLength(1);
    expect(b[0]).toContain(`${MIN_QUOTATIONS_FOR_RATES - 1} of their quotations`);
  });

  it('is not approvable without approved rates or a product master', () => {
    expect(approvalBlockers({ ...READY, liveRates: 0 })[0]).toContain('No rates');
    expect(approvalBlockers({ ...READY, productMaster: 0 })[0]).toContain('product master');
  });

  it('names every reason at once for a studio with nothing in', () => {
    expect(approvalBlockers({ quotationsRead: 0, liveRates: 0, productMaster: 0 })).toHaveLength(3);
  });
});

describe('quotations sent', () => {
  it('counts what was read, and a file per quotation until it has been', () => {
    expect(quotationsSent([{ quotationCount: 45, fileCount: 2 }, { quotationCount: null, fileCount: 12 }])).toBe(57);
    expect(quotationsSent([])).toBe(0);
  });
});
