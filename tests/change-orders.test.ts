import { describe, expect, it } from 'vitest';
import {
  canMove,
  checkDeclineReason,
  checkExtraLines,
  customerSeesExtra,
  extraPaid,
  extrasOpen,
  extraTotals,
  releaseRefusal,
  sizeLabel,
  toCustomerExtra,
  type ProductForExtra,
} from '@/modules/project/change-order-rules';
import { closureTotals } from '@/modules/project/lifecycle-rules';

/**
 * Change orders (owner, 15 Oct 2026): extra work after design sign-off goes
 * to the client for approval, then payment, then the factory. The pure rules
 * (project/change-order-rules.ts) and the closure counting them once.
 */

const LOFT: ProductForExtra = { id: 'p-loft', name: 'Loft', code: 'MODULAR', unit: 'AREA', details: 'BWP ply, laminate', ratePaise: 1_200_00 };
const SKIRT: ProductForExtra = { id: 'p-skirt', name: 'Skirting', code: 'ONSITE', unit: 'RFT', details: null, ratePaise: 150_00 };
const PRODUCTS = new Map([LOFT, SKIRT].map((p) => [p.id, p]));

describe('the flow and who moves it', () => {
  it('goes draft → sent → approved → paid → released, each move by its own side', () => {
    expect(canMove('DRAFT', 'SENT_TO_CLIENT', 'studio')).toBe(true);
    expect(canMove('SENT_TO_CLIENT', 'APPROVED', 'customer')).toBe(true);
    expect(canMove('APPROVED', 'PAID', 'accounts')).toBe(true);
    expect(canMove('PAID', 'RELEASED', 'studio')).toBe(true);
  });

  it('never lets the studio approve for the client, or the client release', () => {
    expect(canMove('SENT_TO_CLIENT', 'APPROVED', 'studio')).toBe(false);
    expect(canMove('PAID', 'RELEASED', 'customer')).toBe(false);
    expect(canMove('DRAFT', 'APPROVED', 'customer')).toBe(false);
  });

  it('cannot skip payment: approved goes to paid, not released', () => {
    expect(canMove('APPROVED', 'RELEASED', 'studio')).toBe(false);
  });

  it('lets the studio take back a draft or an unanswered one, never an approved one', () => {
    expect(canMove('DRAFT', 'CANCELLED', 'studio')).toBe(true);
    expect(canMove('SENT_TO_CLIENT', 'CANCELLED', 'studio')).toBe(true);
    expect(canMove('APPROVED', 'CANCELLED', 'studio')).toBe(false);
  });

  it('is final once declined, released or cancelled', () => {
    for (const from of ['DECLINED', 'RELEASED', 'CANCELLED'] as const) {
      for (const to of ['SENT_TO_CLIENT', 'APPROVED', 'PAID', 'RELEASED'] as const) {
        for (const by of ['studio', 'customer', 'accounts'] as const) expect(canMove(from, to, by)).toBe(false);
      }
    }
  });

  it('opens after design sign-off and closes once the closure is fixed', () => {
    expect(extrasOpen('DESIGN', false).ok).toBe(false);
    expect(extrasOpen('EXECUTION', false).ok).toBe(true);
    expect(extrasOpen('CLOSURE', false).ok).toBe(true);
    expect(extrasOpen('CLOSURE', true).ok).toBe(false);
    expect(extrasOpen('SNAGS', false).ok).toBe(false);
  });
});

