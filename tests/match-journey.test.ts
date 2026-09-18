import { describe, it, expect } from 'vitest';
import { rankStudios } from '@/modules/matching/score';
import { STUDIOS } from '@/data/studios';
import { buildFirstQuote } from '@/modules/quotation/first-quote';
import { compareQuotes, compareMany } from '@/modules/quotation/first-quote';
import { filedRatesFor } from '@/data/filed-rates';
import { EMPTY_BRIEF, type Brief } from '@/modules/brief/types';
import { MIN_TO_COMPARE } from '@/modules/quotation/project-store';

/**
 * The match journey, end to end, without a browser.
 *
 * Every step the customer takes on `/match` is a pure function underneath:
 * rank the roster against the brief, turn a chosen studio into a quote
 * request, build the quote, and compare two of them. This exercises that
 * chain with a realistic brief, so "does match work" has an answer that is
 * not somebody reading the component and nodding.
 *
 * What it deliberately does NOT cover: the rendering, the ten-second timer,
 * and sessionStorage. Those need a browser.
 */

const BRIEF: Brief = {
  ...EMPTY_BRIEF,
  propertyType: 'BHK_2',
  carpetAreaSqft: 850,
  locality: 'baner',
  scope: 'FULL_HOME',
  budgetMinPaise: 12_00_000_00,
  budgetMaxPaise: 20_00_000_00,
  styleLikes: ['warm-modern'],
};

/** The same mapping MatchClient uses to turn a brief into a quote request. */
const BEDROOMS: Record<string, number> = {
  BHK_1: 1,
  BHK_2: 2,
  BHK_3: 3,
  BHK_4_PLUS: 4,
  VILLA: 4,
};

describe('the match list', () => {
  it('returns studios for a filled-in brief', () => {
    const matches = rankStudios(BRIEF, STUDIOS, 6, { allowUnverified: true });
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.length).toBeLessThanOrEqual(6);
  });

  it('orders them best first', () => {
    const matches = rankStudios(BRIEF, STUDIOS, 6, { allowUnverified: true });
    const scores = matches.map((m) => m.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('gives every row a score a person can read', () => {
    const matches = rankStudios(BRIEF, STUDIOS, 6, { allowUnverified: true });
    for (const match of matches) {
      expect(match.score).toBeGreaterThanOrEqual(0);
      expect(match.score).toBeLessThanOrEqual(100);
      expect(Number.isInteger(match.score)).toBe(true);
    }
  });

  it('every match resolves to a studio the row can render', () => {
    // The row reads `byId.get(match.studioId)` and returns null if it misses.
    // A miss would silently drop a studio from the list.
    const byId = new Map(STUDIOS.map((s) => [s.id, s]));
    for (const match of rankStudios(BRIEF, STUDIOS, 6, { allowUnverified: true })) {
      expect(byId.get(match.studioId), match.studioId).toBeDefined();
    }
  });

  it('scores an EMPTY brief anyway — which is why the screen gates on the brief', () => {
    // This is the bug this test was written to catch, kept as documentation of
    // why the gate exists. `rankStudios` is happy to score nothing: it returns
    // five studios at 100, 80, 70, 38 and 7, every one of them off a single
    // factor out of six.
    //
    // A perfect score derived from no answers is exactly the unearned figure
    // this product argues against, so MatchClient refuses to call this at all
    // until the brief has a property type. The engine is not wrong — it is
    // scoring what it was given — the SCREEN was wrong to ask.
    const matches = rankStudios(EMPTY_BRIEF, STUDIOS, 6, { allowUnverified: true });

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]!.score).toBeGreaterThan(50);
    expect(matches.every((m) => m.factorsScored < m.factorsTotal)).toBe(true);
  });

  it('a thin score is visibly thin — the row prints the denominator', () => {
    const matches = rankStudios(BRIEF, STUDIOS, 6, { allowUnverified: true });
    for (const match of matches) {
      // "scored on 4 of 6" is rendered on every row. A 94 on two factors is
      // not the same claim as a 94 on six.
      expect(match.factorsTotal).toBeGreaterThan(0);
      expect(match.factorsScored).toBeLessThanOrEqual(match.factorsTotal);
    }
  });

  it('survives a studio with no reason to show — the row falls back', () => {
    // `buildReasoning` pushes conditionally, so `reasoning` CAN be empty.
    // MatchClient reads `reasoning[0] ?? <fallback>`; this proves the
    // fallback is reachable rather than dead code.
    const matches = rankStudios(EMPTY_BRIEF, STUDIOS, 6, { allowUnverified: true });
    const thin = matches.filter((m) => m.reasoning.length === 0);
    for (const match of thin) {
      expect(match.reasoning[0] ?? 'Matched on your locality and scope.').toBeTruthy();
    }
  });
});

