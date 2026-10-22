import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ACCENT,
  STAGES_NOTE,
  boldSegments,
  coverFacts,
  docColours,
  docDate,
  docHead,
  docRooms,
  docStages,
  donutPalette,
  parseTerms,
  quoteFileName,
  roomShares,
  safeAccent,
  specHasBrands,
  type DocLineInput,
} from '@/modules/studio-quote/document';
import { computeTotals } from '@/modules/studio-quote/pricing';
import { HAUSPIRE_TEMPLATE } from '@/modules/studio-sales/payment-template';

/** The quotation PDF in the owner's sample format (13 Oct 2026). */

const line = (room: string, product: string, code: 'MODULAR' | 'ONSITE', amountPaise: number, extra: Partial<DocLineInput> = {}): DocLineInput => ({
  room,
  product,
  code,
  unit: 'AREA',
  details: null,
  widthMm: 1000,
  heightMm: 750,
  qtyMilli: null,
  amountPaise,
  ...extra,
});

describe('the quotation document', () => {
  it('only ever puts a six-digit hex colour into the CSS', () => {
    expect(safeAccent('#6b1a2b')).toBe('#6B1A2B');
    expect(safeAccent('red; } body { display:none')).toBe(DEFAULT_ACCENT);
    expect(safeAccent(null)).toBe(DEFAULT_ACCENT);
    const c = docColours('#6B1A2B');
    for (const v of Object.values(c)) expect(v).toMatch(/^#[0-9A-F]{6}$/);
    expect(donutPalette('#6B1A2B', 6)).toHaveLength(6);
    expect(donutPalette('#6B1A2B', 6)[0]).toBe('#6B1A2B');
  });

  it('prints rooms in the quotation order, with the modular discount per line and both sub-totals', () => {
    const lines = [
      line('Kitchen', 'Base Cabinets', 'MODULAR', 10_918_100),
      line('Kitchen', 'Tandems', 'ONSITE', 3_000_000, { unit: 'UNIT', qtyMilli: 3000, widthMm: null, heightMm: null }),
      line('Master Bedroom', 'False Ceiling', 'ONSITE', 2_070_000),
    ];
    const rooms = docRooms(lines, ['Master Bedroom', 'Kitchen'], 1500);
    expect(rooms.map((r) => r.room)).toEqual(['Master Bedroom', 'Kitchen']);
    const kitchen = rooms[1]!;
    expect(kitchen.rows[0]).toMatchObject({ n: 1, code: 'MO-01', modular: true, amountPaise: 10_918_100, discountedPaise: 9_280_400 });
    expect(kitchen.rows[1]).toMatchObject({ n: 2, code: 'NM-01', modular: false, units: '3', discountedPaise: 3_000_000 });
    expect(kitchen.subPaise).toBe(13_918_100);
    expect(kitchen.subDiscountedPaise).toBe(12_280_400);
    /* The per-line discount adds up to computeTotals' discount here (one modular line). */
    const totals = computeTotals(lines.map((l) => ({ ...l, ratePaise: 0, amountPaise: l.amountPaise })), { feeBps: 700, discountBps: 1500 });
    expect(kitchen.subPaise - kitchen.subDiscountedPaise).toBe(totals.discountPaise);
    expect(roomShares(rooms).map((s) => s.pct)).toEqual([13, 87]);
  });

  it("prints the studio's stages with their end deliverables, adding to the total exactly", () => {
    const totals = computeTotals([{ unit: 'UNIT', code: 'ONSITE', ratePaise: 47_094_400, qtyMilli: 1000 }], { feeBps: 0, discountBps: 0 });
    const stages = docStages(HAUSPIRE_TEMPLATE, totals);
    expect(stages[0]!.label).toBe('Booking Advance (Fully refundable within 3 days)');
    expect(stages[0]!.amountPaise).toBe(2_500_000);
    expect(stages[1]!.label).toBe('Design Advance (5%)');
    // The old app's words, with its bold (Hauspire's own stage, its note unchanged).
    expect(stages[1]!.deliverable).toContain('**2D drawing revisions, first 3D design, final 3D renders**');
    expect(stages[1]!.deliverable).toMatch(/first 3D design/);
    expect(stages.reduce((a, s) => a + s.amountPaise, 0)).toBe(totals.totalPaise);
    expect(STAGES_NOTE).toMatch(/^Each payment is made at the start of its stage\./);
  });

  it('falls back to the computed stages when the schedule cannot split the total', () => {
    const totals = computeTotals([{ unit: 'UNIT', code: 'ONSITE', ratePaise: 1_000_000, qtyMilli: 1000 }], { feeBps: 0, discountBps: 0, bookingAdvancePaise: 100_000 });
    /* ₹10,000 total, ₹25,000 fixed booking: the template cannot split it. */
    const stages = docStages(HAUSPIRE_TEMPLATE, totals);
    expect(stages.map((s) => s.amountPaise)).toEqual(totals.stages.map((s) => s.amountPaise));
    expect(docStages(null, totals)).toHaveLength(totals.stages.length);
  });

  it('renders terms as headings and bullets, never raw markdown', () => {
    const blocks = parseTerms('## Terms & Conditions\n### 1. Validity\n* Valid for 30 days.\n- **Bold** promise\n\nWarranty:\n1. Ten years on modular work.');
    expect(blocks).toEqual([
      { kind: 'title', text: 'Terms & Conditions' },
      { kind: 'heading', text: '1. Validity' },
      { kind: 'bullet', text: 'Valid for 30 days.' },
      { kind: 'bullet', text: '**Bold** promise' },
      { kind: 'gap' },
      { kind: 'heading', text: 'Warranty' },
      { kind: 'text', text: '1. Ten years on modular work.' },
    ]);
    expect(boldSegments('a **b** c')).toEqual(['a ', 'b', ' c']);
    expect(parseTerms('')).toEqual([]);
  });

  it('names the file for the client and the studio, and fills the header grid', () => {
    expect(quoteFileName('Asha Rao', 'Akara Studio', '2026-014', new Date(2026, 9, 6))).toBe('Asha Rao Akara Studio Quotation 2026-014 06-10-2026');
    expect(quoteFileName('A/B', 'S', '1', new Date(2026, 0, 2), true)).toBe('A B S Final Quotation 1 02-01-2026');
    expect(docDate(new Date(2026, 9, 13))).toBe('13 Oct 2026');
    const head = docHead({ clientName: 'Asha Rao', clientPhone: null, society: 'A-702, Blue Waters', locality: null, config: '3 BHK', number: '2026-014', quoteDate: new Date() }, 'Pune');
    expect(head).toMatchObject({ flatNo: 'A-702, Blue Waters', location: 'Pune', config: '3 BHK' });
  });

  it('prints a Brand column only when a row names a brand, and only true facts on the drawn cover', () => {
    expect(specHasBrands([{ item: 'Plywood', spec: 'BWP' }])).toBe(false);
    expect(specHasBrands([{ item: 'Plywood', brand: 'Century', spec: 'BWP' }])).toBe(true);
    expect(coverFacts({ yearsActive: null, teamSize: 12, localities: [] })).toEqual(['A team of 12']);
    expect(coverFacts(null)).toEqual([]);
  });
});

import { signedQuoteLogoUrl } from '@/modules/storage/studio-logo';

describe('the quotation logo for anyone quoting for the studio (sales included)', () => {
  it('never signs another studio’s logo or a missing one', async () => {
    expect(await signedQuoteLogoUrl('studio_other/logo.png', 'st-a')).toBeNull();
    expect(await signedQuoteLogoUrl(null, 'st-a')).toBeNull();
    expect(await signedQuoteLogoUrl('studio_st-a/logo.png', null)).toBeNull();
  });
});