describe('the lines, priced like the quotation builder', () => {
  it('prices a W × H line from the product master in sq ft at the studio rate', () => {
    const r = checkExtraLines([{ productId: 'p-loft', room: 'Bedroom 2', widthMm: '1200', heightMm: '600' }], PRODUCTS);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const l = r.lines[0]!;
    expect(l).toMatchObject({ product: 'Loft', code: 'MODULAR', unit: 'AREA', widthMm: 1200, heightMm: 600, ratePaise: 1_200_00, room: 'Bedroom 2' });
    // 1200 × 600 mm = 7.75 sq ft (7750 thousandths) × ₹1,200 = ₹9,300.
    expect(l.amountPaise).toBe(9_300_00);
    expect(sizeLabel(l)).toBe('1200 × 600 mm');
  });

  it('prices running feet from the quantity typed', () => {
    const r = checkExtraLines([{ productId: 'p-skirt', qty: '12.5' }], PRODUCTS);
    expect(r.ok && r.lines[0]!.amountPaise).toBe(1_875_00);
    expect(r.ok && sizeLabel(r.lines[0]!)).toBe('12.5 rft');
  });

  it('never takes a rate, unit or name from the browser for a product line', () => {
    const r = checkExtraLines([{ productId: 'p-loft', widthMm: '1000', heightMm: '1000', ratePaise: 1, unit: 'UNIT', product: 'Cheap' }], PRODUCTS);
    expect(r.ok && r.lines[0]).toMatchObject({ product: 'Loft', unit: 'AREA', ratePaise: 1_200_00 });
  });

  it('takes a custom line with an amount, on-site unless said modular', () => {
    const r = checkExtraLines([{ description: 'Extra electrical point', amount: '2,500' }, { description: 'Glass shutter', amount: '8000', code: 'MODULAR' }], PRODUCTS);
    expect(r.ok && r.lines.map((l) => [l.product, l.code, l.amountPaise])).toEqual([
      ['Extra electrical point', 'ONSITE', 2_500_00],
      ['Glass shutter', 'MODULAR', 8_000_00],
    ]);
  });

  it('refuses a product no longer in the master, a missing size and an empty order', () => {
    expect(checkExtraLines([{ productId: 'gone', qty: '1' }], PRODUCTS).ok).toBe(false);
    expect(checkExtraLines([{ productId: 'p-loft', widthMm: '1200' }], PRODUCTS).ok).toBe(false);
    expect(checkExtraLines([], PRODUCTS).ok).toBe(false);
    expect(checkExtraLines([{ description: '', amount: '' }], PRODUCTS).ok).toBe(false);
    expect(checkExtraLines([{ description: 'Loft', amount: '-5' }], PRODUCTS).ok).toBe(false);
  });

  it('applies the quotation modular discount to modular lines only, then GST on the rest; no fee', () => {
    const r = checkExtraLines([{ productId: 'p-loft', widthMm: '1200', heightMm: '600' }, { description: 'Electrical point', amount: '700' }], PRODUCTS);
    if (!r.ok) throw new Error(r.error);
    const t = extraTotals(r.lines, { discountBps: 1000, gstBps: 1800 });
    expect(t.workPaise).toBe(10_000_00);
    expect(t.discountPaise).toBe(930_00); // 10% of the ₹9,300 loft only
    expect(t.gstPaise).toBe(1_633_00); // 18% of ₹9,070 = ₹1,632.60, to the rupee as the builder (22 Oct 2026)
    expect(t.totalPaise).toBe(10_703_00);
  });

  it('wants a reason to decline', () => {
    expect(checkDeclineReason('').ok).toBe(false);
    expect(checkDeclineReason('  no ').ok).toBe(false);
    expect(checkDeclineReason('Not now').ok).toBe(true);
    expect(checkDeclineReason('Too costly right now').ok).toBe(true);
  });
});

describe('paid and released', () => {
  it('counts recorded money (confirmed or waiting), never a disputed or replaced entry', () => {
    const p = extraPaid(12_000_00, [
      { amountPaise: 5_000_00, status: 'confirmed' },
      { amountPaise: 7_000_00, status: 'waiting' },
      { amountPaise: 9_000_00, status: 'replaced' },
    ]);
    expect(p).toMatchObject({ recordedPaise: 12_000_00, confirmedPaise: 5_000_00, openPaise: 0, covered: true, waiting: true, disputed: false });
    expect(extraPaid(12_000_00, [{ amountPaise: 12_000_00, status: 'disputed' }])).toMatchObject({ recordedPaise: 0, covered: false, disputed: true });
  });

  it('releases only once paid in full, with nothing disputed', () => {
    const full = extraPaid(100, [{ amountPaise: 100, status: 'waiting' }]);
    expect(releaseRefusal('PAID', full)).toBeNull();
    expect(releaseRefusal('APPROVED', full)).not.toBeNull();
    expect(releaseRefusal('PAID', extraPaid(100, [{ amountPaise: 60, status: 'confirmed' }]))).not.toBeNull();
    expect(releaseRefusal('PAID', extraPaid(100, [{ amountPaise: 100, status: 'confirmed' }, { amountPaise: 10, status: 'disputed' }]))).not.toBeNull();
    expect(releaseRefusal('RELEASED', full)).not.toBeNull();
  });
});

