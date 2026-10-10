import { gate, json, signedIn } from '@/modules/app-api/http';
import { openedSiteUpdate } from '@/modules/engagement/coins';

/**
 * POST /api/app/v1/coins/opened — the customer opened today's site update.
 * 10 Home Coins a day when there is an update that day, and the 7-day streak
 * bonus; once a day however often it is called.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const g = gate();
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  return json({ ok: true, ...(await openedSiteUpdate(me.user.id)) });
}
