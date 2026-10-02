import { describe, it, expect } from 'vitest';
import { STUDIOS } from '@/data/studios';
import { filedRatesFor } from '@/data/filed-rates';
import { bandFromRates } from '@/modules/studio/band';
import { readProfile } from '@/modules/studio/matching-profile';
import { TIERS } from '@/modules/quotation/tiers';
import { STYLE_TAGS, zoneOf } from '@/modules/brief/types';

/**
 * The invented roster is what the new matcher is built against, so its
 * spread is a contract: every band, several zones per band, every scope.
 */
describe('the fixture roster', () => {
  it('has about fifteen studios', () => {
    expect(STUDIOS.length).toBeGreaterThanOrEqual(15);
  });

  it("gives every studio the band its own rates give", () => {
    for (const s of STUDIOS) {
      expect({ slug: s.slug, band: bandFromRates(filedRatesFor(s.slug))?.tier }).toEqual({ slug: s.slug, band: s.band });
    }
  });

  it('has at least three studios in every band, across at least two zones', () => {
    for (const tier of TIERS) {
      const inBand = STUDIOS.filter((s) => s.band === tier);
      expect(inBand.length, tier).toBeGreaterThanOrEqual(3);
      const zones = new Set(inBand.flatMap((s) => s.localities.map(zoneOf)));
      expect(zones.size, tier).toBeGreaterThanOrEqual(2);
    }
  });

  it('offers every scope in every band', () => {
    for (const tier of TIERS) {
      const scopes = new Set(STUDIOS.filter((s) => s.band === tier).flatMap((s) => s.matchingProfile?.scopes ?? []));
      expect([...scopes].sort(), tier).toEqual(['FULL_HOME', 'KITCHEN_WARDROBE', 'RENOVATION', 'SINGLE_ROOM']);
    }
  });

  it('stores only what the profile reader would keep, and known localities and styles', () => {
    for (const s of STUDIOS) {
      expect(readProfile(JSON.parse(JSON.stringify(s.matchingProfile)))).toEqual(s.matchingProfile);
      for (const l of s.localities) expect(zoneOf(l), `${s.slug}: ${l}`).not.toBeNull();
      for (const p of s.portfolio) for (const t of p.styleTags) expect(STYLE_TAGS).toContain(t);
    }
  });

  it('includes modular, carpentry and mixed studios', () => {
    const mixes = new Set(STUDIOS.map((s) => s.matchingProfile?.workMix));
    expect(mixes).toEqual(new Set(['MODULAR', 'CARPENTRY', 'MIXED']));
  });
});