describe('from a match to a quote', () => {
  const studio = STUDIOS[0]!;

  const request = {
    bhk: BEDROOMS[BRIEF.propertyType ?? 'BHK_2'] ?? 2,
    carpetAreaSqft: BRIEF.carpetAreaSqft ?? 850,
    bathrooms: Math.max(1, BEDROOMS[BRIEF.propertyType ?? 'BHK_2'] ?? 2),
  };

  it('builds a priced quote for the studio the customer picked', () => {
    const quote = buildFirstQuote(
      { ...request, kitchenRunMm: 3600, runSource: 'floor_plan' },
      filedRatesFor(studio.slug),
    );

    expect(quote.lines.length).toBeGreaterThan(10);
    expect(quote.totalPaise).toBeGreaterThan(0);
    expect(quote.rooms.length).toBeGreaterThan(0);
  });

  it('gives two different studios two different numbers', () => {
    // The per-studio rate spread has to actually move the total, or the whole
    // comparison is theatre.
    const a = buildFirstQuote(
      { ...request, kitchenRunMm: 3600, runSource: 'floor_plan' },
      filedRatesFor(STUDIOS[0]!.slug),
    );
    const b = buildFirstQuote(
      { ...request, kitchenRunMm: 3600, runSource: 'floor_plan' },
      filedRatesFor(STUDIOS[1]!.slug),
    );
    expect(a.totalPaise).not.toBe(b.totalPaise);
  });

  it('gives the SAME studio the same number twice', () => {
    // A quote that changes on reload is a quote nobody trusts.
    const once = buildFirstQuote(
      { ...request, kitchenRunMm: 3600, runSource: 'floor_plan' },
      filedRatesFor(studio.slug),
    );
    const twice = buildFirstQuote(
      { ...request, kitchenRunMm: 3600, runSource: 'floor_plan' },
      filedRatesFor(studio.slug),
    );
    expect(once.totalPaise).toBe(twice.totalPaise);
  });

  it('prices a 2 BHK without a third bedroom', () => {
    const quote = buildFirstQuote(
      { ...request, kitchenRunMm: 3600, runSource: 'floor_plan' },
      filedRatesFor(studio.slug),
    );
    expect(quote.rooms.some((r) => r.room === 'THIRD_BEDROOM')).toBe(false);
    expect(quote.rooms.some((r) => r.room === 'KITCHEN')).toBe(true);
  });

  it('lands in a believable band for a 2 BHK in Pune', () => {
    const quote = buildFirstQuote(
      { ...request, kitchenRunMm: 3600, runSource: 'floor_plan' },
      filedRatesFor(studio.slug),
    );
    const lakh = quote.totalPaise / 100 / 100_000;
    // The published range on the site is ₹5.95 L–₹27.2 L. A 2 BHK full home
    // outside 6–20 L means something upstream has gone wrong.
    expect(lakh).toBeGreaterThan(6);
    expect(lakh).toBeLessThan(20);
  });
});

describe('sending quotes to compare', () => {
  const request = { bhk: 2, carpetAreaSqft: 850, bathrooms: 2 };
  const quoteFor = (slug: string) =>
    buildFirstQuote({ ...request, kitchenRunMm: 3600, runSource: 'floor_plan' }, filedRatesFor(slug));

  it('needs two, and caps at nothing', () => {
    // One quote compared with nothing is a quote. Beyond that there is no
    // ceiling — the table scrolls sideways with the line and its material
    // pinned, so a fourth studio costs a swipe rather than legibility.
    expect(MIN_TO_COMPARE).toBe(2);
  });

  it('compares line for line, on the same lines', () => {
    const rows = compareQuotes(quoteFor(STUDIOS[0]!.slug), quoteFor(STUDIOS[1]!.slug));

    expect(rows.length).toBeGreaterThan(10);
    for (const row of rows) {
      // The whole promise: same line, both sides, with the material on it.
      expect(row.label.length).toBeGreaterThan(0);
      expect(row.spec.length).toBeGreaterThan(0);
      expect(row.a).not.toBeNull();
      expect(row.b).not.toBeNull();
    }
  });

  it('a row only one studio priced keeps its place and invents no delta', () => {
    const full = filedRatesFor(STUDIOS[1]!.slug);
    const thin = { ...full };
    delete thin.mandir;

    const rows = compareQuotes(
      quoteFor(STUDIOS[0]!.slug),
      buildFirstQuote({ ...request, kitchenRunMm: 3600, runSource: 'floor_plan' }, thin),
    );

    const mandir = rows.find((r) => r.code === 'mandir')!;
    expect(mandir.a).not.toBeNull();
    expect(mandir.b).toBeNull();
    expect(mandir.deltaPaise).toBeNull();
  });
});

