import { describe, it, expect } from 'vitest';
import { askAllowed, askFacts, cleanQuestion, lineRows } from '@/modules/quotation/quote-questions';
import { buildFirstQuote, homeShapeFor, standardKitchenRunMm } from '@/modules/quotation/first-quote';
import { filedRatesFor } from '@/data/filed-rates';
import { figuresCheck } from '@/modules/quotation/compare-insights';

const shape = homeShapeFor({ propertyType: 'BHK_2', carpetAreaSqft: 900, scope: 'FULL_HOME' });
const quote = (slug: string) =>
  buildFirstQuote({ ...shape, kitchenRunMm: standardKitchenRunMm(2), runSource: 'standard' }, filedRatesFor(slug));
const entries = [
  { slug: 'akara-design-studio', name: 'Akara', quote: quote('akara-design-studio') },
  { slug: 'vaastu-atelier', name: 'Vaastu', quote: quote('vaastu-atelier') },
];

describe('ask your quote', () => {
  it('takes a real question and nothing else', () => {
    expect(cleanQuestion('  Why is the kitchen more?  ')).toBe('Why is the kitchen more?');
    expect(cleanQuestion('hi')).toBeNull();
    expect(cleanQuestion(42)).toBeNull();
  });

  it('gives the model every line, for every studio — and never a rate', () => {
    const rows = lineRows(entries);
    expect(rows.length).toBe(entries[0]!.quote.lines.length);
    const facts = askFacts(entries, 'Why is the kitchen more?');
    expect(facts).toContain('The homeowner asks: Why is the kitchen more?');
    expect(facts).not.toMatch(/per sq ft|\/sq ft/);
  });

  it('lets an answer quote a line and the gap on that line, and nothing invented', () => {
    const base = lineRows(entries).find((r) => r.code === 'kitchen_base')!;
    const [a, b] = base.cells.map((c) => c.amountPaise!);
    const allowed = askAllowed(entries);
    const gap = Math.abs(a! - b!);
    const fmt = (p: number) => `₹${(p / 100).toLocaleString('en-IN')}`;
    expect(figuresCheck(`The base cabinets are ${fmt(a!)} against ${fmt(b!)}.`, allowed).ok).toBe(true);
    if (gap > 0) expect(figuresCheck(`A gap of ${fmt(gap)}.`, allowed).ok).toBe(true);
    expect(figuresCheck('It would cost ₹12,34,567 elsewhere.', allowed).ok).toBe(false);
  });
});
