import { call } from '../api';
import type { Brief } from '../brief-types';
import type { MatchesView, StudioCard } from './types';

/**
 * This area's calls to /api/app/v1 (docs/APP-API-JOURNEY.md): every studio
 * scored on the brief (All studios, #16) and one studio's profile (#17). The
 * matches themselves come from the shared provider (matches-hook.tsx).
 */

/**
 * GET /studios/:slug, copied from the website's src/modules/app/journey-view.ts
 * (React Native cannot import from src/). Change one, change the other.
 */
export interface StudioProfile {
  slug: string;
  name: string;
  area: string | null;
  since: number | null;
  team: number | null;
  photo: string | null;
  about: string | null;
  verified: boolean;
  portfolio: { photo: string; caption: string | null; isRender: boolean }[];
  checks: { label: string; passed: boolean; source: string | null; checkedAt: string | null }[];
  delivery: { completed: number; avgLateDays: number | null; line: string | null };
  /** Only customers whose project went through One Interiors can review, after handover. None yet. */
  reviews: { name: string; stars: number; text: string; at: string }[];
}

/**
 * POST /journey/matches also sends `ratesReal` ("As built"): false while
 * studios are priced on pre-launch archive rates. Not yet in types.ts.
 */
export type MatchesWithRates = MatchesView & { ratesReal?: boolean };

export const matchesApi = {
  /** Every listed studio, best match first; `score` is null until the brief is finished. */
  studios: (brief: Brief) => call<{ studios: StudioCard[] }>('POST', '/journey/studios', { brief }),
  /** One listed studio; the server answers 404 for one that is paused, unverified or unknown. */
  studio: (slug: string) => call<{ studio: StudioProfile | null }>('GET', `/studios/${encodeURIComponent(slug)}`),
};
