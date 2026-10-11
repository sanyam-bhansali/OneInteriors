import { useEffect } from 'react';
import { call } from '../api';
import { useBrief } from '../brief';
import type { Brief } from '../brief-types';
import { useMatches } from './matches-hook';
import type { ApiMatch } from './types';

/**
 * This area's calls to /api/app/v1 (docs/APP-API-JOURNEY.md): verifying the
 * number with the brief and its consent, keeping the chosen studios, the
 * comparison, and the expert call. Screens: journey/phone, quote, compare,
 * expert.
 */

/** Copied from the website's src/modules/app/journey-view.ts (`CompareView`), plus the route's `ratesReal`. */
export interface CompareView {
  plainWords: string[];
  columns: {
    slug: string;
    name: string;
    totalPaise: number;
    board: string | null;
    shutter: string | null;
    counter: string | null;
    weeks: number | null;
    /** journey.ts lateness(): "Usually 4 days late", "Usually on time", "Usually 2 days early", or null with no record. */
    lateness: string | null;
    /** "15/15" */
    checks: string;
  }[];
  ratesReal?: boolean;
}

/** GET /expert/slots (src/app/api/app/v1/expert/slots/route.ts): open half-hours by IST day. */
export interface ExpertSlots {
  expert: { name: string; photo: string | null; line: string };
  /** `date` is the IST day (YYYY-MM-DD); `label` the IST time, "11:30 am". */
  days: { date: string; slots: { startsAt: string; label: string }[] }[];
}

export interface Booking {
  startsAt: string;
  label: string;
}

export interface Consent {
  /** Share the brief with these studios (required, DPDP). */
  share: boolean;
  /** Tips and offers (optional). The server stores it as the marketing consent. */
  offers: boolean;
}

export const quoteApi = {
  /** The first visit's verification: signs in and, with `share` true, saves the brief, name and number onto the account. */
  verifyWithBrief: (phone: string, code: string, name: string, brief: Brief, consent: Consent) =>
    call<{ token: string }>('POST', '/auth/otp/verify', { phone, code, name, brief, consent }),
  /** Keeps the matches and first quotes, and these studios as the shortlist, so the expert reads the same three. */
  submit: (slugs: string[]) => call<{ shortlisted: number }>('POST', '/journey/submit', { slugs }),
  compare: (brief: Brief, slugs: string[]) => call<CompareView>('POST', '/journey/compare', { brief, slugs }),
  slots: () => call<ExpertSlots>('GET', '/expert/slots'),
  /** 409: somebody took the slot (or the account has no brief or number). */
  book: (startsAt: string, slugs: string[]) => call<{ booking: Booking }>('POST', '/expert/book', { startsAt, slugs }),
};

/**
 * The three studios of the tier the customer chose on Matches (else the
 * brief's own tier), each with its first quote. Loads the matches if this
 * screen was opened first (a reload, a deep link).
 */
export function useChosenMatches(): { status: 'loading' | 'error' | 'ready'; matches: ApiMatch[]; error?: string; retry: () => void } {
  const { state, load, tier } = useMatches();
  const { brief, ready } = useBrief();
  // Fetched for the stored brief once it has been read, and again if it changed since.
  const stale = ready && (state.status === 'idle' || (state.status === 'ready' && state.key !== JSON.stringify(brief)));
  useEffect(() => {
    if (stale) void load();
  }, [stale, load]);
  if (state.status === 'error') return { status: 'error', matches: [], error: state.error, retry: () => void load() };
  if (state.status !== 'ready' || stale) return { status: 'loading', matches: [], retry: () => void load() };
  const view = state.view;
  const matches = view.tiers?.[tier ?? view.tier] ?? [];
  return { status: 'ready', matches, retry: () => void load() };
}

/** Whether the studios are priced on pre-launch archive rates (the server's `ratesReal`, not yet in the shared MatchesView type). */
export function ratesArePreLaunch(view: unknown): boolean {
  return (view as { ratesReal?: boolean } | null)?.ratesReal === false;
}
