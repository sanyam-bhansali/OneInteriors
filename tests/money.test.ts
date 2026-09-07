import { describe, it, expect } from 'vitest';
import {
  rupeesToPaise,
  lakhsToPaise,
  formatINR,
  formatINRCompact,
  applyBps,
  addGst,
  splitAcross,
  RATES,
  DEFAULT_MILESTONES,
} from '@/lib/money';

describe('formatINR — Indian numbering', () => {
  it('groups the last three digits, then pairs', () => {
    expect(formatINR(85_000_00)).toBe('₹85,000');
    expect(formatINR(8_50_000_00)).toBe('₹8,50,000');
    expect(formatINR(1_25_00_000_00)).toBe('₹1,25,00,000');
  });

  it('does not group short numbers', () => {
    expect(formatINR(50_000)).toBe('₹500');
    expect(formatINR(100)).toBe('₹1');
  });

  it('handles negatives and paise', () => {
    expect(formatINR(-8_50_000_00)).toBe('-₹8,50,000');
    expect(formatINR(12345, { paise: true })).toBe('₹123.45');
  });
});

describe('formatINRCompact', () => {
  it('uses lakh and crore, not thousands and millions', () => {
    expect(formatINRCompact(lakhsToPaise(8.5))).toBe('₹8.5 L');
    expect(formatINRCompact(lakhsToPaise(125))).toBe('₹1.25 Cr');
    expect(formatINRCompact(lakhsToPaise(0.05))).toBe('₹5 K');
  });
});

describe('applyBps', () => {
  it('computes the pilot commission exactly', () => {
    // 4% of ₹10,00,000 = ₹40,000
    expect(applyBps(lakhsToPaise(10), RATES.PILOT_COMMISSION_BPS)).toBe(lakhsToPaise(0.4));
  });

  it('rounds half-up, once', () => {
    expect(applyBps(101, 5000)).toBe(51); // 50.5 -> 51
  });

  it('rejects a fractional rate rather than silently truncating', () => {
    expect(() => applyBps(1000, 17.5)).toThrow();
  });
});

describe('addGst', () => {
  it('adds 18% and keeps the parts consistent', () => {
    const { net, gst, gross } = addGst(lakhsToPaise(10));
    expect(gst).toBe(lakhsToPaise(1.8));
    expect(net + gst).toBe(gross);
  });
});

describe('splitAcross — the milestone invariant', () => {
  it('always sums to the total, whatever the weights', () => {
    const total = lakhsToPaise(8.37);
    const weights = DEFAULT_MILESTONES.map((m) => m.weight);
    const parts = splitAcross(total, weights);

    expect(parts).toHaveLength(5);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
  });

  it('holds for awkward totals that do not divide cleanly', () => {
    for (const total of [1, 7, 99, 100_001, 3_33_333_33]) {
      const parts = splitAcross(total, [1, 1, 1]);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
    }
  });

  it('puts the remainder on the last milestone, never drops it', () => {
    expect(splitAcross(100, [1, 1, 1])).toEqual([33, 33, 34]);
  });

  it('returns only integers — a fractional paise is unpayable', () => {
    const parts = splitAcross(1_23_456, [15, 20, 30, 20, 15]);
    for (const p of parts) expect(Number.isInteger(p)).toBe(true);
  });
});

describe('rupeesToPaise', () => {
  it('parses rupee strings exactly', () => {
    expect(rupeesToPaise('1234.56')).toBe(123456);
    expect(rupeesToPaise('1234.5')).toBe(123450);
    expect(rupeesToPaise(1234)).toBe(123400);
  });

  it('rejects anything with more than two decimal places', () => {
    expect(() => rupeesToPaise('10.999')).toThrow();
  });
});
