/**
 * The first visit's shapes as /api/app/v1 sends them, copied from the
 * website's src/modules/app/journey-view.ts (React Native cannot import from
 * src/). Shared by the matches, quote and choose screens. Change one, change
 * the other; docs/APP-API-JOURNEY.md is the contract.
 */

export interface ApiQuote {
  totalPaise: number;
  beforeGstPaise: number;
  gstPaise: number;
  /** The honest band either side of the total, until the studio measures. */
  lowPaise: number;
  highPaise: number;
  validTill: string;
  lines: { room: string; item: string; spec: string | null; size: string; amountPaise: number }[];
}

export interface StudioCard {
  slug: string;
  name: string;
  area: string | null;
  /** The year they started, from the years they have practised. */
  since: number | null;
  team: number | null;
  /** 0–100 on this brief; null when there is no finished brief to score. */
  score: number | null;
  reasons: string[];
  photo: string | null;
  /** Verified reviews only. None exist yet, so always null for now. */
  rating: { stars: number; count: number } | null;
  /** Homes handed over through One Interiors. */
  homes: number;
  checks: { passed: number; total: number };
  lateness: string | null;
  /** Their own band, when known — for the app's client-side filters. */
  band: 'essential' | 'premium' | 'luxury' | null;
  localities: string[];
}

export type ApiMatch = StudioCard & { score: number; quote: ApiQuote };

export interface MatchesView {
  /** False while studios are priced on pre-launch archive rates; the screens say so. */
  ratesReal: boolean;
  studioCount: number;
  tiers: Record<'essential' | 'premium' | 'luxury', ApiMatch[]>;
  tier: 'essential' | 'premium' | 'luxury';
  style: { primary: { tag: string; label: string; pct: number }; secondary: { tag: string; label: string; pct: number } | null } | null;
}
