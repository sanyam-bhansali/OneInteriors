import { describe, it, expect } from 'vitest';
import { buildFirstQuote, compareMany } from '@/modules/quotation/first-quote';
import { filedRatesFor } from '@/data/filed-rates';
import { FULL_HOME } from '@/modules/quotation/scope';
import {
  allowedFigures,
  compareFacts,
  deterministicSummary,
  figuresCheck,
  materialRows,
  percentFigures,
  roomSpreads,
  rupeeFigures,
  sameSpecGroups,
} from '@/modules/quotation/compare-insights';

const home = { bhk: 3, carpetAreaSqft: 1250, bathrooms: 3, kitchenRunMm: null, runSource: 'standard' as const, scope: FULL_HOME };
const entries = [
  ['akara-design-studio', 'Akara'],
  ['sixth-wall-design', 'Sixth Wall'],
  ['vaastu-atelier', 'Vaastu Atelier'],
].map(([slug, name]) => ({ slug: slug!, name: name!, quote: buildFirstQuote(home, filedRatesFor(slug!)) }));
const comparison = compareMany(entries);

describe('compare insights', () => {
  it('spreads each room across the studios, biggest spread first', () => {
    const rooms = roomSpreads(entries);
    expect(rooms[0]!.spreadPaise).toBeGreaterThanOrEqual(rooms[rooms.length - 1]!.spreadPaise);
    for (const r of rooms) expect(r.highPaise - r.lowPaise).toBe(r.spreadPaise);
  });

  it('puts each studio’s rate and material side by side on the main carpentry items', () => {
    const rows = materialRows(entries);
    expect(rows.map((r) => r.code)).toContain('kitchen_base');
    const base = rows.find((r) => r.code === 'kitchen_base')!;
    expect(base.cells.every((c) => c.ratePaise !== null && c.materials.length > 0)).toBe(true);
    // Grouped by what the material is, not how the sentence is written.
    const groups = sameSpecGroups(base);
    expect(groups.reduce((n, g) => n + g.studios.length, 0)).toBe(3);
  });

  it('gives the model only the compared numbers', () => {
    const facts = compareFacts(entries);
    expect(facts).toContain('Akara');
    expect(facts).not.toMatch(/Sanyam|\+91/);
  });
});

describe('the figures checker', () => {
  const allowed = allowedFigures(entries);

  it('reads rupee figures and percentages the ways they are written', () => {
    expect(rupeeFigures('₹6.16 L, ₹2.13 K, Rs 61,633 and ₹1.2 Cr')).toEqual([61_600_000, 213_000, 6_163_300, 1_200_000_000]);
    expect(percentFigures('about 12% more, 3.5 %')).toEqual([12, 3.5]);
  });

  it('passes our own rule-based summary', () => {
    const s = deterministicSummary(entries, comparison);
    const text = [s.headline, ...s.points].join(' ');
    expect(figuresCheck(text, allowed)).toEqual({ ok: true, stray: [] });
  });

  it('catches a figure that is not in the data', () => {
    const s = deterministicSummary(entries, comparison);
    const planted = `${s.headline} The kitchen could come down to ₹1.11 L with a cheaper board, a 40% saving.`;
    const result = figuresCheck(planted, allowed);
    expect(result.ok).toBe(false);
    expect(result.stray.length).toBeGreaterThanOrEqual(1);
  });
});
