import { describe, it, expect } from 'vitest';
import { styleDna, whatsappShare } from '@/modules/brief/style-dna';

describe('style DNA', () => {
  it('turns ordered likes into shares that add up to 100', () => {
    const dna = styleDna(['warm-modern', 'japandi', 'indian-contemporary'])!;
    expect(dna.shares.map((s) => s.pct).reduce((a, b) => a + b, 0)).toBe(100);
    expect(dna.shares[0]!.pct).toBeGreaterThan(dna.shares[2]!.pct);
    expect(dna.palette).toHaveLength(5);
    expect(dna.materials).toHaveLength(3);
  });

  it('shares only the styles and a link — never a name or a number', () => {
    const dna = styleDna(['japandi'])!;
    expect(dna.shares[0]!.pct).toBe(100);
    expect(dna.shareText).toBe("My home's style DNA: 100% Japandi. Find yours in four minutes: https://oneinteriors.in/quiz");
    expect(whatsappShare(dna.shareText)).toMatch(/^https:\/\/wa\.me\/\?text=My%20home/);
  });

  it('is nothing without a like', () => {
    expect(styleDna([])).toBeNull();
  });
});