describe('what the client sees', () => {
  const row = {
    id: 'co1',
    number: 3,
    title: 'Loft in bedroom 2',
    reason: 'Asked for on the site visit',
    status: 'SENT_TO_CLIENT' as const,
    workPaise: 9_300_00,
    discountPaise: 930_00,
    gstBps: 1800,
    gstPaise: 1_506_60,
    totalPaise: 9_876_60,
    sentAt: '2026-10-15',
    decidedAt: null,
    declineReason: 'SECRET-REASON-not-yet',
    lines: [{ product: 'Loft', room: 'Bedroom 2', details: null, unit: 'AREA' as const, widthMm: 1200, heightMm: 600, qtyMilli: null, productId: 'p-loft-SECRET', amountPaise: 9_300_00 }],
    payments: [],
  };

  it('never shows a draft or a cancelled order', () => {
    expect(customerSeesExtra('DRAFT')).toBe(false);
    expect(customerSeesExtra('CANCELLED')).toBe(false);
    expect(toCustomerExtra({ ...row, status: 'DRAFT' }, true, null)).toBeNull();
  });

  it('lets only the owner answer an order waiting for them', () => {
    expect(toCustomerExtra(row, true, null)!.canAnswer).toBe(true);
    expect(toCustomerExtra(row, false, null)!.canAnswer).toBe(false);
    expect(toCustomerExtra({ ...row, status: 'APPROVED' }, true, null)!.canAnswer).toBe(false);
  });

  it('says what is due once approved, and nothing internal', () => {
    const out = toCustomerExtra({ ...row, status: 'APPROVED', payments: [{ amountPaise: 4_000_00, status: 'waiting' }] }, true, null)!;
    expect(out).toMatchObject({ state: 'approved', paidPaise: 4_000_00, duePaise: 5_876_60 });
    expect(out.lines[0]).toEqual({ product: 'Loft', room: 'Bedroom 2', details: null, size: '1200 × 600 mm', amountPaise: 9_300_00 });
    const json = JSON.stringify(out);
    expect(json).not.toContain('p-loft-SECRET');
    expect(json).not.toContain('SECRET-REASON');
    expect(json).not.toContain('productId');
  });
});

describe('the closure counts approved extra work once', () => {
  it('adds approved change orders (GST included) apart from its own lines, which carry their own GST', () => {
    const t = closureTotals({
      contractPaise: 10_00_000_00,
      changesPaise: 12_000_00,
      changeOrdersPaise: 9_876_60,
      lines: [{ kind: 'EXTRA', description: 'Extra paint', qtyMilli: null, ratePaise: null, amountPaise: 10_000_00, note: null }],
      gstBps: 1800,
      paidPaise: 0,
    });
    expect(t.changeOrdersPaise).toBe(9_876_60);
    expect(t.gstPaise).toBe(1_800_00);
    expect(t.totalPaise).toBe(10_00_000_00 + 12_000_00 + 9_876_60 + 10_000_00 + 1_800_00);
  });

  it('is unchanged for a closure with no change orders', () => {
    const t = closureTotals({ contractPaise: 100_00, changesPaise: 0, lines: [], gstBps: 1800, paidPaise: 0 });
    expect(t.changeOrdersPaise).toBe(0);
    expect(t.totalPaise).toBe(100_00);
  });
});
