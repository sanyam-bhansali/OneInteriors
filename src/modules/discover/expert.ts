import 'server-only';

/**
 * The rooms a customer saved in Discover, for the expert's call card
 * (owner, 7 Nov 2026): the pictures, newest first, and the style the feed
 * read from them, in one line.
 *
 * Pins are looked up against the whole roster, not the matching gate: a room
 * saved last week from a studio since paused is still what they loved. A pin
 * that no longer exists (a photo removed, consent withdrawn) is left out.
 */

import { cachedRoster } from '@/modules/studio/roster-cache';
import { discoverPins, type Pin } from './pins';
import { revealStyle } from './feed';
import { readSaves } from './saves';

export async function savedRooms(briefId: string): Promise<{ pins: Pin[]; style: string | null }> {
  const ids = await readSaves(briefId);
  if (ids.length === 0) return { pins: [], style: null };
  const all = discoverPins(await cachedRoster());
  const byId = new Map(all.map((p) => [p.id, p]));
  const pins = [...ids].reverse().map((id) => byId.get(id)).filter((p): p is Pin => p !== undefined);
  const reveal = revealStyle(all, ids);
  const style = reveal.shares.length
    ? `${reveal.shares.map((s) => `${s.label} ${s.pct}%`).join(' · ')}${reveal.ready ? '' : ' (early read, under 20 saves)'}`
    : null;
  return { pins, style };
}
