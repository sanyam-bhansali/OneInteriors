import { describe, it, expect } from 'vitest';
import {
  advanceIsHigh,
  checkPhases,
  parsePhasesText,
  phaseAmounts,
  phasesText,
  readPhases,
} from '@/modules/studio/payment-phases';

const FOUR = [
  { label: 'Booking', pct: 10 },
  { label: 'Design sign-off', pct: 40 },
  { label: 'Material delivery', pct: 40 },
  { label: 'Handover', pct: 10 },
];

describe('parsePhasesText', () => {
  it('reads terms the way studios write them', () => {
    expect(parsePhasesText('10% booking, 40% design sign-off, 40% on material delivery, 10% handover')).toEqual([
      { label: 'Booking', pct: 10 },
      { label: 'Design sign-off', pct: 40 },
      { label: 'Material delivery', pct: 40 },
      { label: 'Handover', pct: 10 },
    ]);
    expect(parsePhasesText('Booking 50%\nHandover 50%')).toEqual([
      { label: 'Booking', pct: 50 },
      { label: 'Handover', pct: 50 },
    ]);
  });

  it('refuses a part with no percentage rather than guessing', () => {
    expect(parsePhasesText('10% booking, the rest at handover')).toBeNull();
    expect(parsePhasesText('')).toBeNull();
  });

  it('round-trips through the words', () => {
    expect(parsePhasesText(phasesText(FOUR))).toEqual(FOUR);
  });
});

describe('checkPhases', () => {
  it('accepts a schedule that sums to 100', () => {
    expect(checkPhases(FOUR)).toBeNull();
  });
  it('says what is wrong', () => {
    expect(checkPhases([{ label: 'Booking', pct: 10 }, { label: 'Handover', pct: 80 }])).toMatch(/90%/);
    expect(checkPhases([{ label: 'All', pct: 100 }])).toMatch(/At least 2/);
    expect(checkPhases([{ label: '', pct: 50 }, { label: 'x', pct: 50 }])).toMatch(/name/);
  });
});

describe('readPhases', () => {
  it('treats a broken stored schedule as none', () => {
    expect(readPhases(FOUR)).toEqual(FOUR);
    expect(readPhases([{ label: 'Booking', pct: 20 }])).toBeNull();
    expect(readPhases('10% booking')).toBeNull();
    expect(readPhases(null)).toBeNull();
  });
});

describe('phaseAmounts', () => {
  it('adds up to the total exactly, to the paise', () => {
    const total = 6_16_333_17;
    const amounts = phaseAmounts(FOUR, total);
    expect(amounts.reduce((a, p) => a + p.amountPaise, 0)).toBe(total);
    expect(amounts[0]!.amountPaise).toBe(6_163_300);
  });
});

describe('advanceIsHigh', () => {
  it('flags more than 30% at booking', () => {
    expect(advanceIsHigh(FOUR)).toBe(false);
    expect(advanceIsHigh([{ label: 'Booking', pct: 50 }, { label: 'Handover', pct: 50 }])).toBe(true);
  });
});
