import 'server-only';

/**
 * The Discover feed for whoever is asking — the website page and the phone
 * app's API both start here, so both show the same rooms by the same gate.
 */

import { cachedRoster } from '@/modules/studio/roster-cache';
import { showUnverifiedStudios } from '@/lib/env';
import { loadBrief, saveBrief } from '@/modules/brief/repository';
import { carpetAreaFor } from '@/modules/brief/steps';
import { STYLE_TAGS, type StyleTag } from '@/modules/brief/types';
import { discoverPins, type Pin } from './pins';
import { readSaves } from './saves';
import { TIER, tierRangeFor } from '@/modules/quotation/tiers';

export interface DiscoverContext {
  pins: Pin[];
  sqft: number;
  sqftAssumed: boolean;
  hasProfile: boolean;
  briefId: string | null;
  saved: string[];
}

export async function discoverContext(): Promise<DiscoverContext> {
  const [roster, { brief, found, id }] = await Promise.all([cachedRoster(), loadBrief()]);
  // The same gate as matching: unverified or paused studios' rooms stay out.
  const allowUnverified = showUnverifiedStudios();
  const studios = roster.filter(
    (s) => !s.pausedAt && (allowUnverified || (s.status === 'ACTIVE' && s.tier !== 'UNVERIFIED')),
  );
  const area = carpetAreaFor(brief);
  return {
    pins: discoverPins(studios, brief.styleDislikes),
    sqft: area.sqft,
    sqftAssumed: area.assumed,
    hasProfile: found,
    briefId: found && id ? id : null,
    saved: found && id ? await readSaves(id) : [],
  };
}

/**
 * "Use this style": the revealed styles become what they like, and the
 * studios whose real rooms they saved become evidence for matching. A style
 * they ruled out is never added back.
 */
export async function applyStyle(styles: unknown, studioIds: unknown): Promise<boolean> {
  const tags = Array.isArray(styles)
    ? styles.filter((s): s is StyleTag => typeof s === 'string' && (STYLE_TAGS as readonly string[]).includes(s))
    : [];
  const studios = Array.isArray(studioIds) ? studioIds.filter((s): s is string => typeof s === 'string').slice(0, 3) : [];
  if (tags.length === 0) return false;
  const { brief, found } = await loadBrief();
  if (!found) return false;
  const banned = new Set(brief.styleDislikes);
  const likes = [...new Set(tags)].filter((t) => !banned.has(t)).slice(0, 3);
  if (likes.length === 0) return false;
  const result = await saveBrief({
    ...brief,
    styleLikes: likes,
    styleStudioPicks: [...new Set([...studios, ...(brief.styleStudioPicks ?? [])])].slice(0, 6),
  });
  return result.persisted;
}

/** A pin with its price for this home, ready for the phone to print. */
export function withPrice(pin: Pin, sqft: number) {
  if (!pin.tier) return { ...pin, price: null };
  const { lowPaise, highPaise } = tierRangeFor(pin.tier, sqft);
  return { ...pin, price: { label: TIER[pin.tier].label, lowPaise, highPaise } };
}
