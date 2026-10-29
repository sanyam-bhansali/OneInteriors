import { describe, expect, it } from 'vitest';
import { designLengthFor, effectivePriority, scaledGaps, HAUSPIRE_DESIGN } from '@/modules/studio-design/template';
import { parseDesignDays } from '@/modules/project/own-project-rules';
import { templateStages } from '@/modules/portal/quote-to-plan';

/** The design team walkthrough, 27 Oct 2026 (plan approved 29 Oct). */

describe('Design done in N days (item 2)', () => {
  it('scales every step to end on the days asked, keeping same-day steps together', () => {
    const days = [0, 1, 2, 0, 3];
    expect(scaledGaps(days, 2).reduce((a, b) => a + b, 0)).toBe(6);
    const twelve = scaledGaps(days, 2, 12);
    expect(twelve.reduce((a, b) => a + b, 0)).toBe(12);
    expect(twelve[3]).toBe(0);
    expect(scaledGaps(days, 3, null).reduce((a, b) => a + b, 0)).toBe(Math.round(6 * 1.2));
  });

  it('the design stage lasts exactly that long, and its last step lands on its end', () => {
    const start = new Date('2026-10-27T00:00:00+05:30');
    const stages = templateStages(start, 120, { template: HAUSPIRE_DESIGN, bhk: 3, days: 40, payments: [] });
    const design = stages.find((s) => s.kind === 'DESIGN')!;
    expect(Math.round((design.plannedEnd.getTime() - design.plannedStart.getTime()) / 86_400_000)).toBe(40);
    expect(designLengthFor(HAUSPIRE_DESIGN, 3, 40)).toBe(40);
  });

  it('left out, it is the steps’ own length for the flat; asked for, 3 to 365', () => {
    expect(parseDesignDays('', 48)).toBe(48);
    expect(parseDesignDays('40', 48)).toBe(40);
    expect(parseDesignDays('2', 48)).toBe(false);
    expect(parseDesignDays('400', 48)).toBe(false);
    expect(parseDesignDays('4.5', 48)).toBe(false);
  });
});

describe('Default stars from the category (item 18)', () => {
  it('Luxe 5, Premium 4, Essential 3, unless someone set them', () => {
    expect(effectivePriority(null, 'LUXURY')).toBe(5);
    expect(effectivePriority(null, 'PREMIUM')).toBe(4);
    expect(effectivePriority(null, 'ESSENTIAL')).toBe(3);
    expect(effectivePriority(2, 'LUXURY')).toBe(2);
    expect(effectivePriority(null, null)).toBeNull();
  });
});
