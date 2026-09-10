import { describe, it, expect } from 'vitest';
import { WAIT_LINES, WAIT_MOMENTS, waitLine } from '@/lib/wait-lines';

const ALL = WAIT_MOMENTS.flatMap((m) => WAIT_LINES[m]);

describe('wait lines', () => {
  /**
   * THE test in this file.
   *
   * Naming a competitor in a joke turns a shared observation into a claim about
   * a specific company — a legal problem, and a positioning one: punching at a
   * named rival makes us look like the smaller party. The temptation to add a
   * sharper line grows the more confident everyone gets about the product,
   * which is exactly when nobody re-reads the rules at the top of the module.
   */
  it('names no competitor', () => {
    const forbidden = [
      'livspace',
      'homelane',
      'home lane',
      'magicinteriors',
      'magic interiors',
      'houzz',
      'urbanclap',
      'urban company',
      'designcafe',
      'design cafe',
      'bonito',
      'pepperfry',
      'asian paints',
      'beautiful homes',
      'nobroker',
      'no broker',
    ];
    for (const line of ALL) {
      const lower = line.toLowerCase();
      for (const name of forbidden) {
        expect(lower, line).not.toContain(name);
      }
    }
  });

  /**
   * A joke about money on the screen immediately before we show someone a
   * nine-lakh-rupee figure reads as flippancy about their money. The lines may
   * describe the industry's behaviour; they may not be funny about the amount.
   *
   * "ten percent" in the compare set is allowed deliberately — it describes the
   * width of our own error bar, not what anyone is spending.
   */
  it('makes no joke about a rupee figure', () => {
    for (const line of ALL) {
      expect(line, line).not.toMatch(/₹|lakh|crore|rupee|\d[\d,]{4,}/i);
    }
  });

  it('covers every moment, with enough lines that a second visit is not a repeat', () => {
    for (const moment of WAIT_MOMENTS) {
      expect(WAIT_LINES[moment].length, moment).toBeGreaterThanOrEqual(8);
    }
  });

  /**
   * Duplicates across moments would defeat the point of keying them: the whole
   * reason for three sets is that each answers a different live objection, and
   * a line shared between two of them is by definition answering neither
   * specifically.
   */
  it('uses each line in exactly one moment', () => {
    expect(new Set(ALL).size).toBe(ALL.length);
  });

  // Long enough to be a sentence, short enough to read in the time a page takes
  // to load. Past about 130 characters nobody finishes it.
  it('keeps every line readable at a glance', () => {
    for (const line of ALL) {
      expect(line.length, line).toBeGreaterThan(20);
      expect(line.length, line).toBeLessThanOrEqual(130);
      expect(line, line).toMatch(/[.!?]$/);
    }
  });

  it('picks a real line for every position in every moment', () => {
    for (const moment of WAIT_MOMENTS) {
      const lines = WAIT_LINES[moment];
      for (let i = 0; i < lines.length; i += 1) {
        expect(waitLine(moment, () => i / lines.length)).toBe(lines[i]);
      }
    }
  });

  /**
   * A picker that misbehaves must not put `undefined` on the screen.
   * Math.random cannot return 1, but the parameter exists so callers can supply
   * their own.
   */
  it('survives a picker that returns out-of-range values', () => {
    for (const moment of WAIT_MOMENTS) {
      expect(WAIT_LINES[moment]).toContain(waitLine(moment, () => 1));
      expect(WAIT_LINES[moment]).toContain(waitLine(moment, () => 1.7));
      expect(WAIT_LINES[moment]).toContain(waitLine(moment, () => -3));
    }
  });
});
