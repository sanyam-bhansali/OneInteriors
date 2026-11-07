import { gate, json, signedIn } from '@/modules/app-api/http';
import { discoverContext, withPrice } from '@/modules/discover/server';
import { TIER, tierRangeFor } from '@/modules/quotation/tiers';
import { cleanSaves, nextPins, revealStyle } from '@/modules/discover/feed';
import { DISCOVER_ROOMS, type DiscoverRoom } from '@/modules/discover/pins';

/**
 * POST /api/app/v1/discover/next — the next rooms for the phone feed, ranked
 * by the same rules as the website (modules/discover/feed.ts), and what the
 * saves say so far. Body: { saved, skipped, seen, room?, count? }.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const g = gate('project');
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const saved = cleanSaves(body.saved);
  const skipped = cleanSaves(body.skipped, 2000);
  const seen = new Set([...cleanSaves(body.seen, 2000), ...saved, ...skipped]);
  const room = (DISCOVER_ROOMS as readonly string[]).includes(String(body.room)) ? (body.room as DiscoverRoom) : null;
  const count = Math.min(30, Math.max(1, Number(body.count) || 12));

  const ctx = await discoverContext();
  const pins = nextPins(ctx.pins, { saved, skipped }, seen, count, room);
  const after = new Set([...seen, ...pins.map((p) => p.id)]);
  const exhausted = nextPins(ctx.pins, { saved, skipped }, after, 1, room).length === 0;
  const reveal = revealStyle(ctx.pins, saved, exhausted);
  const revealPrice = reveal.tier ? { label: TIER[reveal.tier].label, ...tierRangeFor(reveal.tier, ctx.sqft) } : null;
  return json({ ok: true, pins: pins.map((p) => withPrice(p, ctx.sqft)), exhausted, reveal: { ...reveal, price: revealPrice } });
}
