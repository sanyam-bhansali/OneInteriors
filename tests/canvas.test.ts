import { describe, expect, it } from 'vitest';
import { homeShapeFor, buildFirstQuote } from '@/modules/quotation/first-quote';
import { draftChanged, draftFrom, priceDraft, toggleItem, withRun, RUN_MAX_MM } from '@/modules/quotation/canvas';
import { scopeCandidates } from '@/modules/quotation/scope';
import { STUDIOS } from '@/data/studios';
import { filedRatesFor } from '@/data/filed-rates';

/**
 * The Home Canvas, v0 (docs/HOME-CANVAS.md): the quote made editable, every
 * studio re-priced on the draft. The rules worth pinning: a draft starts as
 * the brief, prices exactly as the brief would once saved, never empties the
 * quote, and a typed kitchen counts as a measurement.
 */

const shape = homeShapeFor({ propertyType: 'BHK_2', carpetAreaSqft: 960, scope: 'FULL_HOME', excludedItems: [] });
const plan = { fileName: null, kitchenRunMm: 3900, source: 'standard' as const };
const studios = STUDIOS.slice(0, 6).map((s) => ({ slug: s.slug, name: s.tradeName }));
const price = (draft = draftFrom(shape)) =>
  priceDraft({ shape, plan, draft, studios, ratesFor: filedRatesFor });

describe('the canvas draft', () => {
  it('starts as the brief, unchanged', () => {
    const d = draftFrom(shape);
    expect(draftChanged(shape, d)).toBe(false);
    expect(d.kitchenRunMm).toBeNull();
  });

  it('prices every studio with rates, cheapest first', () => {
    const p = price();
    expect(p.length).toBeGreaterThan(1);
    for (let i = 1; i < p.length; i++) expect(p[i]!.quote.totalPaise).toBeGreaterThanOrEqual(p[i - 1]!.quote.totalPaise);
  });

  it('taking a line out lowers every studio by that line', () => {
    const before = price();
    const code = before[0]!.quote.lines[0]!.code;
    const after = price(toggleItem(shape, draftFrom(shape), code));
    for (const b of before) {
      const a = after.find((x) => x.slug === b.slug)!;
      expect(a.quote.totalPaise).toBeLessThan(b.quote.totalPaise);
      expect(a.quote.lines.some((l) => l.code === code)).toBe(false);
    }
  });

  it('putting it back restores the exact total', () => {
    const code = price()[0]!.quote.lines[0]!.code;
    const out = toggleItem(shape, draftFrom(shape), code);
    const back = toggleItem(shape, out, code);
    expect(draftChanged(shape, back)).toBe(false);
    expect(price(back)[0]!.quote.totalPaise).toBe(price()[0]!.quote.totalPaise);
  });

  it('never takes out the last line', () => {
    let d = draftFrom(shape);
    for (const item of scopeCandidates(shape.bhk, shape.scope)) d = toggleItem(shape, d, item.code);
    const left = scopeCandidates(shape.bhk, shape.scope).filter((i) => !d.excludedItems.includes(i.code));
    expect(left.length).toBe(1);
  });

  it('a typed kitchen is a measurement: the band narrows to ±12%', () => {
    const measured = price(withRun(draftFrom(shape), 4200));
    expect(measured[0]!.quote.variancePct).toBeCloseTo(0.12);
    expect(price()[0]!.quote.variancePct).toBeCloseTo(0.16);
  });

  it('keeps the kitchen to a platform that exists', () => {
    expect(withRun(draftFrom(shape), 99_999).kitchenRunMm).toBe(RUN_MAX_MM);
    expect(withRun(draftFrom(shape), 4213).kitchenRunMm).toBe(4200);
  });

  it('prices a draft exactly as the saved brief would', () => {
    const code = price()[0]!.quote.lines[2]!.code;
    const d = toggleItem(shape, draftFrom(shape), code);
    const saved = homeShapeFor({ propertyType: 'BHK_2', carpetAreaSqft: 960, scope: 'FULL_HOME', excludedItems: [code] });
    const slug = studios[0]!.slug;
    const direct = buildFirstQuote(
      { ...saved, kitchenRunMm: 3900, runSource: 'standard', scope: saved.scope, curatedDiscountPct: null },
      filedRatesFor(slug),
    );
    expect(price(d).find((p) => p.slug === slug)!.quote.totalPaise).toBe(direct.totalPaise);
  });
});
