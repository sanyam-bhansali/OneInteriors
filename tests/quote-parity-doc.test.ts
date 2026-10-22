import { describe, expect, it } from 'vitest';
import { docColours, docRooms, docStages, docUnitsText, donutPalette, hauspireWords, HAUSPIRE_COLOURS, HAUSPIRE_DONUT, type DocLineInput } from '@/modules/studio-quote/document';
import { computeTotals } from '@/modules/studio-quote/pricing';
import { HAUSPIRE_TEMPLATE } from '@/modules/studio-sales/payment-template';
import { n } from '@/app/studio/quotations/doc/QuotationDocument';
import { oldFmt } from '@/modules/studio-quote/hauspire-calc';
import { compareLines, sizeText, type CompareLine } from '@/modules/studio-quote/compare-lines';
import { withRepricing, type SizedLine } from '@/modules/studio-quote/line-edit';
import { nextQuoteNumber } from '@/modules/studio-quote/quotes';

/**
 * The PDF and the builder against Hauspire's quotation app (owner, 22 Oct
 * 2026: "Export as PDF exactly as the old app made it"; the builder "exactly
 * similar"). Fake lines only.
 */

const L = (over: Partial<DocLineInput>): DocLineInput => ({ room: 'Kitchen', product: 'X', code: 'MODULAR', unit: 'AREA', details: null, widthMm: 1200, heightMm: 600, qtyMilli: null, amountPaise: 1_000_000, ...over });

describe('the PDF rows, as PrintDocument printed them', () => {
  it('Units only on a per-unit line; blank on W × H, sq ft, running ft and an amount on its own', () => {
    expect(docUnitsText(L({ unit: 'UNIT', qtyMilli: 3000 }))).toBe('3');
    expect(docUnitsText(L({ unit: 'SQFT', qtyMilli: 120_000 }))).toBe('');
    expect(docUnitsText(L({ unit: 'RFT', qtyMilli: 12_000 }))).toBe('');
    expect(docUnitsText(L({ unit: 'AREA' }))).toBe('');
    expect(docUnitsText(L({ unit: 'UNIT', qtyMilli: null }))).toBe('');
  });

  it('every MO-01 line struck through even with no discount; widths as typed', () => {
    const rooms = docRooms([L({}), L({ code: 'ONSITE', unit: 'UNIT', widthMm: null, heightMm: null, qtyMilli: 1000 })], ['Kitchen'], 0);
    expect(rooms[0]!.rows.map((r) => r.modular)).toEqual([true, false]);
    expect(rooms[0]!.rows[0]!.discountedPaise).toBe(1_000_000);
    expect(rooms[0]!.rows[1]!.widthMm).toBeNull();
  });

  it('figures print as Math.round(n).toLocaleString("en-IN"): 0 is "0", paise round', () => {
    for (const p of [0, 12_345_678_00, 85_085, 99_950, 1_00_00_000_00]) expect(n(p)).toBe(oldFmt(p / 100));
  });

  it('Hauspire’s maroon gives the old app’s colours and donut exactly; others work from their accent', () => {
    expect(docColours('#531220')).toMatchObject({ band: HAUSPIRE_COLOURS.brand, head: HAUSPIRE_COLOURS.light, tint: HAUSPIRE_COLOURS.band, line: HAUSPIRE_COLOURS.line });
    expect(docColours('#7a2a3a').band).toBe('#531220');
    expect(donutPalette('#531220', 3)).toEqual(HAUSPIRE_DONUT.slice(0, 3));
    expect(docColours('#1F5C4D').band).not.toBe(HAUSPIRE_COLOURS.brand);
  });

  it('the stages in the old app’s words and bold, amounts as it rounds them', () => {
    const totals = computeTotals([{ unit: 'UNIT', code: 'ONSITE', ratePaise: 95_823_300, qtyMilli: 1000 }], { feeBps: 0, discountBps: 0, bookingAdvancePaise: 2_500_000 });
    const stages = docStages(HAUSPIRE_TEMPLATE, totals);
    expect(stages.map((s) => s.label)).toEqual([
      'Booking Advance (Fully refundable within 3 days)',
      'Design Advance (5%)',
      'Design Closure (10%)',
      'Material Procurement (40%)',
      'Material Dispatch (40%)',
      'Project Handover (5%)',
    ]);
    expect(stages.map((s) => s.amountPaise / 100)).toEqual([25_000, 46_662, 93_323, 373_293, 373_293, 46_662]);
    expect(stages[0]!.deliverable).toContain('**Mood Board, 2D Layout and Furniture Layout**');
  });

  it('a stage a studio reworded prints as they wrote it', () => {
    expect(hauspireWords('Design advance', 'Our own words.')).toEqual({ label: 'Design Advance', note: 'Our own words.' });
    expect(hauspireWords('Token', 'Anything')).toEqual({ label: 'Token', note: 'Anything' });
  });
});

