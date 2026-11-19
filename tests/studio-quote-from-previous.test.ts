import { describe, it, expect } from 'vitest';
import {
  copiedLines,
  fillRefusal,
  previousQuotesWhere,
  templateSourceWhere,
  rateChanges,
  templateLines,
  templateTerms,
  type SourceLine,
  type SourceQuote,
} from '@/modules/studio-quote/from-previous-rules';

/**
 * "Start from a previous quotation" (owner, 17 Nov 2026). The copy carries
 * lines and terms, never the old client, and only from the person's own scope.
 */

const line = (patch: Partial<SourceLine>): SourceLine => ({
  room: 'Kitchen',
  product: 'Base Unit',
  code: 'MODULAR',
  unit: 'RFT',
  details: 'BWP ply',
  widthMm: null,
  heightMm: null,
  qtyMilli: 10_000,
  ratePaise: 150_000n,
  amountPaise: 1_500_000n,
  note: null,
  sortOrder: 10,
  ...patch,
});

/* A source with the old client on it, as a database row would have; the rules must not pass any of it on. */
const source = {
  clientName: 'Mrs Kothari',
  clientPhone: '9876543210',
  clientEmail: 'k@example.com',
  society: 'Kalyani Nagar Heights',
  locality: 'Kalyani Nagar',
  clientId: 'lead-old',
  briefId: 'brief-old',
  introductionId: 'intro-old',
  status: 'ACCEPTED',
  issuedOn: new Date('2026-10-01'),
  issuedLines: [{ room: 'Kitchen', product: 'Base Unit', amountPaise: 1 }],
  basedOnId: 'q-sales',
  number: '2301',
  feeBps: 700,
  discountBps: 1000,
  onSpotPaise: 2_500_000n,
  onSpotLabel: 'Diwali offer',
  bookingAdvancePaise: 2_500_000n,
  gstBps: 1800,
  phases: [{ name: 'Booking', pct: 10 }],
  welcomeNote: 'Thank you',
  terms: 'Our terms',
  kitchenRunMm: 3600,
  bathrooms: 2,
  lines: [line({ sortOrder: 20, room: 'Master Bedroom', product: 'Wardrobe', unit: 'AREA', widthMm: 1800, heightMm: 2100, qtyMilli: null }), line({ sortOrder: 10 })],
} satisfies SourceQuote & Record<string, unknown>;

describe('what a template carries', () => {
  it('copies the terms and the flat, and nothing about the old client', () => {
    const t = templateTerms(source);
    expect(t).toEqual({
      feeBps: 700,
      discountBps: 1000,
      onSpotPaise: 2_500_000n,
      onSpotLabel: 'Diwali offer',
      bookingAdvancePaise: 2_500_000n,
      gstBps: 1800,
      phases: [{ name: 'Booking', pct: 10 }],
      welcomeNote: 'Thank you',
      terms: 'Our terms',
      kitchenRunMm: 3600,
      bathrooms: 2,
    });
    for (const k of ['clientName', 'clientPhone', 'clientEmail', 'society', 'locality', 'clientId', 'briefId', 'introductionId', 'status', 'issuedOn', 'issuedLines', 'basedOnId', 'number']) {
      expect(t).not.toHaveProperty(k);
    }
  });

  it('copies every line in order, with rates and agreed amounts as they were', () => {
    const ls = templateLines(source.lines);
    expect(ls.map((l) => l.product)).toEqual(['Base Unit', 'Wardrobe']);
    expect(ls.map((l) => l.sortOrder)).toEqual([10, 20]);
    expect(ls[0]).toMatchObject({ room: 'Kitchen', unit: 'RFT', qtyMilli: 10_000, ratePaise: 150_000n, amountPaise: 1_500_000n, details: 'BWP ply' });
    expect(ls[1]).toMatchObject({ room: 'Master Bedroom', unit: 'AREA', widthMm: 1800, heightMm: 2100 });
    for (const l of ls) {
      expect(l).not.toHaveProperty('id');
      expect(l).not.toHaveProperty('quoteId');
    }
  });

  it('keeps an agreed amount only where it differs from rate × size, for the First quote page', () => {
    const [plain, agreed] = copiedLines([line({}), line({ product: 'Loft', sortOrder: 20, amountPaise: 1_200_000n, note: 'Agreed on site' })]);
    expect(plain).toMatchObject({ ratePaise: 150_000, agreedPaise: null });
    expect(agreed).toMatchObject({ ratePaise: 150_000, agreedPaise: 1_200_000, note: 'Agreed on site' });
  });
});

