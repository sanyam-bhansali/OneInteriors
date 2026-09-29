import { describe, it, expect } from 'vitest';
import { STUDIOS } from '@/data/studios';
import { coverage, unplaced, zonesServed, THIN_BELOW } from '@/modules/studio/coverage';
import { EMPTY_PROFILE } from '@/modules/studio/matching-profile';

const cell = (cells: ReturnType<typeof coverage>, band: string, zone: string, scope: string) =>
  cells.find((c) => c.band === band && c.zone === zone && c.scope === scope)!;

describe('coverage', () => {
  it('counts a studio in every zone it serves, for the work it takes, in its band', () => {
    const cells = coverage(STUDIOS);
    expect(cell(cells, 'PREMIUM', 'east', 'FULL_HOME').studios).toContain('Vaastu Atelier');
    // Kosha takes homes anywhere in Pune.
    expect(cell(cells, 'PREMIUM', 'south', 'RENOVATION').studios).toContain('Kosha Interiors');
    // Stone & Sill does not do renovation.
    expect(cell(cells, 'LUXURY', 'west', 'RENOVATION').studios).not.toContain('Stone & Sill');
  });

  it('leaves out studios that are paused, hidden or unconfirmed', () => {
    const vaastu = STUDIOS.find((s) => s.slug === 'vaastu-atelier')!;
    const variants = [
      { ...vaastu, pausedAt: '2026-09-01T00:00:00Z' },
      { ...vaastu, hiddenAsTestAt: '2026-09-01T00:00:00Z' },
      { ...vaastu, band: null },
    ];
    for (const v of variants) {
      expect(cell(coverage([v]), 'PREMIUM', 'east', 'FULL_HOME').studios).toEqual([]);
    }
  });

  it('does not treat "not said" as "everything"', () => {
    const quiet = { ...STUDIOS[0]!, matchingProfile: EMPTY_PROFILE };
    expect(coverage([quiet]).every((c) => c.studios.length === 0)).toBe(true);
    expect(unplaced([quiet])[0]!.why).toMatch(/which work/);
  });

  it('city-wide means every zone', () => {
    const marigold = STUDIOS.find((s) => s.slug === 'marigold-house')!;
    expect(zonesServed(marigold)).toHaveLength(6);
  });

  it('finds the thin cells on the sample roster', () => {
    const thin = coverage(STUDIOS).filter((c) => c.studios.length < THIN_BELOW);
    expect(thin.length).toBeGreaterThan(0);
  });
});
