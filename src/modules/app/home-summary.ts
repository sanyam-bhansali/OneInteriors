/**
 * The customer's home in one line, from their brief: what the phone app's
 * "Me" header shows (`GET /api/app/v1/me`) and what GEIO is told about the
 * flat (`geio-facts.ts`). Pure, and tested.
 *
 * The brief records the society and the locality, not a flat number, so the
 * label is "Gera World of Joy, Kharadi" rather than an address. Nothing here
 * is guessed: a field the customer did not answer stays null.
 */

import { localityLabel, propertyLabel, scopeLabel } from '@/modules/brief/types';

/** The brief's home answers, as the server reads them: paise as numbers, dates as ISO strings. */
export interface HomeBrief {
  propertyType: string | null;
  carpetAreaSqft: number | null;
  locality: string | null;
  society: string | null;
  scope: string | null;
  scopeRooms: string[];
  tier: string | null;
  budgetMinPaise: number | null;
  budgetMaxPaise: number | null;
  possessionStatus: string | null;
  possessionOn: string | null;
}

export type HomeTier = 'essential' | 'premium' | 'luxury';

export interface HomeSummary {
  label: string | null;
  locality: string | null;
  bhk: string | null;
  carpetSqft: number | null;
  tier: HomeTier | null;
  /** Only the full-home scope; kitchen & wardrobes, one room and a renovation are not. */
  fullHome: boolean;
}

const TIERS: Record<string, HomeTier> = { ESSENTIAL: 'essential', PREMIUM: 'premium', LUXURY: 'luxury' };

export function homeSummary(brief: HomeBrief | null): HomeSummary | null {
  if (!brief) return null;
  const locality = localityLabel(brief.locality);
  const society = brief.society?.trim() || null;
  const parts = [society, locality].filter((p): p is string => Boolean(p));
  // "OTHER" is in the database enum but means nothing to show.
  const bhk = brief.propertyType && brief.propertyType !== 'OTHER' ? propertyLabel(brief.propertyType) : null;
  return {
    label: parts.length ? parts.join(', ') : null,
    locality,
    bhk,
    carpetSqft: brief.carpetAreaSqft && brief.carpetAreaSqft > 0 ? brief.carpetAreaSqft : null,
    tier: (brief.tier && TIERS[brief.tier]) || null,
    fullHome: brief.scope === 'FULL_HOME',
  };
}

/** "Full home" or "One room (Kitchen, Master bedroom)" — for the model, not a screen. */
export function scopeLine(brief: HomeBrief): string | null {
  const label = scopeLabel(brief.scope);
  if (!label) return null;
  const named = (brief.scope === 'FULL_HOME' ? [] : brief.scopeRooms).map((r) => r.toLowerCase().replace(/_/g, ' ')).join(', ');
  return named ? `${label} (${named})` : label;
}
