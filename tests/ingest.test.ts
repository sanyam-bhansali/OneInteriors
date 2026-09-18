import { describe, it, expect } from 'vitest';
import {
  classify,
  ingestQuotations,
  normalise,
  type IngestedLine,
  type IngestedQuotation,
} from '@/modules/quotation/ingest';
import { ITEM, type Room } from '@/modules/quotation/catalogue';

/**
 * These tests are the ingestion.
 *
 * Every case below is a shape the real archive actually contains — 934
 * quotations, 25,592 line items, 412 distinct spellings of about twenty
 * products. None of them throws. They all "succeed" and produce a rate that
 * is quietly wrong, which then prices somebody's home.
 *
 * The expensive failure is not a crash. It is a pattern that matches more
 * lines than it should: widening "console|shoe rack" to include any "foyer"
 * pulled in "Storage- Foyer Unit", a full-height storage unit, and moved the
 * derived rate from ₹1,910/sqft to ₹5,756/sqft. Three times the truth, from
 * one word.
 */

function line(over: Partial<IngestedLine> = {}): IngestedLine {
  return {
    quotationId: 'q1',
    room: 'KITCHEN',
    product: 'Base Cabinets',
    workCode: 'MO-01',
    widthMm: 3048, // 10 ft
    heightMm: 3048, // 10 ft → exactly 100 sqft
    amountPaise: 100_000_00,
    ...over,
  };
}

function quotation(lines: IngestedLine[], bhk = 2): IngestedQuotation {
  return { quotationId: lines[0]?.quotationId ?? 'q1', bhk, dated: null, lines };
}

describe('reading what the studio wrote', () => {
  it('normalises the spellings the archive actually varies on', () => {
    expect(normalise('Loft (Frame with Shutter)')).toBe('loft frame with shutter');
    expect(normalise('Wall Cabinets- Glass Profile Shutters')).toBe(
      'wall cabinets glass profile shutters',
    );
    expect(normalise('  Premium   Shutter wardrobe ')).toBe('premium shutter wardrobe');
  });

  it('matches the same product written four different ways', () => {
    for (const written of [
      'Console Unit/Shoe Rack',
      'Storage- Shoe Rack',
      'Shoe Rack',
      'Cosole Unit/Cosidered with laminate',
    ]) {
      expect(classify(written, 'LIVING_DINING')).toBe('console_shoe');
    }
  });

  it('does NOT treat a foyer storage unit as a console', () => {
    // The regression this file exists for. "Storage- Foyer Unit" is a
    // full-height unit at a different area, and folding it in tripled the
    // console rate.
    expect(classify('Storage- Foyer Unit', 'LIVING_DINING')).toBeNull();
  });

  it('reads a rate through the studio’s typo', () => {
    // "Electrcials" appears 91 times in the archive.
    expect(classify('Electrcials', 'WHOLE_HOME')).toBe('electrical');
    expect(classify('Electricals', 'WHOLE_HOME')).toBe('electrical');
  });

  it('lets the room decide what a loft is', () => {
    // The commonest line in the entire archive, and it means two different
    // things depending only on which block it sits under.
    expect(classify('Loft (Frame with Shutter)', 'KITCHEN')).toBe('kitchen_loft');
    expect(classify('Loft (Frame with Shutter)', 'MASTER_BEDROOM')).toBe('master_loft');
    expect(classify('Loft (Frame with Shutter)', 'SECOND_BEDROOM')).toBe('second_loft');
  });

  it('puts tandems before base cabinets, because the words overlap', () => {
    expect(classify('Base Cabinets- Tandems', 'KITCHEN')).toBe('kitchen_tandem');
    expect(classify('Base Cabinets', 'KITCHEN')).toBe('kitchen_base');
  });

  it('returns null for a designer add-on rather than forcing it somewhere', () => {
    // 259 lines of dry-balcony storage in the archive. Folding those into the
    // nearest catalogue item would inflate that item for every customer.
    expect(classify('Dry Balcony-Base Storage', 'KITCHEN')).toBeNull();
    expect(classify('Tall Unit', 'KITCHEN')).toBeNull();
    expect(classify('Side Table 01', 'MASTER_BEDROOM')).toBeNull();
  });
});

describe('deriving a rate', () => {
  it('divides the money by the area, not by the row count', () => {
    const { rates } = ingestQuotations(
      [quotation([line({ amountPaise: 200_000_00 })])],
      '2026-09-18',
    );
    // ₹2,00,000 over exactly 100 sqft.
    expect(rates.kitchen_base!.ratePaise).toBe(2_000_00);
  });

  it('sums the split rows before taking one rate', () => {
    // A bed and its headboard are two rows in every real quote and one line
    // on ours. The rate has to be what they charged for the pair.
    const { rates } = ingestQuotations(
      [
        quotation([
          line({ room: 'MASTER_BEDROOM', product: 'Queen size Bed Hydraulic', widthMm: null, heightMm: null, amountPaise: 44_000_00 }),
          line({ room: 'MASTER_BEDROOM', product: 'Headboard', widthMm: null, heightMm: null, amountPaise: 12_000_00 }),
        ]),
      ],
      '2026-09-18',
    );
    expect(rates.master_bed!.ratePaise).toBe(56_000_00);
  });

  it('takes the median, so one fat-fingered zero cannot move a rate', () => {
    const quotes = [
      quotation([line({ quotationId: 'a', amountPaise: 200_000_00 })]),
      quotation([line({ quotationId: 'b', amountPaise: 210_000_00 })]),
      // Somebody typed the project total into a rate cell.
      quotation([line({ quotationId: 'c', amountPaise: 20_000_000_00 })]),
    ];
    const { rates } = ingestQuotations(quotes, '2026-09-18');
    expect(rates.kitchen_base!.ratePaise).toBe(2_100_00);
  });

  it('refuses to invent an area for a line that has no dimensions', () => {
    const { rates } = ingestQuotations(
      [quotation([line({ widthMm: null, heightMm: null })])],
      '2026-09-18',
    );
    // Better no rate at all than a per-sqft rate divided by a guess.
    expect(rates.kitchen_base).toBeUndefined();
  });

  it('records where every rate came from', () => {
    const { rates } = ingestQuotations([quotation([line()])], '2026-09-18');
    expect(rates.kitchen_base!.fromQuotations).toBe(1);
    expect(rates.kitchen_base!.filedOn).toBe('2026-09-18');
  });
});

