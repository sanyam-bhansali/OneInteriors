import { describe, it, expect } from 'vitest';
import { STUDIOS } from '@/data/studios';
import { OPS_ONLY, publicStudio } from '@/modules/studio/public';
import { rankStudios } from '@/modules/matching/score';
import { EMPTY_BRIEF } from '@/modules/brief/types';
import { filedRatesFor } from '@/data/filed-rates';

describe('what the customer’s browser receives about a studio', () => {
  const opsLoaded = {
    ...STUDIOS[0]!,
    pausedReason: 'Chasing an unpaid invoice',
    capacityPerMonth: 4,
    gstinNote: 'Below the threshold',
    portfolioShortfallNote: 'Two homes under a previous practice',
    hiddenAsTestAt: null,
  };

  it('never carries an ops-only field', () => {
    const json = JSON.stringify(publicStudio(opsLoaded));
    expect(json).not.toContain('unpaid invoice');
    expect(json).not.toContain('Below the threshold');
    expect(json).not.toContain('previous practice');
    for (const key of OPS_ONLY) {
      const v = (publicStudio(opsLoaded) as unknown as Record<string, unknown>)[key];
      expect(v ?? null, key).toBeNull();
    }
  });

  it('ranks exactly as the full record does', () => {
    const brief = { ...EMPTY_BRIEF, propertyType: 'BHK_3' as const, locality: 'kharadi', styleLikes: ['warm-modern' as const], tier: 'PREMIUM' as const };
    const opts = { today: new Date('2026-09-30'), ratesFor: filedRatesFor };
    const full = rankStudios(brief, STUDIOS, 99, opts).map((r) => [r.studioId, r.score]);
    const pub = rankStudios(brief, STUDIOS.map(publicStudio), 99, opts).map((r) => [r.studioId, r.score]);
    expect(pub).toEqual(full);
  });

  it('keeps a pause as a flag, so a paused studio is still left out', () => {
    expect(publicStudio({ ...STUDIOS[0]!, pausedAt: '2026-09-01T00:00:00Z' }).pausedAt).toBeTruthy();
  });
});