describe('product master prices that changed since', () => {
  it('names each product whose master rate is not the copied rate, once', () => {
    const lines = [
      { product: 'Base Unit', ratePaise: 150_000 },
      { product: 'base  unit ', ratePaise: 150_000 },
      { product: 'Wardrobe', ratePaise: 180_000 },
      { product: 'Custom shelf', ratePaise: 90_000 },
    ];
    const products = [
      { name: 'Base Unit', ratePaise: 165_000 },
      { name: 'Wardrobe', ratePaise: 180_000 },
    ];
    expect(rateChanges(lines, products)).toEqual([{ product: 'Base Unit', wasPaise: 150_000, nowPaise: 165_000 }]);
  });

  it('ignores products with no rate or switched off in the master', () => {
    const lines = [{ product: 'Loft', ratePaise: 100_000 }, { product: 'Vanity', ratePaise: 100_000 }];
    expect(rateChanges(lines, [{ name: 'Loft', ratePaise: 0 }, { name: 'Vanity', ratePaise: 120_000, isActive: false }])).toEqual([]);
  });
});

describe('where previous quotations are looked for', () => {
  const scope = { studioId: 's1', clientId: { in: ['lead-1'] } };

  it('always inside the person’s own scope and studio, and only quotations with lines', () => {
    const w = previousQuotesWhere(scope, 's1', '');
    expect(w.AND).toEqual([scope, { studioId: 's1' }, { lines: { some: {} } }]);
  });

  it('searches client, number, society, locality and BHK', () => {
    const w = previousQuotesWhere(scope, 's1', '  3 BHK ');
    const and = w.AND as unknown[];
    expect(and.slice(0, 3)).toEqual([scope, { studioId: 's1' }, { lines: { some: {} } }]);
    const or = (and[3] as { OR: Record<string, { contains: string }>[] }).OR;
    expect(or.map((o) => Object.keys(o)[0])).toEqual(['clientName', 'number', 'society', 'locality', 'config']);
    expect(or.every((o) => Object.values(o)[0]!.contains === '3 BHK')).toBe(true);
  });
});

describe('which quotation may be filled', () => {
  const fresh = { status: 'DRAFT', issuedOn: null, lineCount: 0, revisionCount: 0 };

  it('a new empty draft', () => {
    expect(fillRefusal(fresh, true)).toBeNull();
  });

  it('never one that was sent, won, or has revisions', () => {
    expect(fillRefusal({ ...fresh, status: 'ISSUED' }, true)).not.toBeNull();
    expect(fillRefusal({ ...fresh, issuedOn: new Date() }, false)).not.toBeNull();
    expect(fillRefusal({ ...fresh, revisionCount: 1 }, false)).not.toBeNull();
  });

  it('not over lines already there, unless only the terms are copied', () => {
    expect(fillRefusal({ ...fresh, lineCount: 3 }, true)).not.toBeNull();
    expect(fillRefusal({ ...fresh, lineCount: 3 }, false)).toBeNull();
  });
});

describe('templateSourceWhere (owner, 19 Nov 2026: reps pick from every quotation)', () => {
  const own = { studioId: 's1', client: { assignedToId: 'rep' } };
  it('anyone who writes quotations picks from the whole studio', () => {
    expect(templateSourceWhere({ studioId: 's1', where: own, lead: { reach: 'own' } })).toEqual({ studioId: 's1' });
  });
  it('a designer (no lead scope) keeps their own scope', () => {
    expect(templateSourceWhere({ studioId: 's1', where: own, lead: null })).toBe(own);
  });
  it('the list still stays inside the studio and only quotations with lines', () => {
    const w = previousQuotesWhere(templateSourceWhere({ studioId: 's1', where: own, lead: {} }), 's1', '');
    expect(w).toEqual({ AND: [{ studioId: 's1' }, { studioId: 's1' }, { lines: { some: {} } }] });
  });
});
