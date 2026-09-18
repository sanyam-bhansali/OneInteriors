import { describe, expect, it } from 'vitest';
import { tallyStarred, starredGap } from '@/modules/quotation/starred';
import type { ComparedLine } from '@/modules/quotation/first-quote';

const STUDIOS = [
  { slug: 'teakline', name: 'Teakline Studio' },
  { slug: 'chitra', name: 'Chitra & Co.' },
  { slug: 'maya', name: 'Maya Workshop' },
];

function line(
  code: string,
  label: string,
  cells: { slug: string; amountPaise: number | null; spec: string | null }[],
  materialsDiffer = false,
): ComparedLine {
  return {
    code,
    room: 'KITCHEN',
    label,
    size: '1 unit',
    cells,
    cheapest: [],
    spreadPaise: 0,
    materialsDiffer,
  } as unknown as ComparedLine;
}

const LINES: ComparedLine[] = [
  line('KIT-BASE', 'Kitchen base units', [
    { slug: 'teakline', amountPaise: 200_000_00, spec: '18mm BWP carcass' },
    { slug: 'chitra', amountPaise: 170_000_00, spec: '18mm BWR carcass' },
    { slug: 'maya', amountPaise: 190_000_00, spec: '18mm BWP carcass' },
  ], true),
  line('WDR-M', 'Wardrobe — master', [
    { slug: 'teakline', amountPaise: 150_000_00, spec: '18mm BWR carcass' },
    { slug: 'chitra', amountPaise: 140_000_00, spec: '18mm BWR carcass' },
    { slug: 'maya', amountPaise: 160_000_00, spec: '18mm BWR carcass' },
  ]),
  line('MANDIR', 'Mandir', [
    { slug: 'teakline', amountPaise: 45_000_00, spec: '18mm BWP · laminate' },
    { slug: 'chitra', amountPaise: null, spec: null },
    { slug: 'maya', amountPaise: 50_000_00, spec: '18mm BWP · laminate' },
  ]),
];

describe('tallyStarred', () => {
  it('totals only the starred lines', () => {
    const t = tallyStarred(LINES, ['WDR-M'], STUDIOS);
    expect(t.codes).toEqual(['WDR-M']);
    expect(t.studios.map((s) => s.totalPaise)).toEqual([140_000_00, 150_000_00, 160_000_00]);
    expect(t.leader?.name).toBe('Chitra & Co.');
  });

  it('never credits a missing line as zero', () => {
    /**
     * The one that matters. Chitra did not quote the mandir. Counting that as
     * ₹0 would make the studio who is not building a mandir look like better
     * value, which is the exact trick this whole product exists to stop.
     */
    const t = tallyStarred(LINES, ['MANDIR'], STUDIOS);
    const chitra = t.studios.find((s) => s.slug === 'chitra')!;
    expect(chitra.missing).toEqual(['Mandir']);
    expect(t.leader?.slug).not.toBe('chitra');
    expect(t.leader?.slug).toBe('teakline');
  });

  it('sorts the incomplete studios to the bottom rather than dropping them', () => {
    // A gap is a finding, not an absence. It stays on screen.
    const t = tallyStarred(LINES, ['MANDIR', 'WDR-M'], STUDIOS);
    expect(t.studios[t.studios.length - 1]!.slug).toBe('chitra');
    expect(t.studios).toHaveLength(3);
  });

  it('carries the material disagreement so the number cannot travel alone', () => {
    const t = tallyStarred(LINES, ['KIT-BASE'], STUDIOS);
    expect(t.leader?.slug).toBe('chitra');
    // Chitra is cheapest and is using BWR where the others use BWP. The screen
    // is required to print this beside the verdict.
    expect(t.caveats).toEqual(['Kitchen base units']);
  });

  it('reports no caveat when everybody quoted the same material', () => {
    expect(tallyStarred(LINES, ['WDR-M'], STUDIOS).caveats).toEqual([]);
  });

  it('ignores starred codes that are not in this comparison', () => {
    const t = tallyStarred(LINES, ['WDR-M', 'NOT-A-LINE'], STUDIOS);
    expect(t.codes).toEqual(['WDR-M']);
  });

  it('returns no leader when nothing is starred', () => {
    const t = tallyStarred(LINES, [], STUDIOS);
    expect(t.codes).toEqual([]);
    expect(t.studios.every((s) => s.totalPaise === 0)).toBe(true);
  });
});

describe('starredGap', () => {
  it('is the distance between the two cheapest complete quotes', () => {
    const t = tallyStarred(LINES, ['WDR-M'], STUDIOS);
    expect(starredGap(t)).toBe(10_000_00);
  });

  it('is null when only one studio priced everything starred', () => {
    const two = [{ slug: 'teakline', name: 'Teakline Studio' }, { slug: 'chitra', name: 'Chitra & Co.' }];
    const t = tallyStarred(LINES, ['MANDIR'], two);
    expect(t.leader?.slug).toBe('teakline');
    expect(starredGap(t)).toBeNull();
  });

  it('is zero when they are level, which the screen states differently', () => {
    const level: ComparedLine[] = [
      line('X', 'A line', [
        { slug: 'teakline', amountPaise: 100_00, spec: 'same' },
        { slug: 'chitra', amountPaise: 100_00, spec: 'same' },
      ]),
    ];
    const t = tallyStarred(level, ['X'], STUDIOS.slice(0, 2));
    expect(starredGap(t)).toBe(0);
  });
});
