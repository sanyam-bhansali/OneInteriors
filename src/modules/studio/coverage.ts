/**
 * Where a customer would find too few studios — band × zone × scope.
 *
 * The match page promises three to six studios. A customer who picks Luxury,
 * lives in the south and wants a renovation meets whatever this grid says for
 * that cell, and ops should see a thin cell before a customer does — it is a
 * recruitment list, not a report.
 *
 * A studio counts in a cell when it is live (active, not paused, not hidden
 * as a test record), its band is confirmed, it works in that zone (one of its
 * areas is there, or it takes homes anywhere in Pune) and it takes that kind
 * of work. A studio that has not said which kinds of work it takes counts for
 * none — "not said" is not "everything".
 *
 * Pure, and tested.
 */

import { zoneOf, ZONE_LABELS, type PuneZone, type ScopeType } from '@/modules/brief/types';
import { TIERS, type Tier } from '@/modules/quotation/tiers';
import { SCOPES } from './matching-profile';
import type { Studio } from './types';

export const ZONES = Object.keys(ZONE_LABELS) as PuneZone[];

/** Fewer than this in a cell and the match page cannot keep its promise. */
export const THIN_BELOW = 3;

export interface Cell {
  band: Tier;
  zone: PuneZone;
  scope: ScopeType;
  studios: string[];
}

function live(s: Studio): boolean {
  return s.status === 'ACTIVE' && !s.pausedAt && !s.hiddenAsTestAt;
}

export function zonesServed(s: Studio): PuneZone[] {
  if (s.matchingProfile?.cityWide) return ZONES;
  return [...new Set(s.localities.map(zoneOf).filter((z): z is PuneZone => z !== null))];
}

export function coverage(studios: Studio[]): Cell[] {
  const cells: Cell[] = [];
  const eligible = studios.filter((s) => live(s) && s.band);
  for (const band of TIERS) {
    for (const zone of ZONES) {
      for (const scope of SCOPES) {
        cells.push({
          band,
          zone,
          scope,
          studios: eligible
            .filter((s) => s.band === band && zonesServed(s).includes(zone) && (s.matchingProfile?.scopes ?? []).includes(scope))
            .map((s) => s.tradeName),
        });
      }
    }
  }
  return cells;
}

/** The live studios that cannot be placed anywhere yet, and why. */
export function unplaced(studios: Studio[]): { name: string; slug: string; why: string }[] {
  const out: { name: string; slug: string; why: string }[] = [];
  for (const s of studios.filter(live)) {
    if (!s.band) out.push({ name: s.tradeName, slug: s.slug, why: 'band not confirmed' });
    else if ((s.matchingProfile?.scopes ?? []).length === 0) out.push({ name: s.tradeName, slug: s.slug, why: 'has not said which work it takes' });
    else if (zonesServed(s).length === 0) out.push({ name: s.tradeName, slug: s.slug, why: 'no areas we recognise' });
  }
  return out;
}