describe('the report', () => {
  it('names what it could not place, commonest first', () => {
    const { report } = ingestQuotations(
      [
        quotation([
          line({ product: 'Dry Balcony-Base Storage' }),
          line({ product: 'Dry Balcony-Base Storage' }),
          line({ product: 'Tall Unit' }),
        ]),
      ],
      '2026-09-18',
    );

    expect(report.unmapped[0]!.product).toBe('dry balcony base storage');
    expect(report.unmapped[0]!.lines).toBe(2);
    expect(report.linesMapped).toBe(0);
    expect(report.linesRead).toBe(3);
  });

  it('says which catalogue items were never priced', () => {
    const { report } = ingestQuotations([quotation([line()])], '2026-09-18');

    expect(report.missing).toContain('master_wardrobe');
    expect(report.missing).not.toContain('kitchen_base');
    expect(report.problems.join(' ')).toMatch(/never priced/i);
  });

  it('refuses to price a studio that has filed too few quotations', () => {
    const { report } = ingestQuotations([quotation([line()])], '2026-09-18');
    expect(report.problems.join(' ')).toMatch(/at least 100/i);
  });

  it('flags a rate built on almost nothing as provisional', () => {
    const { report } = ingestQuotations([quotation([line()])], '2026-09-18');
    expect(report.problems.join(' ')).toMatch(/provisional/i);
  });

  it('reports the middle half of the spread, not the extremes', () => {
    const quotes = Array.from({ length: 20 }, (_, i) =>
      quotation([line({ quotationId: `q${i}`, amountPaise: (200_000 + i * 1000) * 100 })]),
    );
    // One catastrophic outlier.
    quotes.push(quotation([line({ quotationId: 'bad', amountPaise: 90_000_000_00 })]));

    const { report } = ingestQuotations(quotes, '2026-09-18');
    const evidence = report.evidence.find((e) => e.code === 'kitchen_base')!;

    // The extremes would put the top at ₹9,00,000/sqft; the quartile does not.
    expect(evidence.highPaise).toBeLessThan(10_000_00);
  });

  it('marks a rate that was derived through an assumption', () => {
    const { report } = ingestQuotations(
      [
        quotation([
          line({ room: 'WHOLE_HOME', product: 'Painting (2bhk)', widthMm: null, heightMm: null, amountPaise: 45_000_00 }),
        ]),
      ],
      '2026-09-18',
    );

    const painting = report.evidence.find((e) => e.code === 'painting')!;
    // Painting is quoted as a lump per flat and held as a per-sqft rate, so
    // the carpet area had to be assumed. That must be visible.
    expect(painting.assumed).toBe(true);
    expect(ITEM.painting!.sizing).toBe('PER_SQFT_CARPET');
  });
});

describe('every catalogue item can actually be reached', () => {
  it('has at least one alias that classifies to it', () => {
    // A catalogue item no pattern can ever produce is an item every studio
    // will be permanently "missing" — the quote would name it as unfiled
    // forever and nobody would know why.
    const probes: [string, Room][] = [
      ['Base Cabinets', 'KITCHEN'],
      ['Wall Cabinets', 'KITCHEN'],
      ['Loft (Frame with Shutter)', 'KITCHEN'],
      ['Base Cabinets- Tandems', 'KITCHEN'],
      ['Premium Shutter wardrobe', 'MASTER_BEDROOM'],
      ['Loft (Frame with Shutter)', 'MASTER_BEDROOM'],
      ['Dressing Unit- Mirror', 'MASTER_BEDROOM'],
      ['Queen size Bed Hydraulic Storage', 'MASTER_BEDROOM'],
      ['Premium Shutter wardrobe', 'SECOND_BEDROOM'],
      ['Loft (Frame with Shutter)', 'SECOND_BEDROOM'],
      ['Workstation', 'SECOND_BEDROOM'],
      ['Headboard', 'SECOND_BEDROOM'],
      ['Premium Shutter wardrobe', 'THIRD_BEDROOM'],
      ['Loft (Frame with Shutter)', 'THIRD_BEDROOM'],
      ['Headboard', 'THIRD_BEDROOM'],
      ['Tv Unit', 'LIVING_DINING'],
      ['Shoe Rack', 'LIVING_DINING'],
      ['Mandir', 'LIVING_DINING'],
      ['Safety Door', 'LIVING_DINING'],
      ['False Ceiling -(Master Bedroom)', 'WHOLE_HOME'],
      ['Paint- 3bhk', 'WHOLE_HOME'],
      ['Electrcials', 'WHOLE_HOME'],
      ['Vanity Unit-02', 'BATHROOMS'],
    ];

    const reachable = new Set(probes.map(([p, r]) => classify(p, r)).filter(Boolean));
    for (const code of Object.keys(ITEM)) {
      expect(reachable, `nothing maps to "${code}"`).toContain(code);
    }
  });
});
