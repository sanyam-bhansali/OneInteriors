import { gate, json, signedIn } from '@/modules/app-api/http';
import { discoverContext, withPrice } from '@/modules/discover/server';
import type { Pin } from '@/modules/discover/pins';

/**
 * GET /api/app/v1/discover — the phone app's Discover screen (owner, 7 Nov
 * 2026): whether they have a Home Profile, the home size prices are for, and
 * the rooms already saved (kept on the Home Profile, shared with the website).
 * The feed itself comes from POST /discover/next, ranked on the server.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const g = gate('project');
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const ctx = await discoverContext();
  const byId = new Map(ctx.pins.map((p) => [p.id, p]));
  const savedPins = ctx.saved.map((id) => byId.get(id)).filter((p): p is Pin => p !== undefined);
  return json({
    ok: true,
    hasProfile: ctx.hasProfile,
    sqft: ctx.sqft,
    sqftAssumed: ctx.sqftAssumed,
    saved: savedPins.map((p) => p.id),
    savedPins: savedPins.map((p) => withPrice(p, ctx.sqft)),
  });
}
