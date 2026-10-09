import { describe, expect, it } from 'vitest';
import { checked } from '@/modules/app/geio';
import { geioFacts } from '@/modules/app/geio-facts';

const facts = geioFacts('Meera');

describe('GEIO sources (trust fix 8)', () => {
  it('keeps the quote lines that exist and drops the ones that do not', () => {
    const r = checked(
      { paragraphs: ['The TV unit is ₹86,000 in your quote.'], hand_to_expert: false, sources: [14, 99] },
      facts.allowed,
      'Priya',
      'tv unit price?',
      facts.lines,
    );
    expect(r.sources.map((s) => s.line)).toEqual([14]);
    expect(r.sources[0]!.amount).toBe('₹86,000');
  });

  it('cites nothing when the answer is handed over for breaking a rule', () => {
    const r = checked(
      { paragraphs: ['You could get the TV unit for ₹60,000.'], hand_to_expert: false, sources: [14] },
      facts.allowed,
      'Priya',
      'cheaper tv unit?',
      facts.lines,
    );
    expect(r.sources).toEqual([]);
    expect(r.handover).not.toBeNull();
  });
});