const C = (over: Partial<CompareLine>): CompareLine => ({ room: 'Kitchen', product: 'Wall Cabinets', code: 'MODULAR', unit: 'AREA', widthMm: 2400, heightMm: 600, qtyMilli: null, amountPaise: 3_900_000, ...over });

describe('the Final tab, as lib/compare.ts', () => {
  it('size text', () => {
    expect(sizeText(C({}))).toBe('2400×600');
    expect(sizeText(C({ unit: 'SQFT', qtyMilli: 34_390, widthMm: null, heightMm: null }))).toBe('34.39 sqft');
    expect(sizeText(C({ unit: 'UNIT', qtyMilli: 5000, widthMm: null, heightMm: null }))).toBe('5 unit');
    expect(sizeText(null)).toBe('—');
  });
  it('matches room + product, n-th with n-th; new, changed, removed', () => {
    const rows = compareLines(
      [C({}), C({ product: 'Mirror', unit: 'UNIT', qtyMilli: 1000, widthMm: null, heightMm: null, amountPaise: 800_000 }), C({ product: 'Vertical' })],
      [C({ heightMm: 697, amountPaise: 4_600_000 }), C({ product: ' mirror ', unit: 'UNIT', qtyMilli: 1000, widthMm: null, heightMm: null, amountPaise: 800_000 }), C({ product: 'Loft' })],
    );
    expect(rows.map((r) => [r.product, r.status])).toEqual([
      ['Wall Cabinets', 'changed'],
      [' mirror ', 'same'],
      ['Loft', 'added'],
      ['Vertical', 'removed'],
    ]);
  });
});

describe('editing a line, as the old table setField', () => {
  const agreed: SizedLine = { unit: 'AREA', ratePaise: 258_000, widthMm: 1500, heightMm: 2100, qtyMilli: null, agreedPaise: 8_000_000 };
  it('a new size re-prices a line with a rate, over a typed amount', () => {
    expect(withRepricing(agreed, { widthMm: 1800 }).agreedPaise).toBeNull();
    expect(withRepricing({ ...agreed, unit: 'UNIT', qtyMilli: 1000, widthMm: null, heightMm: null }, { qtyMilli: 2000 }).agreedPaise).toBeNull();
  });
  it('a line without a rate keeps its amount; so does a half-typed W × H', () => {
    expect(withRepricing({ ...agreed, ratePaise: 0 }, { widthMm: 1800 }).agreedPaise).toBe(8_000_000);
    expect(withRepricing(agreed, { widthMm: null }).agreedPaise).toBe(8_000_000);
    expect(withRepricing(agreed, { agreedPaise: 7_000_000 }).agreedPaise).toBe(7_000_000);
  });
});

describe('quotation numbers', () => {
  it('a studio on Hauspire’s running series carries on from the highest', () => {
    expect(nextQuoteNumber(2026, ['2300', '2412', '2412-D', '2026-001'])).toBe('2413');
    expect(nextQuoteNumber(2026, ['2026-004', '17'])).toBe('2026-005');
  });
});

describe('terms sub-points (Hauspire’s terms, 5 Sep 2026)', () => {
  it('a bullet written indented prints as a sub-point', async () => {
    const { parseTerms } = await import('@/modules/studio-quote/document');
    const blocks = parseTerms('* Not included:\n  * Electrical fittings, lights, fans\n* Final measurements');
    expect(blocks).toEqual([
      { kind: 'bullet', text: 'Not included:' },
      { kind: 'bullet', text: 'Electrical fittings, lights, fans', sub: true },
      { kind: 'bullet', text: 'Final measurements' },
    ]);
  });
});