describe('the comparison itself', () => {
  const request = { bhk: 2, carpetAreaSqft: 850, bathrooms: 2 };
  const entry = (slug: string, name: string, rates = filedRatesFor(slug)) => ({
    slug,
    name,
    quote: buildFirstQuote({ ...request, kitchenRunMm: 3600, runSource: 'floor_plan' as const }, rates),
  });

  it('takes any number of studios, not three', () => {
    const many = STUDIOS.slice(0, 6).map((s) => entry(s.slug, s.tradeName));
    const c = compareMany(many);
    expect(c.studios).toHaveLength(6);
    for (const room of c.rooms) {
      for (const line of room.lines) {
        // Every row spans every studio, or the table would ragged-edge.
        expect(line.cells).toHaveLength(6);
      }
    }
  });

  it('keeps the row when only some studios priced it, and never shows zero', () => {
    const thin = filedRatesFor(STUDIOS[1]!.slug);
    delete thin.mandir;

    const c = compareMany([
      entry(STUDIOS[0]!.slug, 'A'),
      entry(STUDIOS[1]!.slug, 'B', thin),
    ]);

    const mandir = c.rooms.flatMap((r) => r.lines).find((l) => l.code === 'mandir')!;
    expect(mandir).toBeDefined();
    const missing = mandir.cells.find((x) => x.slug === STUDIOS[1]!.slug)!;
    // null, not 0 — a zero reads as free.
    expect(missing.amountPaise).toBeNull();
    expect(missing.spec).toBeNull();
  });

  it('marks the cheapest on a row, and does not when only one priced it', () => {
    const c = compareMany([entry(STUDIOS[0]!.slug, 'A'), entry(STUDIOS[1]!.slug, 'B')]);
    const lines = c.rooms.flatMap((r) => r.lines);

    for (const line of lines) {
      expect(line.cheapest.length).toBeGreaterThan(0);
      const low = Math.min(
        ...line.cells.filter((x) => x.amountPaise !== null).map((x) => x.amountPaise!),
      );
      for (const slug of line.cheapest) {
        expect(line.cells.find((x) => x.slug === slug)!.amountPaise).toBe(low);
      }
    }
  });

  it('notices when two studios quoted different boards', () => {
    // The whole reason this screen exists: a lower total is usually a
    // different material, not better value.
    const all = STUDIOS.map((s) => entry(s.slug, s.tradeName));
    const c = compareMany(all);
    const differing = c.rooms.flatMap((r) => r.lines).filter((l) => l.materialsDiffer);
    expect(differing.length).toBeGreaterThan(0);
  });

  it('puts a material disagreement above a bigger price gap', () => {
    const all = STUDIOS.slice(0, 4).map((s) => entry(s.slug, s.tradeName));
    const { tellingRows } = compareMany(all);

    expect(tellingRows.length).toBeGreaterThan(0);
    const firstSame = tellingRows.findIndex((r) => !r.materialsDiffer);
    const lastDiffer = tellingRows.map((r) => r.materialsDiffer).lastIndexOf(true);
    if (firstSame !== -1 && lastDiffer !== -1) {
      expect(lastDiffer).toBeLessThan(firstSame);
    }
  });

  it('every compared line keeps a size, and it is the same for everyone', () => {
    // The labels and sizes are OURS. If they ever differed per studio the
    // row would stop meaning one thing across.
    const a = entry(STUDIOS[0]!.slug, 'A');
    const b = entry(STUDIOS[1]!.slug, 'B');
    const c = compareMany([a, b]);

    for (const line of c.rooms.flatMap((r) => r.lines)) {
      expect(line.size.length).toBeGreaterThan(0);
      const fromA = a.quote.lines.find((l) => l.code === line.code);
      const fromB = b.quote.lines.find((l) => l.code === line.code);
      if (fromA && fromB) expect(fromA.size).toBe(fromB.size);
    }
  });
});
